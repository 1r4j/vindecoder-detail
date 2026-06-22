import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { registerServiceWorker, requestPersistentStorage } from './utils/service-worker-register'
import { setupMobileOptimizations, setupTouchOptimizations, optimizeFormForMobile } from './utils/mobile-optimizations'

// Setup PWA
registerServiceWorker()
requestPersistentStorage()

// Setup mobile optimizations
setupMobileOptimizations()
setupTouchOptimizations()

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    optimizeFormForMobile()
  })
} else {
  optimizeFormForMobile()
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
