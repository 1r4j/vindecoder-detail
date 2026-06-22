# Progressive Web App (PWA) Features

## Overview

The VIN Decoder & Invoice Generator has been converted into a Progressive Web App, enabling offline support, installability, and enhanced user experience across devices.

## ✨ PWA Features Enabled

### 1. **Installability**
- App can be installed on desktop, mobile, and tablet devices
- Native-like experience with app launcher icon
- Splash screen on launch
- Standalone display mode (no browser UI)

**How to Install:**
- **Mobile (iOS):** Safari → Share → Add to Home Screen
- **Mobile (Android):** Chrome → Menu → Install app / Add to home screen
- **Desktop:** Chrome → Menu → Install VIN Decoder
- **Windows:** Edge/Chrome → Install

### 2. **Offline Support**
- App works offline with cached assets
- Vehicle data persists locally
- Invoice history available offline
- Settings sync when connection restored
- Network-first strategy for API calls with fallback to cache

### 3. **Service Worker**
- Automatic caching of app shell and static assets
- Network requests cached for offline access
- Periodic updates check (every 60 seconds)
- Background sync preparation for invoice submissions

### 4. **Persistent Storage**
- Browser requests permission for persistent storage
- Invoice data, customer info, and settings persist
- Data survives browser cache clearing (when persistent storage granted)
- LocalStorage enhanced with IndexedDB capability

### 5. **Web Manifest**
- App metadata (name, description, colors)
- Icon definitions for all common sizes
- App shortcuts for quick actions:
  - Decode VIN
  - Create Invoice
  - View Invoice History
- Theme colors and styling

### 6. **Responsive Design**
- Mobile-first responsive layout
- Works on screens from 320px to 4K+
- Touch-optimized interface
- Portrait and landscape support

### 7. **Performance**
- Code splitting for faster loads
- Asset compression and caching
- Optimized bundle size
- Service worker reduces bandwidth usage

## 📁 Files Added

### Core PWA Files
```
frontend/public/
├── manifest.json          # App metadata and configuration
├── service-worker.js      # Service worker for offline support
└── icons/
    ├── icon-192x192.svg   # Base icon (other sizes referenced)
    └── generate-icons.sh  # Script to generate icons
```

### Service Worker Registration
```
frontend/src/utils/
└── service-worker-register.js  # SW registration and PWA utilities
```

### Updated Files
- `frontend/src/main.jsx` - Registers service worker
- `frontend/vite.config.js` - Build optimization
- `frontend/index.html` - Manifest link and meta tags

## 🛠️ Building Icons

The app includes placeholder icons. For production, replace with actual icons:

### Generate Icons Using ImageMagick:
```bash
# Convert SVG to PNG at various sizes
convert -density 192 icon-192x192.svg -resize 192x192 icon-192x192.png
```

### Generate Icons Using Online Tools:
1. Use https://www.favicon-generator.org/ or similar
2. Upload a 512x512 PNG
3. Download the generated icons
4. Place in `frontend/public/icons/`

### Required Icon Sizes:
- 72x72 (Android)
- 96x96 (Android, Tablet)
- 128x128
- 144x144 (Android)
- 152x152 (iPad)
- 192x192 (Android, Web)
- 384x384
- 512x512 (Web, Splash screens)
- Maskable variants (modern Android)

## 🔄 Caching Strategy

### Static Assets (Cache First)
- JavaScript, CSS, images
- Uses cached version immediately
- Updates fetched in background
- Falls back to offline page if unavailable

### API Calls (Network First)
- Live data always fetched first (invoices, customers, settings)
- Cached version used if network fails
- Offline responses clearly marked

### Manifest & Service Worker
- Always served fresh from server
- Critical for updates

## 💾 Data Persistence

### LocalStorage (Automatic)
- Vehicle history
- Temporary form data
- User preferences

### IndexedDB (Potential)
- Larger invoice datasets
- Binary file storage (PDFs)
- Structured data queries

### Persistent Storage Request
- App requests permission on first load
- Allows data to survive cache clearing
- User can grant/deny in browser settings

## 🔄 Update Flow

1. **Auto-check**: Every 60 seconds when app is open
2. **User Notification**: New version available
3. **User Action**: Can update manually via browser menu
4. **Service Worker**: Automatically uses new version

## 🚀 Deployment

### Vercel
```bash
# Vercel automatically serves public/ files
# manifest.json and service-worker.js are included
git push origin main
```

### Custom Hosting
Ensure your server:
- Serves `manifest.json` with `Content-Type: application/manifest+json`
- Serves `service-worker.js` with correct headers
- Has HTTPS enabled (required for PWA)
- Allows service workers (`Service-Worker-Allowed` header)

### HTTPS Requirement
PWA features require HTTPS in production. Local development (localhost) works without HTTPS.

## 📋 PWA Checklist

- [x] Web manifest with metadata
- [x] Service worker for offline support
- [x] Install prompts and icons
- [x] Theme colors configured
- [x] Responsive design
- [x] Standalone display mode
- [x] Network-first caching strategy
- [x] Persistent storage permission
- [x] Launch shortcuts

## 🧪 Testing PWA Features

### Browser DevTools
```javascript
// Check service worker
navigator.serviceWorker.getRegistrations()

// Check manifest
fetch('/manifest.json').then(r => r.json())

// Check persistent storage
navigator.storage.estimate()
```

### Lighthouse Audit
1. Open DevTools → Lighthouse
2. Run "Progressive Web App" audit
3. View recommendations

### Install Prompt
- On Chrome/Edge: Should see "Install" button in address bar
- On iOS Safari: Use "Add to Home Screen" in Share menu
- On Android: Should see "Install app" prompt

## 📱 App Shortcuts

Users can access these via app menu:
- **Decode VIN** - Quick VIN scanning
- **Create Invoice** - Fast invoice creation
- **Invoice History** - View all invoices

## 🔐 Security

- Service worker only loads over HTTPS (production)
- Manifest includes `prefer_related_applications: false`
- No tracking or analytics by default
- All data stored locally

## 📊 Storage Limits

Different browsers have different limits:
- Chrome/Edge: ~50MB persistent, ~10GB total
- Firefox: ~10MB persistent, ~10GB total
- Safari: ~5MB persistent
- Mobile browsers: Device-dependent

## 🐛 Troubleshooting

### App won't install
- Ensure HTTPS is enabled
- Check manifest.json is valid
- Verify icons are accessible
- Clear browser cache and try again

### Offline features not working
- Check service worker in DevTools → Application
- Ensure ServiceWorker is "activated"
- Verify cache storage in Application tab

### Updates not appearing
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Clear cache and reinstall
- Check service worker update status

## 🔗 Resources

- [MDN PWA Documentation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Web.dev PWA Checklist](https://web.dev/pwa-checklist/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Manifest Spec](https://www.w3.org/TR/appmanifest/)

---

**PWA Setup Complete!** The app is now a Progressive Web App with offline support and installability. 🎉
