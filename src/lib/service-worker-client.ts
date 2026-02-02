/**
 * Client-side service worker management
 * This handles automatic updates and provides utilities for managing the service worker
 */

// Service worker registration state
let swRegistration: ServiceWorkerRegistration | null = null;

/**
 * Initialize service worker with automatic updates
 */
export async function initServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker not supported');
    return null;
  }

  try {
    // Register the service worker
    swRegistration = await navigator.serviceWorker.register('/service-worker.js');
    console.log('Service Worker registered successfully');

    // Listen for service worker updates
    setupServiceWorkerListeners();

    // Check for updates periodically (every 5 minutes)
    setInterval(checkForUpdates, 5 * 60 * 1000);

    // Check for updates when the page becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        checkForUpdates();
      }
    });

    return swRegistration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Set up listeners for service worker events
 */
function setupServiceWorkerListeners() {
  if (!swRegistration) return;

  // Listen for waiting service worker (new version available)
  swRegistration.addEventListener('updatefound', () => {
    const newWorker = swRegistration!.installing;
    console.log('New service worker installing...');

    if (newWorker) {
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('New service worker installed and waiting...');
          // The new service worker will automatically skip waiting due to our changes
        }
      });
    }
  });

  // Listen for messages from the service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    const { type, version, buildDate } = event.data;

    switch (type) {
      case 'NEW_VERSION_ACTIVATED':
        console.log(`New app version activated: ${version}`);
        handleNewVersionActivated(version, buildDate);
        break;
      case 'VERSION_INFO':
        console.log('Current version info:', { version, buildDate });
        break;
      default:
        console.log('Unknown message from service worker:', event.data);
    }
  });
}

/**
 * Handle when a new version becomes active
 */
function handleNewVersionActivated(version: string, buildDate: string) {
  // Dispatch a custom event that components can listen to
  window.dispatchEvent(new CustomEvent('sw-version-updated', {
    detail: { version, buildDate }
  }));

  // Optionally show a toast/notification
  showUpdateNotification(version);
}

/**
 * Show a notification about the app update
 * You can customize this to match your app's design
 */
function showUpdateNotification(version: string) {
  // Simple console notification - replace with your preferred notification system
  console.log(`🎉 App updated to version ${version}! New features and improvements are now available.`);
  
  // Example: You could dispatch an event for your toast/notification system
  window.dispatchEvent(new CustomEvent('show-toast', {
    detail: {
      message: `App updated to version ${version}!`,
      type: 'success',
      duration: 5000
    }
  }));
}

/**
 * Manually check for service worker updates
 */
export async function checkForUpdates(): Promise<boolean> {
  if (!swRegistration) {
    console.log('No service worker registration found');
    return false;
  }

  try {
    await swRegistration.update();
    console.log('Checked for service worker updates');
    return true;
  } catch (error) {
    console.error('Failed to check for updates:', error);
    return false;
  }
}

/**
 * Get current version info from service worker
 */
export async function getVersionInfo(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!navigator.serviceWorker.controller) {
      reject(new Error('No active service worker'));
      return;
    }

    const channel = new MessageChannel();
    
    channel.port1.onmessage = (event) => {
      if (event.data.type === 'VERSION_INFO') {
        resolve(event.data);
      } else {
        reject(new Error('Unexpected response'));
      }
    };

    navigator.serviceWorker.controller.postMessage(
      { type: 'GET_VERSION' },
      [channel.port2]
    );

    // Timeout after 5 seconds
    setTimeout(() => reject(new Error('Timeout')), 5000);
  });
}

/**
 * Force refresh all tabs/windows
 * Use this when you want to ensure all clients are using the new version
 */
export function forceRefreshAllTabs() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'FORCE_REFRESH_ALL'
    });
  }
  
  // Also refresh current tab
  window.location.reload();
}

/**
 * Manual service worker skip waiting (though it should happen automatically now)
 */
export async function skipWaiting(): Promise<void> {
  if (!swRegistration || !swRegistration.waiting) {
    console.log('No waiting service worker found');
    return;
  }

  swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
}