<script lang="ts">
	import MapView from '$lib/components/MapView.svelte';
	import BottomNavigation from '$lib/components/BottomNavigation.svelte';
	import CircularDialog from '$lib/components/CircularDialog.svelte';
</script>

<main class="app-container">
	<CircularDialog />
	<MapView />
	<BottomNavigation />
</main>

<style>
	.app-container {
		position: relative;
		width: 100%;
		height: 100vh;
		height: 100dvh;
		overflow: hidden;
	}
</style>
