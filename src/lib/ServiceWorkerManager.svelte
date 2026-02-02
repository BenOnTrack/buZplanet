<script lang="ts">
  import { onMount } from 'svelte';
  import { initServiceWorker, checkForUpdates, getVersionInfo } from '$lib/service-worker-client';

  // State variables using Svelte 5 syntax
  let currentVersion = $state('');
  let updateAvailable = $state(false);
  let showNotification = $state(false);
  let newVersion = $state('');
  let lastChecked = $state<Date | null>(null);

  // Auto-hide notification after 10 seconds
  let notificationTimeout: number;

  onMount(async () => {
    // Initialize service worker
    await initServiceWorker();

    // Get initial version info
    try {
      const versionInfo = await getVersionInfo();
      currentVersion = versionInfo.version;
    } catch (error) {
      console.error('Failed to get version info:', error);
    }

    // Listen for version updates
    window.addEventListener('sw-version-updated', handleVersionUpdate);

    // Listen for escape key to close notification
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showNotification) {
        dismissNotification();
      }
    };
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('sw-version-updated', handleVersionUpdate);
      window.removeEventListener('keydown', handleEscape);
      if (notificationTimeout) {
        clearTimeout(notificationTimeout);
      }
    };
  });

  function handleVersionUpdate(event: CustomEvent) {
    const { version } = event.detail;
    newVersion = version;
    currentVersion = version;
    showNotification = true;
    
    // Auto-hide after 10 seconds
    notificationTimeout = setTimeout(() => {
      showNotification = false;
    }, 10000);
  }

  function dismissNotification() {
    showNotification = false;
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
    }
  }

  // Test function for development
  function testNotification() {
    newVersion = `test-${Date.now()}`;
    currentVersion = newVersion;
    showNotification = true;
    
    // Auto-hide after 10 seconds
    notificationTimeout = setTimeout(() => {
      showNotification = false;
    }, 10000);
  }

  async function manualUpdateCheck() {
    lastChecked = new Date();
    const success = await checkForUpdates();
    if (!success) {
      console.error('Manual update check failed');
    }
  }
</script>

<!-- Update Notification Toast -->
{#if showNotification}
  <button 
    class="notification-backdrop"
    onclick={dismissNotification}
    aria-label="Close notification"
  >
    <div 
      class="update-notification"
      role="alert"
      aria-live="polite"
    >
      <div class="notification-content">
        <div class="notification-icon">🎉</div>
        <div class="notification-text">
          <h4>App Updated!</h4>
          <p>Version {newVersion} is now active with new features and improvements.</p>
        </div>
      </div>
    </div>
  </button>
{/if}

<!-- Developer Tools (only show in development) -->
{#if import.meta.env.DEV}
  <div class="dev-tools">
    <details>
      <summary>Service Worker Tools</summary>
      <div class="dev-tools-content">
        <p><strong>Current Version:</strong> {currentVersion || 'Unknown'}</p>
        {#if lastChecked}
          <p><strong>Last Checked:</strong> {lastChecked.toLocaleTimeString()}</p>
        {/if}
        <button onclick={manualUpdateCheck}>Check for Updates</button>
        <button onclick={testNotification} style="margin-left: 8px; background: #f59e0b;">Test Notification</button>
      </div>
    </details>
  </div>
{/if}

<style>
  .notification-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.3s ease-out;
    cursor: pointer;
    border: none;
    font-family: inherit;
  }

  .notification-backdrop:focus {
    outline: 2px solid #4ade80;
    outline-offset: -2px;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .update-notification {
    position: relative;
    background: #4ade80;
    color: white;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    max-width: 400px;
    width: 100%;
    animation: scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    cursor: default;
  }

  @keyframes scaleIn {
    from {
      transform: scale(0.8);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .notification-content {
    display: flex;
    align-items: flex-start;
    padding: 20px;
    gap: 16px;
    text-align: left;
  }

  .notification-icon {
    font-size: 32px;
    flex-shrink: 0;
  }

  .notification-text h4 {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 700;
  }

  .notification-text p {
    margin: 0;
    font-size: 15px;
    opacity: 0.95;
    line-height: 1.5;
  }

  /* Developer Tools */
  .dev-tools {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.9);
    color: white;
    border-radius: 8px;
    padding: 12px;
    font-size: 13px;
    z-index: 1000;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .dev-tools summary {
    cursor: pointer;
    padding: 4px;
    list-style: none;
  }

  .dev-tools summary::-webkit-details-marker {
    display: none;
  }

  .dev-tools summary::before {
    content: '🔧 ';
  }

  .dev-tools-content {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
  }

  .dev-tools-content p {
    margin: 4px 0;
  }

  .dev-tools-content button {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    margin-top: 8px;
  }

  .dev-tools-content button:hover {
    background: #2563eb;
  }

  .dev-tools-content button[style*="background: #f59e0b"]:hover {
    background: #d97706 !important;
  }
</style>