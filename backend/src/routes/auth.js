import express from 'express';
import { createUser, getUserByEmail, getUserById, verifyPassword } from '../services/userService.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Register a new user
router.post('/register', (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters'
      });
    }

    const user = createUser(email, password, name);
    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      token,
      user
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

// Login user
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    const user = verifyPassword(email, password);
    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

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
