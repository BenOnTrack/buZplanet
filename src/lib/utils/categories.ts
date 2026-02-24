/**
 * Category utility functions for working with the class-subclass-category hierarchy
 */

import { _CATEGORY } from '$lib/assets/class_subclass_category';

/**
 * Parse a full category string into its components
 * @param category - Full category string like "attraction-cultural-museum"
 * @returns Object with class, subclass, and category components
 */
export function parseCategoryString(category: string) {
	const parts = category.split('-');
	return {
		class: parts[0],
		subclass: parts[1],
		category: parts[2],
		full: category
	};
}

/**
 * Get display name for a category (just the final part, formatted)
 * @param category - Full category string
 * @returns Formatted display name
 */
export function getCategoryDisplayName(category: string): string {
	const parts = category.split('-');
	const finalPart = parts[parts.length - 1];
	return finalPart.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Get the class name from a full category string
 * @param category - Full category string
 * @returns Class name
 */
export function getCategoryClass(category: string): string {
	return category.split('-')[0];
}

/**
 * Get the subclass name from a full category string
 * @param category - Full category string
 * @returns Subclass name
 */
export function getCategorySubclass(category: string): string {
	return category.split('-')[1];
}

/**
 * Get the category name from a full category string
 * @param category - Full category string
 * @returns Category name (final part)
 */
export function getCategoryName(category: string): string {
	return category.split('-')[2];
}

/**
 * Group categories by their class
 * @param categories - Array of full category strings
 * @returns Object with class names as keys and category arrays as values
 */
export function groupCategoriesByClass(categories: string[] = _CATEGORY) {
	const groups: Record<string, string[]> = {};

	categories.forEach((category) => {
		const className = getCategoryClass(category);
		if (!groups[className]) {
			groups[className] = [];
		}
		groups[className].push(category);
	});

	return groups;
}

/**
 * Group categories by their subclass
 * @param categories - Array of full category strings
 * @returns Object with subclass names as keys and category arrays as values
 */
export function groupCategoriesBySubclass(categories: string[] = _CATEGORY) {
	const groups: Record<string, string[]> = {};

	categories.forEach((category) => {
		const subclass = getCategorySubclass(category);
		if (!groups[subclass]) {
			groups[subclass] = [];
		}
		groups[subclass].push(category);
	});

	return groups;
}

/**
 * Filter categories by class
 * @param categories - Array of full category strings
 * @param className - Class to filter by
 * @returns Filtered categories
 */
export function filterCategoriesByClass(categories: string[], className: string): string[] {
	return categories.filter((category) => getCategoryClass(category) === className);
}

/**
 * Filter categories by subclass
 * @param categories - Array of full category strings
 * @param subclassName - Subclass to filter by
 * @returns Filtered categories
 */
export function filterCategoriesBySubclass(categories: string[], subclassName: string): string[] {
	return categories.filter((category) => getCategorySubclass(category) === subclassName);
}

/**
 * Get unique classes from a list of categories
 * @param categories - Array of full category strings
 * @returns Array of unique class names
 */
export function getUniqueClasses(categories: string[]): string[] {
	return [...new Set(categories.map(getCategoryClass))];
}

/**
 * Get unique subclasses from a list of categories
 * @param categories - Array of full category strings
 * @returns Array of unique subclass names
 */
export function getUniqueSubclasses(categories: string[]): string[] {
	return [...new Set(categories.map(getCategorySubclass))];
}

/**
 * Get unique category names from a list of categories
 * @param categories - Array of full category strings
 * @returns Array of unique category names (final parts)
 */
export function getUniqueCategoryNames(categories: string[]): string[] {
	return [...new Set(categories.map(getCategoryName))];
}

/**
 * Build MapLibre GL filter expressions from selected categories
 * @param selectedCategories - Array of selected full category strings
 * @returns MapLibre GL filter expression
 */
export function buildMapFilter(selectedCategories: string[]) {
	if (selectedCategories.length === 0) {
		// Return a filter that always evaluates to false - guaranteed to show nothing
		return ['==', ['literal', true], ['literal', false]];
	}

	const classes = getUniqueClasses(selectedCategories);
	const subclasses = getUniqueSubclasses(selectedCategories);
	const categoryNames = getUniqueCategoryNames(selectedCategories);

	return [
		'all',
		['in', ['get', 'class'], ['literal', classes]],
		['in', ['get', 'subclass'], ['literal', subclasses]],
		['in', ['get', 'category'], ['literal', categoryNames]]
	];
}

/**
 * Check if a feature matches the selected categories
 * @param feature - Feature with class, subclass, category properties
 * @param selectedCategories - Array of selected full category strings
 * @returns Whether the feature matches
 */
export function featureMatchesCategories(
	feature: { class?: string; subclass?: string; category?: string },
	selectedCategories: string[]
): boolean {
	if (!feature.class || !feature.subclass || !feature.category) {
		return false;
	}

	const fullCategory = `${feature.class}-${feature.subclass}-${feature.category}`;
	return selectedCategories.includes(fullCategory);
}

/**
 * Search categories by text
 * @param searchText - Text to search for
 * @param categories - Array of categories to search in (defaults to all)
 * @returns Array of matching categories
 */
export function searchCategories(searchText: string, categories: string[] = _CATEGORY): string[] {
	if (!searchText.trim()) {
		return categories;
	}

	const searchLower = searchText.toLowerCase();
	return categories.filter((category) => {
		const displayName = getCategoryDisplayName(category).toLowerCase();
		const className = getCategoryClass(category).toLowerCase();
		const subclassName = getCategorySubclass(category).toLowerCase();
		const categoryName = getCategoryName(category).toLowerCase();

		return (
			displayName.includes(searchLower) ||
			className.includes(searchLower) ||
			subclassName.includes(searchLower) ||
			categoryName.includes(searchLower) ||
			category.includes(searchLower)
		);
	});
}
