import { useState } from 'react';
import './App.css';
import VINDecoder from './components/VINDecoder';
import InvoiceForm from './components/InvoiceForm';
import InvoiceHistory from './components/InvoiceHistory';
import BusinessSettings from './components/BusinessSettings';
import Navigation from './components/Navigation';

function App() {
  const [currentPage, setCurrentPage] = useState('decoder');
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  const handleVehicleSelected = (vehicle) => {
    setSelectedVehicle(vehicle);
    setCurrentPage('invoice');
  };

  const handleInvoiceCreated = (invoice) => {
    setCurrentPage('history');
  };

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
