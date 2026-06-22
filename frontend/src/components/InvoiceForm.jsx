import { useState, useEffect } from 'react';
import { invoiceService, customerService, servicesService, settingsService } from '../services/api';
import InvoicePreview from './InvoicePreview';

export default function InvoiceForm({ vehicle, onInvoiceCreated }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [services, setServices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState(null);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [newCustomer, setNewCustomer] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNotes, setInvoiceNotes] = useState('');

  const [selectedServices, setSelectedServices] = useState([]);
  const [customService, setCustomService] = useState({ name: '', description: '', price: '' });

  const [preview, setPreview] = useState(false);
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState('INV-00001');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [servicesRes, customersRes, settingsRes, invoicesRes] = await Promise.all([
        servicesService.getList(),
        customerService.getList(),
        settingsService.get(),
        invoiceService.getList(1000, 0)
      ]);

      setServices(servicesRes.data.data || []);
      setCustomers(customersRes.data.data || []);
      const settingsData = settingsRes.data.data;
      setSettings(settingsData);

      const invoices = invoicesRes.data.data || [];
      const prefix = settingsData?.invoicePrefix || 'INV';
      const nextNumber = invoices.length + 1;
      const invoiceNumber = `${prefix}-${String(nextNumber).padStart(5, '0')}`;
      setNextInvoiceNumber(invoiceNumber);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load services and customers');
    }
  };

  const handleAddService = (service) => {
    if (selectedServices.find(s => s.id === service.id)) {
      setSelectedServices(selectedServices.filter(s => s.id !== service.id));
    } else {
      setSelectedServices([...selectedServices, { ...service, quantity: 1 }]);
    }
  };

  const handleAddCustomService = () => {
    if (customService.name && customService.price) {
      const newService = {
        id: `custom-${Date.now()}`,
        name: customService.name,
        description: customService.description,
        quantity: 1,
        defaultPrice: parseFloat(customService.price)
      };
      setSelectedServices([...selectedServices, newService]);
      setCustomService({ name: '', description: '', price: '' });
    }
  };

  const handleRemoveService = (serviceId) => {
    setSelectedServices(selectedServices.filter(s => s.id !== serviceId));
  };

  const handleQuantityChange = (serviceId, quantity) => {
    setSelectedServices(
      selectedServices.map(s =>
        s.id === serviceId ? { ...s, quantity: Math.max(1, parseInt(quantity) || 1) } : s
      )
    );
  };

  const calculateTotals = () => {
    const subtotal = selectedServices.reduce(
      (sum, s) => sum + ((s.defaultPrice || 0) * (s.quantity || 1)),
      0
    );
    const taxRate = (settings?.taxRate || 8) / 100;
    const tax = subtotal * taxRate;
    return { subtotal, tax, total: subtotal + tax };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let customerId = selectedCustomerId;

      if (newCustomer) {
        if (!customerName) {
          throw new Error('Customer name is required');
        }
        const customerRes = await customerService.create({
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          address: customerAddress
        });
        customerId = customerRes.data.data.id;
      }

      if (!customerId) {
        throw new Error('Please select or create a customer');
      }

      if (selectedServices.length === 0) {
        throw new Error('Please add at least one service');
      }

      const { subtotal, tax } = calculateTotals();
      const total = subtotal + tax;

      const invoiceData = {
        customerId: parseInt(customerId),
        vin: vehicle.vin,
        invoiceDate,
        serviceDate,
        items: selectedServices.map(s => ({
          serviceId: s.id,
          name: s.name,
          description: s.description,
          quantity: s.quantity,
          price: s.defaultPrice || 0
        })),
        subtotal: Math.round(subtotal * 100) / 100,
        tax: Math.round(tax * 100) / 100,
        discount: 0,
        total: Math.round(total * 100) / 100,
        notes: invoiceNotes
      };

      const response = await invoiceService.create(invoiceData);

      if (onInvoiceCreated) {
        onInvoiceCreated(response.data.data);
      }

      setPreview(false);
      setStep(1);
      resetForm();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setCustomerAddress('');
    setSelectedCustomerId('');
    setNewCustomer(false);
    setSelectedServices([]);
    setInvoiceNotes('');
  };

  if (!vehicle) {
    return (
      <div className="content-card">
        <p style={{ color: 'var(--text-light)', textAlign: 'center' }}>Please decode a vehicle first</p>
      </div>
    );
  }

  const { subtotal, tax, total } = calculateTotals();

  if (preview) {
    return (
      <InvoicePreview
        vehicle={vehicle}
        customer={{
          name: newCustomer ? customerName : customers.find(c => c.id === parseInt(selectedCustomerId))?.name,
          email: newCustomer ? customerEmail : customers.find(c => c.id === parseInt(selectedCustomerId))?.email,
          phone: newCustomer ? customerPhone : customers.find(c => c.id === parseInt(selectedCustomerId))?.phone,
          address: newCustomer ? customerAddress : customers.find(c => c.id === parseInt(selectedCustomerId))?.address
        }}
        services={selectedServices}
        invoiceDate={invoiceDate}
        serviceDate={serviceDate}
        notes={invoiceNotes}
        subtotal={subtotal}
        tax={tax}
        total={total}
        settings={settings}
        invoiceNumber={nextInvoiceNumber}
        onBack={() => setPreview(false)}
        onConfirm={handleSubmit}
        loading={loading}
      />
    );
  }

  return (
    <div className="page-container">
      <h2 className="page-title">Create Invoice</h2>

      <div className="content-card">
        <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
          <h3>Vehicle Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginTop: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>Year</label>
              <div style={{ fontWeight: '600' }}>{vehicle.year}</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>Make</label>
              <div style={{ fontWeight: '600' }}>{vehicle.make}</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>Model</label>
              <div style={{ fontWeight: '600' }}>{vehicle.model}</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>Color</label>
              <div style={{ fontWeight: '600' }}>{vehicle.color || 'Not specified'}</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>VIN</label>
              <div style={{ fontWeight: '600', fontSize: '12px', fontFamily: 'monospace' }}>{vehicle.vin}</div>
            </div>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <>
              <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ marginBottom: '16px' }}>Customer Information</h3>

                {!newCustomer && customers.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Select Existing Customer:</label>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}
                    >
                      <option value="">Choose a customer...</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.email || 'No email'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCustomer(!newCustomer);
                      setSelectedCustomerId('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontSize: '14px'
                    }}
                  >
                    {newCustomer ? 'Use Existing Customer' : '+ Create New Customer'}
                  </button>
                </div>

                {newCustomer && (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Name *</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Customer name"
                        required
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Email</label>
                        <input
                          type="email"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          placeholder="email@example.com"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Phone</label>
                        <input
                          type="tel"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="(555) 123-4567"
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Address</label>
                      <input
                        type="text"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="Street address"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ marginBottom: '16px' }}>Dates</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Invoice Date</label>
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Service Date</label>
                    <input
                      type="date"
                      value={serviceDate}
                      onChange={(e) => setServiceDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 style={{ marginBottom: '16px' }}>Services *</h3>
                <div style={{ marginBottom: '16px', display: 'grid', gap: '8px' }}>
                  {services.map(service => (
                    <label key={service.id} style={{ display: 'flex', alignItems: 'center', padding: '12px', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedServices.some(s => s.id === service.id)}
                        onChange={() => handleAddService(service)}
                        style={{ marginRight: '12px', cursor: 'pointer', width: '18px', height: '18px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600' }}>{service.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{service.description || ''}</div>
                      </div>
                      <div style={{ fontWeight: '600', minWidth: '80px', textAlign: 'right' }}>
                        {settings?.currency || '$'}{service.defaultPrice || 0}
                      </div>
                    </label>
                  ))}
                </div>

                <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: 'var(--light)', borderRadius: '6px' }}>
                  <h4 style={{ marginBottom: '12px' }}>Add Custom Service</h4>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    <input
                      type="text"
                      placeholder="Service name"
                      value={customService.name}
                      onChange={(e) => setCustomService({ ...customService, name: e.target.value })}
                    />
                    <input
                      type="text"
                      placeholder="Service description (optional)"
                      value={customService.description}
                      onChange={(e) => setCustomService({ ...customService, description: e.target.value })}
                    />
                    <input
                      type="number"
                      placeholder="Price"
                      value={customService.price}
                      onChange={(e) => setCustomService({ ...customService, price: e.target.value })}
                      min="0"
                      step="0.01"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomService}
                      className="btn-secondary"
                      disabled={!customService.name || !customService.price}
                    >
                      Add Custom Service
                    </button>
                  </div>
                </div>
              </div>

              {selectedServices.length > 0 && (
                <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
                  <h3 style={{ marginBottom: '16px' }}>Selected Services</h3>
                  <table style={{ width: '100%', marginBottom: '16px' }}>
                    <thead>
                      <tr>
                        <th>Service</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Total</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedServices.map(service => (
                        <tr key={service.id}>
                          <td>{service.name}</td>
                          <td>
                            <input
                              type="number"
                              value={service.quantity}
                              onChange={(e) => handleQuantityChange(service.id, e.target.value)}
                              min="1"
                              max="100"
                              style={{ width: '50px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }}
                            />
                          </td>
                          <td>{settings?.currency || '$'}{(service.defaultPrice || 0).toFixed(2)}</td>
                          <td>{settings?.currency || '$'}{((service.defaultPrice || 0) * (service.quantity || 1)).toFixed(2)}</td>
                          <td>
                            <button
                              type="button"
                              onClick={() => handleRemoveService(service.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Notes</label>
                    <textarea
                      value={invoiceNotes}
                      onChange={(e) => setInvoiceNotes(e.target.value)}
                      placeholder="Any additional notes for the invoice..."
                      style={{ width: '100%', minHeight: '80px', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px', padding: '16px', backgroundColor: 'var(--light)', borderRadius: '6px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>Subtotal</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{settings?.currency || '$'}{subtotal.toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>Tax ({settings?.taxRate || 8}%)</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{settings?.currency || '$'}{tax.toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>Total</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--primary)' }}>{settings?.currency || '$'}{total.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="action-buttons">
                    <button type="button" className="btn-secondary" onClick={() => resetForm()}>
                      Clear
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => setPreview(true)}
                      disabled={!selectedCustomerId && !newCustomer}
                    >
                      Review Invoice
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </form>
      </div>
    </div>
  );
}
