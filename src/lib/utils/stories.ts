import { featuresDB } from '$lib/stores/FeaturesDB.svelte';
import { getDisplayName } from '$lib/utils/language';

/**
 * Story utilities - centralized functions for story-related operations
 * This module consolidates common story functionality to avoid duplication
 */

/**
 * Feature status type with priority system
 * Priority: Todo (red) > Visited (green) > Bookmarked (blue) > Default (gray)
 */
export type FeatureStatus = 'gray' | 'blue' | 'red' | 'green';

/**
 * Feature status colors for UI styling
 */
export const FEATURE_STATUS_COLORS = {
	gray: {
		background: '#f3f4f6',
		border: '#d1d5db',
		color: '#6b7280',
		hoverBackground: '#e5e7eb',
		hoverBorder: '#9ca3af'
	},
	blue: {
		background: '#ebf8ff',
		border: '#3182ce',
		color: '#2c5282',
		hoverBackground: '#bee3f8',
		hoverBorder: '#2b6cb0'
	},
	red: {
		background: '#fef2f2',
		border: '#dc2626',
		color: '#991b1b',
		hoverBackground: '#fee2e2',
		hoverBorder: '#b91c1c'
	},
	green: {
		background: '#f0fdf4',
		border: '#16a34a',
		color: '#15803d',
		hoverBackground: '#dcfce7',
		hoverBorder: '#15803d'
	}
} as const;

/**
 * Default story categories with their display information
 */
export const DEFAULT_STORY_CATEGORIES = [
	{
		id: 'travel',
		name: 'Travel',
		color: '#3B82F6',
		icon: '✈️',
		description: 'Travel adventures and destinations'
	},
	{
		id: 'food',
		name: 'Food & Dining',
		color: '#EF4444',
		icon: '🍕',
		description: 'Culinary experiences and restaurants'
	},
	{
		id: 'nature',
		name: 'Nature & Outdoors',
		color: '#10B981',
		icon: '🌲',
		description: 'Hiking, parks, and outdoor activities'
	},
	{
		id: 'culture',
		name: 'Culture & History',
		color: '#8B5CF6',
		icon: '🏛️',
		description: 'Museums, landmarks, and cultural sites'
	},
	{
		id: 'events',
		name: 'Events & Entertainment',
		color: '#F59E0B',
		icon: '🎭',
		description: 'Concerts, festivals, and entertainment'
	},
	{
		id: 'personal',
		name: 'Personal',
		color: '#6B7280',
		icon: '📔',
		description: 'Personal experiences and memories'
	}
] as const;

/**
 * Get category color by ID, with fallback to gray
 */
export function getCategoryColor(categoryId: string): string {
	const category = DEFAULT_STORY_CATEGORIES.find((cat) => cat.id === categoryId);
	return category?.color || '#6B7280';
}

/**
 * Determine feature color status based on its bookmark/todo/visited state
 * Priority: Todo (red) > Visited (green) > Bookmarked (blue) > Default (gray)
 */
export async function getFeatureStatus(featureId: string): Promise<FeatureStatus> {
	try {
		const storedFeature = await featuresDB.getFeatureById(featureId);

		if (!storedFeature || !storedFeature.bookmarked) {
			return 'gray'; // Default - not saved or not bookmarked
		}

		// Priority 1: Todo (red) - highest priority
		if (storedFeature.todo) {
			return 'red'; // Todo always takes precedence
		}

		// Priority 2: Visited (green) - second priority
		if (storedFeature.visitedDates && storedFeature.visitedDates.length > 0) {
			return 'green'; // Visited
		}

		// Priority 3: Bookmarked (blue) - lowest priority
		return 'blue'; // Bookmarked but not todo or visited
	} catch (error) {
		console.error('Error getting feature status:', error);
		return 'gray'; // Fallback to default on error
	}
}

/**
 * Update feature statuses for a batch of story content
 * Returns a Map of featureId -> status
 */
export async function updateFeatureStatuses(
	content: StoryContentNode[]
): Promise<Map<string, FeatureStatus>> {
	if (!content || content.length === 0) {
		return new Map();
	}

	const statusMap = new Map<string, FeatureStatus>();

	// Process all feature nodes
	const featureNodes = content.filter(
		(node): node is StoryContentNode & { type: 'feature' } => node.type === 'feature'
	);

	// Get statuses for all features in parallel
	await Promise.all(
		featureNodes.map(async (node) => {
			const status = await getFeatureStatus(node.featureId);
			statusMap.set(node.featureId, status);
		})
	);

	return statusMap;
}

/**
 * Get display name for a feature (StoredFeature or SearchResult)
 * Uses the language setting from AppState via the language utility, falling back appropriately
 */
export function getFeatureDisplayName(feature: StoredFeature | SearchResult): string {
	if ('names' in feature) {
		// It's either type, try to get the best name using the language utility
		const names = 'names' in feature ? feature.names : {};
		return getDisplayName(names) || 'Unknown Feature';
	}
	return 'Unknown Feature';
}

/**
 * Format timestamp to human-readable date
 */
export function formatDate(
	timestamp: number,
	options?: {
		short?: boolean;
		includeTime?: boolean;
	}
): string {
	const date = new Date(timestamp);
	const { short = false, includeTime = false } = options || {};

	if (short) {
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays} days ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
		if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
		return `${Math.floor(diffDays / 365)} years ago`;
	}

	const formatOptions: Intl.DateTimeFormatOptions = {
		year: 'numeric',
		month: includeTime ? 'long' : 'short',
		day: 'numeric'
	};

	if (includeTime) {
		formatOptions.hour = '2-digit';
		formatOptions.minute = '2-digit';
	}

	return date.toLocaleDateString(undefined, formatOptions);
}

/**
 * Extract preview text from story content
 */
export function getPreviewText(content: StoryContentNode[], maxLength = 120): string {
	let text = '';

	for (const node of content) {
		if (node.type === 'text') {
			text += node.text + ' ';
		} else if (node.type === 'feature') {
			text += `[${node.customText || node.displayText}] `;
		}

		if (text.length > maxLength) {
			break;
		}
	}

	return text.trim().length > maxLength ? text.trim().substring(0, maxLength) + '...' : text.trim();
}

/**
 * Count features in story content
 */
export function countFeatures(content: StoryContentNode[]): number {
	return content.filter((node) => node.type === 'feature').length;
}

/**
 * Generate searchable text from story properties
 */
export function generateSearchText(story: Partial<Story>): string {
	const searchParts: string[] = [];

	// Add title and description
	if (story.title) {
		searchParts.push(story.title.toLowerCase());
	}
	if (story.description) {
		searchParts.push(story.description.toLowerCase());
	}

	// Add category names
	if (story.categories) {
		story.categories.forEach((categoryId) => {
			searchParts.push(categoryId.toLowerCase());
		});
	}

	// Add text content from story nodes
	if (story.content) {
		story.content.forEach((node) => {
			if (node.type === 'text') {
				searchParts.push(node.text.toLowerCase());
			} else if (node.type === 'feature') {
				searchParts.push(node.displayText.toLowerCase());
				if (node.customText) {
					searchParts.push(node.customText.toLowerCase());
				}
			}
		});
	}

	return searchParts.join(' ');
}

/**
 * Check if a category is one of the default categories
 */
export function isDefaultCategory(categoryId: string): boolean {
	return DEFAULT_STORY_CATEGORIES.some((cat) => cat.id === categoryId);
}

/**
 * Create a basic SearchResult from a MapGeoJSONFeature
 */
export function createSearchResultFromMapFeature(mapFeature: any): SearchResult {
	const basicFeature: SearchResult = {
		id: String(mapFeature.id),
		names: mapFeature.properties || {},
		class: mapFeature.properties?.class || '',
		subclass: mapFeature.properties?.subclass,
		category: mapFeature.properties?.category,
		lng: 0, // Will be populated from geometry if needed
		lat: 0,
		database: mapFeature.source || '',
		layer: mapFeature.sourceLayer || '',
		zoom: 14,
		tileX: 0,
		tileY: 0
	};

	// Extract coordinates if it's a point
	if (mapFeature.geometry && mapFeature.geometry.type === 'Point') {
		const [lng, lat] = mapFeature.geometry.coordinates;
		basicFeature.lng = lng;
		basicFeature.lat = lat;
	}

	return basicFeature;
}

/**
 * Render story content as HTML for contenteditable elements
 */
export function renderContentToHTML(
	contentNodes: StoryContentNode[],
	featureStatuses: Map<string, FeatureStatus> = new Map()
): string {
	return contentNodes
		.map((node, index) => {
			if (node.type === 'text') {
				return node.text.replace(/\n/g, '<br>');
			} else if (node.type === 'feature') {
				const displayText = node.customText || node.displayText;
				const status = featureStatuses.get(node.featureId) || 'gray';
				// Make feature spans non-editable to prevent cursor getting stuck
				return `<span class="story-feature story-feature-${status}" data-feature-id="${node.featureId}" data-index="${index}" contenteditable="false">${displayText}</span>`;
			}
			return '';
		})
		.join('');
}

/**
 * Parse HTML content back to StoryContentNode array
 * Used when converting contenteditable HTML back to structured content
 */
export function parseHTMLToContent(
	html: string,
	originalContent: StoryContentNode[]
): StoryContentNode[] {
	const newContent: StoryContentNode[] = [];

	// Parse HTML back to content nodes
	const tempDiv = document.createElement('div');
	tempDiv.innerHTML = html;

	let textAccumulator = '';

	function processNode(node: Node) {
		if (node.nodeType === Node.TEXT_NODE) {
			textAccumulator += node.textContent || '';
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			const element = node as HTMLElement;

			if (element.classList.contains('story-feature')) {
				// Save accumulated text before feature
				if (textAccumulator) {
					newContent.push({ type: 'text', text: textAccumulator });
					textAccumulator = '';
				}

				// Find the original feature by ID
				const featureId = element.getAttribute('data-feature-id');
				const originalFeature = originalContent.find(
					(node) => node.type === 'feature' && node.featureId === featureId
				);

				if (originalFeature && originalFeature.type === 'feature') {
					newContent.push({
						...originalFeature,
						customText: element.textContent || originalFeature.displayText
					});
				}
			} else if (element.tagName === 'BR') {
				textAccumulator += '\n';
			} else {
				// Process child nodes
				for (const child of Array.from(element.childNodes)) {
					processNode(child);
				}
			}
		}
	}

	for (const child of Array.from(tempDiv.childNodes)) {
		processNode(child);
	}

	// Save remaining text
	if (textAccumulator) {
		newContent.push({ type: 'text', text: textAccumulator });
	}

	return newContent;
}
