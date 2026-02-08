<script lang="ts">
	import { MagnifyingGlass, X } from 'phosphor-svelte';

	// Props
	let {
		placeholder = 'Search places...',
		value = $bindable(''),
		onSearch = undefined as ((query: string) => void) | undefined,
		onClear = undefined as (() => void) | undefined,
		class: className = ''
	} = $props();

	// Local state
	let isActive = $state(false);
	let inputElement: HTMLInputElement;

	// Handlers
	function handleSubmit(event: Event) {
		event.preventDefault();
		if (value.trim() && onSearch) {
			onSearch(value.trim());
		}
	}

	function handleClear() {
		value = '';
		if (onClear) {
			onClear();
		}
		inputElement?.focus();
	}

	function handleFocus() {
		isActive = true;
	}

	function handleBlur() {
		isActive = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			handleClear();
			inputElement?.blur();
		}
	}
</script>

<div class="search-container {className}" class:active={isActive}>
	<form onsubmit={handleSubmit} class="search-form">
		<div class="search-input-wrapper">
			<MagnifyingGlass class="search-icon" size={18} />
			<input
				bind:this={inputElement}
				bind:value
				{placeholder}
				type="text"
				class="search-input"
				onfocus={handleFocus}
				onblur={handleBlur}
				onkeydown={handleKeydown}
				aria-label="Search for places"
			/>
			{#if value}
				<button
					type="button"
					class="clear-button"
					onclick={handleClear}
					onkeydown={(e) => e.key === 'Enter' && handleClear()}
					aria-label="Clear search"
				>
					<X size={16} />
				</button>
			{/if}
		</div>
	</form>
</div>

<style>
	.search-container {
		position: relative;
		width: 100%;
		max-width: 400px;
		transition: all 0.2s ease;
	}

	.search-form {
		width: 100%;
	}

	.search-input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		background: white;
		border: 2px solid #e2e8f0;
		border-radius: 24px;
		padding: 0 16px;
		transition: all 0.2s ease;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.search-container.active .search-input-wrapper {
		border-color: #3b82f6;
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
	}

	.search-icon {
		color: #64748b;
		margin-right: 12px;
		flex-shrink: 0;
		transition: color 0.2s ease;
	}

	.search-container.active :global(.search-icon) {
		color: #3b82f6;
	}

	.search-input {
		flex: 1;
		border: none;
		outline: none;
		padding: 12px 0;
		font-size: 16px;
		color: #1e293b;
		background: transparent;
		font-family: inherit;
	}

	.search-input::placeholder {
		color: #94a3b8;
	}

	.clear-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		margin-left: 8px;
		background: #f1f5f9;
		border: none;
		border-radius: 50%;
		color: #64748b;
		cursor: pointer;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.clear-button:hover {
		background: #e2e8f0;
		color: #475569;
	}

	/* Mobile responsiveness */
	@media (max-width: 640px) {
		.search-container {
			max-width: calc(100% - 32px);
		}

		.search-input {
			font-size: 16px; /* Prevents zoom on iOS */
		}
	}

	/* Dark theme support */
	@media (prefers-color-scheme: dark) {
		.search-input-wrapper {
			background: #1e293b;
			border-color: #334155;
		}

		.search-container.active .search-input-wrapper {
			border-color: #3b82f6;
		}

		.search-input {
			color: #f1f5f9;
		}

		.search-input::placeholder {
			color: #64748b;
		}

		.clear-button {
			background: #334155;
			color: #94a3b8;
		}

		.clear-button:hover {
			background: #475569;
			color: #cbd5e1;
		}
	}
</style>
