import { useState, useEffect } from 'react';
import './App.css';
import VINDecoder from './components/VINDecoder';
import InvoiceManager from './components/InvoiceManager';
import BusinessConfig from './components/BusinessConfig';
import Navigation from './components/Navigation';

function App() {
  const [currentPage, setCurrentPage] = useState('decoder');
  const [businessConfig, setBusinessConfig] = useState(null);

  useEffect(() => {
    fetchBusinessConfig();
  }, []);

  const fetchBusinessConfig = async () => {
    try {
      const response = await fetch('/api/services/config/business');
      if (response.ok) {
        const data = await response.json();
        setBusinessConfig(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch business config:', error);
    }
  };

  return (
    <div className="app">
      <Navigation currentPage={currentPage} setCurrentPage={setCurrentPage} />

      <main className="app-main">
        {currentPage === 'decoder' && <VINDecoder businessConfig={businessConfig} onBusinessConfigUpdate={fetchBusinessConfig} />}
        {currentPage === 'invoices' && <InvoiceManager businessConfig={businessConfig} />}
        {currentPage === 'settings' && <BusinessConfig config={businessConfig} onConfigUpdate={fetchBusinessConfig} onClose={() => setCurrentPage('decoder')} />}
      </main>
    </div>
  );
}

export default App;
