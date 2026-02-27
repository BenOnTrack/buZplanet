<script lang="ts">
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
	import { appState } from '$lib/stores/AppState.svelte';
	import { mapControl } from '$lib/stores/MapControl.svelte';

	// Props
	let {
		searchQuery = $bindable(''),
		filteredRoutes = [],
		onRouteNavigated
	}: {
		searchQuery?: string;
		filteredRoutes: RouteInfo[];
		onRouteNavigated?: () => void;
	} = $props();

	// Helper function to get display name for a route
	function getRouteDisplayName(route: RouteInfo): string {
		const currentLanguage = appState.language;

		// Try current language setting first
		if (route.names[currentLanguage]) {
			return route.names[currentLanguage];
		}

		// Fallback to name
		if (route.names.name) {
			return route.names.name;
		}

		// Fallback to any available name
		const availableNames = Object.values(route.names).filter(
			(name) => typeof name === 'string' && name.trim()
		);
		if (availableNames.length > 0) {
			return availableNames[0];
		}

		// Final fallback to ID
		return route.id;
	}

	// Helper function to get route type icon based on classification
	function getRouteTypeIcon(route: RouteInfo): string {
		// Prioritize subclass for more specific icons
		if (route.subclass) {
			switch (route.subclass.toLowerCase()) {
				case 'hiking':
				case 'walking':
					return 'person-simple-walk';
				case 'bicycle':
				case 'cycling':
					return 'bicycle';
				case 'train':
					return 'train';
				case 'bus':
					return 'bus';
				case 'ferry':
				case 'water':
					return 'boat';
				case 'tram':
					return 'train-simple';
				default:
					return 'map-trifold';
			}
		}

		// Fallback to class or category
		if (route.class === 'route') {
			return 'map-trifold';
		}

		return 'map-trifold';
	}

	// Helper function to get route type color based on classification
	function getRouteTypeColor(route: RouteInfo): string {
		if (route.subclass) {
			switch (route.subclass.toLowerCase()) {
				case 'hiking':
				case 'walking':
					return 'text-green-600';
				case 'bicycle':
				case 'cycling':
					return 'text-blue-600';
				case 'train':
					return 'text-purple-600';
				case 'bus':
					return 'text-orange-600';
				case 'ferry':
				case 'water':
					return 'text-cyan-600';
				case 'tram':
					return 'text-indigo-600';
				default:
					return 'text-gray-600';
			}
		}
		return 'text-gray-600';
	}

	// Helper function to get route classification display text
	function getRouteClassification(route: RouteInfo): string {
		const parts = [route.class, route.subclass, route.category].filter(Boolean);
		return parts.length > 0 ? parts.join(' → ') : '';
	}

	// Group routes by classification
	let groupedRoutes = $derived.by(() => {
		const groups: Record<string, RouteInfo[]> = {};

		filteredRoutes.forEach((route) => {
			// Create grouping key based on classification
			const groupKey = route.subclass || route.class || route.category || 'Other';
			const displayKey = groupKey.charAt(0).toUpperCase() + groupKey.slice(1);

			if (!groups[displayKey]) {
				groups[displayKey] = [];
			}
			groups[displayKey].push(route);
		});

		// Sort groups by name and sort routes within groups
		return Object.keys(groups)
			.sort()
			.reduce(
				(acc, key) => {
					acc[key] = groups[key].sort((a, b) =>
						getRouteDisplayName(a).localeCompare(getRouteDisplayName(b))
					);
					return acc;
				},
				{} as Record<string, RouteInfo[]>
			);
	});

	// Route management functions
	function handleRemoveRoute(routeToRemove: RouteInfo) {
		console.log('Removing route:', routeToRemove.id);
		appState.removeRouteFromRelation(routeToRemove.id);
	}

	function handleClearAllRoutes() {
		console.log('Clearing all routes');
		appState.updateRelationSettings({ childRoute: [] });
	}

	// Navigation function for route bbox
	function handleNavigateToRoute(route: RouteInfo, event?: MouseEvent | KeyboardEvent) {
		// Prevent default click behavior if this is a click event
		if (event) {
			event.preventDefault();
			event.stopPropagation();
		}

		console.log('Navigating to route:', route.id);

		// Try to navigate using AppState navigation method
		const mapInstance = mapControl.getMapInstance();
		const success = appState.navigateToRoute(route.id, mapInstance);

		if (success) {
			console.log(`✅ Successfully navigated to route ${route.id}`);
		} else {
			console.warn(
				`⚠️ Could not navigate to route ${route.id} - no bbox available or map not ready`
			);
		}

		// Close the parent dialog after navigation
		if (onRouteNavigated) {
			onRouteNavigated();
		}
	}
</script>

<div class="space-y-2">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-medium">Active Route Segments</h3>
		<p class="text-sm text-gray-600">
			{appState.relationSettings.childRoute.length} route segments active
			{#if searchQuery.trim() && filteredRoutes.length !== appState.relationSettings.childRoute.length}
				({filteredRoutes.length} shown)
			{/if}
		</p>
	</div>

	<!-- Action buttons -->
	{#if appState.relationSettings.childRoute.length > 0}
		<div class="mb-4 flex flex-wrap gap-2">
			<button
				type="button"
				class="rounded-md border border-blue-300 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
				onclick={() => {
					const mapInstance = mapControl.getMapInstance();
					const success = appState.navigateToAllRoutes(mapInstance);
					if (success) {
						console.log('✅ Successfully navigated to all route bounds');
					} else {
						console.warn(
							'⚠️ Could not navigate to all routes - no bbox data available or map not ready'
						);
					}
					// Close the parent dialog after navigation
					if (onRouteNavigated) {
						onRouteNavigated();
					}
				}}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						const mapInstance = mapControl.getMapInstance();
						const success = appState.navigateToAllRoutes(mapInstance);
						if (success) {
							console.log('✅ Successfully navigated to all route bounds');
						} else {
							console.warn(
								'⚠️ Could not navigate to all routes - no bbox data available or map not ready'
							);
						}
						// Close the parent dialog after navigation
						if (onRouteNavigated) {
							onRouteNavigated();
						}
					}
				}}
				title="Navigate map to show all route segments"
			>
				View All Routes on Map
			</button>
			<button
				type="button"
				class="rounded-md border border-red-300 bg-red-50 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-100 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
				onclick={handleClearAllRoutes}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						handleClearAllRoutes();
					}
				}}
				title="Remove all route segments"
			>
				Clear All Routes
			</button>
		</div>
	{/if}

	<!-- Search bar -->
	{#if appState.relationSettings.childRoute.length > 0}
		<div class="mb-4">
			<div class="relative">
				<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
					<MagnifyingGlass size={16} class="text-gray-400" />
				</div>
				<input
					type="text"
					bind:value={searchQuery}
					class="block w-full rounded-md border border-gray-300 bg-white py-2 pr-3 pl-10 text-sm placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
					placeholder="Search route segments..."
					aria-label="Search route segments"
				/>
				{#if searchQuery.trim()}
					<button
						type="button"
						class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
						onclick={() => (searchQuery = '')}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								searchQuery = '';
							}
						}}
						aria-label="Clear search"
					>
						<PropertyIcon key="description" value="x" size={16} />
					</button>
				{/if}
			</div>
			{#if searchQuery.trim() && filteredRoutes.length === 0}
				<p class="mt-2 text-center text-sm text-gray-500">
					No routes match "{searchQuery}"
				</p>
			{:else if searchQuery.trim()}
				<p class="mt-2 text-center text-sm text-gray-500">
					Showing {filteredRoutes.length} of {appState.relationSettings.childRoute.length} routes
				</p>
			{/if}
		</div>
	{/if}

	<!-- Route list -->
	<div class="max-h-80 overflow-y-auto">
		{#if appState.relationSettings.childRoute.length === 0}
			<div class="flex items-center justify-center py-8 text-gray-500">
				<div class="text-center">
					<PropertyIcon
						key="description"
						value="map-trifold"
						size={32}
						class="mx-auto mb-2 text-gray-300"
					/>
					<p class="text-sm">No active route segments</p>
					<p class="text-xs text-gray-400">
						Routes will appear here when you explore transportation features
					</p>
				</div>
			</div>
		{:else if filteredRoutes.length === 0 && searchQuery.trim()}
			<div class="flex items-center justify-center py-8 text-gray-500">
				<div class="text-center">
					<MagnifyingGlass size={32} class="mx-auto mb-2 text-gray-300" />
					<p class="text-sm">No routes found</p>
					<p class="text-xs text-gray-400">Try a different search term</p>
				</div>
			</div>
		{:else}
			<div class="space-y-4">
				{#each Object.entries(groupedRoutes) as [groupName, routes] (groupName)}
					<div class="space-y-2">
						<!-- Group header -->
						<div class="flex items-center space-x-2 border-b border-gray-200 pb-1">
							<h4 class="text-xs font-semibold tracking-wide text-gray-700 uppercase">
								{groupName} Routes
							</h4>
							<span class="text-xs text-gray-500">({routes.length})</span>
						</div>

						<!-- Routes in this group -->
						<div class="ml-2 space-y-1">
							{#each routes as route (route.id)}
								<div class="group relative">
									<div
										class="flex cursor-pointer items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
										onclick={(e) => handleNavigateToRoute(route, e)}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												handleNavigateToRoute(route, e);
											}
										}}
										tabindex="0"
										role="button"
										aria-label="Navigate to route {getRouteDisplayName(route)} {route.bbox
											? '(click to navigate to location)'
											: '(no location data)'}"
										title={route.bbox
											? 'Click to navigate to this route on the map'
											: 'This route has no location data for navigation'}
									>
										<div class="flex min-w-0 flex-1 items-center space-x-3">
											<div class="flex items-center space-x-2">
												<PropertyIcon
													key="description"
													value={getRouteTypeIcon(route)}
													size={16}
													class={`${getRouteTypeColor(route)} flex-shrink-0`}
												/>
												{#if route.bbox}
													<PropertyIcon
														key="description"
														value="map-pin"
														size={12}
														class="text-blue-500 opacity-70"
													/>
												{:else}
													<PropertyIcon
														key="description"
														value="map-pin-off"
														size={12}
														class="text-gray-400 opacity-50"
													/>
												{/if}
											</div>
											<div class="min-w-0 flex-1">
												<div class="truncate text-sm font-medium text-gray-900">
													{getRouteDisplayName(route)}
												</div>
												{#if route.id !== getRouteDisplayName(route)}
													<div class="truncate text-xs text-gray-500" title="Route ID: {route.id}">
														ID: {route.id}
													</div>
												{/if}
												{#if getRouteClassification(route)}
													<div
														class="truncate text-xs text-gray-400"
														title="Classification: {getRouteClassification(route)}"
													>
														{getRouteClassification(route)}
													</div>
												{/if}
											</div>
										</div>
										<button
											type="button"
											class="ml-2 flex-shrink-0 rounded-md border border-red-200 bg-red-50 p-2 text-red-600 transition-colors hover:bg-red-100 hover:text-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
											onclick={(e) => {
												e.stopPropagation(); // Prevent triggering the navigation
												handleRemoveRoute(route);
											}}
											onkeydown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													e.stopPropagation(); // Prevent triggering the navigation
													handleRemoveRoute(route);
												}
											}}
											title="Remove route: {getRouteDisplayName(route)}"
											aria-label="Remove route {getRouteDisplayName(route)}"
										>
											<PropertyIcon key="description" value="trash" size={16} />
										</button>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
