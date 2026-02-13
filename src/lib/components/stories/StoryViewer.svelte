<script lang="ts">
	import { clsx } from 'clsx';
	import { mapControl } from '$lib/stores/MapControl.svelte';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';

	let {
		story,
		onFeatureClick = undefined,
		onEditStory = undefined,
		showMetadata = true,
		class: className = ''
	}: {
		story: Story;
		onFeatureClick?: (feature: StoredFeature | SearchResult) => void;
		onEditStory?: (story: Story) => void;
		showMetadata?: boolean;
		class?: string;
	} = $props();

	// Handle feature clicks
	function handleFeatureClick(feature: StoredFeature | SearchResult) {
		if (onFeatureClick) {
			onFeatureClick(feature);
		} else {
			// Default behavior: zoom to feature and open drawer
			if ('geometry' in feature) {
				// It's a StoredFeature
				mapControl.zoomToAndSelectStoredFeature(feature);
			} else {
				// It's a SearchResult
				mapControl.zoomToAndSelectSearchResult(feature);
			}
		}
	}

	// Format date for display
	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	// Get category display info
	function getCategoryColor(categoryId: string): string {
		const categoryColors: Record<string, string> = {
			travel: '#3B82F6',
			food: '#EF4444',
			culture: '#8B5CF6',
			nature: '#10B981',
			urban: '#6B7280',
			history: '#92400E',
			personal: '#EC4899'
		};
		return categoryColors[categoryId] || '#6B7280';
	}
</script>

<article class={clsx('story-viewer', className)}>
	<!-- Story Header with Edit Button -->
	<header class="mb-6">
		<div class="mb-2 flex items-start justify-between">
			<h1 class="flex-1 text-2xl font-bold text-gray-900">{story.title}</h1>

			{#if onEditStory}
				<button
					class="ml-4 flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
					onclick={() => onEditStory && onEditStory(story)}
					title="Edit this story"
				>
					<PropertyIcon key="description" value="edit" size={16} />
					Edit Story
				</button>
			{/if}
		</div>

		{#if story.description}
			<p class="mb-4 text-gray-600">{story.description}</p>
		{/if}

		{#if showMetadata}
			<div class="flex flex-wrap items-center gap-4 text-sm text-gray-500">
				<!-- Date -->
				<div class="flex items-center gap-1">
					<PropertyIcon key="description" value="calendar" size={16} />
					<span>Created {formatDate(story.dateCreated)}</span>
				</div>

				{#if story.dateModified !== story.dateCreated}
					<div class="flex items-center gap-1">
						<PropertyIcon key="description" value="edit" size={16} />
						<span>Updated {formatDate(story.dateModified)}</span>
					</div>
				{/if}

				<!-- View count -->
				{#if story.viewCount && story.viewCount > 0}
					<div class="flex items-center gap-1">
						<PropertyIcon key="description" value="eye" size={16} />
						<span>{story.viewCount} view{story.viewCount !== 1 ? 's' : ''}</span>
					</div>
				{/if}

				<!-- Version -->
				<div class="flex items-center gap-1">
					<PropertyIcon key="description" value="version" size={16} />
					<span>v{story.currentVersion}</span>
				</div>
			</div>

			<!-- Categories and Tags -->
			{#if story.categories.length > 0 || story.tags.length > 0}
				<div class="mt-3 flex flex-wrap gap-2">
					<!-- Categories -->
					{#each story.categories as category}
						<span
							class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-white"
							style="background-color: {getCategoryColor(category)}"
						>
							<PropertyIcon key="description" value="category" size={12} />
							{category}
						</span>
					{/each}

					<!-- Tags -->
					{#each story.tags as tag}
						<span
							class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700"
						>
							<PropertyIcon key="description" value="tag" size={12} />
							{tag}
						</span>
					{/each}
				</div>
			{/if}
		{/if}
	</header>

	<!-- Story Content -->
	<div class="story-content prose prose-gray max-w-none">
		<div class="story-text">
			{#each story.content as node, index}
				{#if node.type === 'text'}
					<span class="story-text-span">{@html node.text.replace(/\n/g, '<br>')}</span>
				{:else if node.type === 'feature'}
					<button
						class="story-feature-button inline-flex items-center gap-1 rounded border border-blue-300 bg-blue-100 px-2 py-1 text-sm font-medium text-blue-800 transition-colors hover:border-blue-400 hover:bg-blue-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:outline-none"
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

	<!-- Story Footer (if metadata is shown) -->
	{#if showMetadata}
		<footer class="mt-8 border-t border-gray-200 pt-4">
			<div class="flex items-center justify-between text-xs text-gray-400">
				<div>
					Story ID: {story.id}
				</div>
				{#if story.isPublic}
					<div class="flex items-center gap-1">
						<PropertyIcon key="description" value="public" size={12} />
						Public story
					</div>
				{:else}
					<div class="flex items-center gap-1">
						<PropertyIcon key="description" value="private" size={12} />
						Private story
					</div>
				{/if}
			</div>
		</footer>
	{/if}
</article>

<style>
	.story-content {
		line-height: 1.7;
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
</style>
