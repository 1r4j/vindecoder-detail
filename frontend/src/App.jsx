import { useState } from 'react';
import './App.css';
import VINDecoder from './components/VINDecoder';
import Navigation from './components/Navigation';

function App() {
  const [currentPage, setCurrentPage] = useState('decoder');

  return (
    <div className="app">
      <Navigation currentPage={currentPage} setCurrentPage={setCurrentPage} />

      <main className="app-main">
        {currentPage === 'decoder' && <VINDecoder />}
      </main>
    </div>
  );
}

export default App;
