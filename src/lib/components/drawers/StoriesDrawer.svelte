<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import { clsx } from 'clsx';

	let { open = $bindable(false) }: { open?: boolean } = $props();
	let activeSnapPoint = $state<string | number>('200px');
</script>

<!-- Stories Drawer -->
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
						<span>📚</span>
						Stories
					</Drawer.Title>
					<Drawer.Close class="text-gray-500 hover:text-gray-700">
						<span class="sr-only">Close</span>
						<span aria-hidden="true" class="text-xl">✕</span>
					</Drawer.Close>
				</div>

				<p class="mb-6 text-gray-600">coming soon...</p>
			</div>
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>
