import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { loadGoogleSignIn, initializeGoogleButton, handleGoogleSignIn } from '../utils/oauth';

export default function Login({ onSuccess }) {
  const { login, register, error, setError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);

  // Initialize Google Sign-In
  useEffect(() => {
    loadGoogleSignIn(() => {
      try {
        console.log('🔄 Initializing Google Sign-In...');
        initializeGoogleButton('google-signin-button', async (response) => {
          console.log('✅ Google Sign-In callback triggered');
          setOauthLoading(true);
          try {
            // Google Sign-In returns credential (JWT token), not response.user.id_token
            const token = response.credential;
            console.log('🔑 Token received:', token ? '✅ Yes' : '❌ No');

            if (!token) {
              console.error('❌ No credential received from Google');
              console.log('📝 Response object keys:', Object.keys(response));
              throw new Error('No credential received from Google');
            }

            console.log('📤 Sending token to backend...');
            const result = await handleGoogleSignIn(token);
            if (result.success) {
              console.log('✅ Login successful');
              if (onSuccess) onSuccess();
            }
          } catch (err) {
            console.error('❌ Google login error:', err);
            setError(err.message || 'Google login failed');
          } finally {
            setOauthLoading(false);
          }
        });
      } catch (err) {
        console.error('❌ Failed to initialize Google Sign-In:', err);
      }
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result;

      if (isRegistering) {
        // Create account
        console.log('Registering new account...');
        result = await register(email, password, name);
      } else {
        // Login to existing account
        console.log('Logging in...');
        result = await login(email, password);
      }

      if (result.success) {
        console.log('Authentication successful');
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="content-card" style={{ maxWidth: '400px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚗</div>
          <h1 style={{ fontSize: '28px', marginBottom: '8px', color: 'var(--primary)' }}>VIN Decoder</h1>
          <p style={{ color: 'var(--text-light)' }}>Professional Invoice Management</p>
        </div>

        {error && <div className="error" style={{ marginBottom: '16px' }}>{error}</div>}

        {/* Social Login Buttons */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '12px', textAlign: 'center' }}>
            {isRegistering ? 'Create Account' : 'Sign In'} with
          </p>

          {/* Google Sign-In Button */}
          <div style={{ marginBottom: '12px' }}>
            <div id="google-signin-button" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}></div>
          </div>

          {/* Apple Sign-In Button */}
          <button
            type="button"
            onClick={async () => {
              setOauthLoading(true);
              setError('Apple Sign-In coming soon');
              setOauthLoading(false);
            }}
            disabled={oauthLoading}
            style={{
              width: '100%',
              padding: '12px',
              background: '#000',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: 0.7,
              marginBottom: '24px'
            }}
          >
            🍎 Continue with Apple (Coming Soon)
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px',
            opacity: 0.5
          }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
            <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {isRegistering && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required={isRegistering}
              />
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                style={{
                  width: '100%',
                  paddingRight: '48px',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '4px 6px',
                  height: 'auto',
                  width: 'auto',
                  minHeight: 'auto',
                  minWidth: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s',
                  zIndex: 1,
                  pointerEvents: 'auto'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(79, 70, 229, 0.1)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {isRegistering && (
              <p style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '4px' }}>
                Minimum 6 characters
              </p>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', marginBottom: '16px' }}
            disabled={loading}
          >
            {loading ? <span className="loading"></span> : (isRegistering ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div style={{ textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <p style={{ color: 'var(--text-light)', marginBottom: '12px' }}>
            {isRegistering ? 'Already have an account?' : "Don't have an account?"}
          </p>
          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
              setEmail('');
              setPassword('');
              setName('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              cursor: 'pointer',
              fontWeight: '600',
              textDecoration: 'underline',
              fontSize: '14px'
            }}
          >
            {isRegistering ? 'Sign In' : 'Create Account'}
          </button>
        </div>

        <div style={{
          marginTop: '24px',
          padding: '12px',
          backgroundColor: 'var(--light)',
          borderRadius: '8px',
          fontSize: '12px',
          color: 'var(--text-light)',
          textAlign: 'center'
        }}>
          <p>Demo Account:</p>
          <p style={{ fontFamily: 'monospace', marginTop: '4px' }}>
            Email: demo@example.com<br />
            Password: demo123
          </p>
        </div>
      </div>
    </div>
  );
}
