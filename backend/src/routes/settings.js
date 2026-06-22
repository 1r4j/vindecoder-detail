import express from 'express';
import db from '../db.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM businessSettings').get();

    res.json({
      success: true,
      data: settings || db.businessSettings
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

    const stmt = db.prepare('UPDATE businessSettings SET data = ? WHERE id = 1');
    stmt.run(JSON.stringify(settings));

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;
