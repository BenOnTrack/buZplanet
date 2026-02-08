<!-- PWAInstallPrompt.svelte -->
<script lang="ts">
	import { swManager } from '$lib/utils/service-worker-manager.svelte';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let showInstallPrompt = $state(false);
	let deferredPrompt: Event | null = null;
	let hasNativeInstall = $state(false);

	onMount(() => {
		// Don't show install prompt if already installed or permanently dismissed
		if (!browser || swManager.isPWA) {
			return;
		}

		// Check if user has permanently dismissed the install prompt
		const dismissed = localStorage.getItem('pwa-install-dismissed');
		if (dismissed) {
			// Check if dismissal was more than 30 days ago (allow showing again)
			const dismissTime = parseInt(dismissed);
			const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
			if (dismissTime > thirtyDaysAgo) {
				return;
			}
		}

		// Listen for the beforeinstallprompt event (for native browser install)
		window.addEventListener('beforeinstallprompt', (e) => {
			// Prevent the mini-infobar from appearing on mobile
			e.preventDefault();
			// Stash the event so it can be triggered later
			deferredPrompt = e;
			hasNativeInstall = true;
			// Only show our custom install prompt if not already installed
			if (!swManager.isPWA) {
				showInstallPrompt = true;
			}
		});

		// Hide the prompt if app gets installed
		window.addEventListener('appinstalled', () => {
			showInstallPrompt = false;
			deferredPrompt = null;
			hasNativeInstall = false;
		});

		// Check if we should show the prompt after a delay (only if no native prompt is available)
		setTimeout(() => {
			// Only show if still not installed and no native install available
			if (!swManager.isPWA && !hasNativeInstall) {
				showInstallPrompt = true;
			}
		}, 2000);
	});

	async function handleInstall() {
		if (hasNativeInstall && deferredPrompt) {
			// Use native browser install if available
			const installed = await swManager.requestInstall(deferredPrompt);
			if (installed) {
				showInstallPrompt = false;
				deferredPrompt = null;
				hasNativeInstall = false;
			}
		} else {
			// Show manual install instructions
			showManualInstructions();
		}
	}

	function showManualInstructions() {
		// Detect browser/OS for manual instructions
		const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
		const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
		const isChrome = /Chrome/.test(navigator.userAgent);
		const isFirefox = /Firefox/.test(navigator.userAgent);

		let instructions = '';
		if (isIOS && isSafari) {
			instructions = 'Tap the Share button and select "Add to Home Screen"';
		} else if (isChrome) {
			instructions = 'Click the menu (⋮) and select "Install BuzPlanet"';
		} else if (isFirefox) {
			instructions = 'Click the menu (≡) and look for "Install" or "Add to Home Screen"';
		} else {
			instructions = 'Look for "Install" or "Add to Home Screen" in your browser menu';
		}

		alert(
			`To install BuzPlanet:\n\n${instructions}\n\nAfter installing, this prompt will not appear again.`
		);

		// Mark as installed to prevent showing the prompt again
		// (user will likely install after seeing instructions)
		swManager.markAsInstalled();
		showInstallPrompt = false;
	}

	function dismissPrompt() {
		showInstallPrompt = false;
		// Don't reset deferredPrompt in case user changes mind
	}

	function dismissPermanently() {
		// Mark as "don't show again" in localStorage
		if (browser) {
			localStorage.setItem('pwa-install-dismissed', Date.now().toString());
		}
		showInstallPrompt = false;
	}
</script>

{#if showInstallPrompt && !swManager.isPWA}
	<div
		class="fixed right-4 bottom-4 left-4 z-2000 rounded-lg border border-gray-200 bg-white p-4 shadow-xl"
		role="dialog"
		aria-labelledby="install-title"
		aria-describedby="install-description"
	>
		<div class="flex items-start gap-3">
			<div class="mt-1 flex-shrink-0">
				<svg
					class="h-6 w-6 text-blue-600"
					fill="currentColor"
					viewBox="0 0 20 20"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
						clip-rule="evenodd"
					/>
				</svg>
			</div>
			<div class="flex-1">
				<h3 id="install-title" class="font-medium text-gray-900">Install BuzPlanet</h3>
				<p id="install-description" class="mt-1 text-sm text-gray-600">
					Add BuzPlanet to your home screen for quick access and a native app experience.
				</p>
				<div class="mt-3 flex gap-2">
					<button
						onclick={handleInstall}
						class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
						type="button"
					>
						{hasNativeInstall ? 'Install' : 'Show Instructions'}
					</button>
					<button
						onclick={dismissPrompt}
						class="px-4 py-2 text-sm text-gray-600 transition-colors hover:text-gray-800"
						type="button"
					>
						Not now
					</button>
					<button
						onclick={dismissPermanently}
						class="px-3 py-2 text-xs text-gray-500 transition-colors hover:text-gray-700"
						type="button"
						title="Don't show this prompt again for 30 days"
					>
						Don't ask again
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
