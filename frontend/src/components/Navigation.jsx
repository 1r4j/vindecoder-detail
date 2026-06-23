import { useAuth } from '../context/AuthContext';

export default function Navigation({ currentPage, setCurrentPage }) {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

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

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
          {user && (
            <>
              <span style={{ fontSize: '13px', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>
                👤 {user.name || user.email}
              </span>
              <button
                className="nav-button"
                onClick={handleLogout}
                title="Logout"
                style={{ padding: '8px 12px', fontSize: '12px' }}
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
