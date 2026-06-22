import jsPDF from 'jspdf';
import 'jspdf-autotable';

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
  settings
}) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;

  // Helper function to add text
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

  // Helper function to add line
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

  // Title and Invoice Number
  doc.setFontSize(24);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(41, 128, 185);
  doc.text('INVOICE', pageWidth - margin, yPosition - 8, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  yPosition += 8;

  // Invoice Details (left side) and Dates (right side)
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  addText('Invoice #: TBD', { size: 10 });
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

  // Services Table
  addText('SERVICE DETAILS', { size: 11, bold: true });
  yPosition += 4;

  const tableData = services.map(service => [
    service.name,
    service.description || '',
    service.quantity.toString(),
    `${settings?.currency || '$'}${(service.defaultPrice || 0).toFixed(2)}`,
    `${settings?.currency || '$'}${((service.defaultPrice || 0) * (service.quantity || 1)).toFixed(2)}`
  ]);

  doc.autoTable({
    head: [['Description', 'Details', 'Qty', 'Rate', 'Amount']],
    body: tableData,
    startY: yPosition,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10
    },
    bodyStyles: {
      fontSize: 10,
      textColor: [0, 0, 0]
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    columnStyles: {
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right' }
    }
  });

  yPosition = doc.lastAutoTable.finalY + 8;

  // Summary Section
  const rightX = pageWidth - margin - 50;
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');

  doc.text('Subtotal:', rightX, yPosition);
  doc.text(
    `${settings?.currency || '$'}${subtotal.toFixed(2)}`,
    pageWidth - margin,
    yPosition,
    { align: 'right' }
  );
  yPosition += 6;

  doc.text(`Tax (${settings?.taxRate || 8}%):`, rightX, yPosition);
  doc.text(
    `${settings?.currency || '$'}${tax.toFixed(2)}`,
    pageWidth - margin,
    yPosition,
    { align: 'right' }
  );
  yPosition += 6;

  // Total - Highlighted
  doc.setFont(undefined, 'bold');
  doc.setFontSize(12);
  doc.setFillColor(41, 128, 185);
  doc.setTextColor(255, 255, 255);
  doc.rect(rightX - 50, yPosition - 2, 50 + margin, 8, 'F');
  doc.text('TOTAL:', rightX, yPosition + 2);
  doc.text(
    `${settings?.currency || '$'}${total.toFixed(2)}`,
    pageWidth - margin,
    yPosition + 2,
    { align: 'right' }
  );

  doc.setTextColor(0, 0, 0);
  yPosition += 10;

  // Notes (if any)
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
  if (yPosition > pageHeight - 20) {
    doc.addPage();
    yPosition = margin;
  }

  yPosition = pageHeight - 15;
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Payment Status: PENDING | Due Date: ${dueDate.toLocaleDateString()}`,
    margin,
    yPosition
  );

  doc.setTextColor(150, 150, 150);
  doc.text('Thank you for your business!', pageWidth / 2, yPosition, { align: 'center' });

  // Save the PDF
  const fileName = `Invoice-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
