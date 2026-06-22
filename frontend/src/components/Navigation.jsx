export default function Navigation({ currentPage, setCurrentPage }) {
  return (
    <nav className="navigation">
      <div className="nav-container">
        <h1 className="nav-title">🚗 VIN Decoder</h1>
        <div className="nav-buttons">
          <button
            className={`nav-button ${currentPage === 'decoder' ? 'active' : ''}`}
            onClick={() => setCurrentPage('decoder')}
          >
            VIN Decoder
          </button>
        </div>
      </div>
    </nav>
  );
}
