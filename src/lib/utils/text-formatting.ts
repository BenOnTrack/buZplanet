/**
 * Text formatting utilities for converting feature properties
 */

/**
 * Converts snake_case strings to Title Case
 * Examples:
 * - "food_and_drink" → "Food And Drink"
 * - "public_transport" → "Public Transport"
 * - "residential_area" → "Residential Area"
 * - "restaurant" → "Restaurant"
 *
 * @param text - The snake_case text to convert
 * @returns The converted Title Case text
 */
export function formatFeatureProperty(text: string | null | undefined): string {
	if (!text || typeof text !== 'string') {
		return '';
	}

	return text
		.split('_') // Split on underscores
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize first letter of each word
		.join(' '); // Join with spaces
}

/**
 * Formats multiple feature properties for display
 * Useful for batch converting class, subclass, category, etc.
 *
 * @param properties - Object with string properties to format
 * @returns Object with formatted properties
 */
export function formatFeatureProperties(properties: Record<string, any>): Record<string, string> {
	const formatted: Record<string, string> = {};

	for (const [key, value] of Object.entries(properties)) {
		if (typeof value === 'string') {
			formatted[key] = formatFeatureProperty(value);
		}
	}

	return formatted;
}
