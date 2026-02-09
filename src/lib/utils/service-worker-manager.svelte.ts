import { dev } from '$app/environment';
import { browser } from '$app/environment';

/**
 * Service Worker Management Utilities
 */
export class ServiceWorkerManager {
	private static instance: ServiceWorkerManager;
	private updateAvailable = $state(false);
	private registration: ServiceWorkerRegistration | null = null;

	static getInstance(): ServiceWorkerManager {
		if (!ServiceWorkerManager.instance) {
			ServiceWorkerManager.instance = new ServiceWorkerManager();
		}
		return ServiceWorkerManager.instance;
	}

	async init() {
		if (!browser || dev || !('serviceWorker' in navigator)) {
			return false;
		}

		try {
			this.registration = await navigator.serviceWorker.register('/service-worker.js');
			console.log('Service Worker registered:', this.registration);

			// Listen for updates
			this.registration.addEventListener('updatefound', this.handleUpdate.bind(this));

			// Listen for service worker state changes
			navigator.serviceWorker.addEventListener('controllerchange', () => {
				// Reset update state when a new service worker takes control
				this.updateAvailable = false;
				console.log('New service worker is now controlling the app');
			});

			// Check if there's already an update waiting
			if (this.registration.waiting) {
				// Only show update if we have an active service worker (not first install)
				if (navigator.serviceWorker.controller) {
					this.updateAvailable = true;
				}
			}

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

		newWorker.addEventListener('statechange', () => {
			if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
				// New update is available
				this.updateAvailable = true;
				console.log('App update available');
			}
		});
	}

	async applyUpdate() {
		if (!this.registration?.waiting) {
			console.warn('No waiting service worker found');
			this.updateAvailable = false;
			return;
		}

		console.log('Applying service worker update...');

		// Reset the update state immediately to prevent duplicate clicks
		this.updateAvailable = false;

		// Tell the waiting service worker to skip waiting and become active
		this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

		// Listen for the controllerchange event to know when the new SW is active
		navigator.serviceWorker.addEventListener(
			'controllerchange',
			() => {
				console.log('New service worker active, reloading page...');
				window.location.reload();
			},
			{ once: true }
		);
	}

	get hasUpdate() {
		return this.updateAvailable;
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
