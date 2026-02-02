<script lang="ts">
	import { Tabs } from "bits-ui";
	
	let activeTab = $state('stories');
	
	const navigationItems = [
		{ 
			id: 'stories', 
			label: 'Stories', 
			icon: '📚',
			ariaLabel: 'View stories section'
		},
		{ 
			id: 'trips', 
			label: 'Trips', 
			icon: '🗺️',
			ariaLabel: 'View trips section'
		},
		{ 
			id: 'features', 
			label: 'Features', 
			icon: '⭐',
			ariaLabel: 'View features section'
		}
	];

	function handleTabChange(value: string) {
		activeTab = value;
		// Here you can add navigation logic or state updates
		console.log('Active tab:', value);
		// You can dispatch custom events or call navigation functions here
	}

	// Handle keyboard navigation
	function handleKeyDown(event: KeyboardEvent, itemId: string) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			activeTab = itemId;
			handleTabChange(itemId);
		}
	}
</script>

<div class="bottom-nav">
	<Tabs.Root 
		value={activeTab} 
		class="w-full h-full flex items-center"
		onValueChange={handleTabChange}
	>
		<Tabs.List class="grid w-full grid-cols-3 gap-0 h-full">
			{#each navigationItems as item}
				<Tabs.Trigger 
					value={item.id}
					class="flex flex-col items-center justify-center gap-1 h-full py-2 px-3 bg-transparent border-none text-muted-foreground transition-all duration-200 hover:text-foreground hover:bg-muted/50 data-[state=active]:text-accent-foreground data-[state=active]:bg-accent/10 rounded-none focus-visible:ring-2 focus-visible:ring-accent-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
					aria-label={item.ariaLabel}
					onkeydown={(e) => handleKeyDown(e, item.id)}
				>
					<span class="text-xl" aria-hidden="true">{item.icon}</span>
					<span class="text-xs font-medium">{item.label}</span>
				</Tabs.Trigger>
			{/each}
		</Tabs.List>
	</Tabs.Root>
</div>

<style>
	.bottom-nav {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 1000;
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

	/* Responsive adjustments */
	@media (max-width: 480px) {
		.bottom-nav {
			height: 72px;
		}
	}
</style>