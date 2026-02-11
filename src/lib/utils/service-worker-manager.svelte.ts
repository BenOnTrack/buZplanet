import { dev } from '$app/environment';
import { browser } from '$app/environment';

/**
 * Enhanced Service Worker Management with User Preferences
 */
export class ServiceWorkerManager {
	private static instance: ServiceWorkerManager;
	private updateAvailable = $state(false);
	private installing = $state(false);
	private registration: ServiceWorkerRegistration | null = null;
	private waitingWorker: ServiceWorker | null = null;

	// User preferences
	private autoUpdate = $state(false);
	private showUpdateNotifications = $state(true);
	private postponeUntilRefresh = $state(false);
	private lastUpdateCheck: Date | null = null;

	static getInstance(): ServiceWorkerManager {
		if (!ServiceWorkerManager.instance) {
			ServiceWorkerManager.instance = new ServiceWorkerManager();
		}
		return ServiceWorkerManager.instance;
	}

	constructor() {
		this.loadPreferences();
	}

	async init() {
		if (!browser || dev || !('serviceWorker' in navigator)) {
			return false;
		}

		try {
			// Use SvelteKit's built-in service worker registration
			this.registration = await navigator.serviceWorker.ready;
			console.log('SW registered: ', this.registration);

			// Listen for updates
			this.registration.addEventListener('updatefound', this.handleUpdate.bind(this));

			// Listen for service worker state changes
			navigator.serviceWorker.addEventListener('controllerchange', () => {
				this.updateAvailable = false;
				this.postponeUntilRefresh = false;
				console.log('New service worker is now controlling the app');
			});

			// Listen for messages from service worker
			navigator.serviceWorker.addEventListener('message', (event) => {
				if (event.data?.type === 'SW_SKIP_WAITING') {
					window.location.reload();
				}
			});

			// Check if there's already an update waiting
			if (this.registration.waiting) {
				if (navigator.serviceWorker.controller) {
					this.handleWaitingServiceWorker(this.registration.waiting);
				}
			}

			// Start periodic update checks
			this.startPeriodicUpdateCheck();

			return true;
		} catch (error) {
			console.error('Service Worker registration failed:', error);
			return false;
		}
	}

	private handleUpdate() {
		if (!this.registration) return;

		const newWorker = this.registration.installing;
		if (!newWorker) return;

		console.log('New service worker found, installing...');
		this.installing = true;

		newWorker.addEventListener('statechange', () => {
			if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
				this.handleWaitingServiceWorker(newWorker);
			}
			this.installing = false;
		});
	}

	/**
	 * Handle when a service worker is waiting to activate
	 */
	private handleWaitingServiceWorker(worker: ServiceWorker) {
		this.waitingWorker = worker;
		this.updateAvailable = true;
		this.lastUpdateCheck = new Date();

		// Auto-update if enabled and not postponed
		if (this.autoUpdate && !this.postponeUntilRefresh) {
			setTimeout(() => this.applyUpdate(), 1000);
		}

		console.log('Service worker update available');
	}

	/**
	 * Start periodic update checks
	 */
	private startPeriodicUpdateCheck() {
		// Check for updates every 30 minutes
		setInterval(
			() => {
				this.registration?.update().catch(console.error);
			},
			30 * 60 * 1000
		);
	}

	async applyUpdate() {
		if (!this.waitingWorker) {
			console.warn('No waiting service worker found');
			this.updateAvailable = false;
			return;
		}

		console.log('Installing service worker update...');
		this.waitingWorker.postMessage({ type: 'SKIP_WAITING' });
		this.installing = true;

		// Clear update state
		this.updateAvailable = false;
		this.waitingWorker = null;
	}

	/**
	 * Dismiss the update notification (postpone until next refresh)
	 */
	dismissUpdate() {
		this.updateAvailable = false;
		this.postponeUntilRefresh = true;
		this.savePreferences();
		console.log('Update dismissed, will install on next refresh');
	}

	/**
	 * Manually check for updates
	 */
	async checkForUpdates() {
		if (!this.registration) return false;
		try {
			await this.registration.update();
			this.lastUpdateCheck = new Date();
			return true;
		} catch (error) {
			console.error('Failed to check for updates:', error);
			return false;
		}
	}

	// Getters for reactive state
	get hasUpdate() {
		return this.updateAvailable;
	}

	get isInstalling() {
		return this.installing;
	}

	get autoUpdateEnabled() {
		return this.autoUpdate;
	}

	get notificationsEnabled() {
		return this.showUpdateNotifications;
	}

	get isPostponed() {
		return this.postponeUntilRefresh;
	}

	get lastCheck() {
		return this.lastUpdateCheck;
	}

	/**
	 * Update user preferences
	 */
	updatePreferences(
		preferences: Partial<{
			autoUpdate: boolean;
			showUpdateNotifications: boolean;
			postponeUntilRefresh: boolean;
		}>
	) {
		Object.assign(this, preferences);
		this.savePreferences();
	}

	/**
	 * Load preferences from localStorage
	 */
	private loadPreferences() {
		if (!browser) return;
		try {
			const stored = localStorage.getItem('sw-update-preferences');
			if (stored) {
				const preferences = JSON.parse(stored);
				this.autoUpdate = preferences.autoUpdate ?? false;
				this.showUpdateNotifications = preferences.showUpdateNotifications ?? true;
				this.postponeUntilRefresh = preferences.postponeUntilRefresh ?? false;
			}
		} catch (error) {
			console.error('Failed to load SW update preferences:', error);
		}
	}

	/**
	 * Save preferences to localStorage
	 */
	private savePreferences() {
		if (!browser) return;
		try {
			const preferences = {
				autoUpdate: this.autoUpdate,
				showUpdateNotifications: this.showUpdateNotifications,
				postponeUntilRefresh: this.postponeUntilRefresh
			};
			localStorage.setItem('sw-update-preferences', JSON.stringify(preferences));
		} catch (error) {
			console.error('Failed to save SW update preferences:', error);
		}
	}

	/**
	 * Check if the app is running as PWA
	 */
	get isPWA(): boolean {
		if (!browser) return false;

		// Check multiple PWA detection methods
		const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
		const isIOSStandalone = (window.navigator as any).standalone;
		const isAndroidApp = document.referrer.includes('android-app://');
		const isInstalledOnDesktop = window.matchMedia('(display-mode: minimal-ui)').matches;
		const hasInstallDate = localStorage.getItem('pwa-installed') !== null;

		// Check if launched from home screen or app launcher
		const isLaunchedFromHomeScreen =
			isStandalone || isIOSStandalone || isAndroidApp || isInstalledOnDesktop;

		// Store install state for persistence
		if (isLaunchedFromHomeScreen && !hasInstallDate) {
			localStorage.setItem('pwa-installed', Date.now().toString());
		}

		return isLaunchedFromHomeScreen || hasInstallDate;
	}

	/**
	 * Check if installation prompt is available
	 */
	canInstall(): boolean {
		return browser && 'beforeinstallprompt' in window;
	}

	/**
	 * Request app installation (if supported)
	 */
	async requestInstall(promptEvent?: Event): Promise<boolean> {
		if (!promptEvent || !('prompt' in promptEvent)) {
			return false;
		}

		try {
			(promptEvent as any).prompt();
			const choiceResult = await (promptEvent as any).userChoice;
			const accepted = choiceResult.outcome === 'accepted';

			// Mark as installed if user accepted
			if (accepted) {
				localStorage.setItem('pwa-installed', Date.now().toString());
			}

			return accepted;
		} catch (error) {
			console.error('Installation failed:', error);
			return false;
		}
	}

	/**
	 * Manually mark the app as installed (for manual install scenarios)
	 */
	markAsInstalled(): void {
		if (browser) {
			localStorage.setItem('pwa-installed', Date.now().toString());
		}
	}
}

// Export singleton instance
export const swManager = ServiceWorkerManager.getInstance();
