<script lang="ts">
	import { clsx } from 'clsx';
	import { mapControl } from '$lib/stores/MapControl.svelte';
	import { featuresDB } from '$lib/stores/FeaturesDB.svelte';
	import { storiesDB } from '$lib/stores/StoriesDB.svelte';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import {
		updateFeatureStatuses,
		formatDate,
		getCategoryColor,
		type FeatureStatus
	} from '$lib/utils/stories';

	let {
		story,
		onFeatureClick = undefined,
		showMetadata = true,
		class: className = ''
	}: {
		story: Story;
		onFeatureClick?: (feature: StoredFeature | SearchResult) => void;
		showMetadata?: boolean;
		class?: string;
	} = $props();

	// State for showing/hiding date details
	let showCreatedDate = $state(false);
	let showUpdatedDate = $state(false);

	// Reactive state for feature statuses - updates when features are modified
	let featureStatuses = $state<Map<string, FeatureStatus>>(new Map());

	// Categories state that updates when storiesDB changes
	let availableCategories = $state<StoryCategory[]>([]);

	// Load categories when storiesDB changes
	$effect(() => {
		// React to changes in storiesDB
		storiesDB.changeSignal;
		loadCategories();
	});

	async function loadCategories() {
		try {
			availableCategories = await storiesDB.getAllCategories();
		} catch (error) {
			console.error('Error loading categories:', error);
		}
	}

	// Track features DB reactivity - VALID DOM EFFECT
	$effect(() => {
		// This effect will re-run whenever bookmarks change in the database
		featuresDB.bookmarksVersion;
		updateFeatureStatusesForContent();
	});

	// Update all feature statuses using centralized function
	async function updateFeatureStatusesForContent() {
		if (!story.content || story.content.length === 0) return;

		featureStatuses = await updateFeatureStatuses(story.content);
	}

	// Update feature statuses when story content changes
	$effect(() => {
		if (story) {
			updateFeatureStatusesForContent();
		}
	});

	// Handle feature clicks
	function handleFeatureClick(feature: StoredFeature | SearchResult) {
		if (onFeatureClick) {
			onFeatureClick(feature);
		} else {
			// Default behavior: zoom to feature and open drawer
			if ('geometry' in feature) {
				// It's a StoredFeature - zoom and select (opens SelectedFeatureDrawer)
				mapControl.zoomToAndSelectStoredFeature(feature);
			} else {
				// It's a SearchResult - zoom and select (opens SelectedFeatureDrawer)
				mapControl.zoomToAndSelectSearchResult(feature);
			}
		}
	}
</script>

<article class={clsx('story-viewer', className)}>
	<!-- Fixed Story Header -->
	<header class="story-header">
		{#if story.description}
			<p class="mb-4 text-gray-600">{story.description}</p>
		{/if}

		<!-- Categories -->
		{#if showMetadata && story.categories.length > 0}
			<div class="categories-tags-container">
				<div class="categories-tags-scroll">
					<!-- Categories -->
					{#each story.categories as categoryId}
						{@const categoryObj = availableCategories.find((cat) => cat.id === categoryId)}
						<span
							class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap text-white"
							style="background-color: {categoryObj?.color || getCategoryColor(categoryId)}"
						>
							<PropertyIcon key="description" value="category" size={12} />
							{categoryObj?.name || categoryId}
						</span>
					{/each}
				</div>
			</div>
		{/if}
	</header>

	<!-- Scrollable Story Content Only -->
	<div class="story-content-container">
		<div class="story-content prose prose-gray max-w-none">
			<div class="story-text">
				{#each story.content as node, index}
					{#if node.type === 'text'}
						<span class="story-text-span">{@html node.text.replace(/\n/g, '<br>')}</span>
					{:else if node.type === 'feature'}
						{@const status = featureStatuses.get(node.featureId) || 'gray'}
						<button
							class="story-feature-button story-feature-{status} inline-flex items-center gap-1 rounded border px-2 py-1 text-sm font-medium transition-colors focus:ring-2 focus:ring-offset-1 focus:outline-none"
							onclick={() => handleFeatureClick(node.feature)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									handleFeatureClick(node.feature);
								}
							}}
							title="Click to view this feature on the map"
							aria-label="View feature {node.customText || node.displayText} on map"
						>
							<PropertyIcon key="category" value={node.feature.category || 'place'} size={14} />
							{node.customText || node.displayText}
							<PropertyIcon key="description" value="external_link" size={12} />
						</button>
					{/if}
				{/each}
			</div>
		</div>
	</div>

	<!-- Fixed Story Footer (if metadata is shown) -->
	{#if showMetadata}
		<footer class="story-footer">
			<div class="flex flex-wrap items-center gap-4 text-sm text-gray-500">
				<!-- Date - Clickable to show/hide full date -->
				<button
					class="flex items-center gap-1 rounded hover:text-gray-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:outline-none"
					onclick={() => (showCreatedDate = !showCreatedDate)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							showCreatedDate = !showCreatedDate;
						}
					}}
					title="Click to {showCreatedDate ? 'hide' : 'show'} creation date"
					aria-label="{showCreatedDate ? 'Hide' : 'Show'} creation date"
				>
					<PropertyIcon key="description" value="calendar" size={14} />
					<span
						>Created{showCreatedDate
							? ` ${formatDate(story.dateCreated, { includeTime: true })}`
							: ''}</span
					>
				</button>

				{#if story.dateModified !== story.dateCreated}
					<button
						class="flex items-center gap-1 rounded hover:text-gray-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:outline-none"
						onclick={() => (showUpdatedDate = !showUpdatedDate)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								showUpdatedDate = !showUpdatedDate;
							}
						}}
						title="Click to {showUpdatedDate ? 'hide' : 'show'} update date"
						aria-label="{showUpdatedDate ? 'Hide' : 'Show'} update date"
					>
						<PropertyIcon key="description" value="edit" size={14} />
						<span
							>Updated{showUpdatedDate
								? ` ${formatDate(story.dateModified, { includeTime: true })}`
								: ''}</span
						>
					</button>
				{/if}

				<!-- View count -->
				{#if story.viewCount && story.viewCount > 0}
					<div class="flex items-center gap-1">
						<PropertyIcon key="description" value="eye" size={14} />
						<span>{story.viewCount} view{story.viewCount !== 1 ? 's' : ''}</span>
					</div>
				{/if}

				<!-- Version -->
				<div class="flex items-center gap-1">
					<PropertyIcon key="description" value="version" size={14} />
					<span>v{story.currentVersion}</span>
				</div>

				<!-- Privacy status -->
				{#if story.isPublic}
					<div class="flex items-center gap-1">
						<PropertyIcon key="description" value="public" size={14} />
						<span>Public</span>
					</div>
				{:else}
					<div class="flex items-center gap-1">
						<PropertyIcon key="description" value="private" size={14} />
						<span>Private</span>
					</div>
				{/if}
			</div>
		</footer>
	{/if}
</article>

<style>
	.story-viewer {
		position: relative;
		height: 100vh;
		display: flex;
		flex-direction: column;
		max-height: 100%;
	}

	.story-header {
		/* Fixed header - stays at top */
		position: relative;
		z-index: 1;
		flex-shrink: 0;
		padding: 1rem;
		background: white;
		border-bottom: 1px solid #e5e7eb;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.story-content-container {
		/* Only this scrolls - takes remaining space */
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		min-height: 0;
		max-height: 100%;
	}

	.story-content {
		padding: 1rem;
		line-height: 1.7;
		min-height: 100%;
	}

	.story-footer {
		/* Fixed footer - stays at bottom */
		position: relative;
		z-index: 1;
		flex-shrink: 0;
		padding: 1rem;
		background: white;
		border-top: 1px solid #e5e7eb;
		box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.1);
	}

	.story-text {
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.story-text-span {
		white-space: pre-wrap;
	}

	.story-feature-button {
		margin: 0 2px;
		vertical-align: baseline;
		display: inline-flex;
	}

	/* Gray - Default (not saved or not bookmarked) */
	.story-feature-gray {
		background-color: #f3f4f6;
		border-color: #d1d5db;
		color: #6b7280;
	}

	.story-feature-gray:hover {
		background-color: #e5e7eb;
		border-color: #9ca3af;
	}

	.story-feature-gray:focus {
		--tw-ring-color: #6b7280;
	}

	/* Blue - Bookmarked */
	.story-feature-blue {
		background-color: #ebf8ff;
		border-color: #3182ce;
		color: #2c5282;
	}

	.story-feature-blue:hover {
		background-color: #bee3f8;
		border-color: #2b6cb0;
	}

	.story-feature-blue:focus {
		--tw-ring-color: #3182ce;
	}

	/* Red - Todo */
	.story-feature-red {
		background-color: #fef2f2;
		border-color: #dc2626;
		color: #991b1b;
	}

	.story-feature-red:hover {
		background-color: #fee2e2;
		border-color: #b91c1c;
	}

	.story-feature-red:focus {
		--tw-ring-color: #dc2626;
	}

	/* Green - Visited */
	.story-feature-green {
		background-color: #f0fdf4;
		border-color: #16a34a;
		color: #15803d;
	}

	.story-feature-green:hover {
		background-color: #dcfce7;
		border-color: #15803d;
	}

	.story-feature-green:focus {
		--tw-ring-color: #16a34a;
	}

	.categories-tags-container {
		overflow: hidden;
		width: 100%;
	}

	.categories-tags-scroll {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		padding-bottom: 0.25rem;
		scrollbar-width: thin;
		scrollbar-color: #d1d5db transparent;
	}

	.categories-tags-scroll::-webkit-scrollbar {
		height: 4px;
	}

	.categories-tags-scroll::-webkit-scrollbar-track {
		background: transparent;
	}

	.categories-tags-scroll::-webkit-scrollbar-thumb {
		background: #d1d5db;
		border-radius: 2px;
	}

	.categories-tags-scroll::-webkit-scrollbar-thumb:hover {
		background: #9ca3af;
	}
</style>
