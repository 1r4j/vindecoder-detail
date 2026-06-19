import { useState } from 'react';
import { vehicleService } from '../services/api';
import VehicleDetails from './VehicleDetails';
import InvoiceCreator from './InvoiceCreator';
import AdvancedVINScanner from './AdvancedVINScanner';

export default function VINDecoder({ businessConfig, onBusinessConfigUpdate }) {
  const [vin, setVin] = useState('');
  const [vehicle, setVehicle] = useState(null);
  const [vehicleColor, setVehicleColor] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showInvoiceCreator, setShowInvoiceCreator] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [recentVehicles, setRecentVehicles] = useState([]);

  const decodeVIN = async (vinToDecude) => {
    setError('');
    setVehicle(null);
    setVehicleColor('');
    setLoading(true);

    try {
      const response = await vehicleService.decode(vinToDecude.toUpperCase());
      console.log('✅ VIN decoded:', vinToDecude, response.data.data);
      setVehicle(response.data.data);
      setVehicleColor(response.data.data.color || '');

      setRecentVehicles(prev => {
        const filtered = prev.filter(v => v.id !== response.data.data.id);
        return [response.data.data, ...filtered].slice(0, 5);
      });
    } catch (err) {
      console.error('Decode error:', err);
      setError(err.response?.data?.error || 'Failed to decode VIN. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDecode = async (e) => {
    if (e) e.preventDefault();
    if (vin.length !== 17) {
      setError('VIN must be 17 characters');
      return;
    }
    await decodeVIN(vin);
  };

  const handleScannerScan = (scannedVin) => {
    console.log('🎯 VIN scanned:', scannedVin);
    setVin(scannedVin);
    setShowScanner(false);

    // Decode immediately with the scanned VIN (don't wait for state update)
    setTimeout(() => {
      decodeVIN(scannedVin);
    }, 300);
  };

  const handleColorChange = async (newColor) => {
    setVehicleColor(newColor);
    if (vehicle && vin) {
      setVehicle(prev => ({
        ...prev,
        color: newColor
      }));
      try {
        const response = await vehicleService.updateColor(vin, newColor);
        setVehicle(response.data.data);
      } catch (err) {
        console.error('Failed to update color:', err);
      }
    }
  };

  const handleQuickSelect = (selectedVehicle) => {
    setVehicle(selectedVehicle);
    setVin(selectedVehicle.vin);
    setShowInvoiceCreator(false);
  };

  return (
    <div className="page-container">
      <h2 className="page-title">VIN Decoder</h2>

      <div className="content-card">
        {showScanner && (
          <AdvancedVINScanner onScan={handleScannerScan} onClose={() => setShowScanner(false)} />
        )}

        {!showScanner && (
          <>
            <form onSubmit={handleDecode} className="scanner-input">
              <input
                type="text"
                placeholder="Enter or scan VIN (17 characters)"
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                maxLength="17"
                autoFocus
              />
              <button type="submit" className="btn-primary" disabled={loading || vin.length !== 17}>
                {loading ? <span className="loading"></span> : 'Decode VIN'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowScanner(true)}
                title="Use mobile camera to scan VIN"
              >
                📱 Scan
              </button>
            </form>
          </>
        )}

        {error && <div className="error">{error}</div>}

        {vehicle && (
          <>
            <VehicleDetails vehicle={vehicle} />

            <div style={{ marginBottom: '24px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
              <h3 style={{ marginBottom: '12px' }}>Vehicle Color</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                {['Black', 'White', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Brown', 'Gold', 'Beige', 'Custom'].map((color) => (
                  <button
                    key={color}
                    onClick={() => color === 'Custom' ? null : handleColorChange(color)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '6px',
                      border: vehicleColor === color ? '3px solid var(--primary)' : '1px solid var(--border)',
                      background: vehicleColor === color ? 'var(--light)' : 'white',
                      cursor: color === 'Custom' ? 'default' : 'pointer',
                      fontWeight: vehicleColor === color ? 'bold' : 'normal',
                      color: vehicleColor === color ? 'var(--primary)' : 'var(--text)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {color}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Or enter custom color:</label>
                <input
                  type="text"
                  placeholder="e.g., Pearl White, Metallic Blue"
                  value={vehicleColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div className="action-buttons">
              <button className="btn-success" onClick={() => setShowInvoiceCreator(true)}>
                Create Invoice
              </button>
              <button className="btn-secondary" onClick={() => setVehicle(null)}>
                Clear
              </button>
            </div>
          </>
        )}

        {recentVehicles.length > 0 && !vehicle && (
          <div>
            <h3>Recent Vehicles</h3>
            <table>
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Make</th>
                  <th>Model</th>
                  <th>Body Type</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentVehicles.map((v) => (
                  <tr key={v.id}>
                    <td>{v.year}</td>
                    <td>{v.make}</td>
                    <td>{v.model}</td>
                    <td>{v.bodyType}</td>
                    <td>
                      <button className="btn-small btn-primary" onClick={() => handleQuickSelect(v)}>
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showInvoiceCreator && vehicle && (
        <InvoiceCreator
          vehicle={vehicle}
          businessConfig={businessConfig}
          onClose={() => setShowInvoiceCreator(false)}
        />
      )}
    </div>
  );
}
