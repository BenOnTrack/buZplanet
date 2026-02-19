<!-- BookmarksGeojsonSource.svelte -->
<script lang="ts">
	// @ts-nocheck
	import { GeoJSON, CircleLayer, SymbolLayer } from 'svelte-maplibre';
	import { appState } from '$lib/stores/AppState.svelte.js';
	import { onMount } from 'svelte';

	interface Props {
		nameExpression: any;
		bookmarksFeaturesGeoJSON: any;
	}
	let { nameExpression, bookmarksFeaturesGeoJSON }: Props = $props();

	// Track initialization
	let isInitialized = $state(false);

	// Initialize on mount
	onMount(async () => {
		await appState.ensureInitialized();
		isInitialized = true;
	});

	// Derived filter based on AppState bookmark filter settings
	let featuresBookmarkFilter = $derived.by(() => {
		if (!isInitialized) {
			// Return permissive filter during initialization
			return ['all'];
		}

		const bookmarkFilterSettings = appState.filterSettings.bookmark;

		// Extract class names (already clean)
		const selectedClasses = Array.from(bookmarkFilterSettings.classes);

		// Extract subclass names (remove class prefix)
		const selectedSubclasses = Array.from(bookmarkFilterSettings.subclasses).map((subclass) => {
			const parts = subclass.split('-');
			return parts.slice(1).join('-'); // Remove first part (class)
		});

		// Extract category names (remove class and subclass prefix)
		const selectedCategories = Array.from(bookmarkFilterSettings.categories).map((category) => {
			const parts = category.split('-');
			return parts.slice(2).join('-'); // Remove first two parts (class-subclass)
		});

		console.log('Bookmark filter applied:', {
			classes: selectedClasses.length,
			subclasses: selectedSubclasses.length,
			categories: selectedCategories.length
		});

		return [
			'all',
			['in', ['get', 'class'], ['literal', selectedClasses]],
			['in', ['get', 'subclass'], ['literal', selectedSubclasses]],
			['in', ['get', 'category'], ['literal', selectedCategories]]
		];
	});

	const iconImage = $derived(() => {
		if (!isInitialized) {
			// Return default values during initialization
			return {
				attraction: [
					'concat',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-bright-',
					'teal'
				],
				education: [
					'concat',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-bright-',
					'stone'
				],
				entertainment: [
					'concat',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-bright-',
					'fuchsia'
				],
				facility: [
					'concat',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-bright-',
					'zinc'
				],
				food_and_drink: [
					'concat',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-bright-',
					'amber'
				],
				healthcare: [
					'concat',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-bright-',
					'red'
				],
				leisure: [
					'concat',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-bright-',
					'blue'
				],
				lodging: [
					'concat',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-bright-',
					'slate'
				],
				natural: [
					'concat',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-bright-',
					'green'
				],
				place: [
					'concat',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-bright-',
					'neutral'
				],
				route: [
					'concat',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-bright-',
					'indigo'
				],
				shop: [
					'concat',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-bright-',
					'rose'
				],
				transportation: [
					'case',
					['has', 'relationChildId'],
					[
						'concat',
						'super-',
						['to-string', ['get', 'class']],
						'-',
						['to-string', ['get', 'subclass']],
						'-',
						['to-string', ['get', 'category']],
						'-bright-',
						'sky'
					],
					[
						'concat',
						['to-string', ['get', 'class']],
						'-',
						['to-string', ['get', 'subclass']],
						'-',
						['to-string', ['get', 'category']],
						'-bright-',
						'sky'
					]
				],
				bookmarks: [
					'concat',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-dark-',
					'blue'
				],
				visited: [
					'concat',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-dark-',
					'green'
				],
				todo: [
					'concat',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-dark-',
					'red'
				],
				followed: [
					'concat',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-dark-',
					'purple'
				],
				search: [
					'concat',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-dark-',
					'yellow'
				]
			};
		}

		// Get current color mappings from AppState
		const colorMappings = appState.colorMappings;

		return {
			attraction: [
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.attraction
			],
			education: [
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.education
			],
			entertainment: [
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.entertainment
			],
			facility: [
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.facility
			],
			food_and_drink: [
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.food_and_drink
			],
			healthcare: [
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.healthcare
			],
			leisure: [
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.leisure
			],
			lodging: [
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.lodging
			],
			natural: [
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.natural
			],
			place: [
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.place
			],
			route: [
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.route
			],
			shop: [
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.shop
			],
			transportation: [
				'case',
				['has', 'relationChildId'],
				[
					'concat',
					'super-',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-bright-',
					colorMappings.transportation
				],
				[
					'concat',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-bright-',
					colorMappings.transportation
				]
			],
			bookmarks: [
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-dark-',
				colorMappings.bookmarks
			],
			visited: [
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-dark-',
				colorMappings.visited
			],
			todo: [
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-dark-',
				colorMappings.todo
			],
			followed: [
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-dark-',
				colorMappings.followed
			],
			search: [
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-dark-',
				colorMappings.search
			]
		};
	});
</script>

<GeoJSON id="bookmarksSource" data={bookmarksFeaturesGeoJSON} cluster={{ maxZoom: 12, radius: 50 }}>
	<CircleLayer
		id="bookmarksClusterCircles"
		beforeId="poi_place_major"
		applyToClusters
		paint={{
			'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
			'circle-opacity': 0.5
		}}
	/>
	<SymbolLayer
		id="bookmarksClusterLabels"
		beforeId="poi_place_major"
		interactive={false}
		applyToClusters
		layout={{
			'text-field': '{point_count}',
			'text-font': ['Noto Sans Regular'],
			'text-size': 12
		}}
	/>
	<SymbolLayer
		id="bookmarks"
		filter={featuresBookmarkFilter}
		layout={{
			'icon-image': iconImage().bookmarks as any,
			'icon-allow-overlap': true,
			'icon-size': [
				'interpolate',
				['linear'],
				['zoom'],
				0,
				0.6,
				14,
				0.75,
				15,
				1,
				16,
				1.25,
				17,
				1.5
			],
			'text-anchor': 'top',
			'text-field': nameExpression,
			'text-font': [
				'case',
				['==', ['get', 'class'], 'place'],
				['literal', ['Noto Sans Bold']],
				['literal', ['Noto Sans Regular']]
			],
			'text-transform': ['case', ['==', ['get', 'class'], 'place'], 'uppercase', 'none'],
			'text-offset': [0, 1],
			'text-max-width': 9,
			'text-optional': true,
			'text-allow-overlap': false,
			'text-size': [
				'interpolate',
				['linear'],
				['zoom'],
				10,
				['case', ['==', ['get', 'class'], 'place'], 10, 8],
				22,
				['case', ['==', ['get', 'class'], 'place'], 15, 10]
			]
		}}
		paint={{
			'text-color': '#55729a',
			'text-halo-blur': 0.5,
			'text-halo-color': '#ffffff',
			'text-halo-width': 2
		}}
	/>
</GeoJSON>
