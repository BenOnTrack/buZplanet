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
	let {
		key,
		value,
		size = 20,
		class: className = '',
		color = undefined
	}: {
		key: string;
		value?: string;
		size?: number;
		class?: string;
		color?: string;
	} = $props();

	const iconsFiles = {
		type: typeIcons,
		class: classIcons,
		subclass: subclassIcons,
		category: categoryIcons,
		description: descriptionIcons,
		tags: tagIcons
	} as const;

	type IconKey = keyof typeof iconsFiles;
	type IconValue<K extends IconKey> = keyof (typeof iconsFiles)[K];

	// Type-safe icon lookup
	function getIconId(iconKey: string, iconValue?: string): string | undefined {
		if (!iconValue) return undefined;
		const iconFile = iconsFiles[iconKey as IconKey];
		if (!iconFile) return undefined;
		return iconFile[iconValue as keyof typeof iconFile] as string | undefined;
	}

	// Safe icons lookup with fallback
	function getSvgMarkup(iconId: string | undefined): string | undefined {
		if (!iconId) return undefined;
		return icons[iconId as keyof typeof icons];
	}
</script>

{#if getIconId(key, value)}
	{@const iconId = getIconId(key, value)}
	{@const svgMarkup = getSvgMarkup(iconId)}
	{#if svgMarkup}
		<div
			class={className}
			style={`width:${size}px; height:${size}px;${color ? ` color:${color};` : ''}`}
			aria-hidden="true"
		>
			{@html svgMarkup}
		</div>
	{/if}
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
