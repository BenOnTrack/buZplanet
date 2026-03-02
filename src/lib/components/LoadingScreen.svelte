<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { Z_INDEX } from '$lib/styles/z-index';

	interface Props {
		initState: InitializationState;
		showLogs?: boolean;
	}

	let { initState, showLogs = false }: Props = $props();

	// Service Worker installation progress
	let swInstallProgress = $state({
		isInstalling: false,
		version: '',
		currentBatch: 0,
		totalBatches: 0,
		totalAssets: 0,
		progress: 0,
		hasErrors: false,
		isComplete: false
	});

	onMount(() => {
		if (!browser) return;

		// Listen for service worker installation messages
		const handleMessage = (event: MessageEvent) => {
			const { data } = event;

			switch (data?.type) {
				case 'SW_INSTALL_START':
					swInstallProgress = {
						isInstalling: true,
						version: data.version,
						currentBatch: 0,
						totalBatches: data.totalBatches,
						totalAssets: data.totalAssets,
						progress: 0,
						hasErrors: false,
						isComplete: false
					};
					break;

				case 'SW_INSTALL_PROGRESS':
					if (swInstallProgress.isInstalling) {
						swInstallProgress = {
							...swInstallProgress,
							currentBatch: data.currentBatch,
							progress: data.progress,
							hasErrors: data.hasErrors || swInstallProgress.hasErrors
						};
					}
					break;

				case 'SW_INSTALL_COMPLETE':
					if (swInstallProgress.isInstalling) {
						swInstallProgress = {
							...swInstallProgress,
							progress: 100,
							isComplete: true
						};

						// Hide SW progress after 2 seconds
						setTimeout(() => {
							swInstallProgress.isInstalling = false;
						}, 2000);
					}
					break;
			}
		};

		navigator.serviceWorker?.addEventListener('message', handleMessage);

		return () => {
			navigator.serviceWorker?.removeEventListener('message', handleMessage);
		};
	});

	const statusMessages = {
		pending: 'Starting up...',
		initializing: 'Initializing worker...',
		'auth-waiting': 'Waiting for authentication...',
		'appstate-loading': 'Loading app state...',
		'worker-ready': 'Worker ready, loading app state...',
		'appstate-ready': 'App state loaded, setting up protocols...',
		'protocol-ready': 'Protocols ready, finalizing setup...',
		'database-scanning': 'Scanning databases...',
		complete: 'Ready!',
		error: 'Initialization failed'
	};

	const statusEmojis = {
		pending: '⏳',
		initializing: '🔄',
		'auth-waiting': '🔐',
		'appstate-loading': '🗺️',
		'worker-ready': '⚙️',
		'appstate-ready': '🗺️',
		'protocol-ready': '🔗',
		'database-scanning': '🗄️',
		complete: '✅',
		error: '❌'
	};
</script>

<div class="loading-container" style="z-index: {Z_INDEX.LOADING}">
	<div class="loading-content">
		<div class="status-indicator">
			<span
				class="status-emoji"
				class:spinning={initState.status === 'initializing' ||
					initState.status === 'auth-waiting' ||
					initState.status === 'appstate-loading' ||
					initState.status === 'worker-ready' ||
					initState.status === 'appstate-ready' ||
					initState.status === 'protocol-ready' ||
					initState.status === 'database-scanning' ||
					swInstallProgress.isInstalling}
			>
				{swInstallProgress.isInstalling ? '📦' : statusEmojis[initState.status]}
			</span>
			<h2 class="status-message">
				{#if swInstallProgress.isInstalling}
					{#if swInstallProgress.isComplete}
						App Update Installed!
					{:else}
						Installing App Update...
					{/if}
				{:else}
					{statusMessages[initState.status]}
				{/if}
			</h2>

			<!-- Service Worker Installation Progress -->
			{#if swInstallProgress.isInstalling}
				<div class="sw-progress-info">
					{#if swInstallProgress.isComplete}
						<p class="sw-progress-text">
							✅ {swInstallProgress.totalAssets} assets cached successfully!
							{#if swInstallProgress.hasErrors}
								<span class="sw-errors">(with some errors)</span>
							{/if}
						</p>
					{:else}
						<p class="sw-progress-text">
							Caching batch {swInstallProgress.currentBatch}/{swInstallProgress.totalBatches}
							<br />({swInstallProgress.totalAssets} total assets)
							{#if swInstallProgress.hasErrors}
								<span class="sw-errors">⚠️ Some errors occurred</span>
							{/if}
						</p>
					{/if}
				</div>
			{/if}
		</div>

		{#if initState.error}
			<div class="error-message">
				<strong>Error:</strong>
				{initState.error}
			</div>
		{/if}

		{#if initState.status === 'initializing' || initState.status === 'auth-waiting' || initState.status === 'appstate-loading' || initState.status === 'worker-ready' || initState.status === 'appstate-ready' || initState.status === 'protocol-ready' || initState.status === 'database-scanning' || swInstallProgress.isInstalling}
			<div class="progress-bar">
				{#if swInstallProgress.isInstalling}
					<!-- Service Worker Installation Progress -->
					<div
						class="progress-fill sw-progress"
						class:sw-complete={swInstallProgress.isComplete}
						class:sw-error={swInstallProgress.hasErrors && !swInstallProgress.isComplete}
						style="width: {swInstallProgress.progress}%"
					></div>
					<div class="progress-label">{swInstallProgress.progress}% cached</div>
				{:else}
					<!-- App Initialization Progress -->
					<div
						class="progress-fill"
						class:step-1={initState.status === 'initializing'}
						class:step-2={initState.status === 'worker-ready'}
						class:step-3={initState.status === 'appstate-ready'}
						class:step-4={initState.status === 'protocol-ready'}
						class:step-5={initState.status === 'database-scanning'}
					></div>
				{/if}
			</div>
		{/if}

		{#if showLogs && initState.logs.length > 0}
			<details class="logs-section">
				<summary>Initialization Logs</summary>
				<div class="logs-container">
					{#each initState.logs as log}
						<div class="log-entry">{log}</div>
					{/each}
				</div>
			</details>
		{/if}
	</div>
</div>

<style>
	.loading-container {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		height: 100dvh;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.loading-content {
		text-align: center;
		max-width: 400px;
		padding: 2rem;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 16px;
		backdrop-filter: blur(10px);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
	}

	.status-indicator {
		margin-bottom: 2rem;
	}

	.status-emoji {
		font-size: 3rem;
		display: block;
		margin-bottom: 1rem;
		transition: transform 0.3s ease;
	}

	.status-emoji.spinning {
		animation: spin 2s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.status-message {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		opacity: 0.9;
	}

	.error-message {
		background: rgba(255, 107, 107, 0.2);
		border: 1px solid rgba(255, 107, 107, 0.4);
		border-radius: 8px;
		padding: 1rem;
		margin-bottom: 1rem;
		font-size: 0.9rem;
	}

	.progress-bar {
		width: 100%;
		height: 4px;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 2px;
		overflow: hidden;
		margin-bottom: 1.5rem;
		position: relative;
	}

	.progress-fill {
		height: 100%;
		background: rgba(255, 255, 255, 0.8);
		border-radius: 2px;
		transition: width 0.5s ease;
		width: 0%;
	}

	.progress-fill.step-1 {
		width: 33%;
	}

	.progress-fill.step-2 {
		width: 66%;
	}

	.progress-fill.step-3 {
		width: 70%;
	}

	.progress-fill.step-4 {
		width: 80%;
	}

	.progress-fill.step-5 {
		width: 95%;
	}

	/* Service Worker Progress Styles */
	.progress-fill.sw-progress {
		background: linear-gradient(90deg, #4ade80, #22c55e);
		transition: width 0.3s ease;
	}

	.progress-fill.sw-complete {
		background: linear-gradient(90deg, #10b981, #059669);
	}

	.progress-fill.sw-error {
		background: linear-gradient(90deg, #f59e0b, #d97706);
	}

	.progress-label {
		position: absolute;
		top: -20px;
		right: 0;
		font-size: 0.75rem;
		opacity: 0.8;
		font-weight: 500;
	}

	.sw-progress-info {
		margin-top: 1rem;
	}

	.sw-progress-text {
		font-size: 0.9rem;
		opacity: 0.9;
		margin: 0;
		line-height: 1.4;
	}

	.sw-errors {
		color: #fbbf24;
		font-size: 0.8rem;
		display: block;
		margin-top: 0.25rem;
	}

	.logs-section {
		margin-top: 1.5rem;
		text-align: left;
	}

	.logs-section summary {
		cursor: pointer;
		font-weight: 600;
		margin-bottom: 0.5rem;
		color: rgba(255, 255, 255, 0.9);
	}

	.logs-container {
		max-height: 150px;
		overflow-y: auto;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 4px;
		padding: 0.75rem;
		font-family: monospace;
		font-size: 0.75rem;
		line-height: 1.4;
	}

	.log-entry {
		margin-bottom: 0.25rem;
		opacity: 0.8;
	}

	.log-entry:last-child {
		margin-bottom: 0;
	}

	/* Mobile responsiveness */
	@media (max-width: 480px) {
		.loading-content {
			max-width: 320px;
			padding: 1.5rem;
		}

		.status-emoji {
			font-size: 2.5rem;
		}

		.status-message {
			font-size: 1.1rem;
		}

		.logs-container {
			font-size: 0.7rem;
		}
	}
</style>
