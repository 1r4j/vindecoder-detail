import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { initializeDatabase } from './db.js';

import authRoutes from './routes/auth.js';
import oauthRoutes from './routes/oauth.js';
import vinRoutes from './routes/vin.js';
import servicesRoutes from './routes/services.js';
import invoicesRoutes from './routes/invoices.js';
import customersRoutes from './routes/customers.js';
import settingsRoutes from './routes/settings.js';
import { authMiddleware } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get Vercel URL from environment or use localhost
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
console.log(`🌐 Allowing CORS from frontend: ${frontendUrl}`);

// Rate limiters for security
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth attempts per windowMs
  message: 'Too many login/register attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed requests
});

const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit OAuth attempts
  message: 'Too many OAuth attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://oauth2.googleapis.com', 'https://accounts.google.com'],
      frameSrc: ["'self'", 'accounts.google.com'],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Apply general rate limiter to all requests
app.use(generalLimiter);

// Configure CORS for Google Sign-In with proper headers
const corsOptions = {
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      frontendUrl
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Add custom security headers AFTER cors
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours for preflight caching
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  next();
});

// Explicit OPTIONS handler for preflight requests
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Initialize database with error handling
try {
  initializeDatabase();
  console.log('✅ Database initialization started...');
} catch (err) {
  console.error('❌ Database initialization error:', err.message);
  console.error('Full error:', err);
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'VIN Decoder API is running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      auth: '/api/auth (register, login, logout)',
      vehicles: '/api/vehicles',
      services: '/api/services',
      invoices: '/api/invoices',
      customers: '/api/customers',
      settings: '/api/settings'
    }
  });
});

// Auth routes (public) - with rate limiting
app.use('/api/auth', authLimiter, authRoutes);

// OAuth routes (public) - with rate limiting
app.use('/api/oauth', oauthLimiter, oauthRoutes);

// Protected routes (require authentication)
app.use('/api/vehicles', authMiddleware, vinRoutes);
app.use('/api/invoices', authMiddleware, invoicesRoutes);
app.use('/api/customers', authMiddleware, customersRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);

// Services available to all (no auth required)
app.use('/api/services', servicesRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.method} ${req.path} does not exist`,
    availableEndpoints: {
      root: 'GET /',
      health: 'GET /api/health',
      vehicles: 'GET /api/vehicles/list, POST /api/vehicles/decode',
      services: 'GET /api/services'
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

const server = app.listen(PORT, () => {
  console.log(`✅ VIN Decoder API running on http://localhost:${PORT}`);
  console.log(`✅ Database initialized`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ All routes loaded successfully`);
  console.log(`✅ Ready to accept requests`);
});

// Handle startup errors
server.on('error', (err) => {
  console.error('❌ Server error:', err.message);
  console.error('Full error:', err);
  process.exit(1);
});

// Handle graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n📛 Received ${signal}, starting graceful shutdown...`);
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
};

// Listen for shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err.message);
  console.error('Full error:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
