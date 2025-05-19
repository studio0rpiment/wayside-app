// public/service-worker.js
const CACHE_NAME = 'wayside-experience-v1';

// Files to cache for offline functionality
const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html',
  '/static/css/main.css',
  '/static/js/main.js'
];

// Install the service worker and cache necessary files
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  // Force activation
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate the service worker
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  // Take control of all clients
  event.waitUntil(clients.claim());
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache');
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Simple function to open the map with an experience ID
function openMapWithExperience(experienceId) {
  // Create the URL with the query parameter
  const mapUrl = new URL('/#/map', self.location.origin);
  if (experienceId) {
    mapUrl.searchParams.set('showExperience', experienceId);
  }
  
  return clients.matchAll({type: 'window'})
    .then(windowClients => {
      // Try to reuse an existing window
      for (let client of windowClients) {
        if ('navigate' in client && 'focus' in client) {
          return client.navigate(mapUrl.toString())
            .then(() => client.focus());
        }
      }
      
      // If no existing window, open a new one
      if (clients.openWindow) {
        return clients.openWindow(mapUrl.toString());
      }
    });
}

// Handle push notifications
self.addEventListener('push', event => {
  console.log('Push notification received');
  
  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (error) {
    console.error('Error parsing push data', error);
  }

  const options = {
    body: data.body || 'You\'ve entered a new experience area!',
    icon: data.icon || '/icons/notification-icon.png',
    badge: data.badge || '/icons/badge-icon.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/#/map',
      experienceId: data.experienceId || null
    },
    requireInteraction: true // Make notification persist
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'Wayside Experience Alert', 
      options
    )
  );
});

// When a notification is clicked
self.addEventListener('notificationclick', event => {
  console.log('Notification clicked!');
  
  // Close the notification
  event.notification.close();
  
  // Get the experience ID from the notification data
  const experienceId = event.notification.data?.experienceId;
  console.log('Experience ID from notification:', experienceId);
  
  // Open the map with this experience
  event.waitUntil(openMapWithExperience(experienceId));
});

// Handle messages from the web app
self.addEventListener('message', event => {
  console.log('Service worker received message');
  
  if (event.data && event.data.type) {
    const data = event.data;
    
    // Show test notification
    if (data.type === 'SHOW_NOTIFICATION') {
      // Get notification content
      const title = data.payload?.title || data.pointData?.title || 'Experience Alert';
      const body = data.payload?.body || data.pointData?.modalContent?.description || 'New experience!';
      const icon = data.payload?.icon || data.pointData?.modalContent?.imageUrl || '/icons/notification-icon.png';
      const experienceId = data.payload?.data?.experienceId || data.pointData?.iconName;
      
      console.log('Showing notification for:', title, 'with experienceId:', experienceId);
      
      // Show the notification
      self.registration.showNotification(title, {
        body: body,
        icon: icon,
        badge: '/icons/badge-icon.png',
        vibrate: [200, 100, 200],
        requireInteraction: true,
        data: {
          url: '/map',
          experienceId: experienceId
        }
      });
    }
    
    // Skip waiting and activate
    if (data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
    
    // Store geofence data for background checks
    if (data.type === 'INIT_GEOFENCE_DATA') {
      console.log('Received geofence data');
    }
  }
});