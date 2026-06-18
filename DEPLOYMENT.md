# Deployment Guide

## 🌐 Deploy to Vercel + Railway (Recommended)

### Option A: Separate Deployments (Easiest)

#### 1. Deploy Frontend to Vercel

1. Push code to GitHub first
2. Go to https://vercel.com
3. Click "Import Project"
4. Select your GitHub repository
5. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
6. Click "Deploy"
7. Note your Vercel URL (e.g., `https://yourapp.vercel.app`)

#### 2. Deploy Backend to Railway

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub"
4. Choose your repository
5. Configure:
   - **Root Directory:** `backend`
   - **Start Command:** `npm start`
6. Click "Deploy"
7. In Railway dashboard, go to Variables
8. Add: `NODE_ENV=production`
9. Note your Railway URL (Railway will provide it)

#### 3. Connect Frontend to Backend

1. Go back to Vercel project settings
2. Add **Environment Variable:**
   - `VITE_API_BASE` = `https://yourapp-railway.railway.app`
3. Redeploy frontend

Then update `frontend/src/services/api.js`:

```javascript
const API_BASE = import.meta.env.VITE_API_BASE || '/api';
```

---

## 🐳 Deploy Both on One Service (Vercel)

### Requirements:
- Backend must be serverless-compatible
- Vercel Functions (paid feature)

### Steps:

1. **Create a wrapper API**:

Create `api/index.js`:
```javascript
import app from '../backend/src/server.js';
export default app;
```

2. **Update vercel.json** (already created)

3. **Push to GitHub and deploy to Vercel**

---

## 📦 Deploy as Docker Container

### 1. Create Dockerfile

Create `Dockerfile` in root:
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

COPY backend ./backend
COPY frontend ./frontend

WORKDIR /app/frontend
RUN npm install && npm run build

WORKDIR /app/backend

EXPOSE 3000

CMD ["npm", "start"]
```

### 2. Deploy to Railway/Render/Heroku

1. Push to GitHub
2. Connect repository to Railway/Render
3. Detect as Docker
4. Deploy

---

## 🚀 Quick Deployment Checklist

### Before Deploying:

- [ ] Code pushed to GitHub
- [ ] `npm run install-all` runs without errors
- [ ] App works locally (`npm run dev:backend` + `npm run dev:frontend`)
- [ ] No hardcoded localhost URLs
- [ ] Environment variables configured

### After Deploying:

- [ ] Frontend loads at deployment URL
- [ ] VIN decoding works (hits NHTSA API)
- [ ] Invoice creation works
- [ ] PDF downloads work
- [ ] Database persists data

---

## 🔒 Security Considerations

### Before Production:

1. **Add Authentication** - Currently no login required
2. **Validate Inputs** - Server-side validation
3. **HTTPS Only** - Vercel/Railway handle this
4. **API Rate Limiting** - Protect NHTSA API calls
5. **CORS** - Restrict to your domain

### Environment Variables to Set:

```
NODE_ENV=production
DB_BACKUP_ENABLED=true
```

---

## 📊 Recommended Architecture

```
┌─────────────────────────────────────┐
│      Your Users (Browser)           │
└──────────────┬──────────────────────┘
               │
        ┌──────▼──────┐
        │   Vercel    │ (Frontend)
        │  yourapp.   │
        │  vercel.app │
        └──────┬──────┘
               │
               │ API Calls
               │
        ┌──────▼──────────────┐
        │   Railway / Render  │ (Backend)
        │  yourapp.railway.   │
        │      app            │
        └──────┬──────────────┘
               │
        ┌──────▼──────┐
        │  SQLite DB  │
        │  (Local)    │
        └─────────────┘
```

---

## 💡 Cost Analysis

| Service | Cost | Notes |
|---------|------|-------|
| Vercel | Free | Frontend only |
| Railway | Free tier | Backend + DB, 512MB RAM |
| Render | Free tier | Backend alternative |
| GitHub | Free | Code hosting |
| Total | $0/month | Completely free |

---

## 🆘 Troubleshooting

### Frontend loads but API fails
- Check if backend deployed successfully
- Verify API URL in environment variables
- Check CORS settings on backend

### Database errors
- Ensure backend has write permissions
- Check disk space on host
- Verify database file exists

### VIN decoding fails
- NHTSA API might be down
- Check internet connectivity on backend
- Verify backend can reach NHTSA (no firewall blocks)

---

## 📞 Support

For deployment issues:
- Check service status pages (vercel.com/status, railway.app/status)
- Review deployment logs
- Verify environment variables
- Test API directly: `curl https://yourapi.app/api/health`

---

**Your app is now ready for production! 🎉**
