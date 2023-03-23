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
    if (event.data && event.data.type === 'CHECK_FOR_UPDATES') {
      // Check for updates by calling update() on the registration
      self.registration.update().catch((error) => {
        console.error('Error while checking for updates:', error);
      });
    }
  });
  