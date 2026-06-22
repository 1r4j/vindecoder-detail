export default function Navigation({ currentPage, setCurrentPage }) {
  return (
    <nav className="navigation">
      <div className="nav-container">
        <h1 className="nav-title">🚗 VIN Decoder & Invoice</h1>
        <div className="nav-buttons">
          <button
            className={`nav-button ${currentPage === 'decoder' ? 'active' : ''}`}
            onClick={() => setCurrentPage('decoder')}
          >
            VIN Decoder
          </button>
          <button
            className={`nav-button ${currentPage === 'invoice' ? 'active' : ''}`}
            onClick={() => setCurrentPage('invoice')}
          >
            Create Invoice
          </button>
          <button
            className={`nav-button ${currentPage === 'history' ? 'active' : ''}`}
            onClick={() => setCurrentPage('history')}
          >
            Invoice History
          </button>
          <button
            className={`nav-button ${currentPage === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentPage('settings')}
          >
            Settings
          </button>
        </div>
      </div>
    </nav>
  );
}
