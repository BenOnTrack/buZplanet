<script lang="ts">
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';

	let {
		features,
		hasActiveFilters,
		clearAllFilters,
		showStats = true,
		showClearAllButton = true
	}: {
		features: (StoredFeature | TableFeature)[];
		hasActiveFilters: boolean;
		clearAllFilters: () => void;
		showStats?: boolean;
		showClearAllButton?: boolean;
	} = $props();

	// Check if a feature is a StoredFeature
	function isStoredFeature(feature: StoredFeature | TableFeature): feature is StoredFeature {
		return 'bookmarked' in feature && 'todo' in feature && 'visitedDates' in feature;
	}

	// Check if a feature is a TableFeature (enhanced search result)
	function isTableFeature(feature: StoredFeature | TableFeature): feature is TableFeature {
		return 'types' in feature && 'lists' in feature;
	}

	// Calculate statistics
	let stats = $derived.by(() => {
		let bookmarked = 0;
		let todo = 0;
		let visited = 0;
		const total = features.length;

		features.forEach((feature) => {
			if (isStoredFeature(feature)) {
				// Handle StoredFeature
				if (feature.bookmarked) bookmarked++;
				if (feature.todo) todo++;
				if (feature.visitedDates && feature.visitedDates.length > 0) visited++;
			} else if (isTableFeature(feature)) {
				// Handle TableFeature (enhanced search result)
				if (feature.types) {
					if (feature.types.includes('bookmarked')) bookmarked++;
					if (feature.types.includes('todo')) todo++;
					if (feature.types.includes('visited')) visited++;
				}
			}
		});

		return { bookmarked, todo, visited, total };
	});
</script>

{#if showStats || (showClearAllButton && hasActiveFilters)}
	<div class="stats-section">
		{#if showStats}
			<div class="stats-grid">
				<div class="stat-item">
					<PropertyIcon key="description" value="features" size={16} class="text-black-600" />
					<div class="stat-content">
						<div class="stat-number">{stats.total}</div>
						<div class="stat-label">Total</div>
					</div>
				</div>
				<div class="stat-item">
					<PropertyIcon key="description" value="bookmark_true" size={16} class="text-blue-600" />
					<div class="stat-content">
						<div class="stat-number">{stats.bookmarked}</div>
						<div class="stat-label">Bookmarked</div>
					</div>
				</div>
				<div class="stat-item">
					<PropertyIcon key="description" value="todo_true" size={16} class="text-red-600" />
					<div class="stat-content">
						<div class="stat-number">{stats.todo}</div>
						<div class="stat-label">Todo</div>
					</div>
				</div>
				<div class="stat-item">
					<PropertyIcon key="description" value="visited_true" size={16} class="text-green-600" />
					<div class="stat-content">
						<div class="stat-number">{stats.visited}</div>
						<div class="stat-label">Visited</div>
					</div>
				</div>
			</div>
		{/if}

		{#if showClearAllButton && hasActiveFilters}
			<div class="clear-section">
				<button
					onclick={clearAllFilters}
					onkeydown={(e) => e.key === 'Enter' && clearAllFilters()}
					class="clear-all-button"
					type="button"
				>
					Clear all filters
				</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.stats-section {
		padding: 0.75rem;
		background: rgb(249 250 251);
		border-radius: 0.375rem;
		margin-bottom: 0.75rem;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	@media (max-width: 480px) {
		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 0.75rem;
		}
	}

	.stat-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		text-align: left;
	}

	.stat-content {
		min-width: 0;
	}

	.stat-number {
		font-size: 0.875rem;
		font-weight: 600;
		color: rgb(17 24 39);
		line-height: 1.2;
	}

	.stat-label {
		font-size: 0.625rem;
		color: rgb(107 114 128);
		line-height: 1.2;
	}

	.clear-section {
		border-top: 1px solid rgb(229 231 235);
		padding-top: 0.75rem;
		text-align: center;
	}

	.clear-all-button {
		font-size: 0.75rem;
		color: rgb(37 99 235);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.375rem 0.75rem;
		border-radius: 0.25rem;
		transition: all 0.2s;
	}

	.clear-all-button:hover {
		color: rgb(29 78 216);
		background: rgb(239 246 255);
	}

	.clear-all-button:focus {
		outline: 2px solid rgb(59 130 246);
		outline-offset: 2px;
	}
</style>
