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
    const { customerId, vin, year, make, model, color, bodyType, invoiceDate, serviceDate, items, subtotal, tax, discount, total, notes } = req.body;
    const userId = req.userId;

    if (!customerId || !vin || !items || items.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields: customerId, vin, and items'
      });
    }

    const invoiceNumber = generateInvoiceNumber();
    const invoiceId = Math.max(0, ...db.invoices.map(i => i.id)) + 1;
    const invoice = {
      id: invoiceId,
      userId,
      invoiceNumber,
      customerId,
      vin,
      year: year || 'Not specified',
      make: make || 'Not specified',
      model: model || 'Not specified',
      color: color || 'Not specified',
      bodyType: bodyType || 'N/A',
      invoiceDate,
      serviceDate,
      subtotal,
      tax,
      discount,
      total,
      status: 'pending',
      notes: notes || '',
      items: items,
      createdAt: new Date().toISOString()
    };

    db.invoices.push(invoice);
    db.save();

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
    const userId = req.userId;

    let invoices = db.invoices.filter(i => i.userId === userId);

    if (status) {
      invoices = invoices.filter(i => i.status === status);
    }

    invoices = invoices
      .sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate))
      .slice(offset, offset + limit);

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
