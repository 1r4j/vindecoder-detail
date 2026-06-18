import { formatDate, formatCurrency } from '../utils/formatting';

export default function InvoicePreview({ invoice, businessConfig, onDownloadPDF, onClose, onBack }) {
  return (
    <div className="page-container">
      <h2 className="page-title">Invoice Preview</h2>

      <div className="content-card" style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div className="invoice-preview">
          {/* Header */}
          <div className="invoice-header">
            <div className="invoice-company-name">{businessConfig?.businessName || 'Sparkle Auto Detailing'}</div>
            <div className="invoice-company-info">
              <div>{businessConfig?.businessAddress || '123 Main Street'}</div>
              <div>{businessConfig?.businessPhone || '(555) 987-6543'} | {businessConfig?.businessEmail || 'info@sparkledetail.com'}</div>
            </div>
          </div>

          {/* Invoice Title and Metadata */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '24px', marginBottom: '16px' }}>INVOICE</h3>
            <div className="invoice-meta">
              <div className="meta-section">
                <div className="meta-label">Invoice Number</div>
                <div className="meta-value" style={{ fontSize: '16px', fontWeight: 'bold' }}>{invoice.invoiceNumber}</div>

                <div className="meta-label" style={{ marginTop: '12px' }}>Invoice ID</div>
                <div className="meta-value">{invoice.invoiceId}</div>

                <div className="meta-label" style={{ marginTop: '12px' }}>Date</div>
                <div className="meta-value">{formatDate(invoice.invoiceDate)}</div>
              </div>

              <div className="meta-section">
                <div className="meta-label">Payment Status</div>
                <div className="meta-value">
                  <span className={`badge badge-${invoice.paymentStatus}`}>
                    {invoice.paymentStatus.toUpperCase()}
                  </span>
                </div>

                <div className="meta-label" style={{ marginTop: '12px' }}>Due Date</div>
                <div className="meta-value">{formatDate(calculateDueDate(invoice.invoiceDate, businessConfig?.paymentTermsDays || 14))}</div>
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div className="invoice-meta">
            <div className="meta-section">
              <div className="meta-label">Bill To</div>
              <div className="meta-value" style={{ fontWeight: 'bold' }}>{invoice.customerName}</div>
              {invoice.customerEmail && <div className="meta-value">Email: {invoice.customerEmail}</div>}
              {invoice.customerPhone && <div className="meta-value">Phone: {invoice.customerPhone}</div>}
              {invoice.customerAddress && <div className="meta-value">Address: {invoice.customerAddress}</div>}
            </div>
          </div>

          {/* Vehicle Information */}
          {(invoice.vin || invoice.vehicleYear || invoice.vehicleMake || invoice.vehicleModel) && (
            <div className="vehicle-info">
              <div style={{ marginBottom: '12px', fontSize: '16px', fontWeight: 'bold' }}>
                Vehicle: {invoice.vehicleYear ? `${invoice.vehicleYear} ` : ''}{invoice.vehicleMake || ''}{invoice.vehicleModel ? ` ${invoice.vehicleModel}` : ''}{invoice.vehicleColor ? ` - ${invoice.vehicleColor}` : ''}
              </div>
              {invoice.vin && (
                <div style={{ marginTop: '8px' }}>
                  <strong>VIN:</strong> {invoice.vin}
                </div>
              )}
            </div>
          )}

          {/* Services Table */}
          <table className="invoice-items-preview preview-table">
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left' }}>Service</th>
                <th style={{ width: '60px' }}>Qty</th>
                <th style={{ width: '80px' }}>Rate</th>
                <th style={{ width: '80px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={index}>
                  <td style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 'bold' }}>{item.serviceName}</div>
                    {item.description && <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{item.description}</div>}
                  </td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.rate, businessConfig?.currencySymbol)}</td>
                  <td>{formatCurrency(item.total, businessConfig?.currencySymbol)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="totals-section">
            <div className="total-row">
              <span>Subtotal:</span>
              <span>{formatCurrency(invoice.subtotal, businessConfig?.currencySymbol)}</span>
            </div>

            {invoice.discountValue > 0 && (
              <div className="total-row">
                <span>Discount {invoice.discountType === 'percentage' ? `(${invoice.discountValue}%)` : ''}:</span>
                <span>-{formatCurrency(invoice.discountValue, businessConfig?.currencySymbol)}</span>
              </div>
            )}

            <div className="total-row">
              <span>Tax ({(invoice.taxRate * 100).toFixed(0)}%):</span>
              <span>{formatCurrency(invoice.taxAmount, businessConfig?.currencySymbol)}</span>
            </div>

            <div className="total-row grand-total">
              <span>TOTAL DUE:</span>
              <span>{formatCurrency(invoice.totalAmount, businessConfig?.currencySymbol)}</span>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Notes:</div>
              <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-light)' }}>{invoice.notes}</div>
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-light)', fontSize: '12px' }}>
            Thank you for your business!
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons" style={{ marginTop: '24px', justifyContent: 'center' }}>
          <button className="btn-success" onClick={onDownloadPDF}>
            Download PDF
          </button>
          <button className="btn-secondary" onClick={onBack}>
            Back to Form
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function calculateDueDate(invoiceDate, days) {
  const date = new Date(invoiceDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}
