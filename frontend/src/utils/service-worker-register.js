export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').then(
        (registration) => {
          console.log('✅ ServiceWorker registered:', registration);

          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60000); // Check every minute

          // Handle updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker is ready
                console.log('📦 New version available');
                // Optionally notify user about update
              }
            });
          });
        },
        (error) => {
          console.log('❌ ServiceWorker registration failed:', error);
        }
      );

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('Message from service worker:', event.data);
      });
    });
  } else {
    console.log('⚠️ ServiceWorker not supported in this browser');
  }
}

export function checkForUpdates() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration) {
        registration.update();
      }
    });
  }
}

export function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then((persistent) => {
      if (persistent) {
        console.log('✅ Persistent storage granted');
      } else {
        console.log('⚠️ Persistent storage denied');
      }
    });
  }
}
