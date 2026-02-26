<script lang="ts">
	import { onMount } from 'svelte';
	import { Drawer } from 'vaul-svelte';
	import { clsx } from 'clsx';
	import { Tabs } from 'bits-ui';
	import { formatFeatureProperty } from '$lib/utils/text-formatting.js';
	import { featuresDB } from '$lib/stores/FeaturesDB.svelte';
	import { appState } from '$lib/stores/AppState.svelte';
	import BookmarkDialog from '$lib/components/dialogs/BookmarkDialog.svelte';
	import OpeningHoursDisplay from '$lib/components/ui/OpeningHoursDisplay.svelte';
	import { Z_INDEX } from '$lib/styles/z-index';
	import type { MapGeoJSONFeature } from 'svelte-maplibre';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';

	let {
		open = $bindable(false),
		feature = null
	}: {
		open?: boolean;
		feature?: MapGeoJSONFeature | null;
	} = $props();

	let snapPoints = $state<[number, number, number]>([0.25, 0.5, 0.75]);
	let activeSnapPoint = $state<string | number>(snapPoints[0]); // Will be updated to actual first snappoint
	let activeTab = $state('info');

	// Initialize window height, snappoints, and feature status on mount
	onMount(() => {
		// Initial load
		if (feature) {
			updateFeatureStatusForFeature(feature);
		}
	});

	// Derived values for display
	let hasFeature = $derived.by(() => feature !== null && feature !== undefined);

	// State for tracking feature status in database
	let featureStatus = $state<{
		bookmarked: boolean;
		listIds: string[];
		visitedDates: number[];
		todo: boolean;
		loading: boolean;
	}>({ bookmarked: false, listIds: [], visitedDates: [], todo: false, loading: false });

	// Dialog state
	let bookmarkDialogOpen = $state(false);
	let visitHistoryExpanded = $state(false);

	// Derived current feature ID
	let featureId = $derived(feature?.id ? String(feature.id) : undefined);

	// Simple effect to watch feature changes (this is appropriate for side effects)
	// Only run when drawer is actually open to avoid interference with close transition
	$effect(() => {
		// Only react to feature changes when drawer is open
		// This prevents effects from running during drawer close transition
		if (!open) {
			// When drawer closes, just reset status without async operations
			if (!feature) {
				console.log('🔍 SelectedFeatureDrawer: Drawer closed, resetting status');
				resetFeatureStatus();
			}
			return;
		}

		// React to feature changes only when drawer is open
		if (feature && featureId) {
			console.log('🔍 SelectedFeatureDrawer: Feature changed:', featureId);
			updateFeatureStatusForFeature(feature);
		} else if (!feature) {
			console.log('🔍 SelectedFeatureDrawer: Feature cleared');
			resetFeatureStatus();
		}
	});

	// Reset feature status to defaults
	function resetFeatureStatus() {
		featureStatus.bookmarked = false;
		featureStatus.listIds = [];
		featureStatus.visitedDates = [];
		featureStatus.todo = false;
		featureStatus.loading = false;
		visitHistoryExpanded = false;
	}

	// Update feature status from database (renamed for clarity)
	async function updateFeatureStatusForFeature(targetFeature: MapGeoJSONFeature) {
		if (!targetFeature) {
			resetFeatureStatus();
			return;
		}

		try {
			featureStatus.loading = true;

			// Ensure database is initialized
			if (!featuresDB.initialized) {
				await featuresDB.ensureInitialized();
			}

			// Get feature ID the same way as FeaturesDB
			const featureId = getFeatureId(targetFeature);
			const storedFeature = await featuresDB.getFeatureById(featureId);

			if (storedFeature) {
				featureStatus.bookmarked = storedFeature.bookmarked;
				featureStatus.listIds = storedFeature.listIds || [];
				featureStatus.visitedDates = storedFeature.visitedDates || [];
				featureStatus.todo = storedFeature.todo;
			} else {
				resetFeatureStatus();
			}
		} catch (error) {
			console.error('Failed to update feature status:', error);
			// Reset to safe defaults on error
			resetFeatureStatus();
		} finally {
			featureStatus.loading = false;
		}
	}

	// Get feature ID (features always have unique IDs)
	function getFeatureId(feature: MapGeoJSONFeature): string {
		if (feature.id !== undefined && feature.id !== null) {
			return String(feature.id);
		}

		// This should not happen according to your note, but keeping as fallback
		console.warn('Feature missing ID, using fallback:', feature);
		return `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	// Helper function to format individual visit date and time
	function formatVisitDateTime(timestamp: number): string {
		const date = new Date(timestamp);
		return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
	}

	// Helper function to get sorted visit dates (most recent first)
	function getSortedVisits(timestamps: number[]): number[] {
		return [...timestamps].sort((a, b) => b - a);
	}

	// Helper function to format phone number for display
	function formatPhoneNumber(phone: string): string {
		// Basic formatting - could be enhanced based on region
		return phone.trim();
	}

	// Helper function to check if URL is valid and format it
	function formatWebsiteUrl(url: string): string {
		if (!url) return '';
		const trimmed = url.trim();
		// Add protocol if missing
		if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
			return `https://${trimmed}`;
		}
		return trimmed;
	}

	// Helper function to format wifi access info
	function formatWifiStatus(internetAccess: string): { hasWifi: boolean; description: string } {
		if (!internetAccess) return { hasWifi: false, description: 'Unknown' };

		const access = internetAccess.toLowerCase().trim();
		if (access === 'wlan' || access === 'wifi' || access === 'yes') {
			return { hasWifi: true, description: 'WiFi available' };
		} else if (access === 'no') {
			return { hasWifi: false, description: 'No WiFi' };
		} else if (access === 'customers' || access === 'customers_only') {
			return { hasWifi: true, description: 'WiFi for customers' };
		} else {
			return { hasWifi: false, description: `Internet: ${access}` };
		}
	}

	// Helper function to get display name with fallbacks for main title based on language preference
	function getDisplayName(feature: MapGeoJSONFeature | null): string {
		if (!feature || !feature.properties) return 'Selected Feature';

		const props = feature.properties;
		const currentLanguage = appState.language;

		// Try current language setting first (don't format, keep as-is)
		if (props[currentLanguage]) return props[currentLanguage];

		// Fallback to name (don't format, keep as-is)
		if (props.name) return props.name;

		// Fallback to category (format this one since it's likely snake_case)
		if (props.category) return formatFeatureProperty(props.category);

		// Final fallback
		return 'Selected Feature';
	}

	// Helper function to get individual feature name (only if name exists)
	function getFeatureName(feature: MapGeoJSONFeature | null): string | null {
		if (!feature || !feature.properties) return null;

		const props = feature.properties;

		// Return name if it exists, otherwise null
		return props.name || null;
	}

	// Helper function to get classification data with formatting
	function getClassificationData(feature: MapGeoJSONFeature | null): {
		class?: string;
		subclass?: string;
		category?: string;
	} {
		if (!feature || !feature.properties) return {};

		const props = feature.properties;
		return {
			class: props.class ? formatFeatureProperty(props.class) : undefined,
			subclass: props.subclass ? formatFeatureProperty(props.subclass) : undefined,
			category: props.category ? formatFeatureProperty(props.category) : undefined
		};
	}

	// Check if feature has any classification data
	function hasClassificationData(feature: MapGeoJSONFeature | null): boolean {
		const data = getClassificationData(feature);
		return !!(data.class || data.subclass || data.category);
	}

	// Action button handlers
	function handleBookmark(feature: MapGeoJSONFeature | null) {
		if (!feature) return;
		// Open the bookmark dialog instead of toggling directly
		bookmarkDialogOpen = true;
	}

	// Handle bookmark update from dialog
	function handleBookmarkUpdated(bookmarked: boolean, listIds: string[]) {
		featureStatus.bookmarked = bookmarked;
		featureStatus.listIds = listIds;

		// If feature is unbookmarked, clear todo status
		if (!bookmarked) {
			featureStatus.todo = false;
		}

		console.log(
			`Feature bookmark status updated: ${bookmarked ? 'bookmarked' : 'unbookmarked'} in ${listIds.length} lists`
		);
	}

	async function handleTodo(feature: MapGeoJSONFeature | null) {
		if (!feature) return;
		// Only allow todo if feature is bookmarked
		if (!featureStatus.bookmarked) {
			console.warn('Cannot set todo status on unbookmarked feature');
			return;
		}

		// Prevent double-clicks
		if (featureStatus.loading) return;

		try {
			featureStatus.loading = true;

			if (!featuresDB.initialized) {
				await featuresDB.ensureInitialized();
			}

			const featureId = getFeatureId(feature);
			let storedFeature = await featuresDB.getFeatureById(featureId);

			if (storedFeature) {
				// Toggle todo status
				storedFeature.todo = !storedFeature.todo;
				storedFeature = await featuresDB.updateFeature(storedFeature);
			} else {
				// Create new feature with todo status
				storedFeature = await featuresDB.storeFeature(feature, 'todo');
			}

			featureStatus.todo = storedFeature.todo;
			console.log(
				`Feature ${storedFeature.todo ? 'added to' : 'removed from'} todo:`,
				storedFeature
			);
		} catch (error) {
			console.error('Failed to toggle todo:', error);
		} finally {
			featureStatus.loading = false;
		}
	}

	async function handleVisited(feature: MapGeoJSONFeature | null) {
		if (!feature) return;
		// Only allow visits if feature is bookmarked
		if (!featureStatus.bookmarked) {
			console.warn('Cannot add visit to unbookmarked feature');
			return;
		}

		// Prevent double-clicks
		if (featureStatus.loading) return;

		try {
			featureStatus.loading = true;

			if (!featuresDB.initialized) {
				await featuresDB.ensureInitialized();
			}

			// Always add a new visit (no toggling)
			const storedFeature = await featuresDB.addVisit(feature);
			featureStatus.visitedDates = storedFeature.visitedDates || [];

			// Update todo status - it should be false after visiting
			featureStatus.todo = storedFeature.todo; // Should be false now

			const visitCount = storedFeature.visitedDates.length;
			console.log(
				`Feature visited! Total visits: ${visitCount}, Todo status: ${storedFeature.todo}`,
				storedFeature
			);
		} catch (error) {
			console.error('Failed to add visit:', error);
		} finally {
			featureStatus.loading = false;
		}
	}

	async function handleRemoveVisit(feature: MapGeoJSONFeature | null, visitTimestamp: number) {
		if (!feature) return;

		// Prevent double-clicks
		if (featureStatus.loading) return;

		try {
			featureStatus.loading = true;

			if (!featuresDB.initialized) {
				await featuresDB.ensureInitialized();
			}

			const featureId = getFeatureId(feature);
			let storedFeature = await featuresDB.getFeatureById(featureId);

			if (storedFeature) {
				// Remove the specific visit timestamp
				storedFeature.visitedDates = (storedFeature.visitedDates || []).filter(
					(ts) => ts !== visitTimestamp
				);
				storedFeature = await featuresDB.updateFeature(storedFeature);
				featureStatus.visitedDates = storedFeature.visitedDates || [];

				console.log(
					`Visit removed. Remaining visits: ${storedFeature.visitedDates.length}`,
					storedFeature
				);
			}
		} catch (error) {
			console.error('Failed to remove visit:', error);
		} finally {
			featureStatus.loading = false;
		}
	}

	function handleUpdate(feature: MapGeoJSONFeature | null) {
		if (!feature) return;

		// Extract OSM type and ID from feature ID
		const featureId = getFeatureId(feature);

		// Skip if it's a fallback ID (not from OSM)
		if (featureId.startsWith('fallback-')) {
			console.warn('Cannot update feature with fallback ID:', featureId);
			return;
		}

		// Get the first digit to determine type
		const firstDigit = featureId.charAt(0);
		const osmId = featureId.substring(1);

		// Map first digit to OSM type
		let osmType: string;
		switch (firstDigit) {
			case '1':
				osmType = 'node';
				break;
			case '2':
				osmType = 'way';
				break;
			case '3':
				osmType = 'relation';
				break;
			default:
				console.warn('Unknown OSM type for feature ID:', featureId);
				return;
		}

		// Construct OpenStreetMap URL and open in new tab
		const osmUrl = `https://www.openstreetmap.org/${osmType}/${osmId}`;
		console.log('Opening OSM URL:', osmUrl);

		// Open in new tab
		window.open(osmUrl, '_blank', 'noopener,noreferrer');
	}

	function handleLocation(feature: MapGeoJSONFeature | null) {
		if (!feature) return;

		// Get coordinates from feature geometry
		let coordinates: [number, number] | null = null;

		if (feature.geometry.type === 'Point') {
			coordinates = feature.geometry.coordinates as [number, number];
		} else if (feature.geometry.type === 'LineString') {
			// Calculate centroid of line string
			const coords = feature.geometry.coordinates as [number, number][];
			coordinates = calculateLineStringCentroid(coords);
		} else if (feature.geometry.type === 'Polygon') {
			// Calculate centroid of polygon
			const coords = feature.geometry.coordinates[0] as [number, number][]; // Use outer ring
			coordinates = calculatePolygonCentroid(coords);
		} else if (feature.geometry.type === 'MultiPolygon') {
			// Calculate centroid of the first polygon in the multipolygon
			const coords = feature.geometry.coordinates[0][0] as [number, number][]; // First polygon, outer ring
			coordinates = calculatePolygonCentroid(coords);
		} else if (feature.geometry.type === 'MultiLineString') {
			// Calculate centroid of the first linestring in the multilinestring
			const coords = feature.geometry.coordinates[0] as [number, number][];
			coordinates = calculateLineStringCentroid(coords);
		}

		if (coordinates) {
			const [lng, lat] = coordinates;
			console.log('Opening Google Maps for location:', { lat, lng });

			// Construct Google Maps URL
			const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}&z=16`;

			// Open in new tab
			window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
		} else {
			console.warn(
				'Could not determine coordinates for feature geometry type:',
				feature.geometry.type
			);
		}
	}

	// Helper function to calculate centroid of a LineString
	function calculateLineStringCentroid(coordinates: [number, number][]): [number, number] {
		if (coordinates.length === 0) return [0, 0];
		if (coordinates.length === 1) return coordinates[0];

		// Find the middle point along the line
		const middleIndex = Math.floor(coordinates.length / 2);
		return coordinates[middleIndex];
	}

	// Helper function to calculate centroid of a polygon using the centroid formula
	function calculatePolygonCentroid(coordinates: [number, number][]): [number, number] {
		if (coordinates.length === 0) return [0, 0];
		if (coordinates.length === 1) return coordinates[0];

		// Simple arithmetic mean of all vertices (works well for most cases)
		let sumLng = 0;
		let sumLat = 0;
		let count = 0;

		for (const [lng, lat] of coordinates) {
			if (typeof lng === 'number' && typeof lat === 'number') {
				sumLng += lng;
				sumLat += lat;
				count++;
			}
		}

		if (count === 0) return [0, 0];

		return [sumLng / count, sumLat / count];
	}
</script>

<!-- Selected Feature Drawer -->
<Drawer.Root bind:open {snapPoints} bind:activeSnapPoint modal={false}>
	<Drawer.Overlay
		class="fixed inset-0 bg-black/40"
		style="z-index: {Z_INDEX.SELECTED_FEATURE_DRAWER_OVERLAY}"
	/>
	<Drawer.Portal>
		<Drawer.Content
			class="border-b-none rounded-t-10px fixed right-0 bottom-0 left-0 -mx-px flex h-full max-h-[97%] flex-col border border-gray-200 bg-white"
			style="z-index: {Z_INDEX.SELECTED_FEATURE_DRAWER_CONTENT}"
		>
			<div
				class={clsx('flex w-full flex-col p-4 pt-5', {
					'overflow-y-auto': activeSnapPoint === snapPoints[1] || activeSnapPoint === snapPoints[2],
					'overflow-hidden': activeSnapPoint === snapPoints[0]
				})}
			>
				<div class="mb-2 flex items-center justify-between">
					<Drawer.Title class="flex items-center gap-2 text-2xl font-medium">
						<PropertyIcon key={'category'} value={feature?.properties.category} size={20} />
						{#if hasFeature}
							{getDisplayName(feature)}
						{:else}
							Selected Feature
						{/if}
					</Drawer.Title>
					<!-- Custom close button instead of Drawer.Close -->
					<button
						class="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:bg-gray-100 focus:text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
						onclick={() => {
							open = false;
						}}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								open = false;
							}
						}}
						title="Close drawer"
						aria-label="Close feature details drawer"
					>
						<PropertyIcon key={'description'} value={'x'} size={20} class="text-current" />
					</button>
				</div>

				<!-- Fixed height container for feature name to maintain consistent spacing -->
				<div class="mb-2 flex min-h-6 items-start">
					{#if hasFeature && getFeatureName(feature) && getFeatureName(feature) !== getDisplayName(feature)}
						<h3 class="text-lg font-medium text-gray-700">
							<span class="truncate">{getFeatureName(feature)}</span>
						</h3>
					{/if}
				</div>

				<div class="space-y-2">
					{#if hasFeature}
						<div class="space-y-2">
							<!-- Classification grid -->
							{#if hasClassificationData(feature)}
								{@const classData = getClassificationData(feature)}
								<div class="grid grid-cols-3 gap-3">
									<!-- Class -->
									<div class="text-center">
										<div
											class="flex min-h-8 items-center justify-center rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900"
										>
											{#if classData.class}
												{#if classData.class.length > 10}
													<!-- Use icon for long class names -->
													<PropertyIcon key="class" value={feature?.properties.class} size={16} />
												{:else}
													{classData.class}
												{/if}
											{:else}
												-
											{/if}
										</div>
									</div>
									<!-- Subclass -->
									<div class="text-center">
										<div
											class="flex min-h-8 items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-gray-900"
										>
											{#if classData.subclass}
												{#if classData.subclass.length > 10}
													<!-- Use icon for long subclass names -->
													<PropertyIcon
														key="subclass"
														value={feature?.properties.subclass}
														size={16}
													/>
												{:else}
													{classData.subclass}
												{/if}
											{:else}
												-
											{/if}
										</div>
									</div>
									<!-- Category -->
									<div class="text-center">
										<div
											class="flex min-h-8 items-center justify-center rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900"
										>
											{#if classData.category}
												{#if classData.category.length > 10}
													<!-- Use icon for long category names -->
													<PropertyIcon
														key="category"
														value={feature?.properties.category}
														size={16}
													/>
												{:else}
													{classData.category}
												{/if}
											{:else}
												-
											{/if}
										</div>
									</div>
								</div>
							{/if}

							<!-- Action buttons grid -->
							<div class="grid grid-cols-5 gap-2">
								<button
									class={clsx(
										'flex flex-col items-center justify-center gap-1 rounded-md px-2 py-3 text-xs font-medium transition-colors focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none',
										{
											'border border-blue-300 bg-blue-100 text-blue-800': featureStatus.bookmarked,
											'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50':
												!featureStatus.bookmarked,
											'cursor-not-allowed opacity-50': featureStatus.loading
										}
									)}
									onclick={() => handleBookmark(feature)}
									disabled={featureStatus.loading}
								>
									<PropertyIcon
										key={'description'}
										value={featureStatus.bookmarked ? 'bookmark_true' : 'bookmark_false'}
										size={20}
										color={featureStatus.bookmarked ? 'border-blue-300' : 'black'}
									/>
								</button>
								<button
									class={clsx(
										'flex flex-col items-center justify-center gap-1 rounded-md px-2 py-3 text-xs font-medium transition-colors focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none',
										{
											'border border-red-300 bg-red-100 text-red-800': featureStatus.todo,
											'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50':
												!featureStatus.todo && featureStatus.bookmarked,
											'cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400':
												!featureStatus.bookmarked,
											'cursor-not-allowed opacity-50': featureStatus.loading
										}
									)}
									onclick={() => handleTodo(feature)}
									disabled={featureStatus.loading || !featureStatus.bookmarked}
								>
									<PropertyIcon
										key={'description'}
										value={featureStatus.todo ? 'todo_true' : 'todo_false'}
										size={20}
										color={featureStatus.todo ? 'border-red-300' : 'black'}
									/>
								</button>
								<button
									class={clsx(
										'relative flex flex-col items-center justify-center gap-1 rounded-md px-2 py-3 text-xs font-medium transition-colors focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none',
										{
											'border border-green-300 bg-green-100 text-green-800':
												featureStatus.visitedDates.length > 0,
											'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50':
												featureStatus.visitedDates.length === 0 && featureStatus.bookmarked,
											'cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400':
												!featureStatus.bookmarked,
											'cursor-not-allowed opacity-50': featureStatus.loading
										}
									)}
									onclick={() => handleVisited(feature)}
									disabled={featureStatus.loading || !featureStatus.bookmarked}
								>
									<PropertyIcon
										key={'description'}
										value={featureStatus.visitedDates.length !== 0
											? 'visited_true'
											: 'visited_false'}
										size={20}
										color={featureStatus.bookmarked ? 'border-green-300' : 'black'}
									/>
									{#if featureStatus.visitedDates.length > 0}
										<span
											class="text-xxs absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-600 font-bold text-white"
										>
											{featureStatus.visitedDates.length}
										</span>
									{/if}
								</button>
								<button
									class={clsx(
										'flex flex-col items-center justify-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none',
										{
											'cursor-not-allowed opacity-50': featureStatus.loading
										}
									)}
									onclick={() => handleUpdate(feature)}
									disabled={featureStatus.loading}
								>
									<PropertyIcon key={'description'} value={'update'} size={20} color={'black'} />
								</button>
								<button
									class={clsx(
										'flex flex-col items-center justify-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none',
										{
											'cursor-not-allowed opacity-50': featureStatus.loading
										}
									)}
									onclick={() => handleLocation(feature)}
									disabled={featureStatus.loading}
								>
									<PropertyIcon key={'description'} value={'location'} size={20} color={'black'} />
								</button>
							</div>

							<!-- Feature details -->
							<Tabs.Root bind:value={activeTab} class="w-full">
								<Tabs.List class="grid w-full grid-cols-2 gap-1 rounded-md bg-gray-100 p-1">
									<Tabs.Trigger
										value="info"
										class="rounded-sm py-2 text-sm font-medium transition-colors data-[state=active]:bg-white data-[state=active]:shadow-sm"
									>
										Info
									</Tabs.Trigger>
									<Tabs.Trigger
										value="visits"
										class="rounded-sm py-2 text-sm font-medium transition-colors data-[state=active]:bg-white data-[state=active]:shadow-sm"
									>
										Visits
									</Tabs.Trigger>
								</Tabs.List>

								<Tabs.Content value="info" class="mt-4">
									{#if feature}
										<div class="max-h-80 space-y-2 overflow-y-auto text-sm">
											{#if feature.properties?.opening_hours}
												<OpeningHoursDisplay
													openingHours={feature.properties.opening_hours}
													showCurrentStatus={true}
												/>
											{/if}
											{#if feature.properties?.website}
												{@const formattedUrl = formatWebsiteUrl(feature.properties.website)}
												<p class="text-gray-600">
													<strong>Website:</strong>
													<a
														href={formattedUrl}
														target="_blank"
														rel="noopener noreferrer"
														class="ml-1 text-blue-600 underline hover:text-blue-800"
													>
														{feature.properties.website}
													</a>
													<span class="ml-1 text-xs">🔗</span>
												</p>
											{/if}
											{#if feature.properties?.phone}
												<p class="text-gray-600">
													<strong>Phone:</strong>
													<a
														href="tel:{feature.properties.phone}"
														class="ml-1 text-blue-600 hover:text-blue-800"
													>
														{formatPhoneNumber(feature.properties.phone)}
													</a>
													<span class="ml-1 text-xs">📞</span>
												</p>
											{/if}
											{#if feature.properties?.internet_access}
												{@const wifiInfo = formatWifiStatus(feature.properties.internet_access)}
												<p class="text-gray-600">
													<strong>WiFi:</strong>
													<span class={wifiInfo.hasWifi ? 'text-green-600' : 'text-gray-500'}>
														{wifiInfo.description}
													</span>
													<span class="ml-1 text-xs">{wifiInfo.hasWifi ? '📶' : '📵'}</span>
												</p>
											{/if}
											{#if feature.properties?.type}
												<p class="text-gray-600">
													<strong>Type:</strong>
													{feature.properties.type}
												</p>
											{/if}
										</div>
									{/if}
								</Tabs.Content>

								<Tabs.Content value="visits" class="mt-4">
									<div class="space-y-3">
										<!-- Visit history -->
										{#if featureStatus.visitedDates.length > 0}
											<div class="space-y-2">
												<h4 class="text-sm font-medium text-gray-700">
													Visit History ({featureStatus.visitedDates.length}):
												</h4>
												<div class="max-h-48 space-y-2 overflow-y-auto">
													{#each getSortedVisits(featureStatus.visitedDates) as visitTimestamp}
														<div
															class="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm"
														>
															<span class="text-gray-700">
																{formatVisitDateTime(visitTimestamp)}
															</span>
															<button
																class="rounded px-2 py-1 text-red-500 hover:bg-red-50 hover:text-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
																onclick={() => handleRemoveVisit(feature, visitTimestamp)}
																onkeydown={(e) => {
																	if (e.key === 'Enter' || e.key === ' ') {
																		e.preventDefault();
																		handleRemoveVisit(feature, visitTimestamp);
																	}
																}}
																disabled={featureStatus.loading}
																title="Remove this visit"
																aria-label={`Remove visit from ${formatVisitDateTime(visitTimestamp)}`}
															>
																🗑️
															</button>
														</div>
													{/each}
												</div>
											</div>
										{:else if featureStatus.bookmarked}
											<div class="py-4 text-center text-sm text-gray-500">
												No visits recorded yet. Add your first visit above!
											</div>
										{:else}
											<div class="py-4 text-center text-sm text-gray-500">
												Bookmark this feature to start tracking visits.
											</div>
										{/if}
									</div>
								</Tabs.Content>
							</Tabs.Root>
						</div>
					{:else}
						<div class="py-8 text-center">
							<div class="mb-4 text-4xl">ℹ️</div>
							<h3 class="mb-2 text-lg font-medium text-gray-900">No Features Selected</h3>
							<p class="text-sm text-gray-600">
								Click on map features to view detailed information about them.
							</p>
						</div>
					{/if}
				</div>
			</div>
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>

<!-- Bookmark Dialog -->
<BookmarkDialog
	bind:open={bookmarkDialogOpen}
	{feature}
	onBookmarkUpdated={handleBookmarkUpdated}
/>
