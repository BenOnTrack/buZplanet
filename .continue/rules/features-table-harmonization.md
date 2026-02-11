---
globs: '**/drawers/*Drawer.svelte, **/table/FeaturesTable.svelte'
---

Use the centralized FeaturesTable component for displaying both SearchResult and StoredFeature data. The table automatically matches SearchResults with StoredFeatures by ID, showing saved feature types (bookmarked, todo, visited) as icons and lists as colored dots. SearchResultsDrawer and FeaturesDrawer should both use FeaturesTable with appropriate showListsColumn and showTypesColumn props.
