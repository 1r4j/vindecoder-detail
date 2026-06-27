import express from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

/**
 * Get business settings for current user
 * Protected route - requires authentication
 */
router.get('/', authMiddleware, (req, res) => {
  try {
    const userId = req.userId;
    console.log('[SETTINGS] GET - Fetching settings for user:', userId);

    // Find user by ID
    const user = db.users.find(u => u.id === parseInt(userId));
    if (!user) {
      console.log('[SETTINGS] GET - User not found:', userId);
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Get user's business settings
    const settings = user.businessSettings || {
      businessName: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      phone: '',
      email: '',
      taxRates: [{ name: 'Standard', rate: 8 }],
      invoicePrefix: 'INV',
      paymentTerms: 14,
      currency: '$'
    };

    console.log('[SETTINGS] GET - Returning settings for user:', userId, {
      businessName: settings.businessName
    });

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('[SETTINGS] GET - Error:', error.message);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * Update business settings for current user
 * Protected route - requires authentication
 */
router.patch('/', authMiddleware, (req, res) => {
  try {
    const userId = req.userId;
    const settings = req.body;

    console.log('[SETTINGS] PATCH - Updating settings for user:', userId, {
      businessName: settings.businessName
    });

    // Find user by ID
    const user = db.users.find(u => u.id === parseInt(userId));
    if (!user) {
      console.log('[SETTINGS] PATCH - User not found:', userId);
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Update user's business settings
    user.businessSettings = {
      ...user.businessSettings,
      ...settings
    };

    db.save();

    console.log('[SETTINGS] PATCH - Settings updated for user:', userId);

    res.json({
      success: true,
      data: user.businessSettings
    });
  } catch (error) {
    console.error('[SETTINGS] PATCH - Error:', error.message);
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;
