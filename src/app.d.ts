// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

// ==================== SHARED INTERFACES ====================

declare global {
	interface R2File {
		key: string;
		size: number;
		lastModified: string;
	}

	interface FileComparisonResult {
		filename: string;
		isInOPFS: boolean;
		r2File: R2File;
	}

	interface FilterOption {
		value: string;
		count: number;
		label?: string;
		color?: string; // For lists
	}

	interface FilterGroup {
		type: 'search' | 'type' | 'list' | 'class' | 'subclass' | 'category';
		label: string;
		placeholder?: string;
		options?: FilterOption[];
		searchValue?: string;
		selectedValues?: string[];
	}

	/**
	 * Feature names with internationalization support
	 */
	interface FeatureNames {
		[key: string]: string; // name, name:en, name:fr, name:de, etc.
	}

	/**
	 * Search result from worker-based feature search
	 * Used for searching across MBTiles databases
	 */
	interface SearchResult {
		id: string;
		names: FeatureNames;
		class: string;
		subclass?: string;
		category?: string;
		lng: number;
		lat: number;
		database: string;
		layer: string;
		zoom: number;
		tileX: number;
		tileY: number;
	}

	/**
	 * Search result from database-based feature search
	 * Used for searching stored/bookmarked features
	 */
	interface FeatureSearchResult {
		feature: StoredFeature;
		score: number; // Relevance score for ranking
		matchedFields: string[]; // Which fields matched the search
	}

	/**
	 * Bookmark list for organizing features
	 */
	interface BookmarkList {
		id: string; // Unique identifier for the list
		name: string; // Display name for the list
		description?: string; // Optional description
		category?: string; // Optional category/tag
		color?: string; // Optional color for UI display
		featureIds: string[]; // Array of feature IDs in this list
		dateCreated: number;
		dateModified: number;
	}

	/**
	 * Stored feature in the local database
	 */
	interface StoredFeature {
		id: string; // Unique identifier for the feature
		class?: string;
		subclass?: string;
		category?: string;
		names: FeatureNames; // All name properties (name, name:en, name:fr, etc.)
		geometry: any; // GeoJSON geometry
		source: string; // Map source
		sourceLayer?: string; // Source layer if applicable
		layer?: { id: string }; // Map layer info

		// User action flags
		bookmarked: boolean;
		listIds: string[]; // Array of bookmark list IDs this feature belongs to
		visitedDates: number[]; // Array of timestamps when visited
		todo: boolean;

		// Metadata
		dateCreated: number;
		dateModified: number;

		// Search optimization - denormalized searchable text
		searchText: string; // Concatenated text for full-text search
	}

	// ==================== APP STATE INTERFACES ====================

	interface MapViewState {
		center: [number, number];
		zoom: number;
		bearing?: number;
		pitch?: number;
	}

	interface ColorMappings {
		// Map feature categories
		attraction: string;
		education: string;
		entertainment: string;
		facility: string;
		food_and_drink: string;
		healthcare: string;
		leisure: string;
		lodging: string;
		natural: string;
		place: string;
		route: string;
		shop: string;
		transportation: string;
		// User action categories
		bookmarks: string;
		visited: string;
		todo: string;
		followed: string;
		search: string;
	}

	interface AppConfig {
		mapView: MapViewState;
		colorMappings: ColorMappings;
		// Future config properties can be added here
		// theme?: string;
		// selectedLayers?: string[];
		// userPreferences?: Record<string, any>;
	}

	// ==================== APP INITIALIZATION INTERFACES ====================

	type InitializationStatus =
		| 'pending'
		| 'initializing'
		| 'worker-ready'
		| 'appstate-ready'
		| 'protocol-ready'
		| 'database-scanning'
		| 'complete'
		| 'error';

	interface InitializationState {
		status: InitializationStatus;
		error?: string;
		logs: string[];
	}

	interface InitializationResult {
		success: boolean;
		error?: string;
		workerInfo?: any;
	}

	// ==================== OPENING HOURS INTERFACES ====================

	interface OpeningHoursSchedule {
		originalText: string;
		is24_7: boolean;
		isClosed: boolean;
		isUnknown: boolean;
		days: {
			monday: TimeSlot[];
			tuesday: TimeSlot[];
			wednesday: TimeSlot[];
			thursday: TimeSlot[];
			friday: TimeSlot[];
			saturday: TimeSlot[];
			sunday: TimeSlot[];
		};
		notes: string[];
		comments: string[];
		warnings: string[];
		error?: string;
	}

	interface TimeSlot {
		start: number; // minutes from midnight (0-1439)
		end: number; // minutes from midnight (0-1440, where 1440 = next day midnight)
	}

	// ==================== PROTOCOL HANDLER INTERFACES ====================

	interface TileRequest {
		source: string;
		z: number;
		x: number;
		y: number;
	}

	// ==================== WORKER INTERFACES ====================

	interface WorkerMessage {
		type: string;
		data?: any;
		id?: string;
		fileData?: ArrayBuffer;
	}

	interface WorkerResponse extends WorkerMessage {
		error?: boolean;
	}

	interface DatabaseEntry {
		db: any; // OpfsDatabase type not imported here
		bounds?: [number, number, number, number];
		minzoom?: number;
		maxzoom?: number;
		filename: string;
		metadata?: any;
	}

	interface DatabaseMetadata {
		bounds?: [number, number, number, number];
		minzoom?: number;
		maxzoom?: number;
		format?: string;
		name?: string;
		description?: string;
	}

	interface TileToMerge {
		filename: string;
		data: ArrayBuffer;
	}

	// ==================== SVELTEKIT APP INTERFACES ====================

	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
