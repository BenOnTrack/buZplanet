<script lang="ts">
	import { formatFeatureProperty } from '$lib/utils/text-formatting.js';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';

	let {
		filters = [],
		expanded = $bindable(false),
		hasActiveFilters = false,
		onToggleFilter,
		onClearSearch,
		onClearAll,
		onSearchChange
	}: {
		filters: FilterGroup[];
		expanded?: boolean;
		hasActiveFilters?: boolean;
		onToggleFilter: (type: string, value: string) => void;
		onClearSearch: (type: string) => void;
		onClearAll: () => void;
		onSearchChange: (type: string, value: string) => void;
	} = $props();

	function toggleExpanded() {
		expanded = !expanded;
	}

	function handleToggleFilter(type: string, value: string) {
		onToggleFilter(type, value);
	}

	function handleClearSearch(type: string) {
		onClearSearch(type);
	}

	function handleSearchInput(type: string, event: Event) {
		const input = event.target as HTMLInputElement;
		onSearchChange(type, input.value);
	}

	function getTypeInfo(type: string) {
		switch (type) {
			case 'bookmarked':
				return { label: 'Bookmarked' };
			case 'todo':
				return { label: 'Todo' };
			case 'visited':
				return { label: 'Visited' };
			case 'none':
				return { label: 'None' };
			default:
				return { label: 'Unknown' };
		}
	}
</script>

<div class="mb-4 rounded-lg border border-gray-200 bg-gray-50">
	<!-- Filters Header -->
	<div class="flex items-center justify-between p-3">
		<button
			onclick={toggleExpanded}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					toggleExpanded();
				}
			}}
			class="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
			tabindex="0"
			aria-expanded={expanded}
			aria-controls="filters-content"
		>
			<span class="text-base">🔧</span>
			<span class="font-medium text-gray-900">Filters</span>
			{#if hasActiveFilters}
				<span class="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">Active</span>
			{/if}
			<span
				class="ml-1 text-gray-400 transition-transform duration-200 {expanded ? 'rotate-180' : ''}"
			>
				▼
			</span>
		</button>

		{#if hasActiveFilters}
			<button
				onclick={onClearAll}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						onClearAll();
					}
				}}
				class="rounded px-2 py-1 text-xs text-blue-600 hover:text-blue-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				tabindex="0"
				title="Clear all filters"
			>
				Clear all
			</button>
		{/if}
	</div>

	<!-- Filters Content -->
	{#if expanded}
		<div id="filters-content" class="space-y-3 px-3 pb-3">
			{#each filters as filterGroup}
				{#if filterGroup.type === 'search'}
					<!-- Search Filter -->
					<div>
						<label
							for="{filterGroup.type}-search-input"
							class="mb-2 block text-xs font-medium text-gray-600"
						>
							{filterGroup.label}:
						</label>
						<div class="relative">
							<input
								id="{filterGroup.type}-search-input"
								value={filterGroup.searchValue || ''}
								oninput={(e) => handleSearchInput(filterGroup.type, e)}
								type="text"
								placeholder={filterGroup.placeholder || 'Search...'}
								class="w-full rounded-lg border border-gray-300 bg-white py-2 pr-4 pl-10 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
							/>
							<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
								<span class="text-gray-400">🔍</span>
							</div>
							{#if filterGroup.searchValue}
								<button
									onclick={() => handleClearSearch(filterGroup.type)}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											handleClearSearch(filterGroup.type);
										}
									}}
									class="absolute inset-y-0 right-0 flex items-center rounded pr-3 text-gray-400 hover:text-gray-600 focus:ring-1 focus:ring-blue-500 focus:outline-none"
									tabindex="0"
									title="Clear search"
								>
									<span class="text-sm">✕</span>
								</button>
							{/if}
						</div>
					</div>
				{:else if filterGroup.options && filterGroup.options.length > 0}
					<!-- Filter Options -->
					<div>
						<div class="mb-2 text-xs font-medium text-gray-600">{filterGroup.label}:</div>
						<div class="flex flex-wrap gap-2">
							{#each filterGroup.options as option}
								{@const isSelected = filterGroup.selectedValues?.includes(option.value) || false}
								<button
									onclick={() => handleToggleFilter(filterGroup.type, option.value)}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											handleToggleFilter(filterGroup.type, option.value);
										}
									}}
									class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none {isSelected
										? 'border-blue-300 bg-blue-100 text-blue-800 shadow-sm'
										: 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'}"
									title="{option.label ||
										formatFeatureProperty(option.value)} ({option.count} items)"
									tabindex="0"
								>
									{#if filterGroup.type === 'type'}
										<PropertyIcon key={'type'} value={option.value} size={20} color={'black'} />
										<span class="font-medium">{getTypeInfo(option.value).label}</span>
									{:else if filterGroup.type === 'list'}
										<div
											class="h-3 w-3 rounded-full border shadow-sm"
											style="background-color: {option.color || '#6b7280'}"
										></div>
										<span class="max-w-24 truncate font-medium">
											{option.label || option.value}
										</span>
									{:else if filterGroup.type === 'class'}
										<PropertyIcon key={'class'} value={option.value} size={20} color={'black'} />
										<span class="max-w-20 truncate font-medium">
											{formatFeatureProperty(option.value)}
										</span>
									{:else if filterGroup.type === 'subclass'}
										<PropertyIcon key={'subclass'} value={option.value} size={20} color={'black'} />
										<span class="max-w-20 truncate font-medium">
											{formatFeatureProperty(option.value)}
										</span>
									{:else if filterGroup.type === 'category'}
										<PropertyIcon key={'category'} value={option.value} size={20} color={'black'} />
										<span class="max-w-20 truncate font-medium">
											{formatFeatureProperty(option.value)}
										</span>
									{:else}
										<span class="max-w-20 truncate font-medium">
											{option.label || option.value}
										</span>
									{/if}
									<span class="bg-opacity-70 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs">
										{option.count}
									</span>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>
