import { useState, useEffect } from 'react';
import { settingsService } from '../services/api';

export default function BusinessSettings() {
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
  const [taxRate, setTaxRate] = useState('8');
  const [invoicePrefix, setInvoicePrefix] = useState('INV');
  const [paymentTerms, setPaymentTerms] = useState('14');
  const [currency, setCurrency] = useState('$');

  useEffect(() => {
    loadSettings();
  }, []);

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
      setTaxRate(String(data?.taxRate || 8));
      setInvoicePrefix(data?.invoicePrefix || 'INV');
      setPaymentTerms(String(data?.paymentTerms || 14));
      setCurrency(data?.currency || '$');
    } catch (err) {
      setError('Failed to load settings');
      console.error(err);
    } finally {
      setLoading(false);
    }
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
        taxRate: parseInt(taxRate),
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Tax Rate (%)</label>
                  <input
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    min="0"
                    max="100"
                    step="0.1"
                  />
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
              <div>Tax Rate: {taxRate}%</div>
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
