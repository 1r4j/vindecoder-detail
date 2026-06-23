# OAuth & Social Login Setup Guide

## Overview

The VIN Decoder app now supports OAuth/Social Login with:
- ✅ **Google Sign-In** (fully implemented)
- 🔄 **Apple Sign-In** (framework ready, button placeholder)

Users can now sign in with their existing Google accounts, making registration faster and easier.

## 🔐 Security Features

- ✅ OAuth tokens verified server-side
- ✅ User accounts auto-created or linked
- ✅ No passwords stored for OAuth users
- ✅ Profile pictures supported
- ✅ Provider linking/unlinking
- ✅ Automatic user discovery by email

## 🚀 Setup Instructions

### Google Sign-In Setup

#### Step 1: Create Google OAuth Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable "Google+ API"
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Choose "Web application"
6. Add authorized JavaScript origins:
   ```
   http://localhost:5173
   http://localhost:3000
   https://yourdomain.com
   ```
7. Add authorized redirect URIs:
   ```
   http://localhost:5173/
   http://localhost:3000/api/oauth/google/callback
   https://yourdomain.com/
   ```
8. Copy the **Client ID** (you'll need this)

#### Step 2: Configure Frontend

Create `.env` file in `frontend/` directory:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
```

Or in `.env.production`:

```env
VITE_GOOGLE_CLIENT_ID=your_production_google_client_id
```

#### Step 3: Verify Backend is Running

Make sure backend is running on `http://localhost:3000`:

```bash
cd backend
npm install  # Install new dependencies
npm run dev
```

#### Step 4: Test Google Sign-In

1. Start frontend:
   ```bash
   cd frontend
   npm run dev
   ```

2. Open browser to `http://localhost:5173`

3. You should see Google Sign-In button

4. Click "Sign in with Google"

5. Complete Google login

6. You'll be automatically logged in to the app

### Apple Sign-In Setup (Future)

Apple Sign-In framework is ready. To enable:

1. Implement Apple OAuth endpoint
2. Add Apple ID registration on Apple Developer
3. Configure signing certificates
4. Update frontend with Apple Sign-In SDK

See code comments in `oauth.js` for implementation notes.

## 📋 How It Works

### Google Sign-In Flow

```
User clicks "Sign in with Google"
  ↓
Google Sign-In popup appears
  ↓
User authenticates with Google
  ↓
Google returns ID token
  ↓
Frontend sends token to backend
  ↓
Backend verifies token with Google
  ↓
Backend creates/links user account
  ↓
Backend returns JWT token
  ↓
Frontend stores token, user logged in
  ↓
User access to app with OAuth account
```

### User Linking

**First Google Login:**
```
- Google user doesn't exist in system
- New user created with Google info
- Auto-populated business name from display name
- Account linked to Google
```

**Existing Email Match:**
```
- User has existing email/password account
- Google account automatically linked
- User can now use either login method
- Business settings preserved
```

## 🔗 API Endpoints

**Public OAuth Endpoints:**
```
POST /api/oauth/google/callback
  - Accepts: { token: "google_id_token" }
  - Returns: { token, user, isNewUser, linked }

POST /api/oauth/apple/callback
  - Accepts: { identityToken, user }
  - Returns: { token, user, isNewUser, linked }
```

**Protected Endpoints:**
```
GET /api/oauth/providers
  - Returns linked providers for current user

POST /api/oauth/unlink/:provider
  - Unlinks specified OAuth provider
```

## 📦 Dependencies Added

Backend:
- `passport`: OAuth middleware
- `passport-google-oauth20`: Google strategy
- `express-session`: Session management

Frontend:
- Google Sign-In SDK (loaded dynamically from CDN)

## 🗂️ Files Created/Modified

**New Files:**
```
backend/src/services/oauthService.js
backend/src/routes/oauth.js
frontend/src/utils/oauth.js
```

**Modified Files:**
```
backend/src/server.js              - Added OAuth routes
backend/src/services/userService.js - Added OAuth fields
backend/package.json               - Added dependencies
frontend/src/components/Login.jsx  - Added OAuth buttons
```

## 🧪 Testing OAuth

### Manual Testing

1. **Test Google Sign-In:**
   - Click "Sign in with Google"
   - Use any Google account
   - Should automatically log in

2. **Test Account Creation:**
   - Use new Google account
   - Should create new user in system
   - Business settings auto-populated

3. **Test Account Linking:**
   - Create email/password account
   - Log out
   - Sign in with Google using same email
   - Should link accounts automatically

### Testing Multiple Providers

1. Create account with email/password
2. Log out
3. Sign in with Google (same email)
4. Both login methods now work
5. User has unified account

### Testing Provider Unlinking

```javascript
// In browser console
const token = localStorage.getItem('token');
fetch('/api/oauth/unlink/google', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => console.log(data))
```

## 🔒 Security Best Practices

1. **Keep Client Secrets Safe:**
   - Never commit Google Client Secret to git
   - Store in environment variables only
   - Use different credentials for dev/prod

2. **Verify Tokens:**
   - Always verify OAuth tokens server-side
   - Don't trust client-provided token claims
   - Use official Google libraries

3. **HTTPS Required:**
   - OAuth only works over HTTPS in production
   - Localhost HTTP is acceptable for development
   - Always deploy with HTTPS

4. **Redirect URIs:**
   - Only register valid redirect URIs
   - Prevents redirect attacks
   - Update Google Console when deploying

## 📊 User Data from OAuth

**Google provides:**
- User ID (unique)
- Email
- Display name
- Profile picture URL

**App creates:**
- User account with OAuth ID
- Business settings with auto-populated name
- Session token for app access

## 🔧 Troubleshooting

### Google Sign-In Button Not Showing

**Issue:** Google button not visible

**Solutions:**
1. Check Google Client ID is set in `.env`
2. Check browser console for errors
3. Verify Google SDK is loaded
4. Check redirect URI is registered

### "Invalid Token" Error

**Issue:** Backend rejects Google token

**Solutions:**
1. Verify Google Client ID is correct
2. Check token isn't expired
3. Verify Google API enabled in Console
4. Check network request payload

### Cannot Create Account with Google

**Issue:** Google login fails

**Solutions:**
1. Check backend is running
2. Check `/api/oauth/google/callback` is accessible
3. Verify network request in DevTools
4. Check backend logs for errors

### Account Not Linking

**Issue:** Existing account not linked

**Solutions:**
1. Email must match exactly (case-insensitive)
2. Check backend received correct email
3. Verify user exists in system
4. Check backend logs

## 🚀 Production Deployment

### Before Deploying to Production

1. **Get Production Google Credentials:**
   - Create separate OAuth app in Google Console
   - Use production domain URLs

2. **Configure Environment:**
   ```bash
   VITE_GOOGLE_CLIENT_ID=prod_client_id
   ```

3. **Set Up Redirect URIs:**
   - Add production domain to Google Console
   - Format: `https://yourdomain.com`

4. **Enable HTTPS:**
   - Vercel/hosting auto-enables HTTPS
   - Confirm in browser address bar

5. **Test End-to-End:**
   - Test Google Sign-In on production
   - Test account creation
   - Test account linking

### Vercel Deployment

1. Add environment variable in Vercel dashboard:
   ```
   VITE_GOOGLE_CLIENT_ID = your_client_id
   ```

2. Register redirect URI in Google Console:
   ```
   https://yourdomain.vercel.app
   ```

3. Deploy and test

## 📚 Resources

- [Google Sign-In Documentation](https://developers.google.com/identity/gsi/web)
- [OAuth 2.0 Overview](https://developers.google.com/identity/protocols/oauth2)
- [Apple Sign-In Documentation](https://developer.apple.com/sign-in-with-apple/)

## ✨ Next Steps

- [ ] Deploy Google Sign-In to production
- [ ] Implement Apple Sign-In
- [ ] Add social provider unlinking UI
- [ ] Add GitHub Sign-In
- [ ] Add Microsoft/Office 365 Sign-In

---

**OAuth Setup Complete!** Users can now sign in with Google! 🔐

