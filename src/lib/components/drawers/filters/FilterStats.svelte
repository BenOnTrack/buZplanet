<script lang="ts">
	let {
		features,
		hasActiveFilters,
		clearAllFilters,
		showStats = true,
		showClearAllButton = true
	}: {
		features: StoredFeature[];
		hasActiveFilters: boolean;
		clearAllFilters: () => void;
		showStats?: boolean;
		showClearAllButton?: boolean;
	} = $props();

	// Calculate statistics
	let stats = $derived.by(() => {
		const bookmarked = features.filter((f) => f.bookmarked).length;
		const todo = features.filter((f) => f.todo).length;
		const visited = features.filter((f) => f.visitedDates && f.visitedDates.length > 0).length;
		const total = features.length;

		return { bookmarked, todo, visited, total };
	});
</script>

{#if showStats || (showClearAllButton && hasActiveFilters)}
	<div class="stats-section">
		{#if showStats}
			<div class="stats-grid">
				<div class="stat-item">
					<span class="stat-icon">📍</span>
					<div class="stat-content">
						<div class="stat-number">{stats.total}</div>
						<div class="stat-label">Total</div>
					</div>
				</div>
				<div class="stat-item">
					<span class="stat-icon">⭐</span>
					<div class="stat-content">
						<div class="stat-number">{stats.bookmarked}</div>
						<div class="stat-label">Bookmarked</div>
					</div>
				</div>
				<div class="stat-item">
					<span class="stat-icon">✅</span>
					<div class="stat-content">
						<div class="stat-number">{stats.todo}</div>
						<div class="stat-label">Todo</div>
					</div>
				</div>
				<div class="stat-item">
					<span class="stat-icon">📍</span>
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
		padding: 1rem;
		background: rgb(249 250 251);
		border-radius: 0.5rem;
		margin-bottom: 1rem;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
		margin-bottom: 1rem;
	}

	@media (min-width: 640px) {
		.stats-grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	.stat-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-align: left;
	}

	.stat-icon {
		font-size: 1.25rem;
	}

	.stat-content {
		min-width: 0;
	}

	.stat-number {
		font-size: 1.125rem;
		font-weight: 600;
		color: rgb(17 24 39);
		line-height: 1.2;
	}

	.stat-label {
		font-size: 0.75rem;
		color: rgb(107 114 128);
		line-height: 1.2;
	}

	.clear-section {
		border-top: 1px solid rgb(229 231 235);
		padding-top: 1rem;
		text-align: center;
	}

	.clear-all-button {
		font-size: 0.875rem;
		color: rgb(37 99 235);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
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
