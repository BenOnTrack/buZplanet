<script lang="ts">
	import type { InitializationState } from '$lib/utils/app-initialization';
	
	interface Props {
		state: InitializationState;
		showLogs?: boolean;
	}
	
	let { state, showLogs = false }: Props = $props();
	
	const statusMessages = {
		pending: 'Starting up...',
		initializing: 'Initializing worker...',
		'worker-ready': 'Worker ready, setting up protocols...',
		'protocol-ready': 'Finalizing setup...',
		complete: 'Ready!',
		error: 'Initialization failed'
	};
	
	const statusEmojis = {
		pending: '⏳',
		initializing: '🔄',
		'worker-ready': '⚙️',
		'protocol-ready': '🔗',
		complete: '✅',
		error: '❌'
	};
</script>

<div class="loading-container">
	<div class="loading-content">
		<div class="status-indicator">
			<span class="status-emoji" class:spinning={state.status === 'initializing' || state.status === 'worker-ready' || state.status === 'protocol-ready'}>
				{statusEmojis[state.status]}
			</span>
			<h2 class="status-message">
				{statusMessages[state.status]}
			</h2>
		</div>
		
		{#if state.error}
			<div class="error-message">
				<strong>Error:</strong> {state.error}
			</div>
		{/if}
		
		{#if state.status === 'initializing' || state.status === 'worker-ready' || state.status === 'protocol-ready'}
			<div class="progress-bar">
				<div class="progress-fill" class:step-1={state.status === 'initializing'} class:step-2={state.status === 'worker-ready'} class:step-3={state.status === 'protocol-ready'}></div>
			</div>
		{/if}
		
		{#if showLogs && state.logs.length > 0}
			<details class="logs-section">
				<summary>Initialization Logs</summary>
				<div class="logs-container">
					{#each state.logs as log}
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
		z-index: 9999;
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
		width: 90%;
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