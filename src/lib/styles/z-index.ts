/**
 * Centralized z-index management
 *
 * This file defines all z-index values used throughout the application
 * to prevent conflicts and maintain a clear layering hierarchy.
 *
 * Layering hierarchy (from bottom to top):
 * 1. Base content (z-0 to z-10)
 * 2. Navigation and UI chrome (z-10 to z-30)
 * 3. Drawers and overlays (z-40 to z-60)
 * 4. Selected feature drawer (z-70) - priority drawer, above other drawers but below dialogs
 * 5. Navigation overlays (z-100)
 * 6. Modals and dialogs (z-300 to z-400)
 * 7. Tooltips and popovers (z-500 to z-600)
 * 8. Notifications (z-700 to z-800)
 * 9. Debug/dev tools (z-9000+)
 */

// Base content layers (0-10)
export const Z_INDEX = {
	// Base content and navigation (0-30)
	MAP: 0,
	BOTTOM_NAV: 10,
	SEARCH_BAR: 20,

	// Drawers and overlays (40-70)
	DRAWER_OVERLAY: 40,
	DRAWER_CONTENT: 50,

	// Selected Feature Drawer (priority drawer - above other drawers, below dialogs)
	SELECTED_FEATURE_DRAWER_OVERLAY: 70,
	SELECTED_FEATURE_DRAWER_CONTENT: 70,

	// Navigation overlays (100)
	DIALOG_TRIGGER: 100,
	MODAL_OVERLAY: 100,
	MODAL_CONTENT: 110,

	// Modals and dialogs (300-400)
	DIALOG_OVERLAY: 300,
	DIALOG_CONTENT: 310,
	STORY_FEATURE_DIALOG_OVERLAY: 320,
	STORY_FEATURE_DIALOG_CONTENT: 330,

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
