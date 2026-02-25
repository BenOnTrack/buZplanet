<script lang="ts">
	import { storiesDB } from '$lib/stores/StoriesDB.svelte';
	import { featuresDB } from '$lib/stores/FeaturesDB.svelte';
	import { authState } from '$lib/stores/auth.svelte';

	let testResults = $state<string[]>([]);
	let isRunning = $state(false);

	function log(message: string) {
		console.log(message);
		testResults = [...testResults, `${new Date().toLocaleTimeString()}: ${message}`];
	}

	function clearLog() {
		testResults = [];
	}

	async function testOfflineSync() {
		if (isRunning) return;
		isRunning = true;
		clearLog();

		try {
			if (!authState.user) {
				log('❌ Error: User not authenticated');
				return;
			}

			log('🚀 Starting offline sync test...');
			log(`👤 User: ${authState.user.email}`);

			// Get initial sync status
			const storySyncStatus = storiesDB.getSyncStatus();
			const featureSyncStatus = featuresDB.getSyncStatus();

			log(`📊 Initial Story sync status: ${JSON.stringify(storySyncStatus)}`);
			log(`📊 Initial Feature sync status: ${JSON.stringify(featureSyncStatus)}`);

			// Test story creation while offline
			log('📝 Creating test story while potentially offline...');
			const testStory = await storiesDB.createStory(
				`Test Story ${Date.now()}`,
				[
					{
						type: 'text',
						text: 'This is a test story created to verify offline sync functionality.'
					}
				],
				{
					description: 'Test story for offline sync verification',
					categories: [],
					isPublic: false
				}
			);

			log(`✅ Created test story: ${testStory.title} (ID: ${testStory.id})`);
			log(`📤 Pending upload flag: ${(testStory as any).pendingUpload || false}`);

			// Test story update
			log('✏️ Updating test story...');
			const updatedStory = await storiesDB.updateStory(testStory.id, {
				title: testStory.title + ' (Updated)',
				description: 'Updated test story for offline sync verification'
			});

			log(`✅ Updated test story: ${updatedStory.title}`);
			log(`📤 Pending upload flag after update: ${(updatedStory as any).pendingUpload || false}`);

			// Create a test bookmark list
			log('📋 Creating test bookmark list...');
			const testList = await featuresDB.createBookmarkList({
				name: `Test List ${Date.now()}`,
				description: 'Test bookmark list for offline sync verification',
				color: 'blue'
			});

			log(`✅ Created test bookmark list: ${testList.name} (ID: ${testList.id})`);
			log(`📤 Pending upload flag: ${(testList as any).pendingUpload || false}`);

			// Force upload pending changes
			log('🔄 Force uploading pending changes...');
			await storiesDB.uploadPendingLocalChanges();
			await featuresDB.uploadPendingLocalChanges();

			log('✅ Completed force upload of pending changes');

			// Get final sync status
			const finalStorySyncStatus = storiesDB.getSyncStatus();
			const finalFeatureSyncStatus = featuresDB.getSyncStatus();

			log(`📊 Final Story sync status: ${JSON.stringify(finalStorySyncStatus)}`);
			log(`📊 Final Feature sync status: ${JSON.stringify(finalFeatureSyncStatus)}`);

			log('🎉 Offline sync test completed successfully!');
			log('💡 Check the console for detailed sync logs');
			log(
				'💡 Try going offline, creating content, then going back online to test real offline behavior'
			);
		} catch (error) {
			log(`❌ Test failed: ${error}`);
			console.error('Offline sync test error:', error);
		} finally {
			isRunning = false;
		}
	}

	// Real offline simulation functions
	function simulateOffline() {
		// Temporarily override navigator.onLine
		Object.defineProperty(navigator, 'onLine', {
			writable: true,
			value: false
		});

		// Dispatch offline event
		window.dispatchEvent(new Event('offline'));
		log('📴 Simulated going offline');
	}

	function simulateOnline() {
		// Restore navigator.onLine
		Object.defineProperty(navigator, 'onLine', {
			writable: true,
			value: true
		});

		// Dispatch online event
		window.dispatchEvent(new Event('online'));
		log('🌐 Simulated going back online');
	}
</script>

<div class="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
	<h2 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">Offline Sync Tester</h2>

	<div class="space-y-4">
		<!-- Test Controls -->
		<div class="flex flex-wrap gap-3">
			<button
				onclick={testOfflineSync}
				disabled={isRunning}
				class="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{isRunning ? 'Running Test...' : 'Run Sync Test'}
			</button>

			<button
				onclick={simulateOffline}
				class="rounded-md bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
			>
				📴 Simulate Offline
			</button>

			<button
				onclick={simulateOnline}
				class="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
			>
				🌐 Simulate Online
			</button>

			<button
				onclick={clearLog}
				class="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
			>
				Clear Log
			</button>
		</div>

		<!-- Current Status -->
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div class="rounded bg-gray-100 p-3 dark:bg-gray-700">
				<h3 class="mb-2 font-semibold text-gray-900 dark:text-white">Stories DB Status</h3>
				{#if storiesDB.initialized}
					<div class="text-sm text-gray-600 dark:text-gray-300">
						<div>Online: {storiesDB.getSyncStatus().online ? '✅' : '❌'}</div>
						<div>Syncing: {storiesDB.getSyncStatus().syncing ? '🔄' : '⏸️'}</div>
						<div>Authenticated: {storiesDB.getSyncStatus().authenticated ? '✅' : '❌'}</div>
						<div>
							Last Sync: {storiesDB.getSyncStatus().lastSync
								? new Date(storiesDB.getSyncStatus().lastSync).toLocaleString()
								: 'Never'}
						</div>
					</div>
				{:else}
					<div class="text-sm text-yellow-600">Initializing...</div>
				{/if}
			</div>

			<div class="rounded bg-gray-100 p-3 dark:bg-gray-700">
				<h3 class="mb-2 font-semibold text-gray-900 dark:text-white">Features DB Status</h3>
				{#if featuresDB.initialized}
					<div class="text-sm text-gray-600 dark:text-gray-300">
						<div>Online: {featuresDB.getSyncStatus().online ? '✅' : '❌'}</div>
						<div>Syncing: {featuresDB.getSyncStatus().syncing ? '🔄' : '⏸️'}</div>
						<div>Authenticated: {featuresDB.getSyncStatus().authenticated ? '✅' : '❌'}</div>
						<div>
							Last Sync: {featuresDB.getSyncStatus().lastSync
								? new Date(featuresDB.getSyncStatus().lastSync).toLocaleString()
								: 'Never'}
						</div>
					</div>
				{:else}
					<div class="text-sm text-yellow-600">Initializing...</div>
				{/if}
			</div>
		</div>

		<!-- Test Results -->
		<div class="mt-6">
			<h3 class="mb-2 font-semibold text-gray-900 dark:text-white">Test Results</h3>
			<div
				class="max-h-96 overflow-y-auto rounded-md bg-black p-4 font-mono text-sm text-green-400"
			>
				{#if testResults.length === 0}
					<div class="text-gray-500">No test results yet. Click "Run Sync Test" to begin.</div>
				{:else}
					{#each testResults as result}
						<div class="mb-1">{result}</div>
					{/each}
				{/if}
			</div>
		</div>

		<!-- Instructions -->
		<div
			class="mt-6 rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20"
		>
			<h3 class="mb-2 font-semibold text-blue-900 dark:text-blue-100">How to Test Offline Sync</h3>
			<ol class="list-inside list-decimal space-y-1 text-sm text-blue-800 dark:text-blue-200">
				<li>First, run the sync test while online to create test data</li>
				<li>Use "Simulate Offline" to test offline behavior</li>
				<li>Create/modify some stories or features while "offline"</li>
				<li>Use "Simulate Online" to trigger sync when going back online</li>
				<li>Check the browser's Network tab to see actual Firestore requests</li>
				<li>For real testing, turn off your internet connection and turn it back on</li>
			</ol>
		</div>
	</div>
</div>
