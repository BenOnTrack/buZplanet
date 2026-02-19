<script lang="ts">
	import { clsx } from 'clsx';
	import { mapControl } from '$lib/stores/MapControl.svelte';
	import { featuresDB } from '$lib/stores/FeaturesDB.svelte';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import FeatureInsertDialog from '$lib/components/dialogs/FeatureInsertDialog.svelte';
	import {
		updateFeatureStatuses,
		getFeatureDisplayName,
		createSearchResultFromMapFeature,
		renderContentToHTML,
		parseHTMLToContent,
		type FeatureStatus
	} from '$lib/utils/stories';

	let {
		content = $bindable([]),
		placeholder = 'Start writing your story...',
		readonly = false,
		onFeatureClick = undefined,
		class: className = ''
	}: {
		content?: StoryContentNode[];
		placeholder?: string;
		readonly?: boolean;
		onFeatureClick?: (feature: StoredFeature | SearchResult) => void;
		class?: string;
	} = $props();

	let editorElement = $state<HTMLDivElement | null>(null);
	let selectedFeature = $state<StoredFeature | SearchResult | null>(null);
	let customDisplayText = $state('');
	let showFeatureDialog = $state(false);
	let lastRenderedContent = $state<string>(''); // Track what we last rendered to avoid cursor jumps

	// Reactive state for feature statuses
	let featureStatuses = $state<Map<string, FeatureStatus>>(new Map());

	// Update feature statuses when features DB changes
	$effect(() => {
		// React to bookmarks changes
		featuresDB.bookmarksVersion;
		updateFeatureStatusesForContent();
	});

	// Update all feature statuses
	async function updateFeatureStatusesForContent() {
		if (!content?.length) return;

		featureStatuses = await updateFeatureStatuses(content);
		updateFeatureSpansColor();
	}

	// Update DOM colors
	function updateFeatureSpansColor() {
		if (!editorElement) return;

		const featureSpans = editorElement.querySelectorAll('.story-feature');
		featureSpans.forEach((span) => {
			const featureId = span.getAttribute('data-feature-id');
			if (featureId) {
				const status = featureStatuses.get(featureId) || 'gray';

				// Remove all status classes
				span.className = span.className.replace(/story-feature-(gray|blue|red|green)/g, '');
				span.classList.add(`story-feature-${status}`);
			}
		});
	}

	// Set story insertion mode
	$effect(() => {
		if (!readonly) {
			mapControl.setStoryInsertionMode(true);
		}

		return () => {
			mapControl.setStoryInsertionMode(false);
		};
	});

	// Render content to HTML - but avoid overwriting user input
	$effect(() => {
		if (editorElement && content) {
			const newHTML = renderContentToHTML(content, featureStatuses);
			const contentStr = JSON.stringify(content);

			// Only update DOM if content actually changed from external source
			if (contentStr !== lastRenderedContent) {
				// Check if this change came from user input by comparing DOM
				const currentHTML = editorElement.innerHTML;

				// If DOM content doesn't match what we expect, it means external change
				if (currentHTML !== newHTML || readonly) {
					editorElement.innerHTML = newHTML;
				}

				lastRenderedContent = contentStr;
			}
		}
	});

	// Handle input changes - prevent cursor jumps
	function handleInput() {
		if (!editorElement || readonly) return;

		try {
			const html = editorElement.innerHTML;
			const newContent = parseHTMLToContent(html, content);

			// Only update if content actually changed
			const newContentStr = JSON.stringify(newContent);
			const oldContentStr = JSON.stringify(content);

			if (newContentStr !== oldContentStr) {
				content = newContent;
				// Update our tracking variable to prevent re-render
				lastRenderedContent = newContentStr;
			}
		} catch (error) {
			console.error('Error processing input:', error);
		}
	}

	// Handle feature clicks
	function handleFeatureClick(event: MouseEvent) {
		if (!readonly) return;

		const target = event.target as HTMLElement;
		if (target.classList.contains('story-feature')) {
			const featureId = target.getAttribute('data-feature-id');
			const featureNode = content.find(
				(node) => node.type === 'feature' && node.featureId === featureId
			);

			if (featureNode && featureNode.type === 'feature') {
				if (onFeatureClick) {
					onFeatureClick(featureNode.feature);
				} else {
					// Default behavior: zoom to feature
					if ('geometry' in featureNode.feature) {
						mapControl.zoomToAndSelectStoredFeature(featureNode.feature);
					} else {
						mapControl.zoomToAndSelectSearchResult(featureNode.feature);
					}
				}
			}
		}
	}

	// Listen for map feature selection
	$effect(() => {
		if (readonly || !mapControl.selectedFeature) return;

		const mapFeature = mapControl.selectedFeature;

		featuresDB
			.getFeatureById(String(mapFeature.id))
			.then((storedFeature) => {
				selectedFeature = storedFeature || createSearchResultFromMapFeature(mapFeature);
			})
			.catch(() => {
				selectedFeature = createSearchResultFromMapFeature(mapFeature);
			});
	});

	// Insert feature
	function insertFeature() {
		if (!selectedFeature) return;

		const featureNode: StoryContentNode = {
			type: 'feature',
			featureId: selectedFeature.id,
			displayText: getFeatureDisplayName(selectedFeature),
			feature: selectedFeature,
			customText: customDisplayText || undefined
		};

		content = [...content, featureNode, { type: 'text', text: ' ' }];

		// Reset state
		selectedFeature = null;
		customDisplayText = '';
		showFeatureDialog = false;

		// Focus editor
		setTimeout(() => {
			if (editorElement) {
				editorElement.focus();
				const selection = window.getSelection();
				if (selection) {
					const range = document.createRange();
					range.selectNodeContents(editorElement);
					range.collapse(false);
					selection.removeAllRanges();
					selection.addRange(range);
				}
			}
		}, 100);
	}
</script>

<div class={clsx('story-editor', className)}>
	<!-- Editor Toolbar (only show in edit mode) -->
	{#if !readonly}
		<div class="border-b border-gray-200 bg-gray-50 px-3 py-2">
			<div class="flex items-center gap-2">
				<button
					class="flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
					onclick={() => (showFeatureDialog = true)}
				>
					<PropertyIcon key="description" value="location" size={16} />
					Insert Feature
					{#if selectedFeature}
						<span class="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
							{getFeatureDisplayName(selectedFeature)}
						</span>
					{/if}
				</button>
			</div>
		</div>
	{/if}

	<!-- Main Editor -->
	<div
		bind:this={editorElement}
		class={clsx('p-4 focus:outline-none', {
			'bg-gray-50': readonly,
			'bg-white': !readonly
		})}
		contenteditable={!readonly}
		oninput={handleInput}
		onclick={handleFeatureClick}
		onkeydown={(e) => {
			if (readonly && (e.key === 'Enter' || e.key === ' ')) {
				e.preventDefault();
				handleFeatureClick(e as any);
			}
		}}
		data-placeholder={placeholder}
		style:border-style={readonly ? 'none' : 'solid'}
		role={readonly ? 'article' : 'textbox'}
		aria-label={readonly ? 'Story content' : 'Story editor'}
		aria-multiline="true"
		style:line-height="1.7"
		style:font-size="1rem"
	>
		<!-- Content will be populated by the effect above -->
	</div>

	<!-- Feature Insertion Dialog -->
	<FeatureInsertDialog
		bind:open={showFeatureDialog}
		{selectedFeature}
		bind:customDisplayText
		onInsertFeature={insertFeature}
	/>
</div>

<style>
	.story-editor {
		position: relative;
	}

	[contenteditable]:empty::before {
		content: attr(data-placeholder);
		color: #9ca3af;
		pointer-events: none;
		font-style: italic;
	}

	:global(.story-feature) {
		border-radius: 4px;
		padding: 4px 8px;
		margin: 0 2px;
		font-weight: 500;
		cursor: pointer;
		display: inline-flex;
		vertical-align: baseline;
		align-items: center;
		gap: 2px;
		transition: all 0.2s;
		font-size: 0.875rem;
		/* Make chips non-editable to prevent cursor getting stuck */
		user-select: none;
		-webkit-user-select: none;
		/* Ensure chips can't be edited */
		pointer-events: auto;
	}

	/* Gray - Default (not saved or not bookmarked) */
	:global(.story-feature-gray) {
		background-color: #f3f4f6;
		border: 1px solid #d1d5db;
		color: #6b7280;
	}

	:global(.story-feature-gray:hover) {
		background-color: #e5e7eb;
		border-color: #9ca3af;
	}

	/* Blue - Bookmarked */
	:global(.story-feature-blue) {
		background-color: #ebf8ff;
		border: 1px solid #3182ce;
		color: #2c5282;
	}

	:global(.story-feature-blue:hover) {
		background-color: #bee3f8;
		border-color: #2b6cb0;
	}

	/* Red - Todo */
	:global(.story-feature-red) {
		background-color: #fef2f2;
		border: 1px solid #dc2626;
		color: #991b1b;
	}

	:global(.story-feature-red:hover) {
		background-color: #fee2e2;
		border-color: #b91c1c;
	}

	/* Green - Visited */
	:global(.story-feature-green) {
		background-color: #f0fdf4;
		border: 1px solid #16a34a;
		color: #15803d;
	}

	:global(.story-feature-green:hover) {
		background-color: #dcfce7;
		border-color: #15803d;
	}

	:global(.story-feature:focus) {
		outline: 2px solid currentColor;
		outline-offset: 1px;
	}
</style>
