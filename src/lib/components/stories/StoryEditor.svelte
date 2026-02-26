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
	let cursorPosition = $state<{ nodeIndex: number; offset: number } | null>(null); // Track cursor position in content model

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

	// Capture cursor position for feature insertion
	function captureCursorPosition() {
		if (!editorElement || readonly) return;

		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) {
			cursorPosition = null;
			return;
		}

		const range = selection.getRangeAt(0);
		const startContainer = range.startContainer;
		const startOffset = range.startOffset;

		// Only handle text nodes
		if (startContainer.nodeType !== Node.TEXT_NODE) {
			cursorPosition = null;
			return;
		}

		// Get all text nodes in the editor in order
		const walker = document.createTreeWalker(editorElement, NodeFilter.SHOW_TEXT, null);

		const textNodes: Text[] = [];
		let currentNode;
		while ((currentNode = walker.nextNode())) {
			textNodes.push(currentNode as Text);
		}

		// Find which text node contains our cursor
		const targetTextNodeIndex = textNodes.indexOf(startContainer as Text);
		if (targetTextNodeIndex === -1) {
			cursorPosition = null;
			return;
		}

		// Calculate the total character offset up to our cursor
		let totalOffset = 0;
		for (let i = 0; i < targetTextNodeIndex; i++) {
			totalOffset += textNodes[i].textContent?.length || 0;
		}
		totalOffset += startOffset;

		console.log('Total character offset in editor:', totalOffset);
		console.log(
			'All text content in DOM:',
			textNodes.map((node) => `"${node.textContent}"`).join(' + ')
		);
		console.log(
			'All content nodes:',
			content
				.map((node, i) => `[${i}] ${node.type === 'text' ? `"${node.text}"` : `<${node.type}>`}`)
				.join(' ')
		);

		// Now map this total offset to our content model
		// We need to account for feature text that appears in DOM but not in our text nodes
		let currentContentOffset = 0;
		let domTextOffset = 0; // Track actual DOM text characters seen
		console.log('\nMapping DOM offset', totalOffset, 'to content model:');

		for (let i = 0; i < content.length; i++) {
			const contentNode = content[i];
			if (contentNode.type === 'text') {
				const nodeLength = contentNode.text.length;
				console.log(
					`  [${i}] text "${contentNode.text}" (length: ${nodeLength}, DOM range: ${domTextOffset}-${domTextOffset + nodeLength})`
				);

				// Check if cursor falls within this text node's DOM range
				if (domTextOffset + nodeLength > totalOffset) {
					// This content node contains our cursor
					const offsetInNode = totalOffset - domTextOffset;
					console.log(`    → CURSOR HERE at offset ${offsetInNode}`);
					cursorPosition = {
						nodeIndex: i,
						offset: Math.max(0, offsetInNode)
					};
					console.log(
						'Cursor mapped to:',
						$state.snapshot(cursorPosition),
						'in content node:',
						contentNode.text
					);
					return;
				}
				domTextOffset += nodeLength;
			} else if (contentNode.type === 'feature') {
				// Features appear in DOM and contribute to total offset, but not to our content text
				const featureTextLength = contentNode.displayText.length;
				console.log(
					`  [${i}] feature <${contentNode.displayText}> (DOM length: ${featureTextLength}, DOM range: ${domTextOffset}-${domTextOffset + featureTextLength})`
				);

				// Check if cursor is exactly at the end of this feature
				if (totalOffset === domTextOffset + featureTextLength) {
					// Cursor is right after this feature - position at start of next text node or create one
					const nextTextIndex = i + 1;
					if (nextTextIndex < content.length && content[nextTextIndex].type === 'text') {
						cursorPosition = {
							nodeIndex: nextTextIndex,
							offset: 0
						};
					} else {
						// Create insertion point after feature
						cursorPosition = {
							nodeIndex: nextTextIndex,
							offset: 0
						};
					}
					console.log(`    → CURSOR AFTER FEATURE at node ${cursorPosition.nodeIndex}`);
					console.log('Cursor mapped to:', $state.snapshot(cursorPosition));
					return;
				}
				domTextOffset += featureTextLength;
			}
		}

		// If we get here, cursor is at the very end
		const lastTextNodeIndex = content.findLastIndex((node) => node.type === 'text');
		if (lastTextNodeIndex >= 0 && content[lastTextNodeIndex].type === 'text') {
			cursorPosition = {
				nodeIndex: lastTextNodeIndex,
				offset: content[lastTextNodeIndex].text.length
			};
		} else {
			// No text nodes at all
			cursorPosition = {
				nodeIndex: 0,
				offset: 0
			};
		}
		console.log('Cursor at end, mapped to:', $state.snapshot(cursorPosition));
	}

	// Handle clicks to capture cursor position
	function handleEditorClick(event: MouseEvent) {
		if (readonly) {
			handleFeatureClick(event);
		} else {
			// Capture cursor position for potential feature insertion
			setTimeout(captureCursorPosition, 10); // Small delay to ensure selection is updated
		}
	}

	// Handle key events to capture cursor position
	function handleKeyDown(event: KeyboardEvent) {
		if (readonly) {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				handleFeatureClick(event as any);
			}
		} else {
			// Capture cursor position after key events that might move cursor
			if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
				setTimeout(captureCursorPosition, 10);
			}
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

	// Insert feature at cursor position
	function insertFeature() {
		if (!selectedFeature) return;

		const featureNode: StoryContentNode = {
			type: 'feature',
			featureId: selectedFeature.id,
			displayText: getFeatureDisplayName(selectedFeature),
			feature: selectedFeature,
			customText: customDisplayText || undefined
		};

		console.log('Inserting feature at position:', $state.snapshot(cursorPosition));
		console.log('Current content:', $state.snapshot(content));

		// Handle empty content
		if (content.length === 0) {
			content = [featureNode, { type: 'text', text: ' ' }];
			console.log('Inserted into empty content');

			// Reset state for empty content insertion
			selectedFeature = null;
			customDisplayText = '';
			showFeatureDialog = false;
			cursorPosition = null;

			// Handle focus based on device type - dismiss keyboard on mobile
			setTimeout(() => {
				if (editorElement) {
					const isMobile = window.innerWidth <= 768 || 'ontouchstart' in window;

					if (isMobile) {
						// On mobile: blur to dismiss keyboard
						editorElement.blur();
						console.log('📱 Feature inserted into empty content - keyboard dismissed on mobile');
					} else {
						// On desktop: focus and position cursor at the end
						editorElement.focus();
						const selection = window.getSelection();
						if (selection) {
							const range = document.createRange();
							range.selectNodeContents(editorElement);
							range.collapse(false);
							selection.removeAllRanges();
							selection.addRange(range);
						}
						console.log('💻 Feature inserted into empty content - focus maintained on desktop');
					}
				}
			}, 50);
			return;
		}

		// No cursor position - append at end
		if (!cursorPosition) {
			content = [...content, featureNode, { type: 'text', text: ' ' }];
			console.log('Appended at end (no cursor position)');

			// Reset state even when appending at end
			selectedFeature = null;
			customDisplayText = '';
			showFeatureDialog = false;
			cursorPosition = null;

			// Handle focus based on device type - dismiss keyboard on mobile
			setTimeout(() => {
				if (editorElement) {
					const isMobile = window.innerWidth <= 768 || 'ontouchstart' in window;

					if (isMobile) {
						// On mobile: blur to dismiss keyboard
						editorElement.blur();
						console.log('📱 Feature appended - keyboard dismissed on mobile');
					} else {
						// On desktop: focus and position cursor at the end
						editorElement.focus();
						const selection = window.getSelection();
						if (selection) {
							const range = document.createRange();
							range.selectNodeContents(editorElement);
							range.collapse(false);
							selection.removeAllRanges();
							selection.addRange(range);
						}
						console.log('💻 Feature appended - focus maintained on desktop');
					}
				}
			}, 50);
			return;
		}

		const nodeIndex = cursorPosition.nodeIndex;
		const offset = cursorPosition.offset;
		const newContent = [...content];

		// Insert beyond existing content
		if (nodeIndex >= newContent.length) {
			newContent.push(featureNode, { type: 'text', text: ' ' });
			console.log('Inserted beyond content length');
		} else {
			const targetNode = newContent[nodeIndex];

			if (targetNode.type === 'text') {
				// Split the text node at cursor position
				const textBefore = targetNode.text.substring(0, offset);
				const textAfter = targetNode.text.substring(offset);

				console.log('Splitting text node:', {
					original: targetNode.text,
					before: textBefore,
					after: textAfter,
					offset
				});

				// Create replacement nodes
				const replacementNodes: StoryContentNode[] = [];

				// Add text before if not empty
				if (textBefore) {
					replacementNodes.push({ type: 'text', text: textBefore });
				}

				// Add the feature
				replacementNodes.push(featureNode);

				// Add text after - DON'T add extra spaces, just use what was there
				if (textAfter) {
					replacementNodes.push({ type: 'text', text: textAfter });
				} else {
					// Only add a space if there was no text after AND we're at the very end
					replacementNodes.push({ type: 'text', text: ' ' });
				}

				console.log('Replacement nodes:', replacementNodes);

				// Replace the target node
				newContent.splice(nodeIndex, 1, ...replacementNodes);
			} else {
				// Target is not a text node, insert before it
				newContent.splice(nodeIndex, 0, featureNode, { type: 'text', text: ' ' });
				console.log('Inserted before non-text node');
			}
		}

		content = newContent;
		console.log('Final content after insertion:', $state.snapshot(newContent));

		// Reset state
		selectedFeature = null;
		customDisplayText = '';
		showFeatureDialog = false;
		cursorPosition = null;

		// Focus editor after feature insertion - dismiss keyboard on mobile
		setTimeout(() => {
			if (editorElement) {
				const isMobile = window.innerWidth <= 768 || 'ontouchstart' in window;

				if (isMobile) {
					// On mobile: blur to dismiss keyboard
					editorElement.blur();
					console.log('📱 Feature inserted - keyboard dismissed on mobile');
				} else {
					// On desktop: maintain focus and position cursor
					editorElement.focus();
					const selection = window.getSelection();
					if (selection) {
						const range = document.createRange();
						range.selectNodeContents(editorElement);
						range.collapse(false);
						selection.removeAllRanges();
						selection.addRange(range);
					}
					console.log('💻 Feature inserted - focus maintained on desktop');
				}
			}
		}, 50);
	}
</script>

<div class={clsx('story-editor', className)}>
	<!-- Editor Toolbar (only show in edit mode) -->
	{#if !readonly}
		<div class="border-b border-gray-200 bg-gray-50 px-3 py-2">
			<div class="flex items-center gap-2">
				<button
					class="flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
					onclick={() => {
						// Ensure editor has focus and capture position
						if (editorElement) {
							editorElement.focus();
							setTimeout(() => {
								captureCursorPosition();
								showFeatureDialog = true;
							}, 10);
						} else {
							showFeatureDialog = true;
						}
					}}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							if (editorElement) {
								editorElement.focus();
								setTimeout(() => {
									captureCursorPosition();
									showFeatureDialog = true;
								}, 10);
							} else {
								showFeatureDialog = true;
							}
						}
					}}
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
		onclick={handleEditorClick}
		onkeydown={handleKeyDown}
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
