/**
 * Centralized z-index management
 *
 * This file defines all z-index values used throughout the application
 * to prevent conflicts and maintain a clear layering hierarchy.
 *
 * Layering hierarchy (from bottom to top):
 * 1. Base content (z-0 to z-10)
 * 2. Drawers and overlays (z-40 to z-95)
 * 3. Selected feature drawer (z-90+) - priority drawer
 * 4. Navigation and UI chrome (z-100 to z-200)
 * 5. Modals and dialogs (z-300 to z-400)
 * 6. Tooltips and popovers (z-500 to z-600)
 * 7. Debug/dev tools (z-9000+)
 */

// Base content layers (0-10)
export const Z_INDEX = {
	// Base application content
	BASE: 0,
	MAP_LAYERS: 1,
	MAP_CONTROLS: 5,

	// Drawers and overlays (40-80)
	DRAWER_OVERLAY: 40,
	DRAWER_CONTENT: 50,
	SELECTED_FEATURE_DRAWER_OVERLAY: 90,
	SELECTED_FEATURE_DRAWER_CONTENT: 95,

	// Navigation and main UI (100-200)
	BOTTOM_NAV: 100,
	SEARCH_BAR: 200,
	TOP_BAR: 150,

	// Modals and dialogs (300-400)
	MODAL_OVERLAY: 300,
	MODAL_CONTENT: 310,
	DIALOG_OVERLAY: 320,
	DIALOG_CONTENT: 330,

	// Tooltips and popovers (500-600)
	TOOLTIP: 500,
	POPOVER: 510,
	DROPDOWN: 520,

	// Notifications and alerts (700-800)
	NOTIFICATION: 700,
	TOAST: 710,
	ALERT: 720,

	// Debug and development tools (9000+)
	DEBUG_PANEL: 9000,
	DEV_TOOLS: 9999
} as const;

// Type for autocomplete and type safety
export type ZIndexKey = keyof typeof Z_INDEX;

/**
 * Helper function to get z-index value with optional offset
 * @param key - The z-index key
 * @param offset - Optional offset to add to the base value
 * @returns The calculated z-index value
 */
export function getZIndex(key: ZIndexKey, offset: number = 0): number {
	return Z_INDEX[key] + offset;
}

/**
 * Helper function to create CSS z-index class string
 * @param key - The z-index key
 * @param offset - Optional offset to add to the base value
 * @returns CSS class string for Tailwind arbitrary values
 */
export function zIndexClass(key: ZIndexKey, offset: number = 0): string {
	const value = Z_INDEX[key] + offset;
	return `z-[${value}]`;
}

// Export individual values for convenience
export const {
	BASE,
	MAP_LAYERS,
	MAP_CONTROLS,
	DRAWER_OVERLAY,
	DRAWER_CONTENT,
	SELECTED_FEATURE_DRAWER_OVERLAY,
	SELECTED_FEATURE_DRAWER_CONTENT,
	BOTTOM_NAV,
	SEARCH_BAR,
	TOP_BAR,
	MODAL_OVERLAY,
	MODAL_CONTENT,
	DIALOG_OVERLAY,
	DIALOG_CONTENT,
	TOOLTIP,
	POPOVER,
	DROPDOWN,
	NOTIFICATION,
	TOAST,
	ALERT,
	DEBUG_PANEL,
	DEV_TOOLS
} = Z_INDEX;
