import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function generateInvoicePDF(invoice, businessConfig) {
  try {
    console.log('Generating PDF for invoice:', invoice.invoiceNumber);

    if (!invoice) {
      throw new Error('Invoice data is missing');
    }
    // Ensure businessConfig has all required properties
    const config = businessConfig || {};
    const businessName = config.businessName || 'Sparkle Auto Detailing';
    const businessAddress = config.businessAddress || '123 Main Street, Your City, State 12345';
    const businessPhone = config.businessPhone || '(555) 987-6543';
    const businessEmail = config.businessEmail || 'info@sparkledetail.com';
    const taxRate = config.taxRate || 0.08;
    const paymentTermsDays = config.paymentTermsDays || 14;
    const currencySymbol = config.currencySymbol || '$';

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    let yPosition = margin;

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(businessName, margin, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(businessAddress, margin, yPosition);
    yPosition += 5;
    doc.text(`${businessPhone} | ${businessEmail}`, margin, yPosition);
    yPosition += 12;

    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('INVOICE', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');

    const leftColumn = margin;
    const rightColumn = pageWidth - margin - 40;

    doc.text('INVOICE #:', leftColumn, yPosition);
    doc.setFont(undefined, 'bold');
    doc.text(invoice.invoiceNumber, leftColumn + 30, yPosition);
    doc.setFont(undefined, 'normal');

    doc.text('Date:', rightColumn, yPosition);
    doc.setFont(undefined, 'bold');
    doc.text(formatDate(invoice.invoiceDate), rightColumn + 15, yPosition);
    doc.setFont(undefined, 'normal');

    yPosition += 6;
    doc.text('Invoice ID:', leftColumn, yPosition);
    doc.setFont(undefined, 'bold');
    doc.text(invoice.invoiceId, leftColumn + 30, yPosition);
    doc.setFont(undefined, 'normal');

    yPosition += 10;

    doc.setFont(undefined, 'bold');
    doc.text('CUSTOMER INFORMATION:', leftColumn, yPosition);
    doc.setFont(undefined, 'normal');
    yPosition += 6;

    doc.text(invoice.customerName, leftColumn, yPosition);
    yPosition += 5;
    if (invoice.customerEmail) {
      doc.text(`Email: ${invoice.customerEmail}`, leftColumn, yPosition);
      yPosition += 5;
    }
    if (invoice.customerPhone) {
      doc.text(`Phone: ${invoice.customerPhone}`, leftColumn, yPosition);
      yPosition += 5;
    }
    if (invoice.customerAddress) {
      doc.text(`Address: ${invoice.customerAddress}`, leftColumn, yPosition);
      yPosition += 5;
    }

    yPosition += 8;

    doc.setFont(undefined, 'bold');
    doc.text('VEHICLE INFORMATION:', leftColumn, yPosition);
    doc.setFont(undefined, 'normal');
    yPosition += 6;

    const vehicleDesc = [
      invoice.vehicleYear || '',
      invoice.vehicleMake || '',
      invoice.vehicleModel || '',
      invoice.vehicleColor ? `- ${invoice.vehicleColor}` : ''
    ].filter(part => part).join(' ');

    if (vehicleDesc) {
      doc.text(`Vehicle: ${vehicleDesc}`, leftColumn, yPosition);
      yPosition += 5;
    }

    if (invoice.vin) {
      doc.text(`VIN: ${invoice.vin}`, leftColumn, yPosition);
      yPosition += 5;
    }

    yPosition += 8;

    doc.setFont(undefined, 'bold');
    doc.text('SERVICE DETAILS:', leftColumn, yPosition);
    doc.setFont(undefined, 'normal');
    yPosition += 8;

    const colWidths = {
      service: 60,
      qty: 15,
      rate: 25,
      total: 25
    };

    doc.setFont(undefined, 'bold');
    doc.setFillColor(245, 245, 245);
    doc.rect(leftColumn, yPosition - 4, pageWidth - 2 * margin, 6, 'F');
    doc.text('Service', leftColumn + 2, yPosition);
    doc.text('Qty', leftColumn + colWidths.service + 2, yPosition);
    doc.text('Rate', leftColumn + colWidths.service + colWidths.qty + 5, yPosition);
    doc.text('Total', leftColumn + colWidths.service + colWidths.qty + colWidths.rate + 2, yPosition);
    doc.setFont(undefined, 'normal');

    yPosition += 8;

    invoice.items.forEach((item) => {
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = margin;
      }

      doc.text(item.serviceName, leftColumn + 2, yPosition, { maxWidth: colWidths.service - 4 });
      doc.text(item.quantity.toString(), leftColumn + colWidths.service + 2, yPosition);
      doc.text(formatCurrency(item.rate, currencySymbol), leftColumn + colWidths.service + colWidths.qty + 5, yPosition);
      doc.text(formatCurrency(item.total, currencySymbol), leftColumn + colWidths.service + colWidths.qty + colWidths.rate + 2, yPosition);

      yPosition += 5;
    });

    yPosition += 4;
    doc.setLineWidth(0.5);
    doc.line(leftColumn, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;

    const rightColX = pageWidth - margin - 50;

    doc.setFont(undefined, 'normal');
    doc.text('Subtotal:', rightColX, yPosition);
    doc.text(formatCurrency(invoice.subtotal, currencySymbol), rightColX + 35, yPosition);

    yPosition += 6;
    doc.text('Tax (' + (invoice.taxRate * 100).toFixed(0) + '%):', rightColX, yPosition);
    doc.text(formatCurrency(invoice.taxAmount, currencySymbol), rightColX + 35, yPosition);

    if (invoice.discountValue > 0) {
      yPosition += 6;
      const discountLabel = invoice.discountType === 'percentage' ? 'Discount (' + invoice.discountValue + '%)' : 'Discount';
      doc.text(discountLabel + ':', rightColX, yPosition);
      doc.text('-' + formatCurrency(invoice.discountValue, currencySymbol), rightColX + 35, yPosition);
    }

    yPosition += 8;
    doc.setFont(undefined, 'bold');
    doc.setFillColor(102, 126, 234);
    doc.setTextColor(255, 255, 255);
    doc.rect(rightColX - 5, yPosition - 4, 60, 6, 'F');
    doc.text('TOTAL DUE:', rightColX, yPosition);
    doc.text(formatCurrency(invoice.totalAmount, currencySymbol), rightColX + 35, yPosition);
    doc.setTextColor(0, 0, 0);

    yPosition += 12;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);

    const statusText = `Payment Status: ${invoice.paymentStatus.toUpperCase()}`;
    const dueDate = new Date(invoice.invoiceDate);
    dueDate.setDate(dueDate.getDate() + paymentTermsDays);
    const dueDateText = `Due Date: ${formatDate(dueDate.toISOString().split('T')[0])}`;

    doc.text(statusText, leftColumn, yPosition);
    yPosition += 5;
    doc.text(dueDateText, leftColumn, yPosition);

    if (invoice.notes) {
      yPosition += 10;
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('Notes:', leftColumn, yPosition);
      doc.setFont(undefined, 'normal');
      yPosition += 5;
      const notesLines = doc.splitTextToSize(invoice.notes, pageWidth - 2 * margin);
      doc.text(notesLines, leftColumn, yPosition);
    }

    yPosition = pageHeight - 15;
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('Thank you for your business!', leftColumn, yPosition, { align: 'center' });

    console.log('PDF generation completed successfully');
    return doc;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

function formatCurrency(amount, symbol = '$') {
  return symbol + amount.toFixed(2);
}

export function downloadPDF(doc, filename) {
  doc.save(filename);
}

export async function elementToPDF(element, filename) {
  const canvas = await html2canvas(element);
  const imgData = canvas.toDataURL('image/png');

  const doc = new jsPDF({
    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [canvas.width, canvas.height]
  });

  doc.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  doc.save(filename);
}
