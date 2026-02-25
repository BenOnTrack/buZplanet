<script lang="ts">
	import { Select } from 'bits-ui';
	import { COLORS } from '$lib/constants.js';
	import { appState } from '$lib/stores/AppState.svelte.js';
	import { Z_INDEX } from '$lib/styles/z-index.js';
	import ChevronDown from 'phosphor-svelte/lib/CaretDown';
	import Check from 'phosphor-svelte/lib/Check';

	// Available colors from COLORS constant
	const colorOptions = Object.keys(COLORS).map((colorName) => ({
		value: colorName,
		label: colorName.charAt(0).toUpperCase() + colorName.slice(1),
		color: COLORS[colorName as keyof typeof COLORS][600] // Use 600 shade for preview
	}));

	// Categories that can be customized - directly using appState
	const categories = [
		{ key: 'attraction', label: 'Attraction' },
		{ key: 'education', label: 'Education' },
		{ key: 'entertainment', label: 'Entertainment' },
		{ key: 'facility', label: 'Facility' },
		{ key: 'food_and_drink', label: 'Food & Drink' },
		{ key: 'healthcare', label: 'Healthcare' },
		{ key: 'leisure', label: 'Leisure' },
		{ key: 'lodging', label: 'Lodging' },
		{ key: 'natural', label: 'Natural' },
		{ key: 'place', label: 'Place' },
		{ key: 'route', label: 'Route' },
		{ key: 'shop', label: 'Shop' },
		{ key: 'transportation', label: 'Transportation' },
		{ key: 'bookmarks', label: 'Bookmarks' },
		{ key: 'visited', label: 'Visited' },
		{ key: 'todo', label: 'To-Do' },
		{ key: 'followed', label: 'Followed' },
		{ key: 'search', label: 'Search' }
	];

	function resetToDefaults() {
		appState.resetColorMappings();
	}
</script>

{#if !appState.initialized}
	<div class="flex items-center justify-center py-8">
		<div class="text-muted-foreground text-sm">Loading color settings...</div>
	</div>
{:else}
	<div class="space-y-4">
		<div class="bg-background sticky top-0 z-10 flex items-center justify-between pb-4">
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
				{@const rawCurrentValue =
					appState.colorMappings[category.key as keyof typeof appState.colorMappings]}
				{@const currentValue = (() => {
					// Ensure currentValue is always a string, not an array
					if (typeof rawCurrentValue === 'string') {
						return rawCurrentValue;
					} else if (Array.isArray(rawCurrentValue) && (rawCurrentValue as any[]).length > 0) {
						// If it's corrupted as an array, take the last element
						console.warn(`Corrupted color value for ${category.key}:`, rawCurrentValue);
						const lastValue = (rawCurrentValue as any[])[(rawCurrentValue as any[]).length - 1];
						return typeof lastValue === 'string' ? lastValue : 'neutral';
					} else {
						return 'neutral'; // fallback
					}
				})()}
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
							value={currentValue}
							onValueChange={(newValue) => {
								console.log('🔍 Value changed to:', newValue, typeof newValue);

								if (newValue && typeof newValue === 'string') {
									console.log('✨ Setting color:', newValue, 'for category:', category.key);
									appState.updateColorMapping(category.key, newValue);
								} else {
									console.warn('⚠️ Unexpected value type:', newValue);
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
									class="bg-background text-foreground shadow-popover data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 max-h-64 min-w-[140px] overflow-auto rounded-md border border-gray-200 p-1 outline-hidden dark:border-gray-800"
									style="z-index: {Z_INDEX.DROPDOWN};"
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
													<span>{colorOption.label}</span>
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
