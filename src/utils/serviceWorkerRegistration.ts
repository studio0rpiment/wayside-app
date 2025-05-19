// src/utils/serviceWorkerRegistration.ts

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('Service Worker registered with scope:', registration.scope);
          
          // Request notification permission if we have location permission
          if (Notification.permission !== 'granted' && 
              navigator.permissions && 
              navigator.permissions.query) {
            
            navigator.permissions.query({name: 'geolocation'})
              .then(geoResult => {
                if (geoResult.state === 'granted') {
                  // If we already have location permission, request notification permission
                  Notification.requestPermission();
                }
              });
          }
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    });
  }
}