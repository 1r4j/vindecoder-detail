import { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Check if user is logged in on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      verifyToken(token);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (token) => {
    try {
      // If a token is provided, set it in Authorization header
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
      const response = await api.post('/auth/verify');
      setUser(response.data.user);
      setError('');
    } catch (err) {
      // Token verification failed, clear localStorage and headers
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, password, name) => {
    setError('');
    try {
      // Clear any old tokens first
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];

      const response = await api.post('/auth/register', { email, password, name });
      const { user } = response.data;

      // Don't store token in localStorage - use httpOnly cookies only
      // Just set Authorization header for this session if needed
      setUser(user);

      return { success: true, user };
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Registration failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const login = async (email, password) => {
    setError('');
    try {
      // Clear any old tokens first
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];

      const response = await api.post('/auth/login', { email, password });
      const { user } = response.data;

      // Don't store token in localStorage - use httpOnly cookies only
      // Server sets cookie automatically in response
      setUser(user);

      return { success: true, user };
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Login failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      // Clear local state first
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
      setError('');

      // Try to notify server to clear httpOnly cookie
      // (may fail if already logged out, which is OK)
      try {
        await api.post('/auth/logout');
      } catch (err) {
        console.log('Logout notification error (OK if already logged out):', err.message);
      }
    } catch (err) {
      console.error('Logout error:', err);
      setUser(null);
    }
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      error,
      isAuthenticated,
      register,
      login,
      logout,
      setError
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export default AuthContext;
