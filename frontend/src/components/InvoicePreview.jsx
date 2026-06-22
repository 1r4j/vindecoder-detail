import { useState } from 'react';
import { generatePDF } from '../utils/pdfGenerator';

export default function InvoicePreview({
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
  invoiceNumber,
  onBack,
  onConfirm,
  loading
}) {
  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      generatePDF({
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
      });
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      setExporting(false);
    }
  };

  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + (settings?.paymentTerms || 14));

  return (
    <div className="page-container">
      <h2 className="page-title">Review Invoice</h2>

      <div className="content-card">
        <div className="invoice-preview">
          <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
              <div>
                <h1 style={{ margin: '0 0 8px 0', fontSize: '28px' }}>{settings?.businessName || 'Your Business'}</h1>
                <div style={{ fontSize: '14px', color: 'var(--primary)', fontWeight: '600', marginTop: '4px' }}>{invoiceNumber}</div>
                <div style={{ fontSize: '14px', color: 'var(--text-light)' }}>
                  {settings?.address && <div>{settings.address}</div>}
                  {settings?.city && <div>{settings.city}, {settings.state} {settings.zipCode}</div>}
                  {settings?.phone && <div>{settings.phone}</div>}
                  {settings?.email && <div>{settings.email}</div>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary)' }}>INVOICE</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
            <div>
              <h4 style={{ marginBottom: '8px', color: 'var(--text-light)', fontSize: '12px' }}>BILL TO</h4>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>{customer?.name || 'Unknown'}</div>
              {customer?.email && <div style={{ fontSize: '13px', color: 'var(--text-light)' }}>{customer.email}</div>}
              {customer?.phone && <div style={{ fontSize: '13px', color: 'var(--text-light)' }}>{customer.phone}</div>}
              {customer?.address && <div style={{ fontSize: '13px', color: 'var(--text-light)' }}>{customer.address}</div>}
            </div>

            <div>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>Invoice Date</div>
                <div style={{ fontWeight: '600' }}>{new Date(invoiceDate).toLocaleDateString()}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>Due Date</div>
                <div style={{ fontWeight: '600' }}>{dueDate.toLocaleDateString()}</div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
            <h4 style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--text-light)' }}>VEHICLE INFORMATION</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', padding: '12px', backgroundColor: 'var(--light)', borderRadius: '6px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>Year</div>
                <div style={{ fontWeight: '600' }}>{vehicle.year}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>Make</div>
                <div style={{ fontWeight: '600' }}>{vehicle.make}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>Model</div>
                <div style={{ fontWeight: '600' }}>{vehicle.model}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>VIN</div>
                <div style={{ fontWeight: '600', fontSize: '11px', fontFamily: 'monospace' }}>{vehicle.vin}</div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <table style={{ width: '100%' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 0', fontWeight: '600' }}>Description</th>
                  <th style={{ textAlign: 'center', padding: '12px 0', fontWeight: '600' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '12px 0', fontWeight: '600' }}>Rate</th>
                  <th style={{ textAlign: 'right', padding: '12px 0', fontWeight: '600' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 0' }}>
                      <div style={{ fontWeight: '500' }}>{service.name}</div>
                      {service.description && <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{service.description}</div>}
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'center' }}>{service.quantity}</td>
                    <td style={{ padding: '12px 0', textAlign: 'right' }}>
                      {settings?.currency || '$'}{(service.defaultPrice || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: '600' }}>
                      {settings?.currency || '$'}{((service.defaultPrice || 0) * (service.quantity || 1)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '24px', marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
            <div>
              {notes && (
                <div>
                  <h4 style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '6px' }}>NOTES</h4>
                  <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-light)', fontSize: '13px' }}>{notes}</p>
                </div>
              )}
            </div>

            <div style={{ minWidth: '250px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', marginBottom: '12px' }}>
                <div style={{ textAlign: 'right', color: 'var(--text-light)' }}>Subtotal:</div>
                <div style={{ textAlign: 'right', fontWeight: '600' }}>
                  {settings?.currency || '$'}{subtotal.toFixed(2)}
                </div>

                <div style={{ textAlign: 'right', color: 'var(--text-light)' }}>Tax ({settings?.taxRate || 8}%):</div>
                <div style={{ textAlign: 'right', fontWeight: '600' }}>
                  {settings?.currency || '$'}{tax.toFixed(2)}
                </div>

                <div style={{
                  textAlign: 'right',
                  color: 'var(--primary)',
                  fontWeight: 'bold',
                  fontSize: '18px',
                  paddingTop: '12px',
                  borderTop: '2px solid var(--border)'
                }}>
                  TOTAL:
                </div>
                <div style={{
                  textAlign: 'right',
                  color: 'var(--primary)',
                  fontWeight: 'bold',
                  fontSize: '18px',
                  paddingTop: '12px',
                  borderTop: '2px solid var(--border)'
                }}>
                  {settings?.currency || '$'}{total.toFixed(2)}
                </div>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'var(--light)', borderRadius: '6px', marginTop: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>Status</div>
                <div style={{ fontWeight: '600', color: 'var(--text)' }}>PENDING</div>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-light)', marginBottom: '24px' }}>
            Thank you for your business!
          </div>
        </div>

        <div className="action-buttons">
          <button className="btn-secondary" onClick={onBack} disabled={loading || exporting}>
            Back to Edit
          </button>
          <button className="btn-secondary" onClick={handleExportPDF} disabled={loading || exporting}>
            {exporting ? <span className="loading"></span> : '📄 Export PDF'}
          </button>
          <button className="btn-primary" onClick={onConfirm} disabled={loading || exporting}>
            {loading ? <span className="loading"></span> : '✓ Save Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}
