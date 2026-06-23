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

  // SERVICE DETAILS - Simple and Clean
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('SERVICE DETAILS', margin, yPosition);
  yPosition += 8;

  // Column positions for clean table
  const serviceCol = margin;
  const qtyCol = pageWidth - margin - 85;
  const priceCol = pageWidth - margin - 55;
  const totalCol = pageWidth - margin - 5;

  // Table header with clean design
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(79, 70, 229);
  doc.text('Service', serviceCol, yPosition);
  doc.text('Qty', qtyCol, yPosition);
  doc.text('Unit Price', priceCol, yPosition);
  doc.text('Total', totalCol, yPosition, { align: 'right' });

  yPosition += 1;
  doc.setDrawColor(79, 70, 229);
  doc.setLineWidth(0.3);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 6;

  // Service lines - SIMPLE AND CLEAR
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(0, 0, 0);

  services.forEach((service) => {
    // Check if need new page
    if (yPosition > pageHeight - 50) {
      doc.addPage();
      yPosition = margin;
    }

    // Service name and description on same line for clarity
    let serviceLabel = service.name;
    if (service.description) {
      serviceLabel += ` (${service.description})`;
    }

    const qty = service.quantity;
    const unitPrice = (service.defaultPrice || 0).toFixed(2);
    const lineTotal = ((service.defaultPrice || 0) * qty).toFixed(2);

    // Service name with wrapping
    const serviceWidth = qtyCol - serviceCol - 5;
    const serviceLines = doc.splitTextToSize(serviceLabel, serviceWidth);
    doc.text(serviceLines, serviceCol, yPosition);

    const lineHeight = serviceLines.length * 4;

    // Numbers on the right
    doc.setFont(undefined, 'normal');
    doc.text(qty.toString(), qtyCol, yPosition);
    doc.text(`${settings?.currency || '$'}${unitPrice}`, priceCol, yPosition);
    doc.text(`${settings?.currency || '$'}${lineTotal}`, totalCol, yPosition, { align: 'right' });

    yPosition += Math.max(lineHeight, 6) + 2;

    // Light separator line between items
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.1);
    doc.line(margin, yPosition - 1, pageWidth - margin, yPosition - 1);
  });

  yPosition += 6;

  // SUMMARY - Clean and Simple
  const summaryLabelX = pageWidth - margin - 85;
  const summaryValueX = pageWidth - margin - 5;

  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(0, 0, 0);

  // Subtotal line
  doc.text('Subtotal:', summaryLabelX, yPosition);
  doc.text(`${settings?.currency || '$'}${subtotal.toFixed(2)}`, summaryValueX, yPosition, { align: 'right' });
  yPosition += 5;

  // Tax line
  doc.text(`Tax (${settings?.taxRate || 8}%):`, summaryLabelX, yPosition);
  doc.text(`${settings?.currency || '$'}${tax.toFixed(2)}`, summaryValueX, yPosition, { align: 'right' });
  yPosition += 6;

  // Total line with highlight
  doc.setLineWidth(0.3);
  doc.setDrawColor(79, 70, 229);
  doc.line(summaryLabelX, yPosition - 1, summaryValueX, yPosition - 1);

  doc.setFont(undefined, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(79, 70, 229);
  doc.text('TOTAL:', summaryLabelX, yPosition + 4);
  doc.text(`${settings?.currency || '$'}${total.toFixed(2)}`, summaryValueX, yPosition + 4, { align: 'right' });

  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  yPosition += 12;

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
