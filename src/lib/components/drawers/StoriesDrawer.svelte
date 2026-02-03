<script lang="ts">
	import { Drawer } from "vaul-svelte";
	import { clsx } from "clsx";

	let { open = $bindable(false) }: { open?: boolean } = $props();
	let activeSnapPoint = $state<string | number>("200px");
</script>
<!-- Stories Drawer -->
<Drawer.Root bind:open={open} snapPoints={["200px", "400px", 1]} bind:activeSnapPoint>
	<Drawer.Overlay class="fixed inset-0 bg-black/40 z-[60]" />
	<Drawer.Portal>
		<Drawer.Content class="fixed flex flex-col bg-white border border-gray-200 border-b-none rounded-t-[10px] bottom-0 left-0 right-0 h-full max-h-[97%] mx-[-1px] z-[60]">
			<div class={clsx("flex flex-col w-full p-4 pt-5", {
				"overflow-y-auto": activeSnapPoint === 1 || activeSnapPoint === "1",
				"overflow-hidden": activeSnapPoint !== 1 && activeSnapPoint !== "1",
			})}>
				<div class="flex items-center justify-between mb-4">
					<Drawer.Title class="text-2xl font-medium flex items-center gap-2">
						<span>📚</span>
						Stories
					</Drawer.Title>
					<Drawer.Close class="text-gray-500 hover:text-gray-700">
						<span class="sr-only">Close</span>
						<span aria-hidden="true" class="text-xl">✕</span>
					</Drawer.Close>
				</div>
				
				<p class="text-gray-600 mb-6">Discover amazing stories and adventures from around the world.</p>
				
				<div class="space-y-4">
					<div class="p-4 bg-gray-50 rounded-lg">
						<h3 class="font-medium mb-2 flex items-center gap-2">
							<span class="text-gold-500">🏆</span>
							Featured Stories
						</h3>
						<p class="text-sm text-gray-600">Handpicked tales of adventure, discovery, and human connection.</p>
					</div>
					
					<div class="p-4 bg-gray-50 rounded-lg">
						<h3 class="font-medium mb-2 flex items-center gap-2">
							<span class="text-blue-500">🌍</span>
							Travel Stories
						</h3>
						<p class="text-sm text-gray-600">Journey through different cultures and breathtaking destinations.</p>
					</div>
					
					<div class="p-4 bg-gray-50 rounded-lg">
						<h3 class="font-medium mb-2 flex items-center gap-2">
							<span class="text-red-500">❤️</span>
							Personal Stories
						</h3>
						<p class="text-sm text-gray-600">Heartfelt experiences and life-changing moments shared by our community.</p>
					</div>
				</div>
				
				<button class="bg-black text-white mt-8 rounded-md h-12 flex-shrink-0 font-medium">
					Read Stories
				</button>
				
				<div class="mt-8">
					<h2 class="text-xl font-medium mb-4">Recent Stories</h2>
					<div class="space-y-4">
						<div>
							<span class="block font-medium">The Mountain That Changed Everything</span>
							<span class="text-gray-600">A journey of self-discovery in the Himalayas.</span>
						</div>
						<div>
							<span class="block font-medium">Finding Home in Tokyo</span>
							<span class="text-gray-600">An expat's tale of belonging in urban Japan.</span>
						</div>
						<div>
							<span class="block font-medium">The Kindness of Strangers</span>
							<span class="text-gray-600">How a flat tire led to lifelong friendships.</span>
						</div>
					</div>
				</div>
			</div>
	</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>