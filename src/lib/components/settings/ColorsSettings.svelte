<script lang="ts">
	import { Select } from 'bits-ui';
	import { COLORS } from '$lib/constants.js';
	import { appState } from '$lib/stores/AppState.svelte.js';
	import ChevronDown from 'phosphor-svelte/lib/CaretDown';
	import Check from 'phosphor-svelte/lib/Check';
	import { onMount } from 'svelte';

	// Track initialization state
	let isInitialized = $state(false);

	// Individual state variables for each category (following the official pattern)
	let attraction = $state<string>('');
	let education = $state<string>('');
	let entertainment = $state<string>('');
	let facility = $state<string>('');
	let food_and_drink = $state<string>('');
	let healthcare = $state<string>('');
	let leisure = $state<string>('');
	let lodging = $state<string>('');
	let natural = $state<string>('');
	let place = $state<string>('');
	let route = $state<string>('');
	let shop = $state<string>('');
	let transportation = $state<string>('');
	let bookmarks = $state<string>('');
	let visited = $state<string>('');
	let todo = $state<string>('');
	let followed = $state<string>('');
	let search = $state<string>('');

	// Initialize appState when component mounts
	onMount(async () => {
		console.log('Initializing ColorsSettings component...');
		await appState.ensureInitialized();
		console.log('AppState initialized, config:', appState.config);

		// Set initial values from appState
		const mappings = appState.colorMappings;
		attraction = mappings.attraction;
		education = mappings.education;
		entertainment = mappings.entertainment;
		facility = mappings.facility;
		food_and_drink = mappings.food_and_drink;
		healthcare = mappings.healthcare;
		leisure = mappings.leisure;
		lodging = mappings.lodging;
		natural = mappings.natural;
		place = mappings.place;
		route = mappings.route;
		shop = mappings.shop;
		transportation = mappings.transportation;
		bookmarks = mappings.bookmarks;
		visited = mappings.visited;
		todo = mappings.todo;
		followed = mappings.followed;
		search = mappings.search;

		isInitialized = true;
	});

	// Available colors from COLORS constant
	const colorOptions = Object.keys(COLORS).map((colorName) => ({
		value: colorName,
		label: colorName.charAt(0).toUpperCase() + colorName.slice(1),
		color: COLORS[colorName as keyof typeof COLORS][600] // Use 600 shade for preview
	}));

	// Categories that can be customized with their corresponding state variables
	const categories = [
		{
			key: 'attraction',
			label: 'Attraction',
			state: () => attraction,
			setState: (v: string) => {
				attraction = v;
				appState.updateColorMapping('attraction', v);
			}
		},
		{
			key: 'education',
			label: 'Education',
			state: () => education,
			setState: (v: string) => {
				education = v;
				appState.updateColorMapping('education', v);
			}
		},
		{
			key: 'entertainment',
			label: 'Entertainment',
			state: () => entertainment,
			setState: (v: string) => {
				entertainment = v;
				appState.updateColorMapping('entertainment', v);
			}
		},
		{
			key: 'facility',
			label: 'Facility',
			state: () => facility,
			setState: (v: string) => {
				facility = v;
				appState.updateColorMapping('facility', v);
			}
		},
		{
			key: 'food_and_drink',
			label: 'Food & Drink',
			state: () => food_and_drink,
			setState: (v: string) => {
				food_and_drink = v;
				appState.updateColorMapping('food_and_drink', v);
			}
		},
		{
			key: 'healthcare',
			label: 'Healthcare',
			state: () => healthcare,
			setState: (v: string) => {
				healthcare = v;
				appState.updateColorMapping('healthcare', v);
			}
		},
		{
			key: 'leisure',
			label: 'Leisure',
			state: () => leisure,
			setState: (v: string) => {
				leisure = v;
				appState.updateColorMapping('leisure', v);
			}
		},
		{
			key: 'lodging',
			label: 'Lodging',
			state: () => lodging,
			setState: (v: string) => {
				lodging = v;
				appState.updateColorMapping('lodging', v);
			}
		},
		{
			key: 'natural',
			label: 'Natural',
			state: () => natural,
			setState: (v: string) => {
				natural = v;
				appState.updateColorMapping('natural', v);
			}
		},
		{
			key: 'place',
			label: 'Place',
			state: () => place,
			setState: (v: string) => {
				place = v;
				appState.updateColorMapping('place', v);
			}
		},
		{
			key: 'route',
			label: 'Route',
			state: () => route,
			setState: (v: string) => {
				route = v;
				appState.updateColorMapping('route', v);
			}
		},
		{
			key: 'shop',
			label: 'Shop',
			state: () => shop,
			setState: (v: string) => {
				shop = v;
				appState.updateColorMapping('shop', v);
			}
		},
		{
			key: 'transportation',
			label: 'Transportation',
			state: () => transportation,
			setState: (v: string) => {
				transportation = v;
				appState.updateColorMapping('transportation', v);
			}
		},
		{
			key: 'bookmarks',
			label: 'Bookmarks',
			state: () => bookmarks,
			setState: (v: string) => {
				bookmarks = v;
				appState.updateColorMapping('bookmarks', v);
			}
		},
		{
			key: 'visited',
			label: 'Visited',
			state: () => visited,
			setState: (v: string) => {
				visited = v;
				appState.updateColorMapping('visited', v);
			}
		},
		{
			key: 'todo',
			label: 'To-Do',
			state: () => todo,
			setState: (v: string) => {
				todo = v;
				appState.updateColorMapping('todo', v);
			}
		},
		{
			key: 'followed',
			label: 'Followed',
			state: () => followed,
			setState: (v: string) => {
				followed = v;
				appState.updateColorMapping('followed', v);
			}
		},
		{
			key: 'search',
			label: 'Search',
			state: () => search,
			setState: (v: string) => {
				search = v;
				appState.updateColorMapping('search', v);
			}
		}
	];

	function resetToDefaults() {
		console.log('Resetting color mappings to defaults');
		appState.resetColorMappings();

		// Update local state variables
		const mappings = appState.colorMappings;
		attraction = mappings.attraction;
		education = mappings.education;
		entertainment = mappings.entertainment;
		facility = mappings.facility;
		food_and_drink = mappings.food_and_drink;
		healthcare = mappings.healthcare;
		leisure = mappings.leisure;
		lodging = mappings.lodging;
		natural = mappings.natural;
		place = mappings.place;
		route = mappings.route;
		shop = mappings.shop;
		transportation = mappings.transportation;
		bookmarks = mappings.bookmarks;
		visited = mappings.visited;
		todo = mappings.todo;
		followed = mappings.followed;
		search = mappings.search;
	}
</script>

{#if !isInitialized}
	<div class="flex items-center justify-center py-8">
		<div class="text-muted-foreground text-sm">Loading color settings...</div>
	</div>
{:else}
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<div>
				<h3 class="text-lg font-semibold tracking-tight">Color Settings</h3>
				<p class="text-muted-foreground mt-1 text-sm">
					Customize colors for different categories and user actions
				</p>
			</div>
			<button
				onclick={resetToDefaults}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						resetToDefaults();
					}
				}}
				class="text-muted-foreground hover:text-foreground focus-visible:ring-foreground rounded-sm text-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
				aria-label="Reset all colors to default values"
			>
				Reset to defaults
			</button>
		</div>

		<div class="space-y-2">
			{#each categories as category}
				{@const currentValue = category.state()}
				{@const selectedLabel = currentValue
					? colorOptions.find((option) => option.value === currentValue)?.label || 'Select color'
					: 'Select color'}
				<div class="flex items-center gap-3 py-1.5">
					<!-- Color preview circle -->
					<div
						class="size-3 flex-shrink-0 rounded-full border border-neutral-300 dark:border-neutral-600"
						style="background-color: {COLORS[currentValue as keyof typeof COLORS]?.[600] ||
							'#6b7280'}"
						aria-hidden="true"
					></div>

					<!-- Category name -->
					<h4 class="min-w-0 flex-1 truncate text-sm font-medium">{category.label}</h4>

					<!-- Color selector dropdown -->
					<div class="flex-shrink-0">
						<Select.Root
							type="single"
							onValueChange={(value) => {
								if (value) {
									category.setState(value);
								}
							}}
							items={colorOptions}
							allowDeselect={false}
						>
							<Select.Trigger
								class="bg-background border-input hover:bg-accent hover:text-accent-foreground focus:ring-ring inline-flex h-7 min-w-[90px] items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
								aria-label={`Select color for ${category.label}`}
							>
								{selectedLabel}
								<ChevronDown class="size-3 opacity-50" />
							</Select.Trigger>

							<Select.Portal>
								<Select.Content
									class="bg-background text-foreground shadow-popover data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-50 max-h-64 min-w-[140px] overflow-auto rounded-md border border-gray-200 p-1 outline-hidden dark:border-gray-800"
									sideOffset={4}
								>
									<Select.Viewport class="p-1">
										{#each colorOptions as colorOption, i (i + colorOption.value)}
											<Select.Item
												value={colorOption.value}
												label={colorOption.label}
												class="hover:bg-accent hover:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-hidden select-none"
											>
												{#snippet children({ selected })}
													<div
														class="size-3 rounded-full border border-neutral-300 dark:border-neutral-600"
														style="background-color: {colorOption.color}"
														aria-hidden="true"
													></div>
													{colorOption.label}
													{#if selected}
														<div class="ml-auto">
															<Check class="size-3" aria-label="selected" />
														</div>
													{/if}
												{/snippet}
											</Select.Item>
										{/each}
									</Select.Viewport>
								</Select.Content>
							</Select.Portal>
						</Select.Root>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}
