import { browser } from '$app/environment';
import { authState } from '$lib/stores/auth.svelte';
import type { User } from 'firebase/auth';

const DEFAULT_COLOR_MAPPINGS: ColorMappings = {
	// Map feature categories
	attraction: 'teal',
	education: 'stone',
	entertainment: 'fuchsia',
	facility: 'zinc',
	food_and_drink: 'amber',
	healthcare: 'red',
	leisure: 'blue',
	lodging: 'slate',
	natural: 'green',
	place: 'neutral',
	route: 'indigo',
	shop: 'rose',
	transportation: 'sky',
	// User action categories
	bookmarks: 'blue',
	visited: 'green',
	todo: 'red',
	followed: 'purple',
	search: 'yellow'
};

const DEFAULT_CONFIG: AppConfig = {
	mapView: {
		center: [0, 0],
		zoom: 2,
		bearing: 0,
		pitch: 0
	},
	colorMappings: DEFAULT_COLOR_MAPPINGS,
	language: 'name' // Default to local names
};

/**
 * App State management class using Svelte 5 runes
 * Handles persistent storage of application configuration
 * Only initializes in browser environment
 */
class AppState {
	// Separate reactive states to prevent cross-triggers
	private _mapView = $state<MapViewState>(DEFAULT_CONFIG.mapView);
	private _colorMappings = $state<ColorMappings>(DEFAULT_CONFIG.colorMappings);
	private _language = $state<LanguageCode>(DEFAULT_CONFIG.language);

	// Storage configuration - user-based local storage
	private readonly DB_NAME = 'AppStateDB';
	private readonly DB_VERSION = 2;
	private readonly STORE_NAME = 'userConfigs';

	private db: IDBDatabase | null = null;
	private isInitialized = $state(false);
	private isLoading = $state(false); // Track if we're currently loading user config
	private initPromise: Promise<void> | null = null;
	private currentUser: User | null = null;

	constructor() {
		// Only initialize in browser environment
		if (browser) {
			// Initialize with default state first to ensure app works without auth
			this.isInitialized = true;

			// Load initial config for anonymous user
			this.initializeStorage();
		} else {
			// In SSR, mark as initialized with defaults
			this.isInitialized = true;
		}
	}

	/**
	 * Handle user change - called from components when auth state changes
	 */
	async handleUserChange(newUser: User | null): Promise<void> {
		if (!browser) return;

		const previousUser = this.currentUser;
		console.log(
			`🔄 handleUserChange: ${previousUser?.uid || 'anonymous'} -> ${newUser?.uid || 'anonymous'}`
		);

		// If user changed, reinitialize storage for new user
		if (previousUser?.uid !== newUser?.uid) {
			this.isLoading = true; // Set loading state
			this.currentUser = newUser;

			// Reset promise to allow re-initialization for new user
			this.initPromise = null;

			try {
				// Reset to defaults when user changes
				console.log('🔄 Resetting to defaults before loading user config');
				this._mapView = { ...DEFAULT_CONFIG.mapView };
				this._colorMappings = { ...DEFAULT_CONFIG.colorMappings };
				this._language = DEFAULT_CONFIG.language;

				// Load user-specific configuration if available
				console.log('🔍 Loading user-specific configuration...');
				await this.initializeStorage();

				console.log(`✅ AppState loaded for user: ${newUser?.uid || 'anonymous'}`);
				console.log(`🗺️ Map view: [${this._mapView.center.join(', ')}] @ z${this._mapView.zoom}`);
			} finally {
				this.isLoading = false; // Clear loading state
			}
		} else {
			console.log('ℹ️ Same user, no change needed');
		}
	}

	// Getter for the current configuration (computed from separate states)
	get config(): AppConfig {
		return {
			mapView: this._mapView,
			colorMappings: this._colorMappings,
			language: this._language
		};
	}

	// Getter for map view state
	get mapView(): MapViewState {
		return this._mapView;
	}

	// Getter for language setting
	get language(): LanguageCode {
		return this._language;
	}

	// Getter for color mappings
	get colorMappings(): ColorMappings {
		return this._colorMappings;
	}

	// Getter for initialization status
	get initialized(): boolean {
		return this.isInitialized;
	}

	// Getter for loading status
	get isLoadingConfig(): boolean {
		return this.isLoading;
	}

	// Check if AppState is ready to be used (initialized and not loading)
	get isReady(): boolean {
		return this.isInitialized && !this.isLoading;
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
			return; // Already initialized with defaults
		}

		try {
			this.db = await this.openDatabase();
			await this.loadConfig();
			console.log('AppState storage initialized for user:', this.getCurrentUserStorageKey());
		} catch (error) {
			console.error('Failed to initialize storage:', error);
			// Continue with default config if storage fails
		}
	}

	/**
	 * Get storage key for current user (local to this device)
	 */
	private getCurrentUserStorageKey(): string {
		if (!this.currentUser) {
			return 'anonymous-config';
		}
		return `user-${this.currentUser.uid}-config`;
	}

	/**
	 * Open IndexedDB database with user-based local storage
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
				const oldVersion = event.oldVersion;

				// Remove old single-user store if exists
				if (oldVersion < 2 && db.objectStoreNames.contains('config')) {
					db.deleteObjectStore('config');
				}

				// Create user-based local config store
				if (!db.objectStoreNames.contains(this.STORE_NAME)) {
					db.createObjectStore(this.STORE_NAME, { keyPath: 'key' });
				}
			};
		});
	}

	/**
	 * Load configuration from local storage for current user
	 */
	private async loadConfig(): Promise<void> {
		if (!this.db) {
			console.log('💾 No database connection, using defaults');
			return;
		}

		try {
			const storageKey = this.getCurrentUserStorageKey();
			console.log(`🔍 Loading config for key: ${storageKey}`);

			const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
			const store = transaction.objectStore(this.STORE_NAME);
			const request = store.get(storageKey);

			const result = await new Promise<any>((resolve, reject) => {
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});

			if (result && result.value) {
				console.log('✅ Found saved config:', result.value);

				// Load and merge saved config with defaults, updating separate states
				this._mapView = {
					...DEFAULT_CONFIG.mapView,
					...result.value.mapView
				};
				this._colorMappings = {
					...DEFAULT_COLOR_MAPPINGS,
					...result.value.colorMappings
				};
				this._language = result.value.language || DEFAULT_CONFIG.language;

				console.log(
					`🗺️ Loaded map view: [${this._mapView.center.join(', ')}] @ z${this._mapView.zoom}`
				);
			} else {
				console.log('⚠️ No saved config found, using defaults');
			}
		} catch (error) {
			console.error('Failed to load config:', error);
		}
	}

	/**
	 * Save configuration to local storage for current user
	 * Only saves in browser environment
	 */
	private async saveConfig(): Promise<void> {
		if (!browser || !this.db || !this.isInitialized) return;

		try {
			const storageKey = this.getCurrentUserStorageKey();
			const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
			const store = transaction.objectStore(this.STORE_NAME);

			// Create a plain object copy to avoid cloning issues with Svelte state
			const plainConfig: AppConfig = {
				mapView: {
					center: [...this._mapView.center] as [number, number],
					zoom: this._mapView.zoom,
					bearing: this._mapView.bearing,
					pitch: this._mapView.pitch
				},
				colorMappings: { ...this._colorMappings },
				language: this._language
			};

			await new Promise<void>((resolve, reject) => {
				const request = store.put({
					key: storageKey,
					userID: this.currentUser?.uid || 'anonymous',
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
		// Update map view state directly (isolated from color mappings)
		this._mapView = {
			...this._mapView,
			...mapView
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
	 * Update language setting
	 */
	updateLanguage(language: LanguageCode): void {
		this._language = language;
		this.saveConfig(); // Auto-save changes
	}

	/**
	 * Update color mapping for a specific category (isolated from map view)
	 */
	updateColorMapping(categoryKey: string, colorName: string): void {
		// Update color mappings directly without affecting map view
		this._colorMappings = {
			...this._colorMappings,
			[categoryKey]: colorName
		};
		this.saveConfig(); // Auto-save changes
	}

	/**
	 * Reset color mappings to defaults
	 */
	resetColorMappings(): void {
		this._colorMappings = { ...DEFAULT_COLOR_MAPPINGS };
		this.saveConfig();
	}

	/**
	 * Get color for a specific category
	 */
	getCategoryColor(categoryKey: string): string {
		return this._colorMappings[categoryKey as keyof ColorMappings] || 'neutral';
	}

	/**
	 * Ensure storage is initialized before operations
	 * Useful for ensuring state is ready before use
	 * Always returns successfully, even if storage initialization fails
	 */
	async ensureInitialized(): Promise<void> {
		if (!browser) return; // Always ready in SSR
		if (this.isInitialized) return; // Already initialized with defaults

		// This should not happen with the new constructor logic, but just in case
		this.isInitialized = true;
		console.warn(
			'AppState was not initialized in constructor, setting to initialized with defaults'
		);
	}

	/**
	 * Reset to default configuration
	 */
	async reset(): Promise<void> {
		this._mapView = { ...DEFAULT_CONFIG.mapView };
		this._colorMappings = { ...DEFAULT_CONFIG.colorMappings };
		this._language = DEFAULT_CONFIG.language;
		await this.saveConfig();
	}

	/**
	 * Get configuration as plain object (for debugging)
	 */
	export(): AppConfig {
		return JSON.parse(JSON.stringify(this.config));
	}

	/**
	 * Import configuration (for backup/restore)
	 */
	async import(config: Partial<AppConfig>): Promise<void> {
		await this.ensureInitialized();
		this._mapView = {
			...DEFAULT_CONFIG.mapView,
			...config.mapView
		};
		this._colorMappings = {
			...DEFAULT_COLOR_MAPPINGS,
			...config.colorMappings
		};
		this._language = config.language || DEFAULT_CONFIG.language;
		await this.saveConfig();
	}

	/**
	 * Clean up resources when component is destroyed
	 */
	destroy(): void {
		// Effects clean up automatically in Svelte 5
	}
}

// Create singleton instance
export const appState = new AppState();
