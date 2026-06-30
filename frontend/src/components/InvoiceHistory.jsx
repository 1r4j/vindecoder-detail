import { useState, useEffect } from 'react';
import { invoiceService, customerService, settingsService } from '../services/api';
import { generatePDF, generateConsolidatedPDF } from '../utils/pdfGenerator';
import ConsolidateInvoices from './ConsolidateInvoices';
import { useAuth } from '../context/AuthContext';

export default function InvoiceHistory() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState({});
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [exportingId, setExportingId] = useState(null);
  const [showConsolidate, setShowConsolidate] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadData();
  }, [statusFilter, user?.id]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [invoicesRes, customersRes, settingsRes] = await Promise.all([
        invoiceService.getList(500, 0, statusFilter === 'all' ? null : statusFilter),
        customerService.getList(),
        settingsService.get()
      ]);

      const customerMap = {};
      (customersRes.data.data || []).forEach(c => {
        customerMap[c.id] = c;
      });

      setInvoices(invoicesRes.data.data || []);
      setCustomers(customerMap);
      setSettings(settingsRes.data.data);
    } catch (err) {
      setError('Failed to load invoices');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await invoiceService.update(id, { status: newStatus });
      loadData();
    } catch (err) {
      setError('Failed to update invoice status');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;

    try {
      await invoiceService.delete(id);
      setInvoices(invoices.filter(i => i.id !== id));
    } catch (err) {
      setError('Failed to delete invoice');
    }
  };

  const handleExportPDF = async (invoice) => {
    setExportingId(invoice.id);
    try {
      const customer = customers[invoice.customerId] || {};

      // Check if this is a consolidated invoice (has consolidatedInvoiceIds or consolidatedFrom field)
      const isConsolidated = invoice.consolidatedInvoiceIds || invoice.consolidatedFrom;

      if (isConsolidated) {
        // For consolidated invoices, fetch the original invoices
        const consolidatedIds = invoice.consolidatedInvoiceIds || (invoice.consolidatedFrom && JSON.parse(invoice.consolidatedFrom)) || [];

        if (consolidatedIds.length > 0) {
          // Get all invoices and filter to the consolidated ones
          const allInvoicesRes = await invoiceService.getList(500, 0);
          const allInvoices = allInvoicesRes.data.data || [];
          const originalInvoices = allInvoices.filter(inv => consolidatedIds.includes(inv.id));

          generateConsolidatedPDF({
            consolidatedInvoice: invoice,
            originalInvoices: originalInvoices.length > 0 ? originalInvoices : [invoice],
            customer,
            settings
          });
        } else {
          // Fallback if we can't find consolidated invoice IDs
          generateConsolidatedPDF({
            consolidatedInvoice: invoice,
            originalInvoices: [invoice],
            customer,
            settings
          });
        }
      } else {
        // Regular invoice - use standard PDF generator
        const vehicle = {
          year: invoice.year || 'Not specified',
          make: invoice.make || 'Not specified',
          model: invoice.model || 'Not specified',
          bodyType: invoice.bodyType || 'N/A',
          vin: invoice.vin || 'Not specified',
          color: invoice.color || 'Not specified'
        };

        generatePDF({
          vehicle,
          customer,
          services: invoice.items || [],
          invoiceDate: invoice.invoiceDate,
          serviceDate: invoice.serviceDate,
          notes: invoice.notes,
          subtotal: invoice.subtotal,
          tax: invoice.tax,
          total: invoice.total,
          settings,
          invoiceNumber: invoice.invoiceNumber
        });
      }
    } catch (err) {
      console.error('PDF generation error:', err);
      setError('Failed to generate PDF');
    } finally {
      setExportingId(null);
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const customer = customers[invoice.customerId];
    const customerName = customer?.name || '';
    const vehicleInfo = `${invoice.year} ${invoice.make} ${invoice.model}`;

    return (
      customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicleInfo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.vin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'var(--success)';
      case 'pending': return 'var(--warning)';
      case 'overdue': return 'var(--danger)';
      default: return 'var(--text-light)';
    }
  };

  return (
    <div className="page-container">
      <h2 className="page-title">Invoice History</h2>

      <div className="content-card">
        {error && <div className="error">{error}</div>}

        {successMessage && (
          <div style={{
            backgroundColor: '#efe',
            color: '#3c3',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '16px'
          }}>
            {successMessage}
          </div>
        )}

        <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '12px', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>

          <input
            type="text"
            placeholder="Search by customer, vehicle, or invoice #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%' }}
          />

          <button
            onClick={() => setShowConsolidate(true)}
            style={{
              padding: '10px 16px',
              borderRadius: '6px',
              border: 'none',
              background: 'var(--primary)',
              color: 'white',
              cursor: 'pointer',
              fontWeight: '500',
              whiteSpace: 'nowrap'
            }}
          >
            📋 Consolidate
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)' }}>
            <span className="loading"></span>
            <p>Loading invoices...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)' }}>
            <p>No invoices found</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Vehicle</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(invoice => (
                  <tr key={invoice.id}>
                    <td style={{ fontWeight: '600', fontFamily: 'monospace', fontSize: '12px' }}>
                      {invoice.invoiceNumber || `INV-${String(invoice.id).padStart(5, '0')}`}
                    </td>
                    <td>{new Date(invoice.invoiceDate).toLocaleDateString()}</td>
                    <td>{customers[invoice.customerId]?.name || 'Unknown'}</td>
                    <td style={{ fontSize: '13px' }}>
                      {invoice.year} {invoice.make} {invoice.model}
                    </td>
                    <td style={{ fontWeight: '600' }}>
                      {settings?.currency || '$'}{invoice.total?.toFixed(2) || '0.00'}
                    </td>
                    <td>
                      <select
                        value={invoice.status}
                        onChange={(e) => handleStatusUpdate(invoice.id, e.target.value)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '4px',
                          border: '1px solid var(--border)',
                          color: getStatusColor(invoice.status),
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleExportPDF(invoice)}
                          disabled={exportingId === invoice.id}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}
                        >
                          {exportingId === invoice.id ? '...' : '📄'}
                        </button>
                        <button
                          onClick={() => handleDelete(invoice.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--danger)',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>Total Invoices</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{invoices.length}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>Pending</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--warning)' }}>
              {invoices.filter(i => i.status === 'pending').length}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>Paid</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--success)' }}>
              {invoices.filter(i => i.status === 'paid').length}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>Total Revenue</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--primary)' }}>
              {settings?.currency || '$'}
              {invoices.reduce((sum, i) => sum + (i.total || 0), 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {showConsolidate && (
        <ConsolidateInvoices
          onClose={() => setShowConsolidate(false)}
          onSuccess={(newInvoice) => {
            setShowConsolidate(false);
            setSuccessMessage(`✅ Successfully created consolidated invoice ${newInvoice.invoiceNumber}`);
            setTimeout(() => setSuccessMessage(''), 5000);
            loadData();
          }}
        />
      )}
    </div>
  );
}
