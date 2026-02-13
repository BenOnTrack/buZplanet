import { appState } from '$lib/stores/AppState.svelte';

/**
 * Get the appropriate name property key based on the current language setting
 */
export function getCurrentLanguageProperty(): LanguageCode {
	return appState.language;
}

/**
 * Get the display name for a feature based on the current language setting
 * Falls back to other available names if the preferred language is not available
 * @param names - FeatureNames object containing various name properties
 * @returns The best available name for display
 */
export function getDisplayName(names: FeatureNames): string {
	if (!names || typeof names !== 'object') {
		return '';
	}

	const currentLanguage = getCurrentLanguageProperty();

	// Try the current language setting first
	if (names[currentLanguage]) {
		return names[currentLanguage];
	}

	// Fallback hierarchy: local name -> English -> first available name
	const fallbackOrder: LanguageCode[] = ['name', 'name:en', 'name:fr', 'name:de', 'name:es'];

	for (const langCode of fallbackOrder) {
		if (names[langCode]) {
			return names[langCode];
		}
	}

	// If none of the preferred names are available, use the first available name
	const availableNames = Object.values(names).filter(Boolean);
	return availableNames[0] || '';
}
