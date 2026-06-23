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
  yPosition += 4;

  // Services Section
  addText('SERVICE DETAILS', { size: 12, bold: true, color: [41, 128, 185] });
  yPosition += 6;

  // Improved table layout
  const tableMargin = margin;
  const tableWidth = pageWidth - (margin * 2);

  // Column widths - optimized for readability
  const colWidths = {
    service: tableWidth * 0.40,      // Service name - 40%
    qty: tableWidth * 0.12,          // Quantity - 12%
    rate: tableWidth * 0.24,         // Unit price - 24%
    amount: tableWidth * 0.24        // Total - 24%
  };

  // Header background
  doc.setFillColor(79, 70, 229);  // Indigo color
  doc.rect(tableMargin, yPosition, tableWidth, 9, 'F');

  // Header text
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(255, 255, 255);

  const headerY = yPosition + 2.5;
  doc.text('Service', tableMargin + 2, headerY);
  doc.text('Qty', tableMargin + colWidths.service + 2, headerY);
  doc.text('Unit Price', tableMargin + colWidths.service + colWidths.qty + 2, headerY);
  doc.text('Total', tableMargin + colWidths.service + colWidths.qty + colWidths.rate + 2, headerY, { align: 'right' });

  yPosition += 11;
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');

  // Service rows
  let rowCount = 0;
  services.forEach((service, index) => {
    // Check if need new page
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = margin;
    }

    // Alternate row background for better readability
    if (index % 2 === 0) {
      doc.setFillColor(248, 250, 252);  // Light blue-gray
      doc.rect(tableMargin, yPosition - 1, tableWidth, 10, 'F');
    }

    // Service name (bold, larger)
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    const serviceName = service.name;
    const nameLines = doc.splitTextToSize(serviceName, colWidths.service - 4);
    doc.text(nameLines, tableMargin + 2, yPosition);

    const nameHeight = nameLines.length * 4;

    // Service description (if exists, smaller and lighter)
    if (service.description) {
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(100, 100, 100);
      const descLines = doc.splitTextToSize(service.description, colWidths.service - 4);
      doc.text(descLines, tableMargin + 2, yPosition + nameHeight + 1);
    }

    // Reset text color for data
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');

    // Quantity (centered)
    const qty = service.quantity.toString();
    doc.text(qty, tableMargin + colWidths.service + (colWidths.qty / 2), yPosition + 3, { align: 'center' });

    // Unit price (right aligned)
    const unitPrice = `${settings?.currency || '$'}${(service.defaultPrice || 0).toFixed(2)}`;
    doc.text(unitPrice, tableMargin + colWidths.service + colWidths.qty + colWidths.rate - 2, yPosition + 3, { align: 'right' });

    // Total amount (bold, right aligned)
    doc.setFont(undefined, 'bold');
    const totalAmount = `${settings?.currency || '$'}${((service.defaultPrice || 0) * (service.quantity || 1)).toFixed(2)}`;
    doc.text(totalAmount, tableMargin + tableWidth - 2, yPosition + 3, { align: 'right' });

    // Add separator line between rows
    doc.setDrawColor(220, 220, 220);
    doc.line(tableMargin, yPosition + 8, tableMargin + tableWidth, yPosition + 8);

    yPosition += 10;
    rowCount++;
  });

  // Summary section with clean layout
  yPosition += 6;

  // Draw a box for summary
  const summaryBoxX = pageWidth - margin - 100;
  const summaryBoxY = yPosition;
  const summaryBoxWidth = 100;
  const summaryBoxHeight = 30;

  // Light background for summary box
  doc.setFillColor(248, 250, 252);
  doc.rect(summaryBoxX, summaryBoxY, summaryBoxWidth, summaryBoxHeight, 'F');

  // Border
  doc.setDrawColor(79, 70, 229);
  doc.setLineWidth(0.5);
  doc.rect(summaryBoxX, summaryBoxY, summaryBoxWidth, summaryBoxHeight);

  // Summary text
  let summaryY = summaryBoxY + 3;
  const summaryLabelX = summaryBoxX + 2;
  const summaryValueX = summaryBoxX + summaryBoxWidth - 2;

  // Subtotal
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Subtotal:', summaryLabelX, summaryY);
  doc.setTextColor(0, 0, 0);
  doc.text(`${settings?.currency || '$'}${subtotal.toFixed(2)}`, summaryValueX, summaryY, { align: 'right' });
  summaryY += 6;

  // Tax
  doc.setTextColor(100, 100, 100);
  doc.text(`Tax (${settings?.taxRate || 8}%):`, summaryLabelX, summaryY);
  doc.setTextColor(0, 0, 0);
  doc.text(`${settings?.currency || '$'}${tax.toFixed(2)}`, summaryValueX, summaryY, { align: 'right' });
  summaryY += 8;

  // Total (highlighted)
  doc.setFont(undefined, 'bold');
  doc.setFontSize(11);
  doc.setFillColor(79, 70, 229);
  doc.setTextColor(255, 255, 255);
  doc.rect(summaryBoxX, summaryY - 2, summaryBoxWidth, 8, 'F');
  doc.text('TOTAL:', summaryLabelX, summaryY + 1);
  doc.text(`${settings?.currency || '$'}${total.toFixed(2)}`, summaryValueX, summaryY + 1, { align: 'right' });

  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  yPosition = summaryBoxY + summaryBoxHeight + 8;

  // Notes
  if (notes) {
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('NOTES:', margin, yPosition);
    yPosition += 6;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    const notesLines = doc.splitTextToSize(notes, pageWidth - margin * 2);
    doc.text(notesLines, margin, yPosition);
    yPosition += notesLines.length * 5 + 4;
  }

  // Footer
  yPosition = pageHeight - 15;
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Payment Status: PENDING | Due Date: ${dueDate.toLocaleDateString()}`,
    margin,
    yPosition
  );
  doc.text('Thank you for your business!', pageWidth / 2, yPosition, { align: 'center' });

  // Save
  const fileName = `Invoice-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
