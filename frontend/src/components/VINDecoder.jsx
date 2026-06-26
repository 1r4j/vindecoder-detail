import { useState, useEffect } from 'react';
import { vehicleService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import VehicleDetails from './VehicleDetails';
import VINBreakdown from './VINBreakdown';
import OptimizedVINScanner from './OptimizedVINScanner';

export default function VINDecoder({ onVehicleSelected }) {
  const { user } = useAuth();
  const [vin, setVin] = useState('');
  const [vehicle, setVehicle] = useState(null);
  const [vehicleColor, setVehicleColor] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [recentVehicles, setRecentVehicles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Load vehicle history from localStorage when user changes
  useEffect(() => {
    if (!user?.id) {
      setRecentVehicles([]);
      return;
    }

    try {
      const storageKey = `vehicleHistory_${user.id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setRecentVehicles(JSON.parse(saved));
      } else {
        setRecentVehicles([]);
      }
    } catch (err) {
      console.error('Failed to load vehicle history:', err);
      setRecentVehicles([]);
    }
  }, [user?.id]);

  // Save vehicle history to localStorage when it changes (per user)
  const saveVehicleToHistory = (vehicleData) => {
    if (!user?.id) return;

    try {
      setRecentVehicles(prev => {
        const filtered = prev.filter(v => v.id !== vehicleData.id);
        const updated = [vehicleData, ...filtered].slice(0, 50); // Keep last 50 vehicles
        const storageKey = `vehicleHistory_${user.id}`;
        localStorage.setItem(storageKey, JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      console.error('Failed to save vehicle history:', err);
    }
  };

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
      saveVehicleToHistory(response.data.data);
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
  };

  return (
    <div className="page-container">
      <h2 className="page-title">VIN Decoder</h2>

      <div className="content-card">
        {showScanner && (
          <OptimizedVINScanner onVINDetected={handleScannerScan} onClose={() => setShowScanner(false)} />
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

            <VINBreakdown vin={vin} />

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
              <button className="btn-secondary" onClick={() => setVehicle(null)}>
                Clear
              </button>
              {onVehicleSelected && (
                <button className="btn-primary" onClick={() => onVehicleSelected(vehicle)}>
                  💼 Create Invoice
                </button>
              )}
            </div>
          </>
        )}

        {recentVehicles.length > 0 && !vehicle && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ marginBottom: '12px' }}>Vehicle History ({recentVehicles.length})</h3>
              <input
                type="text"
                placeholder="Search by year, make, model, or VIN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', marginBottom: '12px' }}
              />
            </div>

            <table>
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Make</th>
                  <th>Model</th>
                  <th>Body Type</th>
                  <th>VIN</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentVehicles
                  .filter(v =>
                    v.year?.toString().includes(searchQuery) ||
                    v.make?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    v.model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    v.vin?.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((v) => (
                    <tr key={v.id}>
                      <td>{v.year}</td>
                      <td>{v.make}</td>
                      <td>{v.model}</td>
                      <td>{v.bodyType}</td>
                      <td style={{ fontSize: '12px', fontFamily: 'monospace' }}>{v.vin}</td>
                      <td>
                        <button className="btn-small btn-primary" onClick={() => handleQuickSelect(v)}>
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {searchQuery && recentVehicles.filter(v =>
              v.year?.toString().includes(searchQuery) ||
              v.make?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              v.model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              v.vin?.toLowerCase().includes(searchQuery.toLowerCase())
            ).length === 0 && (
              <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: '20px' }}>
                No vehicles match your search
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
