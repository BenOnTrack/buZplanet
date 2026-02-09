<script lang="ts">
	import FeaturesDrawer from '$lib/components/drawers/FeaturesDrawer.svelte';
	import StoriesDrawer from '$lib/components/drawers/StoriesDrawer.svelte';
	import TripsDrawer from '$lib/components/drawers/TripsDrawer.svelte';
	import { zIndexClass } from '$lib/styles/z-index.js';
	import PropertyIcon from '../ui/PropertyIcon.svelte';

	// State for tracking which drawer is open (null if none)
	let currentOpenDrawer = $state<string | null>(null);

	// Bindable states for each drawer
	let storiesOpen = $state(false);
	let tripsOpen = $state(false);
	let featuresOpen = $state(false);

	// Keep the drawer states in sync with currentOpenDrawer
	$effect(() => {
		storiesOpen = currentOpenDrawer === 'stories';
		tripsOpen = currentOpenDrawer === 'trips';
		featuresOpen = currentOpenDrawer === 'features';
	});

	// Watch for changes in drawer states (when closed via drawer's close button)
	$effect(() => {
		if (!storiesOpen && currentOpenDrawer === 'stories') {
			currentOpenDrawer = null;
		}
		if (!tripsOpen && currentOpenDrawer === 'trips') {
			currentOpenDrawer = null;
		}
		if (!featuresOpen && currentOpenDrawer === 'features') {
			currentOpenDrawer = null;
		}
	});

	const navigationItems = [
		{
			id: 'stories',
			label: 'Stories',
			icon: 'stories',
			ariaLabel: 'Open stories drawer'
		},
		{
			id: 'trips',
			label: 'Trips',
			icon: 'trips',
			ariaLabel: 'Open trips drawer'
		},
		{
			id: 'features',
			label: 'Features',
			icon: 'features',
			ariaLabel: 'Open features drawer'
		}
	];

	function openDrawer(itemId: string) {
		// If the same drawer is already open, close it
		if (currentOpenDrawer === itemId) {
			currentOpenDrawer = null;
			// Drawer closed
		} else {
			// Close any open drawer and open the new one
			currentOpenDrawer = itemId;
			// Drawer opened
		}
	}

	// Handle keyboard navigation
	function handleKeyDown(event: KeyboardEvent, itemId: string) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			openDrawer(itemId);
		}
	}
</script>

<div class="bottom-nav {zIndexClass('BOTTOM_NAV')}">
	<nav class="flex h-full w-full items-center" aria-label="Main navigation">
		<div class="grid h-full w-full grid-cols-3 gap-0">
			{#each navigationItems as item}
				<button
					type="button"
					class="nav-button text-muted-foreground hover:text-foreground hover:bg-muted/50 focus-visible:ring-accent-foreground focus-visible:ring-offset-background flex h-full flex-col items-center justify-center gap-1 rounded-none border-none bg-transparent px-3 py-2 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2"
					aria-label={item.ariaLabel}
					onclick={() => openDrawer(item.id)}
					onkeydown={(e) => handleKeyDown(e, item.id)}
				>
					<PropertyIcon key={'description'} value={item.icon} size={20} color={'black'} />
					<span class="text-xs font-medium">{item.label}</span>
				</button>
			{/each}
		</div>
	</nav>
</div>

<StoriesDrawer bind:open={storiesOpen} />
<TripsDrawer bind:open={tripsOpen} />
<FeaturesDrawer bind:open={featuresOpen} />

<style>
	.bottom-nav {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: hsl(var(--background) / 0.95);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border-top: 1px solid hsl(var(--border-card));
		box-shadow: var(--shadow-card);
		height: 76px;
		display: flex;
		align-items: center;
		/* Handle safe areas for devices with notches */
		padding-bottom: max(env(safe-area-inset-bottom), 0px);
	}

	.nav-button {
		cursor: pointer;
		outline: none;
		transition: all 0.2s ease;
	}

	.nav-button:focus-visible {
		outline: 2px solid hsl(var(--accent-foreground));
		outline-offset: 2px;
	}

	.nav-button:active {
		transform: scale(0.95);
	}

	/* Drawer styles */
	:global(.drawer-overlay) {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 50;
	}

	:global(.drawer-content) {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 50;
		max-height: 85vh;
		background: hsl(var(--background));
		border-top-left-radius: 12px;
		border-top-right-radius: 12px;
		border: 1px solid hsl(var(--border));
		border-bottom: none;
		box-shadow:
			0 -4px 6px -1px rgba(0, 0, 0, 0.1),
			0 -2px 4px -2px rgba(0, 0, 0, 0.1);
	}

	:global(.drawer-handle) {
		width: 40px;
		height: 4px;
		background: hsl(var(--muted-foreground));
		border-radius: 2px;
		margin: 12px auto 0 auto;
		flex-shrink: 0;
	}

	/* Responsive adjustments */
	@media (max-width: 480px) {
		.bottom-nav {
			height: 72px;
		}

		:global(.drawer-content) {
			max-height: 90vh;
		}
	}
</style>
