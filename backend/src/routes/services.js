import express from 'express';
import db from '../db.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const services = db.prepare(`
      SELECT id, name, description, defaultPrice
      FROM services
      ORDER BY name
    `).all();

    res.json({
      success: true,
      data: services
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;
