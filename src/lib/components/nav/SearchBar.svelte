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
		// Hide keyboard on mobile after search
		inputElement?.blur();
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
		} else if (event.key === 'Enter') {
			// Blur input on Enter to hide mobile keyboard
			setTimeout(() => {
				inputElement?.blur();
			}, 100);
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
		min-width: 0; /* Prevents flex overflow */
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
		border-radius: 20px;
		padding: 0 14px;
		transition: all 0.2s ease;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		min-width: 0; /* Prevents overflow */
		overflow: hidden; /* Ensures content doesn't overflow */
	}

	.search-container.active .search-input-wrapper {
		border-color: #3b82f6;
		box-shadow:
			0 4px 12px rgba(59, 130, 246, 0.15),
			0 0 0 3px rgba(59, 130, 246, 0.1);
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
		padding: 10px 0;
		font-size: 16px;
		color: #1e293b;
		background: transparent;
		font-family: inherit;
		min-width: 0; /* Prevents text overflow */
		width: 100%; /* Ensures proper sizing */
	}

	/* Remove focus outline from input */
	.search-input:focus {
		outline: none;
		border: none;
		box-shadow: none;
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
		outline: none; /* Remove focus outline */
	}

	.clear-button:focus {
		outline: none;
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3); /* Custom focus ring */
		border-radius: 50%;
	}

	.clear-button:hover {
		background: #e2e8f0;
		color: #475569;
	}

	/* Tablet responsiveness */
	@media (max-width: 768px) {
		.search-container {
			max-width: 350px;
		}
	}

	/* Mobile responsiveness */
	@media (max-width: 640px) {
		.search-container {
			max-width: 280px;
			min-width: 200px; /* Minimum usable width */
		}

		.search-input-wrapper {
			border-radius: 16px;
			padding: 0 12px;
		}

		.search-input {
			font-size: 16px; /* Prevents zoom on iOS */
			padding: 8px 0;
		}

		.search-icon {
			margin-right: 8px;
		}

		.clear-button {
			width: 20px;
			height: 20px;
			margin-left: 6px;
		}
	}

	/* Small mobile phones */
	@media (max-width: 480px) {
		.search-container {
			max-width: 240px;
		}
	}

	/* Extra small screens */
	@media (max-width: 360px) {
		.search-container {
			max-width: 200px;
		}

		.search-input-wrapper {
			padding: 0 10px;
		}

		.search-icon {
			margin-right: 6px;
		}

		.clear-button {
			margin-left: 4px;
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
			box-shadow:
				0 4px 12px rgba(59, 130, 246, 0.15),
				0 0 0 3px rgba(59, 130, 246, 0.1);
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

		.clear-button:focus {
			box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.4);
		}
	}
</style>
