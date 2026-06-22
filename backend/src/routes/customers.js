import express from 'express';
import db from '../db.js';

const router = express.Router();

router.post('/', (req, res) => {
  try {
    const { name, email, phone, address, city, state, zipCode } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'Customer name is required'
      });
    }

    const stmt = db.prepare(`
      INSERT INTO customers (name, email, phone, address, city, state, zipCode)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(name, email || '', phone || '', address || '', city || '', state || '', zipCode || '');

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastID);

    res.status(201).json({
      success: true,
      data: customer
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

router.get('/', (req, res) => {
  try {
    const customers = db.prepare('SELECT * FROM customers ORDER BY name').all();

    res.json({
      success: true,
      data: customers
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(parseInt(id));

    if (!customer) {
      return res.status(404).json({
        error: 'Customer not found'
      });
    }

    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

router.patch('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, city, state, zipCode } = req.body;

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(parseInt(id));
    if (!customer) {
      return res.status(404).json({
        error: 'Customer not found'
      });
    }

    const stmt = db.prepare(`
      UPDATE customers
      SET name = ?, email = ?, phone = ?, address = ?, city = ?, state = ?, zipCode = ?
      WHERE id = ?
    `);

    stmt.run(
      name || customer.name,
      email !== undefined ? email : customer.email,
      phone !== undefined ? phone : customer.phone,
      address !== undefined ? address : customer.address,
      city !== undefined ? city : customer.city,
      state !== undefined ? state : customer.state,
      zipCode !== undefined ? zipCode : customer.zipCode,
      parseInt(id)
    );

    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(parseInt(id));

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM customers WHERE id = ?');
    stmt.run(parseInt(id));

    res.json({
      success: true,
      message: 'Customer deleted'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;
