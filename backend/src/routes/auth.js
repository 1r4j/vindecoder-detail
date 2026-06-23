import express from 'express';
import { createUser, getUserByEmail, getUserById, verifyPassword } from '../services/userService.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Register a new user
router.post('/register', (req, res) => {
  try {
    console.log('[AUTH_ROUTE] Register endpoint called');
    const { email, password, name } = req.body;
    console.log('[AUTH_ROUTE] Register request:', { email, name, passwordLength: password?.length });

    if (!email || !password) {
      console.log('[AUTH_ROUTE] Missing email or password');
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    if (password.length < 6) {
      console.log('[AUTH_ROUTE] Password too short');
      return res.status(400).json({
        error: 'Password must be at least 6 characters'
      });
    }

    console.log('[AUTH_ROUTE] Calling createUser...');
    const user = createUser(email, password, name);
    console.log('[AUTH_ROUTE] User created:', { id: user.id, email: user.email });

    const token = generateToken(user.id);
    console.log('[AUTH_ROUTE] Token generated, sending response');

    res.status(201).json({
      success: true,
      token,
      user
    });
  } catch (error) {
    console.error('[AUTH_ROUTE] Register error:', error.message);
    res.status(400).json({
      error: error.message
    });
  }
});

// Login user
router.post('/login', (req, res) => {
  try {
    console.log('[AUTH_ROUTE] Login endpoint called');
    const { email, password } = req.body;
    console.log('[AUTH_ROUTE] Login request for email:', email);

    if (!email || !password) {
      console.log('[AUTH_ROUTE] Missing email or password');
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    console.log('[AUTH_ROUTE] Verifying password...');
    const user = verifyPassword(email, password);
    if (!user) {
      console.log('[AUTH_ROUTE] Invalid credentials');
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    console.log('[AUTH_ROUTE] Password verified, generating token');
    const token = generateToken(user.id);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('[AUTH_ROUTE] Login error:', error.message);
    res.status(400).json({
      error: error.message
    });
  }
});

// Get current user info (protected)
router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = getUserById(req.userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

// Verify token
router.post('/verify', authMiddleware, (req, res) => {
  try {
    const user = getUserById(req.userId);
    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

// Logout (client-side, just for confirmation)
router.post('/logout', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

export default router;
