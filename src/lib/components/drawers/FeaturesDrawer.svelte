<script lang="ts">
	import { Drawer } from "vaul-svelte";
	import { clsx } from "clsx";

	let { open = $bindable(false) }: { open?: boolean } = $props();
	let activeSnapPoint = $state<string | number>("200px");
</script>
<!-- Features Drawer -->
<Drawer.Root bind:open={open} snapPoints={["200px", "400px", 1]} bind:activeSnapPoint modal={false}>
	<Drawer.Overlay class="fixed inset-0 bg-black/40 z-60" style="pointer-events: none" />
	<Drawer.Portal>
		<Drawer.Content class="fixed flex flex-col bg-white border border-gray-200 border-b-none rounded-t-[10px] bottom-0 left-0 right-0 h-full max-h-[97%] mx-[-1px] z-60">
			<div class={clsx("flex flex-col w-full p-4 pt-5", {
				"overflow-y-auto": activeSnapPoint === 1 || activeSnapPoint === "1",
				"overflow-hidden": activeSnapPoint !== 1 && activeSnapPoint !== "1",
			})}>
				<div class="flex items-center justify-between mb-4">
					<Drawer.Title class="text-2xl font-medium flex items-center gap-2">
						<span>⭐</span>
						Features
					</Drawer.Title>
					<Drawer.Close class="text-gray-500 hover:text-gray-700">
						<span class="sr-only">Close</span>
						<span aria-hidden="true" class="text-xl">✕</span>
					</Drawer.Close>
				</div>
				
				<p class="text-gray-600 mb-6">Explore all the amazing features available in our platform.</p>
				
				<div class="space-y-4">
					<div class="p-4 bg-gray-50 rounded-lg">
						<h3 class="font-medium mb-2 flex items-center gap-2">
							<span class="text-blue-500">🚀</span>
							Premium Features
						</h3>
						<p class="text-sm text-gray-600">Access advanced functionality with enhanced performance and exclusive tools.</p>
					</div>
					
					<div class="p-4 bg-gray-50 rounded-lg">
						<h3 class="font-medium mb-2 flex items-center gap-2">
							<span class="text-green-500">✨</span>
							New Features
						</h3>
						<p class="text-sm text-gray-600">Latest updates including improved performance and new integrations.</p>
					</div>
					
					<div class="p-4 bg-gray-50 rounded-lg">
						<h3 class="font-medium mb-2 flex items-center gap-2">
							<span class="text-purple-500">🔧</span>
							Customization
						</h3>
						<p class="text-sm text-gray-600">Personalize your experience with custom themes and layouts.</p>
					</div>
				</div>
				
				<button class="bg-black text-white mt-8 rounded-md h-12 flex-shrink-0 font-medium">
					Explore Features
				</button>
			</div>
	</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>