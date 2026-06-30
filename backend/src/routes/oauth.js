import express from 'express';
import axios from 'axios';
import { findOrCreateOAuthUser, getLinkedProviders } from '../services/oauthService.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Google OAuth Callback
router.post('/google/callback', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Token is required'
      });
    }

    // Verify Google token
    const response = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`
    );

    if (!response.data.sub) {
      return res.status(401).json({
        error: 'Invalid token'
      });
    }

    const profile = {
      id: response.data.sub,
      displayName: response.data.name,
      emails: [{ value: response.data.email }],
      photos: [{ value: response.data.picture }]
    };

    const result = findOrCreateOAuthUser('google', profile);

    res.json({
      success: true,
      token: result.token,
      user: result.user,
      isNewUser: result.isNewUser,
      linked: result.linked || false
    });
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(400).json({
      error: error.message || 'Google authentication failed'
    });
  }
});

// Get linked providers (protected)
router.get('/providers', authMiddleware, (req, res) => {
  try {
    const providers = getLinkedProviders(req.userId);
    res.json({
      success: true,
      data: providers
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

// Unlink OAuth provider (protected)
router.post('/unlink/:provider', authMiddleware, (req, res) => {
  try {
    const { provider } = req.params;

    if (!['google'].includes(provider)) {
      return res.status(400).json({
        error: 'Invalid provider'
      });
    }

    const result = require('../services/oauthService.js').unlinkOAuthProvider(req.userId, provider);

    res.json({
      success: true,
      message: `${provider} account unlinked`
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

export default router;
