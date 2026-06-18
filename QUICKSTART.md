# Quick Start Guide

## Running the Application

### Option 1: Start Backend and Frontend Separately (Recommended for Development)

#### Terminal 1 - Start Backend:
```bash
cd backend
npm start
```
Backend will run on `http://localhost:3000`

#### Terminal 2 - Start Frontend:
```bash
cd frontend
npm run dev
```
Frontend will run on `http://localhost:5173`

### Option 2: Using npm scripts from root

Start backend:
```bash
npm run dev:backend
```

Start frontend (in another terminal):
```bash
npm run dev:frontend
```

## First Time Setup

1. **Install all dependencies**:
   ```bash
   npm run install-all
   ```

2. **Start the backend** (Terminal 1):
   ```bash
   npm run dev:backend
   ```

3. **Start the frontend** (Terminal 2):
   ```bash
   npm run dev:frontend
   ```

4. **Open browser** and go to `http://localhost:5173`

## Testing the App

### Test VIN #1 - Honda Civic
```
VIN: 1HGBH41JXMN109186
Expected: 2021 Honda Civic Sedan
```

### Test Invoice Creation
1. Decode the VIN above
2. Click "Create Invoice"
3. Fill in customer info (e.g., "John Smith")
4. Add services (e.g., "Exterior Wash" + "Interior Vacuum")
5. Review and download PDF

## Default Business Config
- **Name**: Sparkle Auto Detailing
- **Address**: 123 Main Street, Your City, State 12345
- **Phone**: (555) 987-6543
- **Email**: info@sparkledetail.com
- **Tax Rate**: 8%

(Can be customized through the Business Config endpoint)

## Database Location
`backend/data/app.db`

## Common Issues

### Port 3000 already in use
```bash
# On Windows, find what's using port 3000:
netstat -ano | findstr :3000

# Kill the process (replace PID):
taskkill /PID <PID> /F
```

### Port 5173 already in use
Edit `frontend/vite.config.js` and change the port:
```javascript
server: {
  port: 5174  // Change this
}
```

### Database locked error
Stop the server and delete `backend/data/app.db`, then restart.

## API Health Check
```bash
curl http://localhost:3000/api/health
```
Should return:
```json
{"status":"ok","timestamp":"2024-..."}
```

## Production Build

Build frontend for production:
```bash
cd frontend
npm run build
```

Output will be in `frontend/dist/`

## Next Steps

- Read [README.md](README.md) for full documentation
- Check API endpoints documentation in README.md
- Customize business information
- Add more services to database
