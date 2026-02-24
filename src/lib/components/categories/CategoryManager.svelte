<script lang="ts">
	import { clsx } from 'clsx';
	import { _CATEGORY } from '$lib/assets/class_subclass_category';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import { appState } from '$lib/stores/AppState.svelte';
	import { COLORS } from '$lib/constants';

	let {
		selectedCategories = $bindable([]),
		onChange = undefined,
		title = 'Select Categories',
		showGroups = true,
		class: className = ''
	}: {
		selectedCategories?: string[];
		onChange?: (categories: string[]) => void;
		title?: string;
		showGroups?: boolean;
		class?: string;
	} = $props();

	// Group categories by class and subclass for hierarchical organization
	let categoryHierarchy = $derived.by(() => {
		const hierarchy: Record<string, Record<string, string[]>> = {};

		_CATEGORY.forEach((category) => {
			const parts = category.split('-');
			const className = parts[0];
			const subClassName = parts[1];
			const categoryName = parts[2];

			if (!hierarchy[className]) {
				hierarchy[className] = {};
			}
			if (!hierarchy[className][subClassName]) {
				hierarchy[className][subClassName] = [];
			}
			hierarchy[className][subClassName].push(category);
		});

		return hierarchy;
	});

	// Get category display name (just the final part)
	function getCategoryDisplayName(category: string): string {
		const parts = category.split('-');
		return parts[parts.length - 1].replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
	}

	// Get subclass display name
	function getSubclassDisplayName(subclass: string): string {
		return subclass.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
	}

	// Get class display name
	function getClassDisplayName(className: string): string {
		return className.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
	}

	// Get category class for color coding
	function getCategoryClass(category: string): string {
		return category.split('-')[0];
	}

	// Get the actual category name (3rd part) for PropertyIcon
	function getCategoryName(category: string): string {
		const parts = category.split('-');
		return parts[2] || parts[parts.length - 1]; // fallback to last part
	}

	// Get the class name (1st part) for PropertyIcon
	function getClassName(category: string): string {
		return category.split('-')[0];
	}

	// Get the subclass name (2nd part) for PropertyIcon
	function getSubclassName(category: string): string {
		return category.split('-')[1];
	}

	// Toggle individual category
	function toggleCategory(category: string) {
		if (selectedCategories.includes(category)) {
			selectedCategories = selectedCategories.filter((c) => c !== category);
		} else {
			selectedCategories = [...selectedCategories, category];
		}

		if (onChange) {
			onChange(selectedCategories);
		}
	}

	// Toggle all categories in a class
	function toggleClass(className: string) {
		const classCategories = Object.values(categoryHierarchy[className]).flat();
		const allSelected = classCategories.every((cat) => selectedCategories.includes(cat));

		if (allSelected) {
			// Remove all categories in this class
			selectedCategories = selectedCategories.filter((cat) => !classCategories.includes(cat));
		} else {
			// Add all categories in this class
			const newCategories = [...selectedCategories];
			classCategories.forEach((cat) => {
				if (!newCategories.includes(cat)) {
					newCategories.push(cat);
				}
			});
			selectedCategories = newCategories;
		}

		if (onChange) {
			onChange(selectedCategories);
		}
	}

	// Toggle all categories in a subclass
	function toggleSubclass(className: string, subClassName: string) {
		const subclassCategories = categoryHierarchy[className][subClassName];
		const allSelected = subclassCategories.every((cat) => selectedCategories.includes(cat));

		if (allSelected) {
			// Remove all categories in this subclass
			selectedCategories = selectedCategories.filter((cat) => !subclassCategories.includes(cat));
		} else {
			// Add all categories in this subclass
			const newCategories = [...selectedCategories];
			subclassCategories.forEach((cat) => {
				if (!newCategories.includes(cat)) {
					newCategories.push(cat);
				}
			});
			selectedCategories = newCategories;
		}

		if (onChange) {
			onChange(selectedCategories);
		}
	}

	// Check if all categories in a class are selected
	function isClassSelected(className: string): boolean {
		const classCategories = Object.values(categoryHierarchy[className]).flat();
		return classCategories.every((cat) => selectedCategories.includes(cat));
	}

	// Check if some categories in a class are selected
	function isClassPartiallySelected(className: string): boolean {
		const classCategories = Object.values(categoryHierarchy[className]).flat();
		const selectedInClass = classCategories.filter((cat) => selectedCategories.includes(cat));
		return selectedInClass.length > 0 && selectedInClass.length < classCategories.length;
	}

	// Check if all categories in a subclass are selected
	function isSubclassSelected(className: string, subClassName: string): boolean {
		const subclassCategories = categoryHierarchy[className][subClassName];
		return subclassCategories.every((cat) => selectedCategories.includes(cat));
	}

	// Check if some categories in a subclass are selected
	function isSubclassPartiallySelected(className: string, subClassName: string): boolean {
		const subclassCategories = categoryHierarchy[className][subClassName];
		const selectedInSubclass = subclassCategories.filter((cat) => selectedCategories.includes(cat));
		return selectedInSubclass.length > 0 && selectedInSubclass.length < subclassCategories.length;
	}

	// Get dynamic colors based on user settings from AppState
	function getClassStyles(className: string, isSelected: boolean = false): string {
		if (!appState.initialized) {
			return isSelected
				? 'background-color: #374151; color: white; border-color: #6b7280;'
				: 'background-color: white; color: #374151; border-color: #d1d5db;';
		}

		const colorName =
			appState.colorMappings[className as keyof typeof appState.colorMappings] || 'gray';
		const colorShades = COLORS[colorName as keyof typeof COLORS];

		if (!colorShades) {
			return isSelected
				? 'background-color: #374151; color: white; border-color: #6b7280;'
				: 'background-color: white; color: #374151; border-color: #d1d5db;';
		}

		// Class uses 800 level (darkest) when selected, white when unselected
		if (isSelected) {
			return `background-color: ${colorShades[800]}; color: white; border-color: ${colorShades[600]};`;
		} else {
			return `background-color: white; color: ${colorShades[800]}; border-color: ${colorShades[400]};`;
		}
	}

	function getSubclassStyles(className: string, isSelected: boolean = false): string {
		if (!appState.initialized) {
			return isSelected
				? 'background-color: #6b7280; color: white; border-color: #9ca3af;'
				: 'background-color: white; color: #374151; border-color: #d1d5db;';
		}

		const colorName =
			appState.colorMappings[className as keyof typeof appState.colorMappings] || 'gray';
		const colorShades = COLORS[colorName as keyof typeof COLORS];

		if (!colorShades) {
			return isSelected
				? 'background-color: #6b7280; color: white; border-color: #9ca3af;'
				: 'background-color: white; color: #374151; border-color: #d1d5db;';
		}

		// Subclass uses 600 level (medium) when selected, white when unselected
		if (isSelected) {
			return `background-color: ${colorShades[600]}; color: white; border-color: ${colorShades[400]};`;
		} else {
			return `background-color: white; color: ${colorShades[600]}; border-color: ${colorShades[400]};`;
		}
	}

	function getCategoryStyles(className: string, isSelected: boolean = false): string {
		if (!appState.initialized) {
			return isSelected
				? 'background-color: #93c5fd; color: #1e3a8a; border-color: #3b82f6;'
				: 'background-color: white; color: #374151; border-color: #d1d5db;';
		}

		const colorName =
			appState.colorMappings[className as keyof typeof appState.colorMappings] || 'gray';
		const colorShades = COLORS[colorName as keyof typeof COLORS];

		if (!colorShades) {
			return isSelected
				? 'background-color: #93c5fd; color: #1e3a8a; border-color: #3b82f6;'
				: 'background-color: white; color: #374151; border-color: #d1d5db;';
		}

		// Category uses 400 level when selected, white when unselected
		if (isSelected) {
			return `background-color: ${colorShades[400]}; color: ${colorShades[800]}; border-color: ${colorShades[600]};`;
		} else {
			return `background-color: white; color: ${colorShades[600]}; border-color: ${colorShades[400]};`;
		}
	}
</script>

<div class={clsx('simple-category-manager', className)}>
	<!-- Categories - Scrollable content -->
	<div class="overflow-y-auto">
		{#if showGroups}
			<!-- Hierarchical view: Class > Subclass > Categories -->
			<div class="space-y-6">
				{#each Object.entries(categoryHierarchy) as [className, subclasses]}
					<fieldset class="rounded-lg border border-gray-200 p-4">
						<legend class="px-2">
							<button
								type="button"
								class="inline-flex items-center gap-2 rounded-md border px-3 py-1 text-sm font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
								style={getClassStyles(className, isClassSelected(className))}
								onclick={() => toggleClass(className)}
								aria-pressed={isClassSelected(className)}
								title="Toggle all {getClassDisplayName(className)} categories"
							>
								{#if isClassSelected(className)}
									<PropertyIcon key="description" value="check" size={14} />
								{:else if isClassPartiallySelected(className)}
									<PropertyIcon key="description" value="minus" size={14} />
								{:else}
									<PropertyIcon key="description" value="plus" size={14} />
								{/if}
								<PropertyIcon key="class" value={className} size={14} />
								{getClassDisplayName(className)}
								<span class="text-xs opacity-75">
									({Object.values(subclasses)
										.flat()
										.filter((cat) => selectedCategories.includes(cat)).length}/{Object.values(
										subclasses
									).flat().length})
								</span>
							</button>
						</legend>

						<div class="mt-3 space-y-4">
							{#each Object.entries(subclasses) as [subClassName, categories]}
								<div class="border-l-2 border-gray-200 pl-4">
									<!-- Subclass header -->
									<div class="mb-2">
										<button
											type="button"
											class="inline-flex items-center gap-2 rounded border px-2 py-1 text-xs font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
											style={getSubclassStyles(
												className,
												isSubclassSelected(className, subClassName)
											)}
											onclick={() => toggleSubclass(className, subClassName)}
											aria-pressed={isSubclassSelected(className, subClassName)}
											title="Toggle all {getSubclassDisplayName(subClassName)} categories"
										>
											{#if isSubclassSelected(className, subClassName)}
												<PropertyIcon key="description" value="check" size={12} />
											{:else if isSubclassPartiallySelected(className, subClassName)}
												<PropertyIcon key="description" value="minus" size={12} />
											{:else}
												<PropertyIcon key="description" value="plus" size={12} />
											{/if}
											<PropertyIcon key="subclass" value={subClassName} size={12} />
											{getSubclassDisplayName(subClassName)}
											<span class="text-xs opacity-75">
												({categories.filter((cat) => selectedCategories.includes(cat))
													.length}/{categories.length})
											</span>
										</button>
									</div>

									<!-- Categories in this subclass -->
									<div class="flex flex-wrap gap-1">
										{#each categories as category}
											<label class="inline-flex cursor-pointer items-center">
												<input
													type="checkbox"
													class="sr-only"
													checked={selectedCategories.includes(category)}
													onchange={() => toggleCategory(category)}
												/>
												<span
													class="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition-colors focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2"
													style={getCategoryStyles(
														className,
														selectedCategories.includes(category)
													)}
													title="{category}: {getCategoryDisplayName(category)}"
												>
													<PropertyIcon
														key="category"
														value={getCategoryName(category)}
														size={12}
													/>
													{getCategoryDisplayName(category)}
												</span>
											</label>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					</fieldset>
				{/each}
			</div>
		{:else}
			<!-- Flat list -->
			<div class="flex flex-wrap gap-2">
				{#each _CATEGORY as category}
					<label class="inline-flex cursor-pointer items-center">
						<input
							type="checkbox"
							class="sr-only"
							checked={selectedCategories.includes(category)}
							onchange={() => toggleCategory(category)}
						/>
						<span
							class="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition-colors focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2"
							style={getCategoryStyles(
								category.split('-')[0],
								selectedCategories.includes(category)
							)}
							title={category}
						>
							<PropertyIcon key="category" value={getCategoryName(category)} size={12} />
							<span class="mr-1 text-xs opacity-60">
								{getClassDisplayName(category.split('-')[0])} › {getSubclassDisplayName(
									category.split('-')[1]
								)} ›
							</span>
							{getCategoryDisplayName(category)}
						</span>
					</label>
				{/each}
			</div>
		{/if}
	</div>
</div>
