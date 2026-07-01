import express from 'express';
import { createUser, getUserByEmail, getUserById, verifyPassword } from '../services/userService.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { validateEmail, validatePassword, validateName } from '../utils/validation.js';
import { recordFailedAttempt, isAccountLocked, clearFailedAttempts } from '../utils/accountLockout.js';
import { logAuditEvent, AUDIT_EVENTS } from '../utils/auditLog.js';

const router = express.Router();

// Register a new user
router.post('/register', (req, res) => {
  try {
    console.log('[AUTH_ROUTE] Register endpoint called');
    const { email, password, name } = req.body;

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ error: emailValidation.error });
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    // Validate name
    const nameValidation = validateName(name);
    if (!nameValidation.valid) {
      return res.status(400).json({ error: nameValidation.error });
    }

    console.log('[AUTH_ROUTE] Calling createUser...');
    const user = createUser(emailValidation.email, password, nameValidation.name);
    console.log('[AUTH_ROUTE] User created:', { id: user.id, email: user.email });

    const token = generateToken(user.id);
    console.log('[AUTH_ROUTE] Token generated, sending in response');

    logAuditEvent(AUDIT_EVENTS.REGISTER_SUCCESS, user.id, { email: user.email });

    res.status(201).json({
      success: true,
      token,
      user
    });
  } catch (error) {
    console.error('[AUTH_ROUTE] Register error:', error.message);
    logAuditEvent(AUDIT_EVENTS.REGISTER_FAILED, null, { email: req.body.email, error: error.message });
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

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ error: emailValidation.error });
    }

    const normalizedEmail = emailValidation.email;

    // Check if account is locked
    const lockStatus = isAccountLocked(normalizedEmail);
    if (lockStatus.locked) {
      console.warn(`🔒 Login attempt on locked account: ${normalizedEmail}`);
      logAuditEvent(AUDIT_EVENTS.ACCOUNT_LOCKED, null, { email: normalizedEmail });
      return res.status(429).json({
        error: lockStatus.message
      });
    }

    // Verify password
    console.log('[AUTH_ROUTE] Verifying password...');
    const user = verifyPassword(normalizedEmail, password);
    if (!user) {
      console.log('[AUTH_ROUTE] Invalid credentials, recording failed attempt');
      recordFailedAttempt(normalizedEmail);
      logAuditEvent(AUDIT_EVENTS.LOGIN_FAILED, null, { email: normalizedEmail, reason: 'Invalid credentials' });
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Clear failed attempts on successful login
    clearFailedAttempts(normalizedEmail);
    console.log('[AUTH_ROUTE] Password verified, generating token');
    const token = generateToken(user.id);

    logAuditEvent(AUDIT_EVENTS.LOGIN_SUCCESS, user.id, { email: user.email });

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
    logAuditEvent(AUDIT_EVENTS.LOGIN_FAILED, null, { email: normalizedEmail, error: error.message });
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

// Logout (client handles token cleanup)
router.post('/logout', authMiddleware, (req, res) => {
  logAuditEvent(AUDIT_EVENTS.LOGOUT, req.userId);

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Delete user account and all associated data (protected)
router.post('/delete-account', authMiddleware, (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        error: 'Password is required to delete account'
      });
    }

    const user = getUserById(req.userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Verify password before deletion
    const userWithPassword = verifyPassword(user.email, password);
    if (!userWithPassword) {
      logAuditEvent('ACCOUNT_DELETION_FAILED', req.userId, { reason: 'Invalid password' });
      return res.status(401).json({
        error: 'Invalid password'
      });
    }

    // Delete user and all associated data
    const { deleteUser } = require('../services/userService.js');
    deleteUser(req.userId);

    // Delete all user's invoices
    if (require('../db.js').default.invoices) {
      require('../db.js').default.invoices = require('../db.js').default.invoices.filter(i => i.userId !== req.userId);
    }

    // Delete all user's customers
    if (require('../db.js').default.customers) {
      require('../db.js').default.customers = require('../db.js').default.customers.filter(c => c.userId !== req.userId);
    }

    // Delete all user's vehicles
    if (require('../db.js').default.vehicles) {
      require('../db.js').default.vehicles = require('../db.js').default.vehicles.filter(v => v.userId !== req.userId);
    }

    require('../db.js').default.save();

    logAuditEvent('ACCOUNT_DELETED', req.userId, { email: user.email });

    res.clearCookie('authToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.json({
      success: true,
      message: 'Account and all associated data have been permanently deleted'
    });
  } catch (error) {
    console.error('Account deletion error:', error.message);
    logAuditEvent('ACCOUNT_DELETION_FAILED', req.userId, { error: error.message });
    res.status(400).json({
      error: error.message
    });
  }
});

export default router;
