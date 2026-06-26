import { useState, useEffect } from 'react';
import { settingsService } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function BusinessSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [taxRates, setTaxRates] = useState([{ name: 'Standard', rate: 8 }]);
  const [invoicePrefix, setInvoicePrefix] = useState('INV');
  const [paymentTerms, setPaymentTerms] = useState('14');
  const [currency, setCurrency] = useState('$');
  const [newTaxRateName, setNewTaxRateName] = useState('');
  const [newTaxRateValue, setNewTaxRateValue] = useState('0');

  // Reset all state when user changes
  useEffect(() => {
    // Clear state immediately
    setSettings(null);
    setBusinessName('');
    setAddress('');
    setCity('');
    setState('');
    setZipCode('');
    setPhone('');
    setEmail('');
    setTaxRates([{ name: 'Standard', rate: 8 }]);
    setInvoicePrefix('INV');
    setPaymentTerms('14');
    setCurrency('$');
    setNewTaxRateName('');
    setNewTaxRateValue('0');
    setError('');
    setSuccess('');

    // Then load new settings for the user
    if (user?.id) {
      loadSettings();
    }
  }, [user?.id]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await settingsService.get();
      const data = response.data.data;
      setSettings(data);

      setBusinessName(data?.businessName || '');
      setAddress(data?.address || '');
      setCity(data?.city || '');
      setState(data?.state || '');
      setZipCode(data?.zipCode || '');
      setPhone(data?.phone || '');
      setEmail(data?.email || '');

      // Handle backward compatibility: if taxRate exists (old format), convert to taxRates array
      if (data?.taxRates && Array.isArray(data.taxRates)) {
        setTaxRates(data.taxRates);
      } else if (data?.taxRate) {
        setTaxRates([{ name: 'Standard', rate: data.taxRate }]);
      } else {
        setTaxRates([{ name: 'Standard', rate: 8 }]);
      }

      setInvoicePrefix(data?.invoicePrefix || 'INV');
      setPaymentTerms(String(data?.paymentTerms || 14));
      setCurrency(data?.currency || '$');
      setError('');
    } catch (err) {
      setError('Failed to load settings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTaxRate = () => {
    if (!newTaxRateName.trim() || newTaxRateValue === '') {
      setError('Please enter tax rate name and value');
      return;
    }

    const rateValue = parseFloat(newTaxRateValue);
    if (isNaN(rateValue) || rateValue < 0 || rateValue > 100) {
      setError('Tax rate must be between 0 and 100');
      return;
    }

    // Check if name already exists
    if (taxRates.some(t => t.name.toLowerCase() === newTaxRateName.toLowerCase())) {
      setError('Tax rate name already exists');
      return;
    }

    setTaxRates([...taxRates, { name: newTaxRateName, rate: rateValue }]);
    setNewTaxRateName('');
    setNewTaxRateValue('0');
    setError('');
  };

  const handleRemoveTaxRate = (index) => {
    if (taxRates.length === 1) {
      setError('You must have at least one tax rate');
      return;
    }
    setTaxRates(taxRates.filter((_, i) => i !== index));
  };

  const handleUpdateTaxRate = (index, field, value) => {
    const updated = [...taxRates];
    if (field === 'rate') {
      const rateValue = parseFloat(value);
      if (!isNaN(rateValue) && rateValue >= 0 && rateValue <= 100) {
        updated[index].rate = rateValue;
      }
    } else {
      updated[index].name = value;
    }
    setTaxRates(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const updatedSettings = {
        businessName,
        address,
        city,
        state,
        zipCode,
        phone,
        email,
        taxRates,
        invoicePrefix,
        paymentTerms: parseInt(paymentTerms),
        currency
      };

      await settingsService.update(updatedSettings);
      setSettings(updatedSettings);
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !settings) {
    return (
      <div className="page-container">
        <h2 className="page-title">Business Settings</h2>
        <div className="content-card" style={{ textAlign: 'center', padding: '40px' }}>
          <span className="loading"></span>
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h2 className="page-title">Business Settings</h2>

      <div className="content-card">
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ marginBottom: '16px' }}>Business Information</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Business Name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Your Detailing Business"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Street Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main Street"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="State"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>ZIP Code</label>
                <input
                  type="text"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="12345"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="info@yourdetailing.com"
                  />
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ marginBottom: '16px' }}>Invoice Settings</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Currency Symbol</label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    placeholder="$"
                    maxLength="3"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Invoice Prefix</label>
                  <input
                    type="text"
                    value={invoicePrefix}
                    onChange={(e) => setInvoicePrefix(e.target.value)}
                    placeholder="INV"
                    maxLength="10"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  Tax Rates <span style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: '400' }}>(supports decimals like 9.25%)</span>
                </label>
                <div style={{ backgroundColor: 'var(--light)', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                  {taxRates.map((taxRate, index) => (
                    <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'center', marginBottom: index < taxRates.length - 1 ? '12px' : '0' }}>
                      <input
                        type="text"
                        value={taxRate.name}
                        onChange={(e) => handleUpdateTaxRate(index, 'name', e.target.value)}
                        placeholder="Tax Rate Name"
                        style={{ fontSize: '14px' }}
                      />
                      <input
                        type="number"
                        value={taxRate.rate}
                        onChange={(e) => handleUpdateTaxRate(index, 'rate', e.target.value)}
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="e.g., 9.25"
                        style={{ fontSize: '14px' }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveTaxRate(index)}
                        disabled={taxRates.length === 1}
                        style={{
                          background: 'var(--danger)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 10px',
                          cursor: taxRates.length === 1 ? 'not-allowed' : 'pointer',
                          opacity: taxRates.length === 1 ? 0.5 : 1,
                          fontSize: '12px',
                          minHeight: 'auto'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="text"
                    value={newTaxRateName}
                    onChange={(e) => setNewTaxRateName(e.target.value)}
                    placeholder="New tax rate name (e.g., Local, State)"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTaxRate()}
                    style={{ fontSize: '14px' }}
                  />
                  <input
                    type="number"
                    value={newTaxRateValue}
                    onChange={(e) => setNewTaxRateValue(e.target.value)}
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="e.g., 9.25"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTaxRate()}
                    style={{ fontSize: '14px' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddTaxRate}
                    style={{
                      background: 'var(--success)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      minHeight: 'auto',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    + Add
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Payment Terms (Days)</label>
                <input
                  type="number"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  min="0"
                  max="365"
                />
              </div>
            </div>
          </div>

          <div className="action-buttons">
            <button type="button" className="btn-secondary" onClick={loadSettings} disabled={loading}>
              Reset
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <span className="loading"></span> : '✓ Save Settings'}
            </button>
          </div>
        </form>

        <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
          <h3 style={{ marginBottom: '12px' }}>Preview</h3>
          <div style={{ padding: '16px', backgroundColor: 'var(--light)', borderRadius: '8px', borderLeft: '4px solid var(--primary)' }}>
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>{businessName || 'Your Business Name'}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-light)' }}>
              {address && <div>{address}</div>}
              {city && <div>{city}, {state} {zipCode}</div>}
              {phone && <div>Phone: {phone}</div>}
              {email && <div>Email: {email}</div>}
            </div>
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-light)' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong style={{ color: 'var(--text)' }}>Tax Rates:</strong>
                {taxRates.map((tr, idx) => (
                  <div key={idx} style={{ marginLeft: '16px', fontSize: '11px' }}>
                    {tr.name}: {tr.rate}%
                  </div>
                ))}
              </div>
              <div>Invoice Prefix: {invoicePrefix}</div>
              <div>Payment Terms: {paymentTerms} days</div>
              <div>Currency: {currency}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
