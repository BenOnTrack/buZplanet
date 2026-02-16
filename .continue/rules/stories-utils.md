---
globs: '**/*stories*'
alwaysApply: true
---

Always use the centralized story utilities from '$lib/utils/stories.ts' instead of duplicating common functions. Import and use functions like getFeatureStatus, updateFeatureStatuses, formatDate, getPreviewText, countFeatures, getCategoryColor, getFeatureDisplayName, generateSearchText, etc. Never duplicate these functions in individual components.
