import { jsPDF } from 'jspdf';

export function generatePDF({
  vehicle,
  customer,
  services,
  invoiceDate,
  serviceDate,
  notes,
  subtotal,
  tax,
  total,
  settings,
  invoiceNumber
}) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;

  const addText = (text, options = {}) => {
    const {
      size = 11,
      bold = false,
      color = [0, 0, 0],
      align = 'left',
      maxWidth = pageWidth - margin * 2
    } = options;

    doc.setFontSize(size);
    doc.setTextColor(...color);
    if (bold) doc.setFont(undefined, 'bold');
    else doc.setFont(undefined, 'normal');

    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, align === 'right' ? pageWidth - margin : margin, yPosition, { align });
    yPosition += lines.length * 6 + 2;
  };

  const addLine = () => {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 4;
  };

  // Header - Business Info
  addText(settings?.businessName || 'Your Detailing Business', { size: 16, bold: true });
  addText(
    (settings?.address || '') +
    (settings?.city ? `, ${settings.city}` : '') +
    (settings?.state ? `, ${settings.state}` : '') +
    (settings?.zipCode ? ` ${settings.zipCode}` : ''),
    { size: 10, color: [100, 100, 100] }
  );

  if (settings?.phone) {
    addText(`Phone: ${settings.phone}`, { size: 10, color: [100, 100, 100] });
  }
  if (settings?.email) {
    addText(`Email: ${settings.email}`, { size: 10, color: [100, 100, 100] });
  }

  yPosition += 6;
  addLine();
  yPosition += 4;

  // Title
  doc.setFontSize(24);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(41, 128, 185);
  doc.text('INVOICE', pageWidth - margin, yPosition - 8, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  yPosition += 8;

  // Invoice Details
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  addText('Invoice #: ' + (invoiceNumber || 'TBD'), { size: 10 });
  addText('Date: ' + new Date(invoiceDate).toLocaleDateString(), { size: 10 });

  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + (settings?.paymentTerms || 14));

  yPosition += 8;
  addText('BILL TO', { size: 11, bold: true });
  addText(customer?.name || 'Unknown Customer', { size: 11, bold: true });
  if (customer?.email) addText(customer.email, { size: 10 });
  if (customer?.phone) addText(customer.phone, { size: 10 });
  if (customer?.address) addText(customer.address, { size: 10 });

  yPosition += 6;
  addLine();
  yPosition += 4;

  // Vehicle Information
  addText('VEHICLE INFORMATION', { size: 11, bold: true });
  yPosition += 2;

  const vehicleInfo = [
    ['Year', vehicle.year],
    ['Make', vehicle.make],
    ['Model', vehicle.model],
    ['Body Type', vehicle.bodyType || 'N/A'],
    ['VIN', vehicle.vin],
    ['Color', vehicle.color || 'Not specified']
  ];

  vehicleInfo.forEach(([label, value]) => {
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(label + ':', margin, yPosition);
    doc.setFont(undefined, 'normal');
    doc.text(String(value), margin + 40, yPosition);
    yPosition += 6;
  });

  yPosition += 4;
  addLine();
  yPosition += 8;

  // ===== SERVICE DETAILS SECTION =====
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('SERVICE DETAILS', margin, yPosition);
  yPosition += 8;

  // Define table structure - clean and spacious
  const tableLeft = margin;
  const tableRight = pageWidth - margin;
  const tableWidth = tableRight - tableLeft;

  // Column positions (percentages)
  const col1X = tableLeft;                    // Service (50%)
  const col2X = tableLeft + (tableWidth * 0.50);  // Qty (12%)
  const col3X = tableLeft + (tableWidth * 0.62);  // Unit Price (25%)
  const col4X = tableRight - 20;               // Total (13%, right aligned)

  // Header row - BOLD AND CLEAR
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Service', col1X, yPosition);
  doc.text('Qty', col2X, yPosition);
  doc.text('Unit Price', col3X, yPosition);
  doc.text('Total', col4X, yPosition, { align: 'right' });

  // Header underline
  yPosition += 1;
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.5);
  doc.line(tableLeft, yPosition, tableRight, yPosition);
  yPosition += 7;

  // Service rows - CLEAR AND READABLE
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(0, 0, 0);

  services.forEach((service, index) => {
    // Page break check
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = margin;
    }

    // Handle both database format (rate, serviceName) and form format (defaultPrice, name)
    const qty = service.quantity || 1;
    const serviceName = service.name || service.serviceName || 'Service';
    const unitPrice = parseFloat(service.rate || service.defaultPrice || service.price || 0).toFixed(2);
    const lineTotal = (parseFloat(unitPrice) * qty).toFixed(2);

    // Service name line
    doc.text(serviceName, col1X, yPosition);
    doc.text(qty.toString(), col2X, yPosition);
    doc.text(`${settings?.currency || '$'}${unitPrice}`, col3X, yPosition);
    doc.text(`${settings?.currency || '$'}${lineTotal}`, col4X, yPosition, { align: 'right' });

    yPosition += 6;

    // Description on next line if exists (smaller, lighter)
    const description = service.description || '';
    if (description) {
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(description, col1X + 3, yPosition);
      yPosition += 4;
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
    }

    // Light separator between items
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.1);
    doc.line(tableLeft, yPosition, tableRight, yPosition);
    yPosition += 3;
  });

  // Add spacing before summary
  yPosition += 3;

  // ===== SUMMARY SECTION =====
  // Summary label and value positions
  const summaryLabelX = pageWidth - margin - 70;
  const summaryValueX = pageWidth - margin - 2;
  const summaryBoxWidth = 70;

  // Subtotal
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Subtotal:', summaryLabelX, yPosition);
  doc.setTextColor(0, 0, 0);
  doc.text(`${settings?.currency || '$'}${subtotal.toFixed(2)}`, summaryValueX, yPosition, { align: 'right' });
  yPosition += 6;

  // Tax
  doc.setTextColor(80, 80, 80);
  doc.text(`Tax (${settings?.taxRate || 8}%):`, summaryLabelX, yPosition);
  doc.setTextColor(0, 0, 0);
  doc.text(`${settings?.currency || '$'}${tax.toFixed(2)}`, summaryValueX, yPosition, { align: 'right' });
  yPosition += 8;

  // Total - HIGHLIGHTED
  doc.setLineWidth(0.5);
  doc.setDrawColor(50, 50, 50);
  doc.line(summaryLabelX, yPosition - 1.5, summaryValueX, yPosition - 1.5);

  doc.setFont(undefined, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('TOTAL:', summaryLabelX, yPosition + 3);
  doc.text(`${settings?.currency || '$'}${total.toFixed(2)}`, summaryValueX, yPosition + 3, { align: 'right' });

  yPosition += 12;

  // ===== NOTES SECTION =====
  if (notes) {
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('NOTES:', margin, yPosition);
    yPosition += 5;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    const notesLines = doc.splitTextToSize(notes, pageWidth - margin * 2);
    doc.text(notesLines, margin, yPosition);
    yPosition += notesLines.length * 4 + 6;
  }

  // ===== FOOTER =====
  const footerY = pageHeight - 12;
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.setFont(undefined, 'normal');
  doc.text(`Payment Status: PENDING | Due Date: ${dueDate.toLocaleDateString()}`, margin, footerY);
  doc.text('Thank you for your business!', pageWidth / 2, footerY, { align: 'center' });

  // Save
  const fileName = `Invoice-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

// Generate consolidated invoice PDF with vehicle info for each original invoice
export function generateConsolidatedPDF({
  consolidatedInvoice,
  originalInvoices,
  customer,
  settings
}) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;

  const addText = (text, options = {}) => {
    const {
      size = 11,
      bold = false,
      color = [0, 0, 0],
      align = 'left',
      maxWidth = pageWidth - margin * 2
    } = options;

    doc.setFontSize(size);
    doc.setTextColor(...color);
    if (bold) doc.setFont(undefined, 'bold');
    else doc.setFont(undefined, 'normal');

    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, align === 'right' ? pageWidth - margin : margin, yPosition, { align });
    yPosition += lines.length * 6 + 2;
  };

  const addLine = () => {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 4;
  };

  // Header - Business Info
  addText(settings?.businessName || 'Your Detailing Business', { size: 16, bold: true });
  addText(
    (settings?.address || '') +
    (settings?.city ? `, ${settings.city}` : '') +
    (settings?.state ? `, ${settings.state}` : '') +
    (settings?.zipCode ? ` ${settings.zipCode}` : ''),
    { size: 10, color: [100, 100, 100] }
  );

  if (settings?.phone) {
    addText(`Phone: ${settings.phone}`, { size: 10, color: [100, 100, 100] });
  }
  if (settings?.email) {
    addText(`Email: ${settings.email}`, { size: 10, color: [100, 100, 100] });
  }

  yPosition += 6;
  addLine();
  yPosition += 4;

  // Title
  doc.setFontSize(24);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(41, 128, 185);
  doc.text('INVOICE', pageWidth - margin, yPosition - 8, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  yPosition += 8;

  // Invoice Details
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  addText('Invoice #: ' + (consolidatedInvoice.invoiceNumber || 'TBD'), { size: 10 });
  addText('Date: ' + new Date(consolidatedInvoice.invoiceDate).toLocaleDateString(), { size: 10 });

  const dueDate = new Date(consolidatedInvoice.invoiceDate);
  dueDate.setDate(dueDate.getDate() + (settings?.paymentTerms || 14));

  yPosition += 8;
  addText('BILL TO', { size: 11, bold: true });
  addText(customer?.name || 'Unknown Customer', { size: 11, bold: true });
  if (customer?.email) addText(customer.email, { size: 10 });
  if (customer?.phone) addText(customer.phone, { size: 10 });
  if (customer?.address) addText(customer.address, { size: 10 });

  yPosition += 6;
  addLine();
  yPosition += 4;

  // Vehicle Information for all original invoices
  addText('VEHICLES', { size: 11, bold: true });
  yPosition += 2;

  originalInvoices.forEach((invoice) => {
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = margin;
    }

    // Invoice number
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`Invoice #${invoice.invoiceNumber || 'N/A'}`, margin, yPosition);
    yPosition += 6;

    // Vehicle info indented under invoice number
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0);

    const vehicleInfo = [
      ['Year', invoice.year || 'Not specified'],
      ['Make', invoice.make || 'Not specified'],
      ['Model', invoice.model || 'Not specified'],
      ['VIN', invoice.vin || 'Not specified'],
      ['Color', invoice.color || 'Not specified']
    ];

    vehicleInfo.forEach(([label, value]) => {
      doc.setFont(undefined, 'bold');
      doc.text(label + ':', margin + 10, yPosition);
      doc.setFont(undefined, 'normal');
      doc.text(String(value), margin + 35, yPosition);
      yPosition += 5;
    });

    yPosition += 3;
  });

  yPosition += 2;
  addLine();
  yPosition += 8;

  // ===== SERVICE DETAILS SECTION =====
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('SERVICE DETAILS', margin, yPosition);
  yPosition += 8;

  // Define table structure
  const tableLeft = margin;
  const tableRight = pageWidth - margin;
  const tableWidth = tableRight - tableLeft;

  const col1X = tableLeft;
  const col2X = tableLeft + (tableWidth * 0.50);
  const col3X = tableLeft + (tableWidth * 0.62);
  const col4X = tableRight - 20;

  // Header row
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Service', col1X, yPosition);
  doc.text('Qty', col2X, yPosition);
  doc.text('Unit Price', col3X, yPosition);
  doc.text('Total', col4X, yPosition, { align: 'right' });

  yPosition += 1;
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.5);
  doc.line(tableLeft, yPosition, tableRight, yPosition);
  yPosition += 7;

  // Service rows - all services from all invoices
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(0, 0, 0);

  originalInvoices.forEach((invoice) => {
    (invoice.items || []).forEach((service) => {
      // Page break check
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = margin;
      }

      const qty = service.quantity || 1;
      const serviceName = service.name || service.serviceName || 'Service';
      const unitPrice = parseFloat(service.rate || service.defaultPrice || service.price || 0).toFixed(2);
      const lineTotal = (parseFloat(unitPrice) * qty).toFixed(2);

      doc.text(serviceName, col1X, yPosition);
      doc.text(qty.toString(), col2X, yPosition);
      doc.text(`${settings?.currency || '$'}${unitPrice}`, col3X, yPosition);
      doc.text(`${settings?.currency || '$'}${lineTotal}`, col4X, yPosition, { align: 'right' });

      yPosition += 6;

      if (service.description) {
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(service.description, col1X + 3, yPosition);
        yPosition += 4;
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
      }

      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.1);
      doc.line(tableLeft, yPosition, tableRight, yPosition);
      yPosition += 3;
    });
  });

  yPosition += 3;

  // ===== SUMMARY SECTION =====
  // Note: No tax recalculation for consolidated invoices
  // Each original invoice already includes tax in its total
  const summaryLabelX = pageWidth - margin - 70;
  const summaryValueX = pageWidth - margin - 2;

  doc.setLineWidth(0.5);
  doc.setDrawColor(50, 50, 50);
  doc.line(summaryLabelX, yPosition - 1.5, summaryValueX, yPosition - 1.5);

  doc.setFont(undefined, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('TOTAL DUE:', summaryLabelX, yPosition + 3);
  doc.text(`${settings?.currency || '$'}${parseFloat(consolidatedInvoice.total || 0).toFixed(2)}`, summaryValueX, yPosition + 3, { align: 'right' });

  // Save
  const fileName = `Invoice-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
