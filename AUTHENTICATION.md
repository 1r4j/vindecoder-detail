# Authentication & User Accounts Guide

## Overview

The VIN Decoder & Invoice Generator now features a complete authentication system that allows users to create accounts, log in securely, and access their own separate data including vehicles, invoices, customers, and business settings.

## 🔐 Authentication Features

### User Accounts
- ✅ User registration with email and password
- ✅ Secure password hashing (bcryptjs)
- ✅ JWT token-based authentication
- ✅ Automatic session persistence (7-day tokens)
- ✅ Logout functionality
- ✅ User profile display

### Data Privacy
- ✅ All user data is isolated per account
- ✅ Vehicles saved per user
- ✅ Invoices tied to user accounts
- ✅ Customers stored per user
- ✅ Business settings unique per user
- ✅ Secure API endpoints with authentication

## 🚀 Getting Started

### For Users

**Creating an Account:**
1. Open the app
2. Click "Create Account"
3. Enter email, password (min 6 chars), and name
4. Click "Create Account"
5. Automatically logged in and ready to use

**Logging In:**
1. Enter your email
2. Enter your password
3. Click "Sign In"
4. Access all your saved data

**Logging Out:**
1. Click your name/email in top right
2. Click "Logout"
3. Session cleared, redirected to login page

### Demo Account

For testing purposes, a demo account is available:
```
Email: demo@example.com
Password: demo123
```

## 🛠️ Backend Implementation

### API Endpoints

**Authentication Endpoints:**
```
POST   /api/auth/register     - Create new account
POST   /api/auth/login        - Log in to account
POST   /api/auth/verify       - Verify token validity
POST   /api/auth/logout       - Log out (confirmation)
GET    /api/auth/me           - Get current user info
```

**Protected Endpoints (require authentication):**
```
GET    /api/vehicles          - List user's vehicles
POST   /api/vehicles/decode   - Decode VIN

GET    /api/customers         - List user's customers
POST   /api/customers         - Create customer

GET    /api/invoices          - List user's invoices
POST   /api/invoices          - Create invoice

GET    /api/settings          - Get user's business settings
PATCH  /api/settings          - Update business settings
```

**Public Endpoints:**
```
GET    /api/services          - List available services (no auth)
GET    /api/health           - Health check
```

### Authentication Flow

**Registration:**
```
User Input (email, password, name)
        ↓
Validate Input
        ↓
Hash Password (bcryptjs)
        ↓
Create User Record
        ↓
Generate JWT Token (7-day expiry)
        ↓
Return Token + User Data
        ↓
Save Token to localStorage
```

**Login:**
```
User Input (email, password)
        ↓
Find User by Email
        ↓
Compare Password Hash
        ↓
Generate JWT Token
        ↓
Return Token + User Data
        ↓
Save Token to localStorage
```

**Request with Authentication:**
```
Client Request
        ↓
Include Token in Header: "Authorization: Bearer <token>"
        ↓
Server Validates Token
        ↓
Extract userId from Token
        ↓
Process Request (filtered by userId)
        ↓
Return User-Specific Data
```

### Security Measures

1. **Password Security:**
   - Bcryptjs with 10 salt rounds
   - Never stored in plain text
   - Never returned in API responses

2. **Token Security:**
   - JWT tokens signed with secret key
   - 7-day expiration time
   - Verified on every protected request
   - Stored in secure localStorage

3. **API Security:**
   - Authentication middleware on protected routes
   - userId extracted from token for data filtering
   - Users can only access their own data
   - CORS enabled for safe cross-origin requests

4. **Data Isolation:**
   - Each user has separate vehicle history
   - Each user has separate invoices
   - Each user has separate customers
   - Business settings per user account

## 📱 Frontend Implementation

### AuthContext (Context API)

Located in `frontend/src/context/AuthContext.jsx`

```javascript
// Get authentication state
const { user, isAuthenticated, loading, error } = useAuth()

// Available methods
register(email, password, name)  // Create new account
login(email, password)           // Log in to account
logout()                         // Log out
setError(message)               // Set error message
```

### Login Component

Located in `frontend/src/components/Login.jsx`

Features:
- Email and password input
- Toggle password visibility
- Registration mode toggle
- Error messages
- Demo account info
- Loading state
- Fully responsive design

### Protected App Flow

```
App.jsx
  ↓
AuthProvider wraps entire app
  ↓
useAuth() checks localStorage for token
  ↓
If token exists:
  ├─ Verify token with backend
  ├─ Load user data
  ├─ Show main app
  └─ Set Authorization header on all requests
  ↓
If no token:
  ├─ Show Login component
  ├─ User can register or login
  └─ After success, token saved and main app shown
```

## 💾 Data Storage

### Database Structure

**Users Collection:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "password": "$2a$10$...", // hashed
  "name": "John Doe",
  "createdAt": "2024-06-22T...",
  "businessSettings": {
    "businessName": "John's Business",
    "address": "123 Main St",
    "taxRate": 8,
    ...
  }
}
```

**Vehicles (User-Filtered):**
```json
{
  "id": 1,
  "userId": 1,
  "vin": "1HGBH41JXMN109186",
  "year": 2021,
  "make": "Honda",
  ...
}
```

**Invoices (User-Filtered):**
```json
{
  "id": 1,
  "userId": 1,
  "invoiceNumber": "INV-00001",
  "customerId": 1,
  ...
}
```

**Customers (User-Filtered):**
```json
{
  "id": 1,
  "userId": 1,
  "name": "John Smith",
  ...
}
```

## 🔑 Token Management

### Token Storage
- Stored in browser localStorage
- Automatically retrieved on app startup
- Automatically attached to all API requests
- Automatically cleared on logout

### Token Verification
- Verified on app load
- If invalid/expired, user returned to login
- Valid tokens refresh auth context

### Token Expiration
- Default: 7 days
- User automatically logged out after expiration
- Logout clears token immediately

## 🔒 Security Best Practices

### For Developers

1. **Never expose JWT_SECRET:**
   - Change in production environment
   - Use environment variables
   - Example: `JWT_SECRET=your-random-secret-key`

2. **HTTPS in Production:**
   - Always use HTTPS for authentication
   - Tokens transmitted securely
   - Prevents token interception

3. **Password Requirements:**
   - Minimum 6 characters (can increase)
   - Hashed with bcryptjs
   - Never shown in console/logs

4. **API Endpoints:**
   - All protected endpoints require token
   - Token validated before processing request
   - userId extracted for data filtering

### For Users

1. **Strong Passwords:**
   - Use unique password per app
   - Avoid common passwords
   - Consider using password manager

2. **Logout on Public Devices:**
   - Always logout when using shared computer
   - Clear browser cache if concerned

3. **Token Security:**
   - Don't share your token
   - Don't copy token from localStorage
   - Don't paste token in messages

## 🧪 Testing Authentication

### Manual Testing

**Register New User:**
1. Click "Create Account"
2. Enter unique email
3. Enter password (6+ chars)
4. Enter name
5. Click "Create Account"
6. Should be logged in automatically

**Login:**
1. Logout (from settings)
2. Enter email and password
3. Click "Sign In"
4. Should load all previous data

**Try Demo Account:**
```
Email: demo@example.com
Password: demo123
```

### API Testing

**Using cURL:**

Register:
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test"}'
```

Login:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

Get User Data (with token):
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <your-token>"
```

### Browser DevTools

Check stored token:
```javascript
// In browser console
localStorage.getItem('token')

// Check API headers
fetch('/api/auth/me', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  }
})
```

## ⚠️ Common Issues

### "Invalid Token" Error
- **Cause:** Token expired or invalid
- **Fix:** Log out and log back in

### "Email Already Exists"
- **Cause:** Account with that email already registered
- **Fix:** Use different email or log in with existing account

### 401 Unauthorized
- **Cause:** Missing or invalid authentication token
- **Fix:** Ensure logged in, check localStorage for token

### Data Not Loading
- **Cause:** Token not properly attached to request
- **Fix:** Log out, clear cache, log back in

## 🚀 Production Deployment

### Setup Checklist

- [ ] Change `JWT_SECRET` in environment variables
- [ ] Use strong, random JWT_SECRET (min 32 chars)
- [ ] Deploy with HTTPS enabled
- [ ] Backend running on secure domain
- [ ] CORS properly configured
- [ ] Database backup strategy in place
- [ ] User passwords never logged
- [ ] Tokens never exposed in logs

### Environment Variables

Backend `.env` file:
```
JWT_SECRET=your-super-secret-random-key-minimum-32-characters
NODE_ENV=production
PORT=3000
```

### Deployment Notes

**Vercel/Hosting:**
- Set environment variables in platform settings
- Ensure backend API is accessible
- Configure CORS for frontend domain
- Enable HTTPS (automatic on Vercel)

## 📚 Resources

- [JWT Introduction](https://jwt.io/)
- [bcryptjs Documentation](https://github.com/dcodeIO/bcrypt.js)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Express Authentication](https://expressjs.com/en/guide/advanced/best-practice-security.html)

---

**Authentication Setup Complete!** Users can now create accounts and manage their own data! 🔐

