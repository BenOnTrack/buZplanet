<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import { clsx } from 'clsx';

	let { open = $bindable(false) }: { open?: boolean } = $props();
	let activeSnapPoint = $state<string | number>('200px');
</script>

<!-- Features Drawer -->
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
						<span>⭐</span>
						Features
					</Drawer.Title>
					<Drawer.Close class="text-gray-500 hover:text-gray-700">
						<span class="sr-only">Close</span>
						<span aria-hidden="true" class="text-xl">✕</span>
					</Drawer.Close>
				</div>

				<p class="mb-6 text-gray-600">
					Explore all the amazing features available in our platform.
				</p>

				<div class="space-y-4">
					<div class="rounded-lg bg-gray-50 p-4">
						<h3 class="mb-2 flex items-center gap-2 font-medium">
							<span class="text-blue-500">🚀</span>
							Premium Features
						</h3>
						<p class="text-sm text-gray-600">
							Access advanced functionality with enhanced performance and exclusive tools.
						</p>
					</div>

					<div class="rounded-lg bg-gray-50 p-4">
						<h3 class="mb-2 flex items-center gap-2 font-medium">
							<span class="text-green-500">✨</span>
							New Features
						</h3>
						<p class="text-sm text-gray-600">
							Latest updates including improved performance and new integrations.
						</p>
					</div>

					<div class="rounded-lg bg-gray-50 p-4">
						<h3 class="mb-2 flex items-center gap-2 font-medium">
							<span class="text-purple-500">🔧</span>
							Customization
						</h3>
						<p class="text-sm text-gray-600">
							Personalize your experience with custom themes and layouts.
						</p>
					</div>
				</div>

				<button class="mt-8 h-12 flex-shrink-0 rounded-md bg-black font-medium text-white">
					Explore Features
				</button>
			</div>
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>
