import express from 'express';
import db from '../db.js';

const router = express.Router();

let nextInvoiceNumber = 1;

const generateInvoiceNumber = () => {
  const prefix = db.businessSettings.invoicePrefix || 'INV';
  return `${prefix}-${String(nextInvoiceNumber++).padStart(5, '0')}`;
};

router.post('/', (req, res) => {
  try {
    const { customerId, vin, invoiceDate, serviceDate, items, subtotal, tax, discount, total, notes } = req.body;

    if (!customerId || !vin || !items || items.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields: customerId, vin, and items'
      });
    }

    const invoiceNumber = generateInvoiceNumber();
    const stmt = db.prepare(`
      INSERT INTO invoices (invoiceNumber, customerId, vin, invoiceDate, serviceDate, subtotal, tax, discount, total, status, notes, items)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      invoiceNumber,
      customerId,
      vin,
      invoiceDate,
      serviceDate,
      subtotal,
      tax,
      discount,
      total,
      'pending',
      notes || '',
      JSON.stringify(items)
    );

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(result.lastID);

    res.status(201).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status || null;

    let invoices;
    if (status) {
      invoices = db.prepare('SELECT * FROM invoices WHERE status = ? ORDER BY invoiceDate DESC LIMIT ? OFFSET ?').all(status, limit, offset);
    } else {
      invoices = db.prepare('SELECT * FROM invoices ORDER BY invoiceDate DESC LIMIT ? OFFSET ?').all(limit, offset);
    }

    invoices = invoices.map(inv => ({
      ...inv,
      items: typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items
    }));

    res.json({
      success: true,
      data: invoices
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
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(parseInt(id));

    if (!invoice) {
      return res.status(404).json({
        error: 'Invoice not found'
      });
    }

    invoice.items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;

    res.json({
      success: true,
      data: invoice
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
    const { status, notes } = req.body;

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(parseInt(id));
    if (!invoice) {
      return res.status(404).json({
        error: 'Invoice not found'
      });
    }

    const stmt = db.prepare('UPDATE invoices SET status = ?, notes = ? WHERE id = ?');
    stmt.run(status || invoice.status, notes !== undefined ? notes : invoice.notes, parseInt(id));

    const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(parseInt(id));
    updated.items = typeof updated.items === 'string' ? JSON.parse(updated.items) : updated.items;

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
    const stmt = db.prepare('DELETE FROM invoices WHERE id = ?');
    stmt.run(parseInt(id));

    res.json({
      success: true,
      message: 'Invoice deleted'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;
