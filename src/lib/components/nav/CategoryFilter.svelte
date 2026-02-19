<script lang="ts">
	import { _CLASS, _SUBCLASS, _CATEGORY } from '$lib/assets/class_subclass_category';

	// Props
	interface Props {
		selectedItems?: {
			classes: Set<string>;
			subclasses: Set<string>;
			categories: Set<string>;
		};
		onSelectionChange?: (selection: {
			classes: Set<string>;
			subclasses: Set<string>;
			categories: Set<string>;
		}) => void;
	}

	let { selectedItems, onSelectionChange }: Props = $props();

	// Internal state - initialize from props if available, otherwise empty
	let selection = $state(
		(() => {
			if (selectedItems) {
				return {
					classes: new Set(selectedItems.classes),
					subclasses: new Set(selectedItems.subclasses),
					categories: new Set(selectedItems.categories)
				};
			}
			return {
				classes: new Set<string>(),
				subclasses: new Set<string>(),
				categories: new Set<string>()
			};
		})()
	);

	// Build hierarchy
	const hierarchy = $derived.by(() => {
		const result: Record<
			string,
			{
				subclasses: Record<string, string[]>;
				allSubclasses: string[];
				allCategories: string[];
			}
		> = {};

		console.log('Available classes:', _CLASS);
		console.log('First 5 subclasses:', _SUBCLASS.slice(0, 5));
		console.log('First 5 categories:', _CATEGORY.slice(0, 5));

		// Initialize classes
		_CLASS.forEach((cls) => {
			result[cls] = {
				subclasses: {},
				allSubclasses: [],
				allCategories: []
			};
		});

		// Group subclasses by class
		let subclassCount = 0;
		_SUBCLASS.forEach((subclass) => {
			const parts = subclass.split('-');
			const cls = parts[0];

			if (result[cls]) {
				result[cls].subclasses[subclass] = [];
				result[cls].allSubclasses.push(subclass);
				subclassCount++;
			} else {
				console.warn(`Class ${cls} not found for subclass ${subclass}`);
			}
		});

		console.log(`Successfully matched ${subclassCount} subclasses`);

		// Group categories by subclass
		_CATEGORY.forEach((category) => {
			const parts = category.split('-');
			if (parts.length >= 3) {
				const cls = parts[0];
				const subclass = `${parts[0]}-${parts[1]}`;

				if (result[cls] && result[cls].subclasses[subclass]) {
					result[cls].subclasses[subclass].push(category);
					result[cls].allCategories.push(category);
				}
			}
		});

		console.log('Built hierarchy:', result);
		console.log('Attraction class data:', result['attraction']);
		return result;
	});

	// Helper functions
	function getClassState(cls: string): 'checked' | 'unchecked' | 'indeterminate' {
		const classData = hierarchy[cls];
		if (!classData || !classData.allSubclasses) return 'unchecked';

		const totalSubclasses = classData.allSubclasses.length;
		if (totalSubclasses === 0) return 'unchecked';

		// Count how many subclasses have ANY selected categories
		let subclassesWithSelections = 0;
		classData.allSubclasses.forEach((subclass) => {
			const categories = classData.subclasses[subclass] || [];
			const hasSelectedCategories = categories.some((cat) => selection.categories.has(cat));
			if (hasSelectedCategories) {
				subclassesWithSelections++;
			}
		});

		console.log(
			`Class ${cls}: ${subclassesWithSelections}/${totalSubclasses} subclasses have selections`
		);

		if (subclassesWithSelections === 0) return 'unchecked';
		if (subclassesWithSelections === totalSubclasses) {
			// Check if ALL categories in ALL subclasses are selected
			const allCategoriesSelected = classData.allCategories.every((cat) =>
				selection.categories.has(cat)
			);
			return allCategoriesSelected ? 'checked' : 'indeterminate';
		}
		return 'indeterminate';
	}

	function getSubclassState(subclass: string): 'checked' | 'unchecked' | 'indeterminate' {
		const [cls] = subclass.split('-');
		const classData = hierarchy[cls];
		if (!classData || !classData.subclasses || !classData.subclasses[subclass]) return 'unchecked';

		const categories = classData.subclasses[subclass];
		if (!categories) return 'unchecked';

		const totalCategories = categories.length;
		if (totalCategories === 0) return 'unchecked';

		const selectedCategories = categories.filter((cat) => selection.categories.has(cat)).length;

		if (selectedCategories === 0) return 'unchecked';
		if (selectedCategories === totalCategories) return 'checked';
		return 'indeterminate';
	}

	function toggleClass(cls: string) {
		const state = getClassState(cls);
		const classData = hierarchy[cls];
		if (!classData || !classData.allSubclasses || !classData.allCategories) return;

		// Create new Sets to avoid mutation issues
		const newClasses = new Set(selection.classes);
		const newSubclasses = new Set(selection.subclasses);
		const newCategories = new Set(selection.categories);

		if (state === 'checked') {
			// Uncheck all
			newClasses.delete(cls);
			classData.allSubclasses.forEach((sub) => newSubclasses.delete(sub));
			classData.allCategories.forEach((cat) => newCategories.delete(cat));
		} else {
			// Check all
			newClasses.add(cls);
			classData.allSubclasses.forEach((sub) => newSubclasses.add(sub));
			classData.allCategories.forEach((cat) => newCategories.add(cat));
		}

		// Update selection with new Sets
		selection = {
			classes: newClasses,
			subclasses: newSubclasses,
			categories: newCategories
		};

		onSelectionChange?.(selection);
	}

	function toggleSubclass(subclass: string) {
		const [cls] = subclass.split('-');
		const state = getSubclassState(subclass);
		const classData = hierarchy[cls];
		if (!classData || !classData.subclasses || !classData.subclasses[subclass]) return;

		const categories = classData.subclasses[subclass];
		if (!categories) return;

		// Create new Sets to avoid mutation issues
		let newClasses = new Set(selection.classes);
		let newSubclasses = new Set(selection.subclasses);
		let newCategories = new Set(selection.categories);

		if (state === 'checked') {
			// Uncheck all categories in this subclass
			newSubclasses.delete(subclass);
			categories.forEach((cat) => newCategories.delete(cat));
		} else {
			// Check all categories in this subclass
			newSubclasses.add(subclass);
			categories.forEach((cat) => newCategories.add(cat));
		}

		// Update selection with new Sets
		selection = {
			classes: newClasses,
			subclasses: newSubclasses,
			categories: newCategories
		};

		// Update class state based on current subclass states
		const updatedClassState = getClassState(cls);
		if (updatedClassState === 'checked') {
			selection.classes.add(cls);
		} else if (updatedClassState === 'unchecked') {
			selection.classes.delete(cls);
		}
		// For indeterminate, we don't add or remove the class

		onSelectionChange?.(selection);
	}

	function toggleCategory(category: string) {
		const parts = category.split('-');
		const cls = parts[0];
		const subclass = `${parts[0]}-${parts[1]}`;

		// Create new Sets to avoid mutation issues
		let newClasses = new Set(selection.classes);
		let newSubclasses = new Set(selection.subclasses);
		let newCategories = new Set(selection.categories);

		if (newCategories.has(category)) {
			newCategories.delete(category);
		} else {
			newCategories.add(category);
		}

		// Update selection with new Sets
		selection = {
			classes: newClasses,
			subclasses: newSubclasses,
			categories: newCategories
		};

		// Update subclass state based on current category states
		const updatedSubclassState = getSubclassState(subclass);
		if (updatedSubclassState === 'checked') {
			selection.subclasses.add(subclass);
		} else if (updatedSubclassState === 'unchecked') {
			selection.subclasses.delete(subclass);
		}
		// For indeterminate, we don't add or remove the subclass

		// Update class state based on current subclass states
		const updatedClassState = getClassState(cls);
		if (updatedClassState === 'checked') {
			selection.classes.add(cls);
		} else if (updatedClassState === 'unchecked') {
			selection.classes.delete(cls);
		}
		// For indeterminate, we don't add or remove the class

		onSelectionChange?.(selection);
	}

	function formatLabel(text: string): string {
		return text
			.split(/[-_]/)
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	// Custom action to set indeterminate state
	function setIndeterminate(node: HTMLInputElement, isIndeterminate: boolean) {
		node.indeterminate = isIndeterminate;

		return {
			update(newIsIndeterminate: boolean) {
				node.indeterminate = newIsIndeterminate;
			}
		};
	}

	// Select/Unselect all functionality
	function selectAll() {
		console.log('Select All clicked');
		selection = {
			classes: new Set(_CLASS),
			subclasses: new Set(_SUBCLASS),
			categories: new Set(_CATEGORY)
		};
		onSelectionChange?.(selection);
	}

	function unselectAll() {
		console.log('Unselect All clicked');
		selection = {
			classes: new Set<string>(),
			subclasses: new Set<string>(),
			categories: new Set<string>()
		};
		onSelectionChange?.(selection);
	}

	// Derived state for select all buttons - removed, buttons always enabled
	// const allSelected = $derived(() => {
	// 	return selection.classes.size === _CLASS.length &&
	// 		   selection.subclasses.size === _SUBCLASS.length &&
	// 		   selection.categories.size === _CATEGORY.length;
	// });

	// const noneSelected = $derived(() => {
	// 	return selection.classes.size === 0 &&
	// 		   selection.subclasses.size === 0 &&
	// 		   selection.categories.size === 0;
	// });
</script>

<div class="space-y-2">
	<!-- Debug info -->
	<div class="text-muted-foreground mb-2 text-xs">
		Classes: {_CLASS.length}, Subclasses: {_SUBCLASS.length}, Categories: {_CATEGORY.length}
	</div>

	<!-- Select/Unselect All buttons - Always enabled -->
	<div class="border-muted mb-4 flex gap-2 border-b pb-2">
		<button
			type="button"
			onclick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				selectAll();
			}}
			class="focus:ring-ring bg-primary text-primary-foreground border-primary hover:bg-primary/90 flex-1 cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
		>
			✓ Select All
		</button>
		<button
			type="button"
			onclick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				unselectAll();
			}}
			class="focus:ring-ring bg-secondary text-secondary-foreground border-secondary hover:bg-secondary/90 flex-1 cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
		>
			✗ Unselect All
		</button>
	</div>

	<!-- Scrollable filter content -->
	<div class="max-h-80 space-y-1 overflow-y-auto">
		{#each _CLASS as cls}
			{@const classState = getClassState(cls)}
			{@const classData = hierarchy[cls]}

			<div class="space-y-1">
				<!-- Class level -->
				<label
					class="hover:bg-muted/50 flex cursor-pointer items-center space-x-2 rounded px-2 py-1 font-semibold"
				>
					<input
						type="checkbox"
						checked={classState === 'checked'}
						use:setIndeterminate={classState === 'indeterminate'}
						onchange={() => toggleClass(cls)}
						class="border-border rounded"
					/>
					<span class="text-sm">{formatLabel(cls)}</span>
					<span class="text-muted-foreground text-xs"
						>({classData?.allSubclasses?.length || 0})</span
					>
				</label>

				<!-- Subclass level -->
				{#if classData?.allSubclasses && classData.allSubclasses.length > 0}
					<div class="ml-4 space-y-1">
						{#each Object.keys(classData.subclasses || {}) as subclass}
							{@const subclassState = getSubclassState(subclass)}
							{@const categories = classData.subclasses[subclass] || []}

							<div class="space-y-1">
								<label
									class="hover:bg-muted/30 flex cursor-pointer items-center space-x-2 rounded px-2 py-0.5 font-medium"
								>
									<input
										type="checkbox"
										checked={subclassState === 'checked'}
										use:setIndeterminate={subclassState === 'indeterminate'}
										onchange={() => toggleSubclass(subclass)}
										class="border-border rounded"
									/>
									<span class="text-xs">{formatLabel(subclass.split('-').slice(1).join('-'))}</span>
									<span class="text-muted-foreground text-xs">({categories.length})</span>
								</label>

								<!-- Category level -->
								{#if categories.length > 0}
									<div class="ml-4 space-y-0.5">
										{#each categories as category}
											<label
												class="hover:bg-muted/20 flex cursor-pointer items-center space-x-2 rounded px-2 py-0.5"
											>
												<input
													type="checkbox"
													checked={selection.categories.has(category)}
													onchange={() => toggleCategory(category)}
													class="border-border rounded"
												/>
												<span class="text-muted-foreground text-xs">
													{formatLabel(category.split('-').slice(2).join('-'))}
												</span>
											</label>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	input[type='checkbox']:indeterminate {
		opacity: 0.6;
	}
</style>
