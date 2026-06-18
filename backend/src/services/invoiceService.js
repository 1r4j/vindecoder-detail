import db from '../db.js';

export function generateInvoiceNumber(prefix = 'INV') {
  const lastInvoice = db.prepare(`
    SELECT invoiceNumber FROM invoices
    ORDER BY id DESC LIMIT 1
  `).get();

  let nextNumber = 1;
  if (lastInvoice) {
    const match = lastInvoice.invoiceNumber.match(/\d+$/);
    if (match) {
      nextNumber = parseInt(match[0]) + 1;
    }
  }

  return `${prefix}-${String(nextNumber).padStart(5, '0')}`;
}

export function generateInvoiceId() {
  return `ID-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createInvoice(invoiceData) {
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
    taxRate,
    discountType,
    discountValue,
    notes
  } = invoiceData;

  console.log('Creating invoice with data:', {
    vehicleYear,
    vehicleMake,
    vehicleModel,
    vehicleColor,
    vin,
    customerName
  });

  const invoiceNumber = generateInvoiceNumber();
  const invoiceId = generateInvoiceId();

  let subtotal = 0;
  items.forEach(item => {
    subtotal += item.total;
  });

  let discountAmount = 0;
  if (discountType === 'percentage') {
    discountAmount = (subtotal * discountValue) / 100;
  } else if (discountType === 'fixed') {
    discountAmount = discountValue;
  }

  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * taxRate;
  const totalAmount = taxableAmount + taxAmount;

  const stmt = db.prepare(`
    INSERT INTO invoices (
      invoiceNumber, invoiceId, vehicleId, vin, vehicleYear, vehicleMake, vehicleModel, vehicleColor,
      customerName, customerEmail, customerPhone, customerAddress, serviceDate, subtotal, taxRate, taxAmount,
      discountType, discountValue, totalAmount, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    invoiceNumber,
    invoiceId,
    vehicleId || null,
    vin || '',
    vehicleYear || null,
    vehicleMake || '',
    vehicleModel || '',
    vehicleColor || '',
    customerName,
    customerEmail || '',
    customerPhone || '',
    customerAddress || '',
    serviceDate || new Date().toISOString().split('T')[0],
    subtotal,
    taxRate,
    taxAmount,
    discountType || 'none',
    discountValue || 0,
    totalAmount,
    notes || ''
  );

  const invoiceDbId = result.lastInsertRowid;

  const itemStmt = db.prepare(`
    INSERT INTO invoiceItems (invoiceId, serviceName, description, quantity, rate, total)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  items.forEach(item => {
    itemStmt.run(
      invoiceDbId,
      item.serviceName,
      item.description || '',
      item.quantity,
      item.rate,
      item.total
    );
  });

  return getInvoiceById(invoiceDbId);
}

export function getInvoiceById(id) {
  const invoice = db.prepare(`
    SELECT * FROM invoices WHERE id = ?
  `).get(id);

  if (!invoice) return null;

  console.log('Invoice returned from DB:', invoice);

  const items = db.prepare(`
    SELECT * FROM invoiceItems WHERE invoiceId = ?
  `).all(id);

  return {
    ...invoice,
    items
  };
}

export function getAllInvoices(limit = 100, offset = 0) {
  const invoices = db.prepare(`
    SELECT * FROM invoices ORDER BY createdAt DESC LIMIT ? OFFSET ?
  `).all(limit, offset);

  return invoices.map(invoice => {
    const items = db.prepare(`
      SELECT * FROM invoiceItems WHERE invoiceId = ?
    `).all(invoice.id);
    return {
      ...invoice,
      items
    };
  });
}

export function updateInvoiceStatus(id, status) {
  const valid = ['pending', 'paid', 'overdue'];
  if (!valid.includes(status)) {
    throw new Error('Invalid payment status');
  }

  db.prepare(`
    UPDATE invoices SET paymentStatus = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?
  `).run(status, id);

  return getInvoiceById(id);
}

export function deleteInvoice(id) {
  db.prepare('DELETE FROM invoiceItems WHERE invoiceId = ?').run(id);
  db.prepare('DELETE FROM invoices WHERE id = ?').run(id);
  return { success: true };
}
