self.addEventListener('install', (event) => {
    //console.log('Service worker installed');
  });
  
  self.addEventListener('fetch', (event) => {
    //console.log('Fetch event:', event);
  });
  
  self.addEventListener('activate', (event) => {
    //console.log('Service worker activated');
  });
  
  self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  });