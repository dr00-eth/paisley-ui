self.addEventListener('install', (event) => {
    // The install event is fired when the service worker is installed
    // You can use this event to cache static assets
    //console.log('Service worker installed');
  });
  
  self.addEventListener('fetch', (event) => {
    // The fetch event is fired whenever a network request is made
    // You can use this event to handle caching strategies
    //console.log('Fetch event:', event);
  });
  
  self.addEventListener('activate', (event) => {
    // The activate event is fired when the service worker is activated
    // You can use this event to clean up old caches or perform other tasks
    //console.log('Service worker activated');
  });
  
  self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  });