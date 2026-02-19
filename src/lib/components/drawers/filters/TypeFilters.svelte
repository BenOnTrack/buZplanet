<script lang="ts">
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';

	let {
		availableTypes,
		selectedTypes = $bindable([]),
		getFilterCount
	}: {
		availableTypes: string[];
		selectedTypes: string[];
		getFilterCount: (
			type: 'type' | 'list' | 'class' | 'subclass' | 'category',
			value: string
		) => number;
	} = $props();

	// Toggle type filter
	function toggleTypeFilter(type: string) {
		if (selectedTypes.includes(type)) {
			selectedTypes = selectedTypes.filter((t) => t !== type);
		} else {
			selectedTypes = [...selectedTypes, type];
		}
	}

	// Get type icon and label
	function getTypeInfo(type: string) {
		switch (type) {
			case 'bookmarked':
				return { iconKey: 'description', iconValue: 'bookmark_true', label: 'Bookmarked' };
			case 'todo':
				return { iconKey: 'description', iconValue: 'todo_true', label: 'Todo' };
			case 'visited':
				return { iconKey: 'description', iconValue: 'visited_true', label: 'Visited' };
			default:
				return { iconKey: 'description', iconValue: 'info', label: 'Unknown' };
		}
	}
</script>

<div class="filter-section">
	<div class="filter-label">Filter by Type:</div>
	<div class="filter-buttons">
		{#each availableTypes as type}
			{@const typeInfo = getTypeInfo(type)}
			{@const count = getFilterCount('type', type)}
			{@const isSelected = selectedTypes.includes(type)}
			<button
				onclick={() => toggleTypeFilter(type)}
				onkeydown={(e) => e.key === 'Enter' && toggleTypeFilter(type)}
				class="filter-button {isSelected ? 'selected' : ''}"
				title="{typeInfo.label} ({count} features)"
				role="checkbox"
				aria-checked={isSelected}
			>
				<PropertyIcon key={typeInfo.iconKey} value={typeInfo.iconValue} size={16} />
				<span class="filter-text">{typeInfo.label}</span>
				<span class="filter-count">{count}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.filter-section {
		margin-bottom: 0.75rem;
	}

	.filter-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: rgb(75 85 99);
		margin-bottom: 0.5rem;
	}

	.filter-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.filter-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		border-radius: 0.5rem;
		border: 1px solid;
		transition: all 0.2s;
		cursor: pointer;
		background: rgb(249 250 251);
		border-color: rgb(229 231 235);
		color: rgb(55 65 81);
	}

	.filter-button:hover {
		background: rgb(243 244 246);
	}

	.filter-button.selected {
		background: rgb(219 234 254);
		border-color: rgb(147 197 253);
		color: rgb(30 58 138);
		box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
	}

	.filter-text {
		font-weight: 500;
	}

	.filter-count {
		font-size: 0.75rem;
		background: rgba(255, 255, 255, 0.7);
		padding: 0.125rem 0.375rem;
		border-radius: 9999px;
	}
</style>
