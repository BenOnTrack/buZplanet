import { browser } from '$app/environment';

// Type declarations for build-time defines
declare const __VERSION__: string;
declare const __BUILD_TIME__: number;

/**
 * Version management utilities
 */
export class VersionManager {
	private static instance: VersionManager;
	private currentVersion: string;
	private buildTime: number;

	constructor() {
		// Get version info from build-time defines
		this.currentVersion = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '1.0.0';
		this.buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : Date.now();
	}

	static getInstance(): VersionManager {
		if (!VersionManager.instance) {
			VersionManager.instance = new VersionManager();
		}
		return VersionManager.instance;
	}

	/**
	 * Get current app version
	 */
	get version(): string {
		return this.currentVersion;
	}

	/**
	 * Get build timestamp
	 */
	get timestamp(): number {
		return this.buildTime;
	}

	/**
	 * Force a hard reload by clearing all caches
	 */
	async forceReload(): Promise<void> {
		if (!browser) return;

		try {
			console.log('Forcing hard reload - clearing all caches...');

			// Clear all caches
			if ('caches' in window) {
				const cacheNames = await caches.keys();
				await Promise.all(
					cacheNames.map((cacheName) => {
						console.log('Deleting cache:', cacheName);
						return caches.delete(cacheName);
					})
				);
			}

			// Unregister all service workers
			if ('serviceWorker' in navigator) {
				const registrations = await navigator.serviceWorker.getRegistrations();
				await Promise.all(
					registrations.map((registration) => {
						console.log('Unregistering service worker:', registration.scope);
						return registration.unregister();
					})
				);
			}

			// Clear storage
			if ('localStorage' in window) {
				localStorage.clear();
			}
			if ('sessionStorage' in window) {
				sessionStorage.clear();
			}

			// Force reload with cache bypass
			window.location.reload();
		} catch (error) {
			console.error('Error during force reload:', error);
			// Fallback to simple reload
			window.location.reload();
		}
	}

	/**
	 * Store current version info in localStorage for tracking
	 */
	storeVersionInfo(): void {
		if (!browser) return;

		try {
			const versionInfo = {
				version: this.currentVersion,
				buildTime: this.buildTime,
				timestamp: Date.now()
			};
			localStorage.setItem('app-version', JSON.stringify(versionInfo));
		} catch (error) {
			console.warn('Could not store version info:', error);
		}
	}

	/**
	 * Get stored version info
	 */
	getStoredVersionInfo(): { version: string; buildTime: number; timestamp: number } | null {
		if (!browser) return null;

		try {
			const stored = localStorage.getItem('app-version');
			return stored ? JSON.parse(stored) : null;
		} catch (error) {
			console.warn('Could not read stored version info:', error);
			return null;
		}
	}

	/**
	 * Check if this is the first run of a new version
	 */
	isNewVersion(): boolean {
		const stored = this.getStoredVersionInfo();
		return !stored || stored.version !== this.currentVersion;
	}
}

// Export singleton instance
export const versionManager = VersionManager.getInstance();

/**
 * Force reload with cache clearing
 * Use this when you need to clear all caches and reload
 */
export function forceAppReload() {
	return versionManager.forceReload();
}

/**
 * Get current app version info
 */
export function getVersionInfo() {
	return {
		current: versionManager.version,
		buildTime: versionManager.timestamp,
		stored: versionManager.getStoredVersionInfo(),
		isNewVersion: versionManager.isNewVersion()
	};
}

// Auto-store version on import (no checking or notifications)
if (browser) {
	versionManager.storeVersionInfo();

	// Export for console debugging
	// @ts-ignore
	window.__versionUtils = {
		forceReload: forceAppReload,
		getInfo: getVersionInfo,
		manager: versionManager
	};
}
