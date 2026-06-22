import { useState, useEffect } from 'react';

export default function BusinessConfig({ config, onConfigUpdate, onClose }) {
  const [formData, setFormData] = useState({
    businessName: 'SPARKLE AUTO DETAILING',
    businessAddress: '123 Main Street, City, State 12345',
    businessPhone: '(555) 987-6543',
    businessEmail: 'info@sparkledetail.com',
    taxRate: 0.08,
    invoicePrefix: 'INV',
    paymentTermsDays: 14,
    currencySymbol: '$'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (config) {
      setFormData(prev => ({
        ...prev,
        ...config
      }));
    }
  }, [config]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'taxRate' || field === 'paymentTermsDays' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch('/api/services/config/business', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Failed to update configuration');
      }

      const data = await response.json();
      setSuccess('Business configuration saved successfully!');
      if (onConfigUpdate) {
        onConfigUpdate();
      }

      setTimeout(() => {
        if (onClose) onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <h2 className="page-title">Business Configuration</h2>

      <div className="content-card">
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        <form onSubmit={handleSubmit} className="invoice-form">
          {/* Business Information */}
          <div className="form-section">
            <h3 className="section-title">Business Information</h3>

            <div className="form-group">
              <label>Business Name *</label>
              <input
                type="text"
                required
                value={formData.businessName}
                onChange={(e) => handleChange('businessName', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Address</label>
              <textarea
                rows="2"
                value={formData.businessAddress}
                onChange={(e) => handleChange('businessAddress', e.target.value)}
                placeholder="Street, City, State ZIP"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={formData.businessPhone}
                  onChange={(e) => handleChange('businessPhone', e.target.value)}
                  placeholder="(555) 987-6543"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.businessEmail}
                  onChange={(e) => handleChange('businessEmail', e.target.value)}
                  placeholder="info@business.com"
                />
              </div>
            </div>
          </div>

          {/* Invoice Settings */}
          <div className="form-section">
            <h3 className="section-title">Invoice Settings</h3>

            <div className="form-row">
              <div className="form-group">
                <label>Invoice Prefix</label>
                <input
                  type="text"
                  value={formData.invoicePrefix}
                  onChange={(e) => handleChange('invoicePrefix', e.target.value)}
                  placeholder="INV"
                  maxLength="10"
                />
              </div>

              <div className="form-group">
                <label>Currency Symbol</label>
                <input
                  type="text"
                  value={formData.currencySymbol}
                  onChange={(e) => handleChange('currencySymbol', e.target.value)}
                  placeholder="$"
                  maxLength="5"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Default Tax Rate (%)</label>
                <input
                  type="number"
                  value={formData.taxRate * 100}
                  onChange={(e) => handleChange('taxRate', parseFloat(e.target.value) / 100)}
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>

              <div className="form-group">
                <label>Payment Terms (Days)</label>
                <input
                  type="number"
                  value={formData.paymentTermsDays}
                  onChange={(e) => handleChange('paymentTermsDays', e.target.value)}
                  min="0"
                  step="1"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="form-section">
            <h3 className="section-title">Invoice Header Preview</h3>

            <div style={{ backgroundColor: 'var(--light)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: '13px' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>{formData.businessName}</strong>
              </div>
              <div style={{ marginBottom: '8px', color: 'var(--text-light)', fontSize: '12px' }}>
                {formData.businessAddress}
              </div>
              <div style={{ color: 'var(--text-light)', fontSize: '12px' }}>
                Phone: {formData.businessPhone} | Email: {formData.businessEmail}
              </div>
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)', color: 'var(--text-light)', fontSize: '12px' }}>
                Invoice Format: {formData.invoicePrefix}-00001
              </div>
              <div style={{ marginTop: '4px', color: 'var(--text-light)', fontSize: '12px' }}>
                Tax Rate: {(formData.taxRate * 100).toFixed(1)}% | Payment Terms: Due in {formData.paymentTermsDays} days
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button type="submit" className="btn-success" disabled={loading}>
              {loading ? <span className="loading"></span> : 'Save Configuration'}
            </button>
            {onClose && (
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
