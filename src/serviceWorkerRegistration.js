export function register() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        const swUrl = `/service-worker.js`;
        navigator.serviceWorker
          .register(swUrl)
          .then((registration) => {
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker == null) {
                return;
              }
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.log('New content is available; please refresh.');

                    installingWorker.postMessage({ type: 'SKIP_WAITING'});

                    window.dispatchEvent(new CustomEvent('appUpdateAvailable'));
                  }
                }
              };
            };
          })
          .catch((error) => {
            console.error('Error during service worker registration:', error);
          });
      });
    }
  }
  
  export function unregister() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          registration.unregister();
        })
        .catch((error) => {
          console.error(error.message);
        });
    }
  }
  