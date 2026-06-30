# Quick Start: Deploy in 30 Minutes

TL;DR version of deployment guide for developers who want to get the app live fast.

---

## 🚀 The Fastest Way to Deploy

### Option A: Vercel + Railway (Recommended - 15 minutes)

```bash
# 1. Push code to GitHub (if not already done)
git push origin main

# 2. Frontend → Vercel (Easiest)
- Go to vercel.com
- Click "Import Project"
- Select GitHub repo
- Select /frontend folder
- Set VITE_GOOGLE_CLIENT_ID env var
- Deploy ✅ (Done in 2 min)

# 3. Backend → Railway (Easy)
- Go to railway.app
- Click "New Project"
- Select GitHub repo
- Set these env vars:
  GOOGLE_CLIENT_ID=xxx
  GOOGLE_CLIENT_SECRET=xxx
  JWT_SECRET=xxx
- Deploy ✅ (Done in 2 min)

# 4. Connect Frontend to Backend
- In Vercel env vars, add:
  VITE_API_URL=https://your-railway-backend.com/api
- Redeploy ✅ (Done in 1 min)
```

**Total time: ~5-10 minutes**
**Cost: Free tier works for testing, $7-20/month for production**

---

### Option B: Full Local Setup (For Testing)

```bash
# Backend
cd backend
npm install
npm start
# Runs on http://localhost:3000

# Frontend (in new terminal)
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

---

## 🔑 Required Credentials

### Google OAuth (Free)

1. [Google Cloud Console](https://console.cloud.google.com/)
2. Create project
3. Enable Google+ API
4. Create OAuth 2.0 credentials (Web app)
5. Add authorized origins:
   - http://localhost:5173
   - http://localhost:3000
   - https://yourdomain.com
6. Copy Client ID

**Time: 5 minutes**

---

## 📋 Minimal Environment Variables

### Frontend (.env.production)
```
VITE_GOOGLE_CLIENT_ID=your_id
VITE_API_URL=https://your-backend.com/api
```

### Backend (.env)
```
PORT=3000
NODE_ENV=production
GOOGLE_CLIENT_ID=your_id
GOOGLE_CLIENT_SECRET=your_secret
JWT_SECRET=any_random_string
```

---

## ✅ Quick Testing Checklist

After deployment:

```bash
# Test backend is alive
curl https://your-backend.com/api

# Test frontend loads
Open https://your-frontend.com in browser

# Test login works
Click "Sign Up" → Create account

# Test VIN decoding
Enter VIN: 1HGBH41JXMN109186

# Test invoice creation
Click "Create Invoice" → Download PDF
```

**If all work → You're done! 🎉**

---

## 🆘 Quick Fixes

| Problem | Solution |
|---------|----------|
| `CORS error` | Add frontend URL to backend CORS config |
| `Google auth fails` | Verify Client ID in .env and authorized origins |
| `API 404 error` | Check VITE_API_URL in frontend .env |
| `Database error` | Delete `backend/data/app.db` and restart |
| `Build fails` | Run `npm install` again in both folders |

---

## 📱 Share with Users

Once deployed:

```
🎉 VIN Decoder is Live!

Visit: https://yourdomain.com

Features:
✓ Scan or enter VINs
✓ Get vehicle info instantly  
✓ Create professional invoices
✓ Download as PDF

Quick Start:
1. Sign up with email or Google
2. Enter a VIN: 1HGBH41JXMN109186
3. Create an invoice
4. Download PDF

Questions? Email: support@yourdomain.com
```

---

## 💰 Cost Summary

| Component | Free Tier | Cost |
|-----------|-----------|------|
| Vercel (Frontend) | 100 GB/mo | $0 → $20/mo |
| Railway (Backend) | 5 GB/mo | $0 → $7/mo |
| Domain | - | $10-15/year |
| Google OAuth | Unlimited | $0 |
| **TOTAL** | - | **$0-35/year** |

---

## 🎯 What's NOT Required for Deployment

- ❌ No database migration
- ❌ No SSL certificates (automatic)
- ❌ No Docker setup needed
- ❌ No server administration
- ❌ No DevOps knowledge required

Everything is built-in or automated! ✨

---

## 🚀 You're Ready!

That's it. The app is production-ready. Just:

1. Get Google OAuth credentials (5 min)
2. Deploy to Vercel (2 min)
3. Deploy to Railway (2 min)
4. Connect them (1 min)
5. Test it works (5 min)

**Done in 15 minutes.** Share the link with users!

---

For detailed steps, see: `DEPLOYMENT_GUIDE.md`
