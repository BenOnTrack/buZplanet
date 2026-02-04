<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import { clsx } from 'clsx';

	let { open = $bindable(false) }: { open?: boolean } = $props();
	let activeSnapPoint = $state<string | number>('200px');
</script>

<!-- Trips Drawer -->
<Drawer.Root bind:open snapPoints={['200px', '400px', 1]} bind:activeSnapPoint modal={false}>
	<Drawer.Overlay class="fixed inset-0 z-60 bg-black/40" style="pointer-events: none" />
	<Drawer.Portal>
		<Drawer.Content
			class="border-b-none fixed right-0 bottom-0 left-0 z-60 mx-[-1px] flex h-full max-h-[97%] flex-col rounded-t-[10px] border border-gray-200 bg-white"
		>
			<div
				class={clsx('flex w-full flex-col p-4 pt-5', {
					'overflow-y-auto': activeSnapPoint === 1 || activeSnapPoint === '1',
					'overflow-hidden': activeSnapPoint !== 1 && activeSnapPoint !== '1'
				})}
			>
				<div class="mb-4 flex items-center justify-between">
					<Drawer.Title class="flex items-center gap-2 text-2xl font-medium">
						<span>🗺️</span>
						Trips
					</Drawer.Title>
					<Drawer.Close class="text-gray-500 hover:text-gray-700">
						<span class="sr-only">Close</span>
						<span aria-hidden="true" class="text-xl">✕</span>
					</Drawer.Close>
				</div>

				<p class="mb-6 text-gray-600">
					Plan and explore your next adventure with our trip planning tools.
				</p>

				<div class="space-y-4">
					<div class="rounded-lg bg-gray-50 p-4">
						<h3 class="mb-2 flex items-center gap-2 font-medium">
							<span class="text-blue-500">📝</span>
							Trip Planning
						</h3>
						<p class="text-sm text-gray-600">
							Create detailed itineraries with destinations, activities, and budgets.
						</p>
					</div>

					<div class="rounded-lg bg-gray-50 p-4">
						<h3 class="mb-2 flex items-center gap-2 font-medium">
							<span class="text-green-500">📸</span>
							Trip Memories
						</h3>
						<p class="text-sm text-gray-600">
							Capture and share your favorite moments from past adventures.
						</p>
					</div>

					<div class="rounded-lg bg-gray-50 p-4">
						<h3 class="mb-2 flex items-center gap-2 font-medium">
							<span class="text-orange-500">🌍</span>
							Destination Guides
						</h3>
						<p class="text-sm text-gray-600">
							Discover hidden gems and local insights for your destinations.
						</p>
					</div>
				</div>

				<button class="mt-8 h-12 flex-shrink-0 rounded-md bg-black font-medium text-white">
					Plan New Trip
				</button>

				<div class="mt-8">
					<h2 class="mb-4 text-xl font-medium">Upcoming Trips</h2>
					<div class="space-y-4">
						<div>
							<span class="block font-medium">Tokyo Adventure</span>
							<span class="text-gray-600">March 15-22, 2024 • 7 days in Japan</span>
						</div>
						<div>
							<span class="block font-medium">European Road Trip</span>
							<span class="text-gray-600">June 10-30, 2024 • 3 weeks across 5 countries</span>
						</div>
						<div>
							<span class="block font-medium">Bali Retreat</span>
							<span class="text-gray-600">August 5-12, 2024 • Wellness and relaxation</span>
						</div>
					</div>
				</div>

				<div class="mt-12">
					<figure>
						<blockquote class="font-serif italic">
							"The trip planning feature made organizing our family vacation so much easier. We
							discovered places we never would have found otherwise!"
						</blockquote>
						<figcaption>
							<span class="mt-2 block text-sm text-gray-600">
								Sarah Johnson, Travel Enthusiast
							</span>
						</figcaption>
					</figure>
				</div>
			</div>
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>
