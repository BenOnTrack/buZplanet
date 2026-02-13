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
	// Navigation and main UI (0-100)
	MAP: 0,
	BOTTOM_NAV: 10,
	SEARCH_BAR: 20,

	// Modals and dialogs (100-200)
	DIALOG_TRIGGER: 30,
	DIALOG_OVERLAY: 50,
	DIALOG_CONTENT: 50,
	MODAL_OVERLAY: 200,
	MODAL_CONTENT: 210,

	// Drawers and overlays (40-95)
	DRAWER_OVERLAY: 40,
	DRAWER_CONTENT: 50,

	// Selected Feature Drawer (priority drawer - always on top)
	SELECTED_FEATURE_DRAWER_OVERLAY: 90,
	SELECTED_FEATURE_DRAWER_CONTENT: 95,

	// Tooltips and popovers (500-600)
	TOOLTIP: 500,
	POPOVER: 510,
	DROPDOWN: 520,

	// Notifications and alerts (700-800)
	LOADING: 700,
	NOTIFICATION: 700,
	SW_UPDATE_NOTIFICATION: 750, // Service worker update notifications
	TOAST: 710,
	ALERT: 720,

	// Debug and development tools (9000+)
	DEBUG_PANEL: 9000,
	DEV_TOOLS: 9999
} as const;
