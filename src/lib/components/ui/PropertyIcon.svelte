<!-- PropertyIcon.svelte -->
<script lang="ts">
	import { categoryIcons } from '$lib/assets/categoryIcons';
	import { classIcons } from '$lib/assets/classIcons';
	import { descriptionIcons } from '$lib/assets/descriptionIcons';
	import { subclassIcons } from '$lib/assets/subclassIcons';
	import { icons } from '$lib/assets/icons';
	import { tagIcons } from '$lib/assets/tagIcons';
	import { typeIcons } from '$lib/assets/typeIcons';

	// Svelte 5 props API
	let { key, value, size = 20, class: className = '', color = undefined } = $props();

	const iconsFiles = {
		type: typeIcons,
		class: classIcons,
		subclass: subclassIcons,
		category: categoryIcons,
		description: descriptionIcons,
		tags: tagIcons
	} as const;
</script>

{#if iconsFiles[key]?.[value]}
	{@const iconId = iconsFiles[key][value]}
	{@const svgMarkup = icons[iconId]}
	<div
		class={className}
		style={`width:${size}px; height:${size}px;${color ? ` color:${color};` : ''}`}
		aria-hidden="true"
	>
		{@html svgMarkup}
	</div>
{/if}

<style>
	/* Ensure the embedded SVG fills the wrapper box */
	div :global(svg) {
		width: 100%;
		height: 100%;
		display: block;
	}
	/* Your SVGs use fill/stroke="currentColor", so they inherit from this wrapper's color */
</style>
