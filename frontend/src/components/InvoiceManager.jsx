import { useState, useEffect } from 'react';
import { invoiceService } from '../services/api';
import { generateInvoicePDF, downloadPDF } from '../utils/pdfGenerator';
import { formatDate, formatCurrency } from '../utils/formatting';
import InvoicePreview from './InvoicePreview';

export default function InvoiceManager({ businessConfig }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await invoiceService.getList();
      setInvoices(response.data.data);
    } catch (err) {
      setError('Failed to load invoices');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (invoiceId, newStatus) => {
    try {
      await invoiceService.updateStatus(invoiceId, newStatus);
      setInvoices(prevInvoices =>
        prevInvoices.map(inv =>
          inv.id === invoiceId ? { ...inv, paymentStatus: newStatus } : inv
        )
      );
    } catch (err) {
      setError('Failed to update invoice status');
    }
  };

  const handleDelete = async (invoiceId) => {
    if (confirm('Are you sure you want to delete this invoice?')) {
      try {
        await invoiceService.delete(invoiceId);
        setInvoices(invoices.filter(inv => inv.id !== invoiceId));
      } catch (err) {
        setError('Failed to delete invoice');
      }
    }
  };

  const handleDownloadPDF = async (invoice) => {
    try {
      const doc = await generateInvoicePDF(invoice, businessConfig);
      downloadPDF(doc, `Invoice_${invoice.invoiceNumber}.pdf`);
    } catch (err) {
      setError('Failed to generate PDF');
    }
  };

  const filteredInvoices = filterStatus === 'all'
    ? invoices
    : invoices.filter(inv => inv.paymentStatus === filterStatus);

  if (showPreview && selectedInvoice) {
    return (
      <InvoicePreview
        invoice={selectedInvoice}
        businessConfig={businessConfig}
        onDownloadPDF={() => handleDownloadPDF(selectedInvoice)}
        onClose={() => {
          setShowPreview(false);
          setSelectedInvoice(null);
        }}
        onBack={() => setShowPreview(false)}
      />
    );
  }

  return (
    <div className="page-container">
      <h2 className="page-title">Invoice History</h2>

      <div className="content-card">
        {error && <div className="error">{error}</div>}

        <div style={{ marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontWeight: '500' }}>Filter by Status:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
          >
            <option value="all">All Invoices</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>

          <button className="btn-secondary" onClick={fetchInvoices} disabled={loading}>
            {loading ? <span className="loading"></span> : 'Refresh'}
          </button>
        </div>

        {loading && <p>Loading invoices...</p>}

        {!loading && filteredInvoices.length === 0 ? (
          <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: '40px 20px' }}>
            No invoices found {filterStatus !== 'all' && `with status "${filterStatus}"`}
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <strong>{invoice.invoiceNumber}</strong>
                    </td>
                    <td>{invoice.customerName}</td>
                    <td>{formatDate(invoice.invoiceDate)}</td>
                    <td>{formatCurrency(invoice.totalAmount, businessConfig?.currencySymbol)}</td>
                    <td>
                      <select
                        value={invoice.paymentStatus}
                        onChange={(e) => handleStatusUpdate(invoice.id, e.target.value)}
                        className={`badge badge-${invoice.paymentStatus}`}
                        style={{
                          padding: '6px 8px',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '12px'
                        }}
                      >
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn-small btn-primary"
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setShowPreview(true);
                          }}
                        >
                          View
                        </button>
                        <button
                          className="btn-small btn-warning"
                          onClick={() => handleDownloadPDF(invoice)}
                        >
                          PDF
                        </button>
                        <button
                          className="btn-small btn-danger"
                          onClick={() => handleDelete(invoice.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && invoices.length > 0 && (
          <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border)', color: 'var(--text-light)', fontSize: '14px' }}>
            Total Invoices: {invoices.length} | Showing: {filteredInvoices.length}
          </div>
        )}
      </div>
    </div>
  );
}
