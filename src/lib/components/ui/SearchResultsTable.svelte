<script lang="ts">
	import { formatFeatureProperty } from '$lib/utils/text-formatting.js';

	let {
		results = [],
		onRowClick,
		maxResults = undefined,
		showHeader = true
	}: {
		results: SearchResult[];
		onRowClick: (result: SearchResult, event: Event) => void;
		maxResults?: number;
		showHeader?: boolean;
	} = $props();

	// Get result's primary name - same logic as FeaturesDrawer
	function getResultName(result: SearchResult): string {
		return (
			result.names['name:en'] ||
			result.names.name ||
			(result.category ? formatFeatureProperty(result.category) : '') ||
			Object.values(result.names)[0] || // fallback to first available name
			'Unnamed'
		);
	}

	// Get result's secondary name - same logic as FeaturesDrawer
	function getResultSecondaryName(result: SearchResult): string | null {
		const primaryName = getResultName(result);
		const regularName = result.names.name;

		// Only show the regular 'name' if it exists and is different from the primary name
		if (regularName && regularName !== primaryName) {
			return regularName;
		}

		return null;
	}

	// Get icon for class type (simple fallback function)
	function getClassIcon(className: string): string {
		// Simple fallback - just return an emoji based on class type
		switch (className?.toLowerCase()) {
			case 'highway':
			case 'road':
				return '🛣️';
			case 'building':
				return '🏢';
			case 'restaurant':
			case 'food':
				return '🍴';
			case 'hotel':
			case 'accommodation':
				return '🏨';
			case 'shop':
			case 'retail':
				return '🏪';
			case 'tourism':
			case 'attraction':
				return '🎯';
			case 'transport':
			case 'transportation':
				return '🚌';
			case 'health':
			case 'medical':
				return '🏥';
			case 'education':
			case 'school':
				return '🏫';
			case 'place':
			case 'locality':
				return '📍';
			default:
				return '📍';
		}
	}

	// Create unique key for each result to avoid duplicate key errors
	function createUniqueKey(result: SearchResult, index: number): string {
		// Combine multiple fields to ensure uniqueness
		return `${result.id}-${result.database}-${result.layer}-${result.lng}-${result.lat}-${index}`;
	}

	// Apply max results limit if specified
	let displayResults = $derived.by(() => {
		if (maxResults && results.length > maxResults) {
			return results.slice(0, maxResults);
		}
		return results;
	});
</script>

<div class="overflow-x-auto">
	<table class="w-full min-w-[600px] text-sm">
		{#if showHeader}
			<thead class="sticky top-0 bg-gray-50">
				<tr class="border-b border-gray-200">
					<th class="min-w-[140px] pr-4 pb-2 text-left font-medium text-gray-700">Name</th>
					<th class="min-w-[50px] pr-2 pb-2 text-center font-medium text-gray-700">Type</th>
					<th class="min-w-[80px] pr-2 pb-2 text-left font-medium text-gray-700">Class</th>
					<th class="min-w-[100px] pr-2 pb-2 text-left font-medium text-gray-700">Subclass</th>
					<th class="min-w-[80px] pr-2 pb-2 text-left font-medium text-gray-700">Category</th>
				</tr>
			</thead>
		{/if}
		<tbody class="divide-y divide-gray-100">
			{#each displayResults as result, index (createUniqueKey(result, index))}
				<tr
					class="group cursor-pointer transition-colors hover:bg-blue-50 focus:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:ring-inset active:bg-blue-100"
					onclick={(e) => onRowClick(result, e)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							onRowClick(result, e);
						}
					}}
					tabindex="0"
					role="button"
					aria-label="Select and zoom to {getResultName(result)}"
					title="Click to zoom to and select this feature on the map"
				>
					<td class="py-3 pr-4">
						<div class="flex items-center gap-2">
							<div class="flex-1">
								<div class="leading-tight font-medium text-gray-900">
									{getResultName(result)}
								</div>
								<div class="mt-1 text-xs text-gray-500">
									{#if getResultSecondaryName(result)}
										{getResultSecondaryName(result)}
									{/if}
								</div>
							</div>
							<div class="text-gray-400 opacity-0 transition-opacity group-hover:opacity-100">
								<span class="text-xs">🔍</span>
							</div>
						</div>
					</td>
					<td class="py-3 pr-2">
						<div class="flex justify-center">
							<span class="text-lg" title={formatFeatureProperty(result.class)}>
								{getClassIcon(result.class)}
							</span>
						</div>
					</td>
					<td class="py-3 pr-2 text-xs text-gray-600">
						<div
							class="max-w-20 truncate"
							title={result.class ? formatFeatureProperty(result.class) : '-'}
						>
							{result.class ? formatFeatureProperty(result.class) : '-'}
						</div>
					</td>
					<td class="py-3 pr-2 text-xs text-gray-600">
						<div
							class="max-w-20 truncate"
							title={result.subclass ? formatFeatureProperty(result.subclass) : '-'}
						>
							{result.subclass ? formatFeatureProperty(result.subclass) : '-'}
						</div>
					</td>
					<td class="py-3 pr-2 text-xs text-gray-600">
						<div
							class="max-w-24 truncate"
							title={result.category ? formatFeatureProperty(result.category) : '-'}
						>
							{result.category ? formatFeatureProperty(result.category) : '-'}
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
	{#if maxResults && results.length > maxResults}
		<div class="border-t bg-gray-50 py-2 text-center text-xs text-gray-500">
			Showing first {maxResults} of {results.length} results{results.length > displayResults.length
				? '. Search will continue...'
				: ''}
		</div>
	{/if}
</div>
