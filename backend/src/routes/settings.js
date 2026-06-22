import express from 'express';
import db from '../db.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    res.json({
      success: true,
      data: db.businessSettings || {}
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

router.patch('/', (req, res) => {
  try {
    const settings = req.body;

    db.businessSettings = {
      ...db.businessSettings,
      ...settings
    };
    db.save();

    res.json({
      success: true,
      data: db.businessSettings
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;
