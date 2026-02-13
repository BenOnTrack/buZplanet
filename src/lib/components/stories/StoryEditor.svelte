<script lang="ts">
	import { clsx } from 'clsx';
	import { mapControl } from '$lib/stores/MapControl.svelte';
	import { featuresDB } from '$lib/stores/FeaturesDB.svelte';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';

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
	let isInserting = $state(false);
	let selectedFeature = $state<StoredFeature | SearchResult | null>(null);
	let customDisplayText = $state('');
	let showFeatureDialog = $state(false);
	let lastRenderedContent = $state<string>(''); // Track what we last rendered

	// Debug: Track selectedFeature changes
	$effect(() => {
		console.log('🔄 selectedFeature changed:', selectedFeature);
	});

	// Debug: Track isInserting changes
	$effect(() => {
		console.log('🔄 isInserting changed:', isInserting);
	});

	// Debug: Track showFeatureDialog changes
	$effect(() => {
		console.log('🔄 showFeatureDialog changed:', showFeatureDialog);
	});
	// Clean up story insertion mode when component is destroyed
	$effect(() => {
		return () => {
			if (isInserting) {
				mapControl.setStoryInsertionMode(false);
			}
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
			isInserting = false;
			// Disable story insertion mode
			mapControl.setStoryInsertionMode(false);

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
			isInserting = false;
			showFeatureDialog = false;
			mapControl.setStoryInsertionMode(false);
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

	// Listen for map feature selection when in insert mode
	$effect(() => {
		if (isInserting && mapControl.selectedFeature) {
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
		} else if (isInserting) {
			console.log('⏳ Story Editor: Waiting for feature selection...');
		}
	});

	// Debug: Track selectedFeature changes
	$effect(() => {
		console.log('🔄 selectedFeature changed:', selectedFeature);
	});

	// Debug: Track isInserting changes
	$effect(() => {
		console.log('🔄 isInserting changed:', isInserting);
	});

	// Debug: Track showFeatureDialog changes
	$effect(() => {
		console.log('🔄 showFeatureDialog changed:', showFeatureDialog);
	});

	// Start feature insertion mode
	function startFeatureInsertion() {
		console.log('🚀 Story Editor: Starting feature insertion mode');
		isInserting = true;
		showFeatureDialog = true;
		// Enable story insertion mode to prevent SelectedFeatureDrawer from opening
		mapControl.setStoryInsertionMode(true);
		console.log('📺 Story insertion mode enabled, selectedFeature:', mapControl.selectedFeature);
	}

	// Cancel feature insertion
	function cancelFeatureInsertion() {
		console.log('❌ Story Editor: Cancelling feature insertion');
		isInserting = false;
		selectedFeature = null;
		customDisplayText = '';
		showFeatureDialog = false;
		// Disable story insertion mode
		mapControl.setStoryInsertionMode(false);
	}
</script>

<div class={clsx('story-editor', className)}>
	<!-- Editor Toolbar (only show in edit mode) -->
	{#if !readonly}
		<div class="border-b border-gray-200 bg-gray-50 px-3 py-2">
			<div class="flex items-center gap-2">
				<button
					class={clsx(
						'flex items-center gap-1 rounded px-2 py-1 text-sm font-medium transition-colors',
						{
							'bg-blue-100 text-blue-700': isInserting,
							'border border-gray-200 bg-white text-gray-700 hover:bg-gray-100': !isInserting
						}
					)}
					onclick={startFeatureInsertion}
					disabled={isInserting}
				>
					<PropertyIcon key="description" value="location" size={16} />
					{isInserting ? 'Select Feature on Map...' : 'Insert Feature'}
				</button>

				{#if isInserting}
					<button
						class="rounded px-2 py-1 text-sm text-gray-600 hover:text-gray-800"
						onclick={cancelFeatureInsertion}
					>
						Cancel
					</button>
				{/if}
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

	<!-- Feature Insertion Dialog - Use fixed positioning to ensure visibility -->
	{#if showFeatureDialog}
		<div
			class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
			onclick={cancelFeatureInsertion}
		>
			<div
				class="mx-4 w-full max-w-md rounded-lg border-2 border-red-500 bg-yellow-100 p-6 shadow-xl"
				onclick={(e) => e.stopPropagation()}
			>
				<div class="mb-4 text-lg font-bold text-red-600">FEATURE DIALOG IS VISIBLE!</div>

				<!-- Debug info -->
				<div class="mb-4 text-sm text-gray-700">
					DEBUG: selectedFeature = {selectedFeature ? 'SET' : 'NULL'}, showFeatureDialog = {showFeatureDialog},
					isInserting = {isInserting}
				</div>

				{#if selectedFeature}
					<div class="space-y-3">
						<div class="flex items-center gap-2 text-sm text-gray-600">
							<PropertyIcon key="description" value="check" size={16} color="green" />
							Feature selected: <strong>{getFeatureDisplayName(selectedFeature)}</strong>
						</div>

						<div>
							<label for="custom-text" class="block text-sm font-medium text-gray-700">
								Custom display text (optional):
							</label>
							<input
								id="custom-text"
								bind:value={customDisplayText}
								placeholder={getFeatureDisplayName(selectedFeature)}
								class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
							/>
						</div>

						<div class="flex items-center gap-2">
							<button
								class="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
								onclick={insertFeature}
							>
								Insert Feature
							</button>
							<button
								class="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none"
								onclick={cancelFeatureInsertion}
							>
								Cancel
							</button>
						</div>
					</div>
				{:else}
					<div class="space-y-2 text-sm text-gray-600">
						<div class="flex items-center gap-2">
							<PropertyIcon key="description" value="info" size={16} />
							Click on a feature on the map or search for one to insert it here.
						</div>
						<div class="text-xs text-gray-500">
							You can also select from your bookmarked features.
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
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
