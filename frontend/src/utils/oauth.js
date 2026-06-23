import api from '../services/api';

// Load Google Sign-In Script
export function loadGoogleSignIn(callback) {
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.onload = callback;
  document.head.appendChild(script);
}

// Initialize Google Sign-In Button
export function initializeGoogleButton(buttonId, onSuccess) {
  if (!window.google) {
    console.error('Google Sign-In library not loaded');
    return;
  }

  window.google.accounts.id.initialize({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
    callback: async (response) => {
      try {
        const result = await api.post('/oauth/google/callback', {
          token: response.credential
        });

        localStorage.setItem('token', result.data.token);
        api.defaults.headers.common['Authorization'] = `Bearer ${result.data.token}`;

        onSuccess(result.data);
      } catch (error) {
        console.error('Google login error:', error);
        throw new Error(error.response?.data?.error || 'Google login failed');
      }
    }
  });

  window.google.accounts.id.renderButton(
    document.getElementById(buttonId),
    {
      type: 'standard',
      size: 'large',
      text: 'signin_with',
      theme: 'outline',
      locale: 'en_US'
    }
  );
}

// Handle Google Sign-In Response
export async function handleGoogleSignIn(token) {
  try {
    const response = await api.post('/oauth/google/callback', {
      token
    });

    const { token: authToken, user, isNewUser } = response.data;

    // Store token
    localStorage.setItem('token', authToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;

    return {
      success: true,
      token: authToken,
      user,
      isNewUser
    };
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Google login failed');
  }
}

// Handle Apple Sign-In
export async function handleAppleSignIn(response) {
  try {
    const result = await api.post('/oauth/apple/callback', {
      identityToken: response.identityToken,
      user: response.user
    });

    const { token, user, isNewUser } = result.data;

    // Store token
    localStorage.setItem('token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    return {
      success: true,
      token,
      user,
      isNewUser
    };
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Apple login failed');
  }
}

// Get linked providers
export async function getLinkedProviders() {
  try {
    const response = await api.get('/oauth/providers');
    return response.data.data;
  } catch (error) {
    console.error('Failed to get linked providers:', error);
    return null;
  }
}

// Unlink provider
export async function unlinkProvider(provider) {
  try {
    await api.post(`/oauth/unlink/${provider}`);
    return true;
  } catch (error) {
    console.error(`Failed to unlink ${provider}:`, error);
    return false;
  }
}

export default {
  loadGoogleSignIn,
  initializeGoogleButton,
  handleGoogleSignIn,
  handleAppleSignIn,
  getLinkedProviders,
  unlinkProvider
};
