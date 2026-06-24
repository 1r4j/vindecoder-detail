import { useState, useEffect } from 'react';
import { invoiceService, customerService } from '../services/api';

export default function ConsolidateInvoices({ onClose, onSuccess }) {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCustomers();
  }, []);

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
            <div style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
              {customerInvoices.map(invoice => (
                <div
                  key={invoice.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    borderBottom: '1px solid var(--light)',
                    cursor: 'pointer',
                    backgroundColor: selectedInvoices.includes(invoice.id) ? 'var(--light)' : 'white',
                    borderRadius: '4px',
                    marginBottom: '8px'
                  }}
                  onClick={() => toggleInvoiceSelection(invoice.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedInvoices.includes(invoice.id)}
                    onChange={() => toggleInvoiceSelection(invoice.id)}
                    style={{ marginRight: '12px', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600' }}>{invoice.invoiceNumber}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                      {new Date(invoice.invoiceDate).toLocaleDateString()} • Total: ${invoice.total.toFixed(2)}
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
