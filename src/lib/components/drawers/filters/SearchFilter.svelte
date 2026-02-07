<script lang="ts">
	let {
		searchQuery = $bindable('')
	}: {
		searchQuery: string;
	} = $props();

	function clearSearch() {
		searchQuery = '';
	}
</script>

<div class="search-section">
	<label for="feature-search" class="search-label">Search Features:</label>
	<div class="search-container">
		<input
			id="feature-search"
			bind:value={searchQuery}
			type="text"
			placeholder="Search features by name, class, category, or list..."
			class="search-input"
		/>
		<div class="search-icon" aria-hidden="true">🔍</div>
		{#if searchQuery}
			<button
				onclick={clearSearch}
				onkeydown={(e) => e.key === 'Enter' && clearSearch()}
				class="clear-button"
				type="button"
				aria-label="Clear search"
			>
				<span aria-hidden="true">✕</span>
			</button>
		{/if}
	</div>
</div>

<style>
	.search-section {
		margin-bottom: 1rem;
	}

	.search-label {
		display: block;
		font-size: 0.75rem;
		font-weight: 500;
		color: rgb(75 85 99);
		margin-bottom: 0.5rem;
	}

	.search-container {
		position: relative;
	}

	.search-input {
		width: 100%;
		padding: 0.5rem 2.5rem 0.5rem 2.5rem;
		font-size: 0.875rem;
		border: 1px solid rgb(209 213 219);
		border-radius: 0.5rem;
		background: white;
		transition: all 0.2s;
	}

	.search-input:focus {
		outline: none;
		border-color: rgb(59 130 246);
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.search-icon {
		position: absolute;
		left: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		color: rgb(156 163 175);
		pointer-events: none;
	}

	.clear-button {
		position: absolute;
		right: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		color: rgb(156 163 175);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 0.25rem;
		transition: color 0.2s;
	}

	.clear-button:hover {
		color: rgb(75 85 99);
	}

	.clear-button:focus {
		outline: 2px solid rgb(59 130 246);
		outline-offset: 2px;
	}
</style>
