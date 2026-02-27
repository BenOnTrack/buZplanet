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
		status: 'not-downloaded' | 'up-to-date' | 'needs-update';
		opfsFile?: OPFSFileInfo;
	}

	interface OPFSFileInfo {
		filename: string;
		size: number;
		lastModified: number; // timestamp
	}

	interface R2FileMetadata {
		lastModified: string;
		size: number;
	}

	// File hierarchy for categorized display
	interface FileHierarchyNode {
		name: string;
		files: FileComparisonResult[];
		children: Record<string, FileHierarchyNode>;
		path: string[];
		totalFiles: number;
		missingFiles: number;
		allFilesDownloaded: boolean;
		partiallySelected: boolean;
		fullySelected: boolean;
	}

	interface FileHierarchy {
		[continent: string]: {
			name: string;
			children: {
				[country: string]: {
					name: string;
					children: {
						[region: string]: {
							name: string;
							children: {
								[type: string]: FileHierarchyNode;
							};
							path: string[];
							totalFiles: number;
							missingFiles: number;
							allFilesDownloaded: boolean;
							partiallySelected: boolean;
							fullySelected: boolean;
						};
					};
					path: string[];
					totalFiles: number;
					missingFiles: number;
					allFilesDownloaded: boolean;
					partiallySelected: boolean;
					fullySelected: boolean;
				};
			};
			path: string[];
			totalFiles: number;
			missingFiles: number;
			allFilesDownloaded: boolean;
			partiallySelected: boolean;
			fullySelected: boolean;
		};
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
	 * Feature relation information for route connections
	 */
	interface FeatureRelation {
		type: string; // relationType from the feature
		childId: string; // relationChildId from the feature
		parentId?: string; // relationParentId from the feature
		bbox?: [number, number, number, number]; // bbox from the feature
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

		// Relation information
		relation?: FeatureRelation; // Route relation data if applicable

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

	interface CategoryFilterSettings {
		categories: Set<string>;
	}

	// For storage - arrays are used in IndexedDB
	interface CategoryFilterSettingsStored {
		categories: string[];
	}

	/**
	 * Relation settings for route tracking
	 */
	interface RelationSettings {
		childRoute: string[];
	}

	interface AppFilterSettings {
		map: CategoryFilterSettings;
		heat: CategoryFilterSettings;
		bookmark: CategoryFilterSettings;
		todo: CategoryFilterSettings;
		visited: CategoryFilterSettings;
	}

	interface AppConfig {
		mapView: MapViewState;
		colorMappings: ColorMappings;
		language: LanguageCode;
		filterSettings: AppFilterSettings;
		relationSettings: RelationSettings;
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
		| 'error'
		| 'auth-waiting'
		| 'appstate-loading';

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

	// ==================== TILE CACHE INTERFACES ====================

	interface CachedTile {
		data: ArrayBuffer;
		timestamp: number;
		accessCount: number;
		lastAccessed: number;
		source: string;
		z: number;
		x: number;
		y: number;
		size: number;
	}

	interface TileCacheConfig {
		maxMemorySize: number;
		prefetchRadius: number;
		prefetchZoomLevels: number[];
		prefetchDirection: boolean;
		maxPrefetchQueue: number;
	}

	interface Viewport {
		z: number;
		centerX: number;
		centerY: number;
		tilesX: number;
		tilesY: number;
	}

	interface TileRequestWithPriority extends TileRequest {
		priority: number;
		isPrefetch: boolean;
	}

	interface MovementVector {
		dx: number;
		dy: number;
		magnitude: number;
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
		debugStoriesSync: () => Promise<void>;
		testFollowedStoriesSync: () => Promise<void>;
		debugStorySync: (authorUserId: string, storyId: string) => Promise<void>;
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
		categories: string[]; // Predefined and user-created categories like 'travel', 'food', etc.

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

		// Social fields (for followed stories)
		authorName?: string; // Display name of story author (for followed stories)
		authorUsername?: string; // Username of story author (for followed stories)
		authorAvatarUrl?: string; // Avatar URL of story author (for followed stories)
		authorUserId?: string; // User ID of story author (for followed stories)
		readOnly?: boolean; // Whether story is read-only (for followed stories)
		viewerUserId?: string; // Current user viewing the story (for cache isolation)
		originalStoryId?: string; // Original story ID for followed stories (before prefixing)
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

	// ==================== USER FOLLOWING INTERFACES ====================

	/**
	 * User profile for public display and following
	 */
	interface UserProfile {
		id: string; // Firebase Auth UID
		username: string; // Unique username for @mentions and URLs
		displayName: string; // Display name
		bio?: string; // User bio/description
		avatarUrl?: string; // Profile picture URL
		location?: string; // User's location (optional)
		website?: string; // Personal website/social link

		// Social stats
		followerCount: number;
		followingCount: number;
		publicStoryCount: number;
		publicFeatureCount: number;

		// Metadata
		dateCreated: number;
		dateModified: number;
		lastActiveDate: number;

		// Sync fields
		lastSyncTimestamp?: number;
		firestoreId?: string;
	}

	/**
	 * Follow relationship between users
	 */
	interface UserFollow {
		id: string; // Unique follow relationship ID
		followerId: string; // User who is following
		followeeId: string; // User being followed
		status: 'pending' | 'accepted' | 'blocked'; // Follow request status
		dateCreated: number;
		dateAccepted?: number; // When follow request was accepted

		// Notification preferences for this follow
		notifyOnStories: boolean; // Notify when followee posts stories
		notifyOnFeatures: boolean; // Notify when followee bookmarks features
		notifyOnLists: boolean; // Notify when followee creates lists

		// Metadata
		dateModified: number;

		// Sync fields
		lastSyncTimestamp?: number;
		firestoreId?: string;
		deleted?: boolean;
	}

	/**
	 * Activity feed item for social features
	 */
	type ActivityType =
		| 'story_created'
		| 'story_updated'
		| 'feature_bookmarked'
		| 'list_created'
		| 'list_updated'
		| 'user_followed';

	interface ActivityFeedItem {
		id: string; // Unique activity ID
		userId: string; // User who performed the activity
		type: ActivityType;
		dateCreated: number;

		// Activity-specific data
		storyId?: string; // For story activities
		featureId?: string; // For feature activities
		listId?: string; // For list activities
		targetUserId?: string; // For follow activities

		// Denormalized data for efficient display
		userDisplayName: string;
		userUsername: string;
		userAvatarUrl?: string;
		itemTitle?: string; // Title of story/list/feature
		itemDescription?: string; // Brief description

		// Privacy and filtering
		isPublic: boolean; // Whether this activity should be public

		// Sync fields
		lastSyncTimestamp?: number;
		firestoreId?: string;
	}

	/**
	 * User search result for finding users to follow
	 */
	interface UserSearchResult {
		user: UserProfile;
		score: number; // Relevance score
		matchedFields: string[]; // Which fields matched
		followStatus?: 'none' | 'following' | 'follower' | 'mutual';
		mutualFollowers?: UserProfile[]; // Mutual followers (limited to first few)
		mutualFollowerCount?: number;
	}

	/**
	 * Notification for social interactions
	 */
	type NotificationType =
		| 'follow_request'
		| 'follow_accepted'
		| 'story_mention'
		| 'activity_like'
		| 'new_follower_activity';

	interface UserNotification {
		id: string;
		userId: string; // Recipient user ID
		type: NotificationType;
		read: boolean;
		dateCreated: number;

		// Notification-specific data
		fromUserId?: string; // User who triggered the notification
		itemId?: string; // Related story/feature/list ID
		message: string; // Notification message

		// Denormalized data
		fromUserDisplayName?: string;
		fromUserUsername?: string;
		fromUserAvatarUrl?: string;

		// Sync fields
		lastSyncTimestamp?: number;
		firestoreId?: string;
		deleted?: boolean;
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
