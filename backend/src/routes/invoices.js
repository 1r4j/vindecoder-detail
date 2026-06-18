import express from 'express';
import {
  createInvoice,
  getInvoiceById,
  getAllInvoices,
  updateInvoiceStatus,
  deleteInvoice
} from '../services/invoiceService.js';

const router = express.Router();

router.post('/', (req, res) => {
  try {
    const {
      vehicleId,
      vin,
      vehicleYear,
      vehicleMake,
      vehicleModel,
      vehicleColor,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      serviceDate,
      items,
      taxRate = 0.08,
      discountType,
      discountValue,
      notes
    } = req.body;

    if (!customerName || !items || items.length === 0) {
      return res.status(400).json({
        error: 'Customer name and items are required'
      });
    }

    const invoice = createInvoice({
      vehicleId,
      vin,
      vehicleYear,
      vehicleMake,
      vehicleModel,
      vehicleColor,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      serviceDate,
      items,
      taxRate,
      discountType,
      discountValue,
      notes
    });

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

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const invoice = getInvoiceById(id);

    if (!invoice) {
      return res.status(404).json({
        error: 'Invoice not found'
      });
    }

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

router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const invoices = getAllInvoices(limit, offset);

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

router.patch('/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const invoice = updateInvoiceStatus(id, status);

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = deleteInvoice(id);

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;
