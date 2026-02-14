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
		userId: string; // User ID from Firebase Auth
		name: string; // Display name for the list
		description?: string; // Optional description
		category?: string; // Optional category/tag
		color?: string; // Optional color for UI display
		featureIds: string[]; // Array of feature IDs in this list
		dateCreated: number;
		dateModified: number;

		// Sync fields
		lastSyncTimestamp?: number; // When this list was last synced
		firestoreId?: string; // Firestore document ID
		deleted?: boolean; // Soft delete flag for sync
	}

	/**
	 * Stored feature in the local database
	 */
	interface StoredFeature {
		id: string; // Unique identifier for the feature
		userId: string; // User ID from Firebase Auth
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

		// Sync fields
		lastSyncTimestamp?: number; // When this feature was last synced
		firestoreId?: string; // Firestore document ID
		deleted?: boolean; // Soft delete flag for sync

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

	/**
	 * Language configuration for internationalization
	 * Determines which name property to use for displaying feature names
	 */
	type LanguageCode =
		| 'name'
		| 'name:en'
		| 'name:fr'
		| 'name:de'
		| 'name:es'
		| 'name:it'
		| 'name:pt'
		| 'name:zh'
		| 'name:ja'
		| 'name:ko'
		| 'name:ar'
		| 'name:ru';

	interface LanguageOption {
		code: LanguageCode;
		label: string;
	}

	interface AppConfig {
		mapView: MapViewState;
		colorMappings: ColorMappings;
		language: LanguageCode;
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

	interface BaseFeature {
		id: string;
		class?: string;
		subclass?: string;
		category?: string;
		names: FeatureNames;
	}

	interface TableFeature extends BaseFeature {
		// Common properties for both StoredFeature and SearchResult
		types?: ('bookmarked' | 'todo' | 'visited')[];
		lists?: { id: string; name: string; color: string }[];
		isFromSearch?: boolean;
		searchResult?: SearchResult; // Original search result if this is from search
		storedFeature?: StoredFeature; // Matched stored feature if available
	}

	// ==================== BROWSER WINDOW EXTENSIONS ====================

	interface Window {
		testWorker: () => Promise<void>;
		workerStatus: () => void;
	}

	// ==================== STORIES INTERFACES ====================

	/**
	 * Story content node types
	 */
	type StoryContentNode =
		| {
				type: 'text';
				text: string;
		  }
		| {
				type: 'feature';
				featureId: string;
				displayText: string;
				feature: StoredFeature | SearchResult; // Can embed either type
				customText?: string; // User can override display text
		  };

	/**
	 * Story version for editing history
	 */
	interface StoryVersion {
		id: string; // version id
		storyId: string;
		content: StoryContentNode[];
		title: string;
		description?: string;
		tags: string[];
		categories: string[];
		dateCreated: number;
		versionNumber: number;
		changeDescription?: string; // What changed in this version
	}

	/**
	 * Main story interface
	 */
	interface Story {
		id: string; // Unique identifier for the story
		userId: string; // User ID from Firebase Auth
		title: string;
		description?: string;
		content: StoryContentNode[];
		tags: string[]; // User-defined tags
		categories: string[]; // Predefined categories like 'travel', 'food', etc.

		// Metadata
		dateCreated: number;
		dateModified: number;
		viewCount?: number; // How many times story was viewed
		isPublic: boolean; // Whether story can be shared

		// Versioning
		currentVersion: number;
		versions?: StoryVersion[]; // Full version history

		// Sync fields
		lastSyncTimestamp?: number; // When this story was last synced
		firestoreId?: string; // Firestore document ID
		deleted?: boolean; // Soft delete flag for sync

		// Search optimization - denormalized searchable text
		searchText: string; // Concatenated text for full-text search
	}

	/**
	 * Story search result
	 */
	interface StorySearchResult {
		story: Story;
		score: number; // Relevance score for ranking
		matchedFields: string[]; // Which fields matched the search
		matchedContent?: StoryContentNode[]; // Content nodes that matched
	}

	/**
	 * Story category configuration
	 */
	interface StoryCategory {
		id: string;
		userId: string; // User ID from Firebase Auth
		name: string;
		color: string;
		icon?: string;
		description?: string;

		// Sync fields
		lastSyncTimestamp?: number; // When this category was last synced
		firestoreId?: string; // Firestore document ID
		deleted?: boolean; // Soft delete flag for sync
	}

	// ==================== SYNC INTERFACES ====================

	interface SyncConflict {
		id: string;
		type: 'feature' | 'list' | 'story';
		localData: any;
		remoteData: any;
		conflictType: 'both_modified' | 'local_deleted' | 'remote_deleted';
		timestamp: number;
	}

	interface SyncMetadata {
		userId: string;
		lastSyncTimestamp: number;
		deviceId: string;
		syncVersion: number;
	}

	interface SyncStats {
		featuresUploaded: number;
		featuresDownloaded: number;
		listsUploaded: number;
		listsDownloaded: number;
		conflictsResolved: number;
		lastSyncDuration: number;
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
