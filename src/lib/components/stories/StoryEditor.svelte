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
	let lastRenderedContent = $state<string>(''); // Track what we last rendered

	// Reactive state for feature statuses - updates when features are modified
	let featureStatuses = $state<Map<string, FeatureStatus>>(new Map());
	let bookmarksVersion = $state(0);

	// Track features DB reactivity
	$effect(() => {
		// This effect will re-run whenever bookmarks change in the database
		bookmarksVersion = featuresDB.bookmarksVersion;
		updateFeatureStatusesForContent();
	});

	// Update all feature statuses using centralized function
	async function updateFeatureStatusesForContent() {
		if (!content || content.length === 0) return;

		featureStatuses = await updateFeatureStatuses(content);

		// Update DOM if editor is mounted
		if (editorElement) {
			updateFeatureSpansColor();
		}
	}

	// Update colors of existing feature spans in the DOM
	function updateFeatureSpansColor() {
		if (!editorElement) return;

		const featureSpans = editorElement.querySelectorAll('.story-feature');
		featureSpans.forEach((span) => {
			const featureId = span.getAttribute('data-feature-id');
			if (featureId) {
				const status = featureStatuses.get(featureId) || 'gray';

				// Remove existing status classes
				span.classList.remove(
					'story-feature-gray',
					'story-feature-blue',
					'story-feature-red',
					'story-feature-green'
				);

				// Add new status class
				span.classList.add(`story-feature-${status}`);
			}
		});
	}

	// Enable story insertion mode when editor is opened (if not readonly)
	$effect(() => {
		if (!readonly) {
			mapControl.setStoryInsertionMode(true);
		}

		// Clean up story insertion mode when component is destroyed or becomes readonly
		return () => {
			mapControl.setStoryInsertionMode(false);
		};
	});

	// Initialize editor when mounted or content changes externally
	$effect(() => {
		if (editorElement && readonly) {
			// For readonly mode, always update to show current content
			const newHTML = renderContentToHTML(content, featureStatuses);
			editorElement.innerHTML = newHTML;
		}
	});

	// Update feature statuses when content changes
	$effect(() => {
		if (content) {
			updateFeatureStatusesForContent();
		}
	});

	// Update the editor HTML when content changes from outside (not from user input)
	$effect(() => {
		if (editorElement && !readonly) {
			const newHTML = renderContentToHTML(content, featureStatuses);
			const contentStr = JSON.stringify(content);

			// Only update DOM if content actually changed from external source
			if (contentStr !== lastRenderedContent) {
				// Check if this change came from user input by comparing DOM
				const currentHTML = editorElement.innerHTML;

				// If DOM content doesn't match what we expect, it means external change
				if (currentHTML !== newHTML) {
					editorElement.innerHTML = newHTML;
				}

				lastRenderedContent = contentStr;
			}
		}
	});

	// Update content when HTML changes (for typing)
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
				// Update our tracking variable
				lastRenderedContent = newContentStr;
			}
		} catch (error) {
			console.error('Error processing input:', error);
		}
	}

	// Handle feature clicks
	function handleFeatureSpanClick(event: MouseEvent) {
		if (readonly) {
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
						// Default behavior: zoom to feature and open drawer
						if ('geometry' in featureNode.feature) {
							// It's a StoredFeature
							mapControl.zoomToAndSelectStoredFeature(featureNode.feature);
						} else {
							// It's a SearchResult
							mapControl.zoomToAndSelectSearchResult(featureNode.feature);
						}
					}
				}
			}
		}
	}

	// Insert feature at cursor position
	async function insertFeature() {
		if (!selectedFeature) {
			console.error('❌ No feature selected for insertion');
			return;
		}

		console.log('🎯 Inserting feature:', selectedFeature);

		try {
			// Create display text
			const displayText = customDisplayText || getFeatureDisplayName(selectedFeature);
			console.log('📝 Display text:', displayText);

			// Create feature node
			const featureNode: StoryContentNode = {
				type: 'feature',
				featureId: selectedFeature.id,
				displayText: getFeatureDisplayName(selectedFeature),
				feature: selectedFeature,
				customText: customDisplayText || undefined
			};

			console.log('🏗️ Created feature node:', featureNode);

			// Add feature to content and add space after it
			content = [...content, featureNode, { type: 'text', text: ' ' }];

			console.log('✅ Feature inserted successfully! New content:', content);

			// Reset state
			selectedFeature = null;
			customDisplayText = '';
			showFeatureDialog = false;

			// After content updates, focus at the end of the editor
			setTimeout(() => {
				if (editorElement) {
					// Focus the editor
					editorElement.focus();

					// Move cursor to end
					const selection = window.getSelection();
					if (selection) {
						const range = document.createRange();
						range.selectNodeContents(editorElement);
						range.collapse(false); // Collapse to end
						selection.removeAllRanges();
						selection.addRange(range);
					}
				}
			}, 100);
		} catch (error) {
			console.error('❌ Failed to insert feature:', error);
			// Make sure to reset state even on error
			showFeatureDialog = false;
		}
	}

	// Listen for map feature selection when in edit mode
	$effect(() => {
		if (!readonly && mapControl.selectedFeature) {
			console.log('🎯 Story Editor: Feature selected for insertion:', mapControl.selectedFeature);

			// Convert MapGeoJSONFeature to usable format
			const mapFeature = mapControl.selectedFeature;

			// Try to find stored feature first
			featuresDB
				.getFeatureById(String(mapFeature.id))
				.then((storedFeature) => {
					if (storedFeature) {
						console.log('✅ Found stored feature:', storedFeature);
						selectedFeature = storedFeature;
					} else {
						console.log('🔄 Creating basic feature from map feature:', mapFeature);
						// Create a basic feature from map feature
						const basicFeature = createSearchResultFromMapFeature(mapFeature);

						console.log('✅ Created basic feature:', basicFeature);
						selectedFeature = basicFeature;
					}
				})
				.catch((error) => {
					console.error('❌ Error processing selected feature:', error);
				});
		}
	});

	// Open feature insertion dialog
	function openFeatureDialog() {
		console.log('🚀 Story Editor: Opening feature insertion dialog');
		showFeatureDialog = true;
	}
</script>

<div class={clsx('story-editor', className)}>
	<!-- Editor Toolbar (only show in edit mode) -->
	{#if !readonly}
		<div class="border-b border-gray-200 bg-gray-50 px-3 py-2">
			<div class="flex items-center gap-2">
				<button
					class="flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
					onclick={openFeatureDialog}
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
		class={clsx('min-h-[200px] p-4 focus:outline-none', {
			'bg-gray-50': readonly,
			'bg-white': !readonly
		})}
		contenteditable={!readonly}
		oninput={handleInput}
		onclick={handleFeatureSpanClick}
		onkeydown={(e) => {
			if (readonly && (e.key === 'Enter' || e.key === ' ')) {
				handleFeatureSpanClick(e as any);
			}
		}}
		data-placeholder={placeholder}
		style:border-style={readonly ? 'none' : 'solid'}
		role={readonly ? 'article' : 'textbox'}
		aria-label={readonly ? 'Story content' : 'Story editor'}
		aria-multiline="true"
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
	}

	:global(.story-feature) {
		border-radius: 4px;
		padding: 2px 6px;
		margin: 0 4px;
		font-weight: 500;
		cursor: pointer;
		display: inline-block;
		transition: all 0.2s;
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
