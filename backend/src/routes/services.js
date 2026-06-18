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

router.get('/config/business', (req, res) => {
  try {
    const config = db.prepare(`
      SELECT * FROM businessConfig WHERE id = 1
    `).get();

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

router.put('/config/business', (req, res) => {
  try {
    const {
      businessName,
      businessAddress,
      businessPhone,
      businessEmail,
      taxRate,
      invoicePrefix,
      paymentTermsDays,
      currencySymbol
    } = req.body;

    db.prepare(`
      UPDATE businessConfig
      SET businessName = ?, businessAddress = ?, businessPhone = ?, businessEmail = ?,
          taxRate = ?, invoicePrefix = ?, paymentTermsDays = ?, currencySymbol = ?
      WHERE id = 1
    `).run(
      businessName,
      businessAddress,
      businessPhone,
      businessEmail,
      taxRate,
      invoicePrefix,
      paymentTermsDays,
      currencySymbol
    );

    const config = db.prepare(`
      SELECT * FROM businessConfig WHERE id = 1
    `).get();

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;
