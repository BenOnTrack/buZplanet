<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import { clsx } from 'clsx';
	import { Z_INDEX } from '$lib/styles/z-index';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();
	let activeSnapPoint = $state<string | number>('200px');
</script>

<!-- Trips Drawer -->
<Drawer.Root bind:open snapPoints={['200px', '400px', 1]} bind:activeSnapPoint modal={false}>
	<Drawer.Overlay
		class="fixed inset-0 bg-black/40"
		style="pointer-events: none;z-index: {Z_INDEX.DRAWER_OVERLAY}"
	/>
	<Drawer.Portal>
		<Drawer.Content
			class="border-b-none fixed right-0 bottom-0 left-0 mx-[-1px] flex h-full max-h-[97%] flex-col rounded-t-[10px] border border-gray-200 bg-white"
			style="z-index: {Z_INDEX.DRAWER_CONTENT}"
		>
			<div
				class={clsx('flex w-full flex-col p-4 pt-5', {
					'overflow-y-auto': activeSnapPoint === 1 || activeSnapPoint === '1',
					'overflow-hidden': activeSnapPoint !== 1 && activeSnapPoint !== '1'
				})}
			>
				<div class="mb-4 flex items-center justify-between">
					<Drawer.Title class="flex items-center gap-2 text-lg font-medium sm:text-2xl">
						<span>🗺️</span>
						Trips
					</Drawer.Title>
					<Drawer.Close class="text-gray-500 hover:text-gray-700">
						<PropertyIcon key={'description'} value={'x'} size={20} class="text-foreground" />
						<span class="sr-only">Close</span>
					</Drawer.Close>
				</div>

				<p class="mb-6 text-gray-600">coming soon...</p>
			</div>
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>
