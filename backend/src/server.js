import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './db.js';

import vinRoutes from './routes/vin.js';
import invoiceRoutes from './routes/invoices.js';
import servicesRoutes from './routes/services.js';

const app = express();
const PORT = process.env.PORT || 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

initializeDatabase();

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'VIN Decoder API is running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      vehicles: '/api/vehicles',
      invoices: '/api/invoices',
      services: '/api/services'
    }
  });
});

app.use('/api/vehicles', vinRoutes);
app.use('/api/invoices', invoiceRoutes);
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
      invoices: 'GET /api/invoices, POST /api/invoices'
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

app.listen(PORT, () => {
  console.log(`VIN Decoder API running on http://localhost:${PORT}`);
  console.log(`Database initialized at ${path.join(__dirname, '../data/app.db')}`);
});
