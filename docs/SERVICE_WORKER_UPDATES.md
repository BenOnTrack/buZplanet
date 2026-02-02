# Service Worker Automatic Updates

Your service worker has been configured to automatically install and activate new versions of your app. Here's how it works:

## What Changed

### Service Worker (`src/service-worker.ts`)
- **Automatic Skip Waiting**: New versions automatically skip the waiting phase
- **Immediate Activation**: New service workers take control immediately
- **Client Notification**: All open tabs are notified when a new version activates
- **Cache Management**: Old caches are automatically cleaned up

### Client-Side Management (`src/lib/service-worker-client.ts`)
- **Auto-Registration**: Service worker registers automatically
- **Update Checking**: Checks for updates every 5 minutes and when page becomes visible
- **Version Info**: Can query current version information
- **Event Handling**: Listens for and handles service worker messages

### UI Component (`src/lib/ServiceWorkerManager.svelte`)
- **Update Notifications**: Shows a toast when new versions are activated
- **Developer Tools**: Debug panel in development mode
- **Manual Updates**: Button to manually check for updates (dev mode only)

## How It Works

1. **Initial Load**: Service worker registers and caches app assets
2. **Update Detection**: When you deploy a new version, the service worker detects it
3. **Automatic Installation**: New version installs immediately (no waiting)
4. **Cache Update**: New assets are cached, old caches are cleaned up
5. **User Notification**: Users see a brief notification about the update
6. **Seamless Experience**: App continues working with new features immediately

## User Experience

- **No Refresh Required**: Updates happen automatically in the background
- **Instant Activation**: New features are available immediately
- **Visual Feedback**: Users get a brief, non-intrusive notification
- **Offline Support**: App continues working offline with cached content

## For Development

### Testing Updates
1. Make changes to your app
2. Build and deploy (`npm run build`)
3. Open your app - you should see the update notification
4. Check the developer tools panel (bottom-right in dev mode)

### Manual Control
```typescript
import { 
  initServiceWorker, 
  checkForUpdates, 
  getVersionInfo,
  forceRefreshAllTabs 
} from '$lib/service-worker-client';

// Initialize (done automatically in layout)
await initServiceWorker();

// Manually check for updates
await checkForUpdates();

// Get current version
const info = await getVersionInfo();
console.log('Version:', info.version);

// Force refresh all tabs (nuclear option)
forceRefreshAllTabs();
```

### Custom Notifications
You can customize the update notification by modifying the `ServiceWorkerManager.svelte` component or by listening to the custom events:

```typescript
// Listen for updates in any component
window.addEventListener('sw-version-updated', (event) => {
  const { version, buildDate } = event.detail;
  // Your custom handling here
});

// Listen for toast events (if you have a toast system)
window.addEventListener('show-toast', (event) => {
  const { message, type, duration } = event.detail;
  // Show in your toast system
});
```

## Configuration Options

### Update Check Frequency
Change the interval in `service-worker-client.ts`:
```typescript
// Currently checks every 5 minutes
setInterval(checkForUpdates, 5 * 60 * 1000);
```

### Notification Duration
Change auto-hide timeout in `ServiceWorkerManager.svelte`:
```typescript
// Currently hides after 10 seconds
notificationTimeout = setTimeout(() => {
  showNotification = false;
}, 10000);
```

### Cache Strategy
Modify cache behavior in `service-worker.ts` by adjusting the `CACHE_STRATEGIES` object.

## Troubleshooting

### Updates Not Working
1. Check developer console for errors
2. Verify service worker is registered: DevTools → Application → Service Workers
3. Clear browser cache and reload
4. Check that you're deploying with a new version string

### Performance Issues
1. Monitor cache sizes: DevTools → Application → Storage
2. Adjust batch sizes for asset caching
3. Modify update check frequency

### Development Issues
1. Use the developer tools panel (bottom-right corner)
2. Check browser DevTools → Console for service worker logs
3. Use "Update on reload" in DevTools → Application → Service Workers for testing

## Best Practices

1. **Version Your Releases**: Ensure each deployment has a unique version
2. **Test Updates**: Always test the update flow before deploying
3. **Monitor Performance**: Keep an eye on cache sizes and update frequency
4. **User Communication**: Consider adding update notes or changelogs
5. **Graceful Degradation**: App should work even if service worker fails

The system is designed to be robust and user-friendly, providing seamless updates while maintaining a good user experience.