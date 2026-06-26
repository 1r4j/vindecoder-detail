import { useState, useEffect } from 'react';
import { invoiceService, customerService } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ConsolidateInvoices({ onClose, onSuccess }) {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCustomers();
  }, [user?.id]);

  const loadCustomers = async () => {
    try {
      const res = await customerService.getList();
      setCustomers(res.data.data || []);
    } catch (err) {
      setError('Failed to load customers');
      console.error(err);
    }
  };

  const handleCustomerSelect = async (customerId) => {
    setSelectedCustomerId(customerId);
    setSelectedInvoices([]);
    setError('');

    try {
      const res = await invoiceService.getList(500, 0);
      const allInvoices = res.data.data || [];

      // Filter for pending/unpaid invoices for this customer
      const pendingInvoices = allInvoices.filter(inv =>
        inv.customerId === parseInt(customerId) &&
        (inv.status === 'pending' || inv.status === 'unpaid')
      );

      if (pendingInvoices.length < 2) {
        setError('This customer does not have at least 2 pending/unpaid invoices to consolidate');
        setCustomerInvoices([]);
      } else {
        setCustomerInvoices(pendingInvoices);
      }
    } catch (err) {
      setError('Failed to load invoices');
      console.error(err);
    }
  };

  const toggleInvoiceSelection = (invoiceId) => {
    setSelectedInvoices(prev =>
      prev.includes(invoiceId)
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const handleConsolidate = async () => {
    if (selectedInvoices.length < 2) {
      setError('Please select at least 2 invoices to consolidate');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await invoiceService.consolidate({
        customerId: parseInt(selectedCustomerId),
        invoiceIds: selectedInvoices,
        notes
      });

      if (onSuccess) {
        onSuccess(response.data.data);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to consolidate invoices');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectedInvoiceData = customerInvoices.filter(inv =>
    selectedInvoices.includes(inv.id)
  );

  const combinedSubtotal = selectedInvoiceData.reduce((sum, inv) => sum + inv.subtotal, 0);
  const combinedTax = selectedInvoiceData.reduce((sum, inv) => sum + inv.tax, 0);
  const combinedTotal = combinedSubtotal + combinedTax;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        maxWidth: '800px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto',
        padding: '24px'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '16px' }}>Consolidate Invoices</h2>

        {error && (
          <div style={{
            backgroundColor: '#fee',
            color: '#c33',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        {/* Customer Selection */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            Select Customer
          </label>
          <select
            value={selectedCustomerId}
            onChange={(e) => handleCustomerSelect(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              fontSize: '14px'
            }}
          >
            <option value="">Choose a customer...</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Invoice Selection */}
        {selectedCustomerId && customerInvoices.length >= 2 && (
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '12px', fontWeight: '500' }}>
              Select Invoices to Consolidate
            </label>
            <div style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
              {customerInvoices.map((invoice, index) => (
                <div
                  key={invoice.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    padding: '16px',
                    borderBottom: index < customerInvoices.length - 1 ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer',
                    backgroundColor: selectedInvoices.includes(invoice.id) ? '#f0f8f4' : 'white',
                    transition: 'background-color 0.2s'
                  }}
                  onClick={() => toggleInvoiceSelection(invoice.id)}
                >
                  {/* Custom Checkbox with Green Checkmark */}
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      minWidth: '24px',
                      borderRadius: '4px',
                      border: selectedInvoices.includes(invoice.id) ? 'none' : '2px solid var(--border)',
                      backgroundColor: selectedInvoices.includes(invoice.id) ? '#4CAF50' : 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {selectedInvoices.includes(invoice.id) && (
                      <span style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>✓</span>
                    )}
                  </div>

                  {/* Invoice Details */}
                  <div style={{ flex: 1 }}>
                    {/* Invoice Number and Date */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                      <div style={{ fontWeight: '600', fontSize: '14px' }}>
                        {invoice.invoiceNumber}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-light)' }}>
                        {new Date(invoice.invoiceDate).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Service Names */}
                    <div style={{ marginBottom: '8px' }}>
                      {invoice.items && invoice.items.length > 0 ? (
                        <div style={{ fontSize: '13px', color: 'var(--text)' }}>
                          <span style={{ color: 'var(--text-light)', fontWeight: '500' }}>Services:</span>{' '}
                          {invoice.items.map(item => item.name).join(', ')}
                        </div>
                      ) : (
                        <div style={{ fontSize: '13px', color: 'var(--text-light)' }}>No services</div>
                      )}
                    </div>

                    {/* Total */}
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary)' }}>
                      Total: ${invoice.total.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        {selectedInvoices.length >= 2 && (
          <div style={{
            backgroundColor: 'var(--light)',
            padding: '16px',
            borderRadius: '6px',
            marginBottom: '24px'
          }}>
            <div style={{ marginBottom: '12px', fontWeight: '600' }}>
              Consolidating {selectedInvoices.length} invoices
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>Subtotal</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>${combinedSubtotal.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>Tax</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>${combinedTax.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>Total</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--primary)' }}>
                  ${combinedTotal.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {selectedInvoices.length >= 2 && (
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes for this consolidated invoice..."
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                fontFamily: 'inherit'
              }}
            />
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'white',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConsolidate}
            disabled={selectedInvoices.length < 2 || loading}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              background: selectedInvoices.length < 2 ? 'var(--text-light)' : 'var(--primary)',
              color: 'white',
              cursor: selectedInvoices.length < 2 ? 'not-allowed' : 'pointer',
              fontWeight: '500'
            }}
          >
            {loading ? 'Consolidating...' : `Consolidate ${selectedInvoices.length} Invoices`}
          </button>
        </div>
      </div>
    </div>
  );
}
