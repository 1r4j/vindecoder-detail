import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import '../styles/Navigation.css';

export default function Navigation({ currentPage, setCurrentPage }) {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
  };

  const navItems = [
    { id: 'decoder', label: 'Scan', icon: '📱', title: 'VIN Decoder' },
    { id: 'invoice', label: 'Create', icon: '📄', title: 'Create Invoice' },
    { id: 'history', label: 'History', icon: '📋', title: 'Invoice History' },
    { id: 'settings', label: 'Settings', icon: '⚙️', title: 'Settings' }
  ];

  return (
    <>
      {/* Desktop Header */}
      <nav className="navigation navigation-desktop">
        <div className="nav-container">
          <div className="nav-header">
            <h1 className="nav-title">🚗 VIN Decoder</h1>
            <p className="nav-subtitle">Professional Invoice Management</p>
          </div>

          <div className="nav-buttons">
            {navItems.map(item => (
              <button
                key={item.id}
                className={`nav-button ${currentPage === item.id ? 'active' : ''}`}
                onClick={() => setCurrentPage(item.id)}
                title={item.title}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="nav-user-section">
            <div className="user-menu-container">
              <button
                className="user-button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                title={user?.name || user?.email}
              >
                <span className="user-avatar">👤</span>
                <span className="user-name">{user?.name || user?.email?.split('@')[0]}</span>
              </button>

              {showUserMenu && (
                <div className="user-menu-dropdown">
                  <div className="user-menu-header">
                    <p className="user-email">{user?.email}</p>
                  </div>
                  <button
                    className="user-menu-item logout-button"
                    onClick={handleLogout}
                  >
                    <span>🚪</span> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="navigation navigation-mobile">
        <div className="mobile-nav-container">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`mobile-nav-button ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => setCurrentPage(item.id)}
              title={item.title}
            >
              <span className="mobile-nav-icon">{item.icon}</span>
              <span className="mobile-nav-label">{item.label}</span>
            </button>
          ))}

          {/* User Menu Button */}
          <div className="mobile-nav-user">
            <button
              className={`mobile-nav-button user-menu-trigger ${showUserMenu ? 'active' : ''}`}
              onClick={() => setShowUserMenu(!showUserMenu)}
              title="Account"
            >
              <span className="mobile-nav-icon">👤</span>
              <span className="mobile-nav-label">Account</span>
            </button>

            {showUserMenu && (
              <div className="mobile-user-menu">
                <div className="mobile-user-menu-header">
                  <p className="mobile-user-name">{user?.name || 'User'}</p>
                  <p className="mobile-user-email">{user?.email}</p>
                </div>
                <button
                  className="mobile-user-logout"
                  onClick={handleLogout}
                >
                  <span>🚪</span> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
