<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import { clsx } from 'clsx';
	import { formatFeatureProperty } from '$lib/utils/text-formatting.js';
	import { featuresDB, type StoredFeature } from '$lib/stores/FeaturesDB.svelte.js';
	import BookmarkDialog from '$lib/components/dialogs/BookmarkDialog.svelte';
	import OpeningHoursDisplay from '$lib/components/ui/OpeningHoursDisplay.svelte';
	import type { MapGeoJSONFeature } from 'svelte-maplibre';

	let {
		open = $bindable(false),
		feature = null
	}: {
		open?: boolean;
		feature?: MapGeoJSONFeature | null;
	} = $props();
	let activeSnapPoint = $state<string | number>('200px');

	// Derived values for display
	let hasFeature = $derived(feature !== null && feature !== undefined);

	// State for tracking feature status in database
	let featureStatus = $state<{
		bookmarked: boolean;
		listIds: string[]; // Array of bookmark list IDs
		visitedDates: number[]; // Array of visit timestamps
		todo: boolean;
		loading: boolean;
	}>({ bookmarked: false, listIds: [], visitedDates: [], todo: false, loading: false });

	// Dialog state
	let bookmarkDialogOpen = $state(false);

	// Watch for feature changes and update status
	$effect(() => {
		if (feature) {
			updateFeatureStatus();
		}
	});

	// Update feature status from database
	async function updateFeatureStatus() {
		if (!feature) return;

		try {
			featureStatus.loading = true;
			await featuresDB.ensureInitialized();

			// Get feature ID the same way as FeaturesDB
			const featureId = getFeatureId(feature);
			const storedFeature = await featuresDB.getFeatureById(featureId);

			if (storedFeature) {
				featureStatus.bookmarked = storedFeature.bookmarked;
				featureStatus.listIds = storedFeature.listIds || [];
				featureStatus.visitedDates = storedFeature.visitedDates || [];
				featureStatus.todo = storedFeature.todo;
			} else {
				featureStatus.bookmarked = false;
				featureStatus.listIds = [];
				featureStatus.visitedDates = [];
				featureStatus.todo = false;
			}
		} catch (error) {
			console.error('Failed to update feature status:', error);
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

	// Helper function to format visit dates for display
	function formatVisitDates(timestamps: number[]): string {
		if (timestamps.length === 0) return 'Never visited';

		const dates = timestamps.map((ts) => new Date(ts).toLocaleDateString());
		const uniqueDates = [...new Set(dates)];

		if (uniqueDates.length === 1) {
			return `Visited on ${uniqueDates[0]}`;
		} else if (uniqueDates.length <= 3) {
			return `Visited on ${uniqueDates.join(', ')}`;
		} else {
			return `Visited ${uniqueDates.length} times (${uniqueDates[0]} to ${uniqueDates[uniqueDates.length - 1]})`;
		}
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

	// Helper function to get display name with fallbacks for main title
	function getDisplayName(feature: MapGeoJSONFeature | null): string {
		if (!feature || !feature.properties) return 'Selected Feature';

		const props = feature.properties;

		// Try name:en first (don't format, keep as-is)
		if (props['name:en']) return props['name:en'];

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

		try {
			featureStatus.loading = true;
			await featuresDB.ensureInitialized();

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

		try {
			featureStatus.loading = true;
			await featuresDB.ensureInitialized();

			// Always add a new visit (no toggling)
			const storedFeature = await featuresDB.addVisit(feature);
			featureStatus.visitedDates = storedFeature.visitedDates;

			const visitCount = storedFeature.visitedDates.length;
			console.log(`Feature visited! Total visits: ${visitCount}`, storedFeature);
		} catch (error) {
			console.error('Failed to add visit:', error);
		} finally {
			featureStatus.loading = false;
		}
	}

	function handleUpdate(feature: MapGeoJSONFeature | null) {
		if (!feature) return;
		// TODO: Implement feature update/edit functionality
		console.log('Update feature:', feature);
	}
</script>

<!-- Selected Feature Drawer -->
<Drawer.Root bind:open snapPoints={['200px', '400px', 1]} bind:activeSnapPoint modal={false}>
	<Drawer.Overlay class="fixed inset-0 z-60 bg-black/40" style="pointer-events: none" />
	<Drawer.Portal>
		<Drawer.Content
			class="border-b-none fixed right-0 bottom-0 left-0 z-60 mx-[-1px] flex h-full max-h-[97%] flex-col rounded-t-[10px] border border-gray-200 bg-white"
		>
			<div
				class={clsx('flex w-full flex-col p-4 pt-5', {
					'overflow-y-auto': activeSnapPoint === 1 || activeSnapPoint === '1',
					'overflow-hidden': activeSnapPoint !== 1 && activeSnapPoint !== '1'
				})}
			>
				<div class="mb-4 flex items-center justify-between">
					<Drawer.Title class="flex items-center gap-2 text-2xl font-medium">
						<span>📍</span>
						{#if hasFeature}
							{getDisplayName(feature)}
						{:else}
							Selected Feature
						{/if}
					</Drawer.Title>
					<Drawer.Close class="text-gray-500 hover:text-gray-700">
						<span class="sr-only">Close</span>
						<span aria-hidden="true" class="text-xl">✕</span>
					</Drawer.Close>
				</div>

				<div class="space-y-4">
					{#if hasFeature}
						<div class="space-y-4">
							<!-- Individual feature name (only if name exists and different from main title) -->
							{#if getFeatureName(feature) && getFeatureName(feature) !== getDisplayName(feature)}
								<h3 class="text-lg font-medium text-gray-700">
									<span class="truncate">{getFeatureName(feature)}</span>
								</h3>
							{/if}

							<!-- Classification grid -->
							{#if hasClassificationData(feature)}
								{@const classData = getClassificationData(feature)}
								<div class="grid grid-cols-3 gap-3">
									<!-- Class -->
									<div class="text-center">
										<div class="mb-1 text-xs tracking-wide text-gray-500 uppercase">Class</div>
										<div
											class="flex min-h-[2rem] items-center justify-center rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900"
										>
											{classData.class || '-'}
										</div>
									</div>
									<!-- Subclass -->
									<div class="text-center">
										<div class="mb-1 text-xs tracking-wide text-gray-500 uppercase">Subclass</div>
										<div
											class="flex min-h-[2rem] items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-gray-900"
										>
											{classData.subclass || '-'}
										</div>
									</div>
									<!-- Category -->
									<div class="text-center">
										<div class="mb-1 text-xs tracking-wide text-gray-500 uppercase">Category</div>
										<div
											class="flex min-h-[2rem] items-center justify-center rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900"
										>
											{classData.category || '-'}
										</div>
									</div>
								</div>
							{/if}

							<!-- Action buttons grid -->
							<div class="grid grid-cols-4 gap-3">
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
									<span class="text-lg">{featureStatus.bookmarked ? '🔖' : '📑'}</span>
									<span>{featureStatus.bookmarked ? 'Bookmarked' : 'Bookmark'}</span>
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
									<span class="text-lg">{featureStatus.todo ? '✅' : '📝'}</span>
									<span>{featureStatus.todo ? 'In Todo' : 'Todo'}</span>
								</button>
								<button
									class={clsx(
										'flex flex-col items-center justify-center gap-1 rounded-md px-2 py-3 text-xs font-medium transition-colors focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none',
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
									<span class="text-lg">{featureStatus.visitedDates.length > 0 ? '✅' : '👀'}</span>
									<span>
										{#if featureStatus.visitedDates.length === 0}
											Visit
										{:else if featureStatus.visitedDates.length === 1}
											Visited 1x
										{:else}
											Visited {featureStatus.visitedDates.length}x
										{/if}
									</span>
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
									<span class="text-lg">🔄</span>
									<span>Update</span>
								</button>
							</div>

							<!-- Feature details -->
							{#if feature}
								<div class="space-y-2 text-sm">
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
										<p class="text-gray-600"><strong>Type:</strong> {feature.properties.type}</p>
									{/if}
									{#if featureStatus.visitedDates.length > 0}
										<p class="text-gray-600">
											<strong>Visits:</strong>
											{formatVisitDates(featureStatus.visitedDates)}
										</p>
									{/if}
								</div>
							{/if}
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

				<button
					class="mt-8 h-12 flex-shrink-0 rounded-md font-medium text-white"
					class:bg-black={hasFeature}
					class:bg-gray-400={!hasFeature}
					disabled={!hasFeature}
				>
					{hasFeature ? 'View Details' : 'No Features Selected'}
				</button>
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
