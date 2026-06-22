import { useState, useEffect } from 'react';
import { invoiceService, servicesService } from '../services/api';
import { generateInvoicePDF, downloadPDF } from '../utils/pdfGenerator';
import InvoicePreview from './InvoicePreview';

export default function InvoiceCreator({ vehicle, businessConfig, onClose }) {
  console.log('Vehicle data received in InvoiceCreator:', vehicle);

  const [formData, setFormData] = useState({
    vehicleId: vehicle?.id || null,
    vin: vehicle?.vin || '',
    vehicleYear: vehicle?.year || null,
    vehicleMake: vehicle?.make || '',
    vehicleModel: vehicle?.model || '',
    vehicleColor: vehicle?.color || '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    serviceDate: new Date().toISOString().split('T')[0],
    items: [],
    taxRate: businessConfig?.taxRate || 0.08,
    discountType: 'none',
    discountValue: 0,
    notes: ''
  });

  const [availableServices, setAvailableServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);

  // Default car detailing services
  const DEFAULT_SERVICES = [
    { id: 1, name: 'Exterior Wash', price: 50, category: 'Exterior' },
    { id: 2, name: 'Interior Vacuum', price: 40, category: 'Interior' },
    { id: 3, name: 'Ceramic Coat', price: 150, category: 'Premium' },
    { id: 4, name: 'Window Cleaning', price: 25, category: 'Exterior' },
    { id: 5, name: 'Tire Shine', price: 20, category: 'Exterior' },
    { id: 6, name: 'Clay Bar Treatment', price: 60, category: 'Exterior' },
    { id: 7, name: 'Wax Application', price: 80, category: 'Exterior' },
    { id: 8, name: 'Leather Conditioning', price: 75, category: 'Interior' },
    { id: 9, name: 'Paint Correction', price: 150, category: 'Premium' },
    { id: 10, name: 'Carpet Cleaning', price: 100, category: 'Interior' },
    { id: 11, name: 'Engine Detailing', price: 120, category: 'Engine' },
    { id: 12, name: 'Headlight Restoration', price: 90, category: 'Exterior' }
  ];

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const response = await servicesService.getServices();
      if (response.data.data && response.data.data.length > 0) {
        setAvailableServices(response.data.data);
      } else {
        setAvailableServices(DEFAULT_SERVICES);
      }
    } catch (err) {
      console.error('Failed to fetch services, using defaults:', err);
      setAvailableServices(DEFAULT_SERVICES);
    }
  };

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { serviceName: '', description: '', quantity: 1, rate: 0, total: 0 }]
    }));
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = field === 'quantity' || field === 'rate' ? parseFloat(value) || 0 : value;

    if (field === 'quantity' || field === 'rate') {
      newItems[index].total = newItems[index].quantity * newItems[index].rate;
    }

    setFormData(prev => ({
      ...prev,
      items: newItems
    }));
  };

  const handleServiceSelect = (index, serviceName) => {
    const service = availableServices.find(s => s.name === serviceName);
    if (service) {
      const newItems = [...formData.items];
      newItems[index].serviceName = service.name;
      newItems[index].description = service.description;
      newItems[index].rate = service.defaultPrice;
      newItems[index].quantity = 1;
      newItems[index].total = service.defaultPrice;

      setFormData(prev => ({
        ...prev,
        items: newItems
      }));
    }
  };

  const calculateTotals = () => {
    let subtotal = formData.items.reduce((sum, item) => sum + (item.total || 0), 0);
    let discount = 0;

    if (formData.discountType === 'percentage') {
      discount = (subtotal * formData.discountValue) / 100;
    } else if (formData.discountType === 'fixed') {
      discount = formData.discountValue;
    }

    const taxableAmount = subtotal - discount;
    const taxAmount = taxableAmount * formData.taxRate;
    const totalAmount = taxableAmount + taxAmount;

    return { subtotal, discount, taxAmount, totalAmount };
  };

  const totals = calculateTotals();

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.customerName) {
      setError('Customer name is required');
      return;
    }

    if (formData.items.length === 0) {
      setError('At least one service item is required');
      return;
    }

    setLoading(true);

    try {
      const response = await invoiceService.create(formData);
      console.log('Invoice response from backend:', response.data.data);
      console.log('FormData sent:', formData);
      setInvoiceData(response.data.data);
      setShowPreview(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      console.log('Starting PDF generation...');
      console.log('Invoice data:', invoiceData);
      console.log('Business config:', businessConfig);

      const doc = await generateInvoicePDF(invoiceData, businessConfig);
      console.log('PDF generated successfully');
      console.log('PDF object:', doc);

      downloadPDF(doc, `Invoice_${invoiceData.invoiceNumber}.pdf`);
      console.log('PDF download initiated');
    } catch (err) {
      console.error('PDF generation error:', err);
      console.error('Error stack:', err.stack);
      setError(`Failed to generate PDF: ${err.message}`);
    }
  };

  if (showPreview && invoiceData) {
    return (
      <InvoicePreview
        invoice={invoiceData}
        businessConfig={businessConfig}
        onDownloadPDF={handleDownloadPDF}
        onClose={onClose}
        onBack={() => setShowPreview(false)}
      />
    );
  }

  return (
    <div className="page-container">
      <h2 className="page-title">Create Invoice</h2>

      <div className="content-card">
        {error && <div className="error">{error}</div>}

        <form onSubmit={handleCreateInvoice} className="invoice-form">
          {/* Customer Information */}
          <div className="form-section">
            <h3 className="section-title">Customer Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Customer Name *</label>
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Address</label>
              <input
                type="text"
                value={formData.customerAddress}
                onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
              />
            </div>
          </div>

          {/* Service Date */}
          <div className="form-section">
            <h3 className="section-title">Service Information</h3>
            <div className="form-group">
              <label>Service Date</label>
              <input
                type="date"
                value={formData.serviceDate}
                onChange={(e) => setFormData({ ...formData, serviceDate: e.target.value })}
              />
            </div>
          </div>

          {/* Service Items */}
          <div className="form-section">
            <h3 className="section-title">Services</h3>

            {formData.items.length === 0 ? (
              <p style={{ color: 'var(--text-light)', marginBottom: '16px' }}>No services added yet. Click "Add Service" below to get started.</p>
            ) : (
              <div style={{ marginBottom: '16px' }}>
                {formData.items.map((item, index) => (
                  <div key={index} style={{ backgroundColor: 'var(--light)', padding: '16px', borderRadius: '8px', marginBottom: '12px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '12px', alignItems: 'end', marginBottom: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-light)', marginBottom: '6px', textTransform: 'uppercase' }}>Service</label>
                        {item.serviceName && !item.serviceName.includes('Custom:') ? (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <select
                              value={item.serviceName}
                              onChange={(e) => {
                                if (e.target.value === 'custom') {
                                  handleItemChange(index, 'serviceName', 'Custom:');
                                } else {
                                  handleServiceSelect(index, e.target.value);
                                }
                              }}
                              style={{ flex: 1 }}
                            >
                              <option value="">Select a service</option>
                              {availableServices.map(service => (
                                <option key={service.id} value={service.name}>{service.name}</option>
                              ))}
                              <option value="custom">+ Custom Service</option>
                            </select>
                          </div>
                        ) : (
                          <input
                            type="text"
                            placeholder="Enter custom service name"
                            value={item.serviceName.replace('Custom:', '').trim()}
                            onChange={(e) => handleItemChange(index, 'serviceName', 'Custom: ' + e.target.value)}
                          />
                        )}
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-light)', marginBottom: '6px', textTransform: 'uppercase' }}>Qty</label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          min="0.1"
                          step="0.1"
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-light)', marginBottom: '6px', textTransform: 'uppercase' }}>Rate</label>
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                          min="0"
                          step="0.01"
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-light)', marginBottom: '6px', textTransform: 'uppercase' }}>Total</label>
                        <div style={{ padding: '10px', backgroundColor: 'white', borderRadius: '6px', fontWeight: '600' }}>
                          ${item.total.toFixed(2)}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-danger btn-small"
                        onClick={() => handleRemoveItem(index)}
                        style={{ height: '44px' }}
                      >
                        Remove
                      </button>
                    </div>

                    {item.description && !item.serviceName.includes('Custom:') && (
                      <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: 'var(--text-light)' }}>
                        {item.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button type="button" className="btn-secondary" onClick={handleAddItem}>
              + Add Service
            </button>
          </div>

          {/* Discounts and Totals */}
          <div className="form-section">
            <h3 className="section-title">Pricing</h3>

            <div className="invoice-summary">
              <div className="summary-row">
                <span>Subtotal:</span>
                <span>${totals.subtotal.toFixed(2)}</span>
              </div>

              <div className="form-row" style={{ marginBottom: '16px' }}>
                <div className="form-group">
                  <label>Discount Type</label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value, discountValue: 0 })}
                  >
                    <option value="none">None</option>
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
                {formData.discountType !== 'none' && (
                  <div className="form-group">
                    <label>Discount Value</label>
                    <input
                      type="number"
                      value={formData.discountValue}
                      onChange={(e) => setFormData({ ...formData, discountValue: parseFloat(e.target.value) || 0 })}
                      min="0"
                      step="0.01"
                    />
                  </div>
                )}
              </div>

              {formData.discountValue > 0 && (
                <div className="summary-row">
                  <span>Discount:</span>
                  <span>-${totals.discount.toFixed(2)}</span>
                </div>
              )}

              <div className="summary-row">
                <span>Tax ({(formData.taxRate * 100).toFixed(0)}%):</span>
                <span>${totals.taxAmount.toFixed(2)}</span>
              </div>

              <div className="summary-row total">
                <span>Total:</span>
                <span>${totals.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="form-section">
            <h3 className="section-title">Additional Information</h3>
            <div className="form-group">
              <label>Notes</label>
              <textarea
                rows="4"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add any additional notes for the invoice..."
              ></textarea>
            </div>
          </div>

          {/* Form Actions */}
          <div className="action-buttons">
            <button type="submit" className="btn-success" disabled={loading}>
              {loading ? <span className="loading"></span> : 'Create Invoice'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
