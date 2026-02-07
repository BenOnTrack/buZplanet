<script lang="ts">
	let {
		availableSubclasses,
		selectedSubclasses = $bindable([]),
		getFilterCount
	}: {
		availableSubclasses: string[];
		selectedSubclasses: string[];
		getFilterCount: (
			type: 'type' | 'list' | 'class' | 'subclass' | 'category',
			value: string
		) => number;
	} = $props();

	// Toggle subclass filter
	function toggleSubclassFilter(subclassName: string) {
		if (selectedSubclasses.includes(subclassName)) {
			selectedSubclasses = selectedSubclasses.filter((s) => s !== subclassName);
		} else {
			selectedSubclasses = [...selectedSubclasses, subclassName];
		}
	}
</script>

<div class="filter-section">
	<div class="filter-label">Filter by Subclass:</div>
	<div class="filter-buttons">
		{#each availableSubclasses as subclassName}
			{@const count = getFilterCount('subclass', subclassName)}
			{@const isSelected = selectedSubclasses.includes(subclassName)}
			<button
				onclick={() => toggleSubclassFilter(subclassName)}
				onkeydown={(e) => e.key === 'Enter' && toggleSubclassFilter(subclassName)}
				class="filter-button {isSelected ? 'selected' : ''}"
				title="{subclassName} ({count} features)"
				role="checkbox"
				aria-checked={isSelected}
			>
				<span class="filter-text">{subclassName}</span>
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
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 6rem;
	}

	.filter-count {
		font-size: 0.75rem;
		background: rgba(255, 255, 255, 0.7);
		padding: 0.125rem 0.375rem;
		border-radius: 9999px;
	}
</style>
