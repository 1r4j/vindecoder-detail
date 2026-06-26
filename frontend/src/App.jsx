import { useState, useEffect } from 'react';
import './App.css';
import VINDecoder from './components/VINDecoder';
import InvoiceForm from './components/InvoiceForm';
import InvoiceHistory from './components/InvoiceHistory';
import BusinessSettings from './components/BusinessSettings';
import Navigation from './components/Navigation';
import Login from './components/Login';
import { useAuth } from './context/AuthContext';

function App() {
  const [currentPage, setCurrentPage] = useState('decoder');
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const { isAuthenticated, loading, user } = useAuth();

  // Reset state when user changes
  useEffect(() => {
    if (isAuthenticated && user) {
      setCurrentPage('decoder');
      setSelectedVehicle(null);
    }
  }, [user?.id]);

  const handleVehicleSelected = (vehicle) => {
    setSelectedVehicle(vehicle);
    setCurrentPage('invoice');
  };

  const handleInvoiceCreated = (invoice) => {
    setCurrentPage('history');
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <span className="loading" style={{ transform: 'scale(2)' }}></span>
          <p style={{ marginTop: '16px', color: 'var(--text-light)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onSuccess={() => {}} />;
  }

  return (
    <div className="app">
      <Navigation currentPage={currentPage} setCurrentPage={setCurrentPage} />

      <main className="app-main">
        {currentPage === 'decoder' && <VINDecoder onVehicleSelected={handleVehicleSelected} />}
        {currentPage === 'invoice' && <InvoiceForm vehicle={selectedVehicle} onInvoiceCreated={handleInvoiceCreated} />}
        {currentPage === 'history' && <InvoiceHistory />}
        {currentPage === 'settings' && <BusinessSettings />}
      </main>
    </div>
  );
}

export default App;
