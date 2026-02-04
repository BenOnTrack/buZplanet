import { browser } from '$app/environment';

export interface MapViewState {
	center: [number, number];
	zoom: number;
	bearing?: number;
	pitch?: number;
}

export interface AppConfig {
	mapView: MapViewState;
	// Future config properties can be added here
	// theme?: string;
	// selectedLayers?: string[];
	// userPreferences?: Record<string, any>;
}

const DEFAULT_CONFIG: AppConfig = {
	mapView: {
		center: [0, 0],
		zoom: 2,
		bearing: 0,
		pitch: 0
	}
};

/**
 * App State management class using Svelte 5 runes
 * Handles persistent storage of application configuration
 * Only initializes in browser environment
 */
class AppState {
	// Reactive state for current configuration
	private _config = $state<AppConfig>(DEFAULT_CONFIG);

	// Storage key for IndexedDB
	private readonly STORAGE_KEY = 'app-config';
	private readonly DB_NAME = 'AppStateDB';
	private readonly DB_VERSION = 1;
	private readonly STORE_NAME = 'config';

	private db: IDBDatabase | null = null;
	private isInitialized = $state(false);
	private initPromise: Promise<void> | null = null;

	constructor() {
		// Only initialize in browser environment
		if (browser) {
			this.initializeStorage();
		} else {
			// In SSR, mark as initialized with defaults
			this.isInitialized = true;
		}
	}

	// Getter for the current configuration
	get config(): AppConfig {
		return this._config;
	}

	// Getter for map view state
	get mapView(): MapViewState {
		return this._config.mapView;
	}

	// Getter for initialization status
	get initialized(): boolean {
		return this.isInitialized;
	}

	/**
	 * Initialize IndexedDB storage
	 * Only runs in browser environment
	 */
	private async initializeStorage(): Promise<void> {
		// Prevent multiple initialization attempts
		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = this._initializeStorage();
		return this.initPromise;
	}

	private async _initializeStorage(): Promise<void> {
		// Double-check we're in browser
		if (!browser || typeof indexedDB === 'undefined') {
			console.warn('IndexedDB not available, using default configuration');
			this.isInitialized = true;
			return;
		}

		try {
			this.db = await this.openDatabase();
			await this.loadConfig();
			this.isInitialized = true;
		} catch (error) {
			console.error('Failed to initialize storage:', error);
			// Fallback to default config if storage fails
			this.isInitialized = true;
		}
	}

	/**
	 * Open IndexedDB database
	 * Only available in browser environment
	 */
	private openDatabase(): Promise<IDBDatabase> {
		if (!browser || typeof indexedDB === 'undefined') {
			throw new Error('IndexedDB not available');
		}

		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result);

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;

				// Create object store if it doesn't exist
				if (!db.objectStoreNames.contains(this.STORE_NAME)) {
					db.createObjectStore(this.STORE_NAME, { keyPath: 'key' });
				}
			};
		});
	}

	/**
	 * Load configuration from storage
	 */
	private async loadConfig(): Promise<void> {
		if (!this.db) return;

		try {
			const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
			const store = transaction.objectStore(this.STORE_NAME);
			const request = store.get(this.STORAGE_KEY);

			const result = await new Promise<any>((resolve, reject) => {
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});

			if (result && result.value) {
				// Merge saved config with defaults to ensure all properties exist
				this._config = { ...DEFAULT_CONFIG, ...result.value };
			}
		} catch (error) {
			console.error('Failed to load config:', error);
		}
	}

	/**
	 * Save configuration to storage
	 * Only saves in browser environment
	 */
	private async saveConfig(): Promise<void> {
		if (!browser || !this.db || !this.isInitialized) return;

		try {
			const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
			const store = transaction.objectStore(this.STORE_NAME);

			// Create a plain object copy to avoid cloning issues with Svelte state
			const plainConfig: AppConfig = {
				mapView: {
					center: [...this._config.mapView.center] as [number, number],
					zoom: this._config.mapView.zoom,
					bearing: this._config.mapView.bearing,
					pitch: this._config.mapView.pitch
				}
			};

			await new Promise<void>((resolve, reject) => {
				const request = store.put({
					key: this.STORAGE_KEY,
					value: plainConfig,
					timestamp: Date.now()
				});

				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});
		} catch (error) {
			console.error('Failed to save config:', error);
		}
	}

	/**
	 * Update map view state
	 */
	updateMapView(mapView: Partial<MapViewState>): void {
		// Create a new config object to ensure reactivity
		this._config = {
			...this._config,
			mapView: {
				...this._config.mapView,
				...mapView
			}
		};
		this.saveConfig(); // Auto-save changes
	}

	/**
	 * Update center coordinates
	 */
	updateCenter(center: [number, number]): void {
		this.updateMapView({ center });
	}

	/**
	 * Update zoom level
	 */
	updateZoom(zoom: number): void {
		this.updateMapView({ zoom });
	}

	/**
	 * Update bearing (rotation)
	 */
	updateBearing(bearing: number): void {
		this.updateMapView({ bearing });
	}

	/**
	 * Update pitch (tilt)
	 */
	updatePitch(pitch: number): void {
		this.updateMapView({ pitch });
	}

	/**
	 * Ensure storage is initialized before operations
	 * Useful for ensuring state is ready before use
	 */
	async ensureInitialized(): Promise<void> {
		if (!browser) return; // Always ready in SSR
		if (this.isInitialized) return;
		if (this.initPromise) {
			await this.initPromise;
		}
	}

	/**
	 * Reset to default configuration
	 */
	async reset(): Promise<void> {
		this._config = { ...DEFAULT_CONFIG };
		await this.saveConfig();
	}

	/**
	 * Get configuration as plain object (for debugging)
	 */
	export(): AppConfig {
		return JSON.parse(JSON.stringify(this._config));
	}

	/**
	 * Import configuration (for backup/restore)
	 */
	async import(config: Partial<AppConfig>): Promise<void> {
		await this.ensureInitialized();
		this._config = { ...DEFAULT_CONFIG, ...config };
		await this.saveConfig();
	}
}

// Create singleton instance
export const appState = new AppState();
