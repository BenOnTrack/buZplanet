<script lang="ts">
	import '../app.css';
	import './layout.css';
	import { page } from '$app/state';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import favicon from '$lib/assets/favicon.svg';
	import UpdateNotification from '$lib/components/pwa/UpdateNotification.svelte';
	import PWAInstallPrompt from '$lib/components/pwa/PWAInstallPrompt.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{@render children()}

<!-- PWA Components -->
<UpdateNotification />
<PWAInstallPrompt />

<div style="display:none">
	{#each locales as locale}
		<a href={localizeHref(page.url.pathname, { locale })}>
			{locale}
		</a>
	{/each}
</div>
