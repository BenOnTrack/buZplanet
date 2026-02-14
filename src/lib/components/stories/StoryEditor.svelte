<script lang="ts">
	import { clsx } from 'clsx';
	import { mapControl } from '$lib/stores/MapControl.svelte';
	import { featuresDB } from '$lib/stores/FeaturesDB.svelte';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import FeatureInsertDialog from '$lib/components/dialogs/FeatureInsertDialog.svelte';

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

	// Render content as HTML for contenteditable
	function renderContentToHTML(contentNodes: StoryContentNode[]): string {
		return contentNodes
			.map((node, index) => {
				if (node.type === 'text') {
					return node.text.replace(/\n/g, '<br>');
				} else if (node.type === 'feature') {
					const displayText = node.customText || node.displayText;
					// Make feature spans non-editable to prevent cursor getting stuck
					return `<span class="story-feature" data-feature-id="${node.featureId}" data-index="${index}" contenteditable="false">${displayText}</span>`;
				}
				return '';
			})
			.join('');
	}

	// Initialize editor when mounted or content changes externally
	$effect(() => {
		if (editorElement && readonly) {
			// For readonly mode, always update to show current content
			const newHTML = renderContentToHTML(content);
			editorElement.innerHTML = newHTML;
		}
	});

	// Update the editor HTML when content changes from outside (not from user input)
	$effect(() => {
		if (editorElement && !readonly) {
			const newHTML = renderContentToHTML(content);
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
			const newContent: StoryContentNode[] = [];

			// Parse HTML back to content nodes
			const tempDiv = document.createElement('div');
			tempDiv.innerHTML = html;

			let textAccumulator = '';

			function processNode(node: Node) {
				if (node.nodeType === Node.TEXT_NODE) {
					textAccumulator += node.textContent || '';
				} else if (node.nodeType === Node.ELEMENT_NODE) {
					const element = node as HTMLElement;

					if (element.classList.contains('story-feature')) {
						// Save accumulated text before feature
						if (textAccumulator) {
							newContent.push({ type: 'text', text: textAccumulator });
							textAccumulator = '';
						}

						// Find the original feature by ID
						const featureId = element.getAttribute('data-feature-id');
						const originalFeature = content.find(
							(node) => node.type === 'feature' && node.featureId === featureId
						);

						if (originalFeature && originalFeature.type === 'feature') {
							newContent.push({
								...originalFeature,
								customText: element.textContent || originalFeature.displayText
							});
						}
					} else if (element.tagName === 'BR') {
						textAccumulator += '\n';
					} else {
						// Process child nodes
						for (const child of Array.from(element.childNodes)) {
							processNode(child);
						}
					}
				}
			}

			for (const child of Array.from(tempDiv.childNodes)) {
				processNode(child);
			}

			// Save remaining text
			if (textAccumulator) {
				newContent.push({ type: 'text', text: textAccumulator });
			}

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

	// Get display name for feature
	function getFeatureDisplayName(feature: StoredFeature | SearchResult): string {
		if ('names' in feature) {
			// It's either type, try to get the best name
			const names = 'names' in feature ? feature.names : {};
			return names.name || names['name:en'] || Object.values(names)[0] || 'Unknown Feature';
		}
		return 'Unknown Feature';
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
						const basicFeature: SearchResult = {
							id: String(mapFeature.id),
							names: mapFeature.properties || {},
							class: mapFeature.properties?.class || '',
							subclass: mapFeature.properties?.subclass,
							category: mapFeature.properties?.category,
							lng: 0, // These will be populated from geometry if needed
							lat: 0,
							database: mapFeature.source || '',
							layer: mapFeature.sourceLayer || '',
							zoom: 14,
							tileX: 0,
							tileY: 0
						};

						// Extract coordinates if it's a point
						if (mapFeature.geometry && mapFeature.geometry.type === 'Point') {
							const [lng, lat] = mapFeature.geometry.coordinates;
							basicFeature.lng = lng;
							basicFeature.lat = lat;
						}

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
		background-color: #ebf8ff;
		border: 1px solid #3182ce;
		border-radius: 4px;
		padding: 2px 6px;
		margin: 0 2px;
		color: #2c5282;
		font-weight: 500;
		cursor: pointer;
		display: inline-block;
		transition: all 0.2s;
		/* Make chips non-editable to prevent cursor getting stuck */
		user-select: none;
		-webkit-user-select: none;
		/* Add some spacing around chips */
		margin: 0 4px;
		/* Ensure chips can't be edited */
		pointer-events: auto;
	}

	:global(.story-feature:hover) {
		background-color: #bee3f8;
		border-color: #2b6cb0;
	}

	:global(.story-feature:focus) {
		outline: 2px solid #3182ce;
		outline-offset: 1px;
	}
</style>
