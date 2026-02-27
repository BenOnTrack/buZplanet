import { browser } from '$app/environment';
import { authState } from '$lib/stores/auth.svelte';
import { _CATEGORY } from '$lib/assets/class_subclass_category';
import type { User } from 'firebase/auth';

const DEFAULT_RELATION_SETTINGS: RelationSettings = {
	childRoute: []
};

const DEFAULT_FILTER_SETTINGS: AppFilterSettings = {
	map: {
		categories: new Set(_CATEGORY)
	},
	heat: {
		categories: new Set<string>() // Empty by default
	},
	bookmark: {
		categories: new Set(_CATEGORY)
	},
	todo: {
		categories: new Set(_CATEGORY)
	},
	visited: {
		categories: new Set(_CATEGORY)
	}
};

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
	language: 'name', // Default to local names
	filterSettings: DEFAULT_FILTER_SETTINGS,
	relationSettings: DEFAULT_RELATION_SETTINGS
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
	private _filterSettings = $state<AppFilterSettings>(DEFAULT_CONFIG.filterSettings);
	private _relationSettings = $state<RelationSettings>(DEFAULT_CONFIG.relationSettings);

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
				// Load user-specific configuration directly without resetting first
				// This prevents the map from being initialized with default coordinates
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
			language: this._language,
			filterSettings: this._filterSettings,
			relationSettings: this._relationSettings
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

	// Getter for filter settings
	get filterSettings(): AppFilterSettings {
		return this._filterSettings;
	}

	// Getter for map filter settings
	get mapFilterSettings(): CategoryFilterSettings {
		return this._filterSettings.map;
	}

	// Getter for color mappings
	get colorMappings(): ColorMappings {
		return this._colorMappings;
	}

	// Getter for relation settings
	get relationSettings(): RelationSettings {
		return this._relationSettings;
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
			console.log('💾 No database connection, using current values or defaults');
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

				// Ensure colorMappings are always strings, not arrays
				const loadedColorMappings = result.value.colorMappings || {};
				const cleanColorMappings: ColorMappings = { ...DEFAULT_COLOR_MAPPINGS };

				// Clean and validate each color mapping
				for (const [key, value] of Object.entries(loadedColorMappings)) {
					if (typeof value === 'string' && value.length > 0) {
						// Valid string value
						cleanColorMappings[key as keyof ColorMappings] = value;
					} else if (Array.isArray(value) && value.length > 0) {
						// If it's an array, take the last element (most recent)
						console.warn(
							`Color mapping for ${key} was corrupted as array:`,
							value,
							'using last value'
						);
						const lastValue = value[value.length - 1];
						if (typeof lastValue === 'string' && lastValue.length > 0) {
							cleanColorMappings[key as keyof ColorMappings] = lastValue;
						}
					} else {
						console.warn(`Invalid color mapping for ${key}:`, value, 'using default');
						// Keep default value
					}
				}

				this._colorMappings = cleanColorMappings;
				console.log('🎨 Loaded and cleaned color mappings:', this._colorMappings);
				this._language = result.value.language || DEFAULT_CONFIG.language;

				// Load relation settings
				if (result.value.relationSettings) {
					this._relationSettings = {
						childRoute: Array.isArray(result.value.relationSettings.childRoute)
							? result.value.relationSettings.childRoute
							: []
					};
				} else {
					this._relationSettings = { ...DEFAULT_RELATION_SETTINGS };
				}

				// IMPORTANT: Always ensure filterSettings exist, even for old configs
				if (result.value.filterSettings) {
					// Existing config has filterSettings, load them with conversion from arrays to Sets
					console.log('📂 Loading existing filterSettings from storage');

					// Check if this is an old format with classes/subclasses or new format with just categories
					if (
						result.value.filterSettings.map?.classes ||
						result.value.filterSettings.map?.subclasses
					) {
						// Old format - migrate to new format (categories only)
						console.log('🔄 Migrating old filter format to new categories-only format');
						this._filterSettings = {
							map: {
								categories: new Set(result.value.filterSettings.map?.categories || _CATEGORY)
							},
							heat: {
								categories: new Set(result.value.filterSettings.heat?.categories || [])
							},
							bookmark: {
								categories: new Set(result.value.filterSettings.bookmark?.categories || _CATEGORY)
							},
							todo: {
								categories: new Set(result.value.filterSettings.todo?.categories || _CATEGORY)
							},
							visited: {
								categories: new Set(result.value.filterSettings.visited?.categories || _CATEGORY)
							}
						};
						// Save the migrated config
						this.saveConfig();
					} else {
						// New format - load categories directly
						this._filterSettings = {
							map: {
								categories: new Set(result.value.filterSettings.map?.categories || _CATEGORY)
							},
							heat: {
								categories: new Set(result.value.filterSettings.heat?.categories || [])
							},
							bookmark: {
								categories: new Set(result.value.filterSettings.bookmark?.categories || _CATEGORY)
							},
							todo: {
								categories: new Set(result.value.filterSettings.todo?.categories || _CATEGORY)
							},
							visited: {
								categories: new Set(result.value.filterSettings.visited?.categories || _CATEGORY)
							}
						};
					}
				} else {
					// Old config without filterSettings - initialize with defaults (all selected)
					console.log(
						'🆕 Adding missing filterSettings to existing config - initializing with ALL categories selected'
					);
					this._filterSettings = { ...DEFAULT_FILTER_SETTINGS };

					// Save the updated config immediately to persist the new filterSettings
					this.saveConfig();
				}

				console.log(
					`🗺️ Loaded map view: [${this._mapView.center.join(', ')}] @ z${this._mapView.zoom}`
				);
				console.log('🔍 Loaded filter settings:', {
					map: {
						categories: this._filterSettings.map.categories.size
					}
				});
			} else {
				console.log('⚠️ No saved config found, using defaults');
				// Only set defaults if switching from completely uninitialized state
				// (Check if mapView exactly matches the default values - indicates uninitialized)
				const isDefaultState =
					this._mapView.center[0] === 0 &&
					this._mapView.center[1] === 0 &&
					this._mapView.zoom === 2;

				if (isDefaultState) {
					console.log('🔄 Setting defaults for uninitialized state');
					this._mapView = { ...DEFAULT_CONFIG.mapView };
					this._colorMappings = { ...DEFAULT_CONFIG.colorMappings };
					this._language = DEFAULT_CONFIG.language;
				} else {
					console.log('🔐 Preserving current map view state');
					// Keep current mapView state, but ensure other settings have defaults
					if (Object.keys(this._colorMappings).length === 0) {
						this._colorMappings = { ...DEFAULT_CONFIG.colorMappings };
					}
					if (!this._language) {
						this._language = DEFAULT_CONFIG.language;
					}
					if (!this._filterSettings) {
						this._filterSettings = { ...DEFAULT_FILTER_SETTINGS };
					}
					if (!this._relationSettings) {
						this._relationSettings = { ...DEFAULT_RELATION_SETTINGS };
					}

					// Save the updated config with new fields
					this.saveConfig();
				}
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
		console.log(
			'🔄 saveConfig() called - browser:',
			browser,
			'db:',
			!!this.db,
			'initialized:',
			this.isInitialized
		);

		if (!browser || !this.db || !this.isInitialized) {
			console.warn('❌ saveConfig() aborted - missing requirements');
			return;
		}

		try {
			const storageKey = this.getCurrentUserStorageKey();
			console.log('💾 Saving config with key:', storageKey);

			const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
			const store = transaction.objectStore(this.STORE_NAME);

			// Create a plain object copy to avoid cloning issues with Svelte state
			const plainConfig = {
				mapView: {
					center: [this._mapView.center[0], this._mapView.center[1]] as [number, number],
					zoom: this._mapView.zoom,
					bearing: this._mapView.bearing,
					pitch: this._mapView.pitch
				},
				colorMappings: JSON.parse(JSON.stringify(this._colorMappings)),
				language: this._language,
				filterSettings: {
					map: {
						categories: Array.from(this._filterSettings.map.categories)
					},
					heat: {
						categories: Array.from(this._filterSettings.heat.categories)
					},
					bookmark: {
						categories: Array.from(this._filterSettings.bookmark.categories)
					},
					todo: {
						categories: Array.from(this._filterSettings.todo.categories)
					},
					visited: {
						categories: Array.from(this._filterSettings.visited.categories)
					}
				},
				relationSettings: {
					childRoute: [...this._relationSettings.childRoute]
				}
			};

			console.log('📝 Saving config data:', plainConfig);

			await new Promise<void>((resolve, reject) => {
				const request = store.put({
					key: storageKey,
					userID: this.currentUser?.uid || 'anonymous',
					value: plainConfig,
					timestamp: Date.now()
				});

				request.onsuccess = () => {
					console.log('✅ Config saved successfully to IndexedDB');
					resolve();
				};
				request.onerror = () => {
					console.error('❌ Failed to save config to IndexedDB:', request.error);
					reject(request.error);
				};
			});
		} catch (error) {
			console.error('❌ Failed to save config:', error);
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
	 * Update map filter settings
	 */
	updateMapFilterSettings(filterSettings: Partial<CategoryFilterSettings>): void {
		this._filterSettings = {
			...this._filterSettings,
			map: {
				...this._filterSettings.map,
				...filterSettings
			}
		};
		this.saveConfig(); // Auto-save changes
	}

	/**
	 * Update filter settings for a specific tab
	 */
	updateFilterSettings(
		tab: keyof AppFilterSettings,
		filterSettings: Partial<CategoryFilterSettings>
	): void {
		this._filterSettings = {
			...this._filterSettings,
			[tab]: {
				...this._filterSettings[tab],
				...filterSettings
			}
		};
		this.saveConfig(); // Auto-save changes
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
		console.log(`🎨 Updating color mapping: ${categoryKey} = ${colorName}`);

		// Ensure we're always storing a clean string value
		if (typeof colorName !== 'string' || colorName.length === 0) {
			console.error('Invalid color name provided:', colorName);
			return;
		}

		// Update color mappings directly without affecting map view
		this._colorMappings = {
			...this._colorMappings,
			[categoryKey]: colorName
		};

		console.log(`✅ Color mapping updated. New mappings:`, this._colorMappings);
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
	 * Update relation settings
	 */
	updateRelationSettings(relationSettings: Partial<RelationSettings>): void {
		this._relationSettings = {
			...this._relationSettings,
			...relationSettings
		};
		this.saveConfig(); // Auto-save changes
	}

	/**
	 * Add childId to route (parsing X-Y-Z format)
	 */
	addChildIdToRoute(childId: string): void {
		// Parse childId: split by "-" into individual parts
		const parts = childId.split('-').filter((part) => part.length > 0);

		console.log(`Adding childId "${childId}" parsed as:`, parts);

		// Add all parts to the route
		const newRoute = [...this._relationSettings.childRoute, ...parts];

		this._relationSettings = {
			...this._relationSettings,
			childRoute: newRoute
		};

		console.log('Updated childRoute:', newRoute);
		this.saveConfig();
	}

	/**
	 * Toggle childId in route - if exists, remove ALL parts, if not exists, add it
	 */
	toggleChildIdInRoute(childId: string): void {
		// Parse childId: split by "-" into individual parts
		const parts = childId.split('-').filter((part) => part.length > 0);
		const currentRoute = this._relationSettings.childRoute;

		console.log(`Toggling childId "${childId}" parsed as:`, parts);
		console.log('Current route:', currentRoute);

		// Check if ALL parts of the childId exist anywhere in the current route
		const allPartsExist = parts.every((part) => currentRoute.includes(part));

		let newRoute: string[];

		if (allPartsExist) {
			// Remove ALL parts of the childId from the route
			newRoute = currentRoute.filter((routePart) => !parts.includes(routePart));
			console.log('All parts exist - removing ALL parts:', parts);
			console.log('Filtered route:', newRoute);
		} else {
			// Add the parts to the route (only if they don't already exist)
			newRoute = [...currentRoute];
			parts.forEach((part) => {
				if (!newRoute.includes(part)) {
					newRoute.push(part);
				}
			});
			console.log('Some/all parts missing - adding missing parts:', newRoute);
		}

		this._relationSettings = {
			...this._relationSettings,
			childRoute: newRoute
		};

		console.log('Updated childRoute:', newRoute);
		this.saveConfig();
	}

	/**
	 * Get color mapping for a specific category
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
		this._filterSettings = { ...DEFAULT_FILTER_SETTINGS };
		this._relationSettings = { ...DEFAULT_RELATION_SETTINGS };
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

		// Handle filter settings import with Set conversion
		if (config.filterSettings) {
			this._filterSettings = {
				map: {
					categories: new Set(config.filterSettings.map?.categories || _CATEGORY)
				},
				heat: {
					categories: new Set(config.filterSettings.heat?.categories || [])
				},
				bookmark: {
					categories: new Set(config.filterSettings.bookmark?.categories || _CATEGORY)
				},
				todo: {
					categories: new Set(config.filterSettings.todo?.categories || _CATEGORY)
				},
				visited: {
					categories: new Set(config.filterSettings.visited?.categories || _CATEGORY)
				}
			};
		} else {
			this._filterSettings = { ...DEFAULT_FILTER_SETTINGS };
		}

		// Handle relation settings import
		if (config.relationSettings) {
			this._relationSettings = {
				childRoute: Array.isArray(config.relationSettings.childRoute)
					? config.relationSettings.childRoute
					: []
			};
		} else {
			this._relationSettings = { ...DEFAULT_RELATION_SETTINGS };
		}

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
