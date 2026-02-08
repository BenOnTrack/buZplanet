import { deLocalizeUrl } from '$lib/paraglide/runtime';
import { dev } from '$app/environment';

export const reroute = (request) => deLocalizeUrl(request.url).pathname;

// Service Worker Registration
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !dev) {
	navigator.serviceWorker
		.register('/service-worker.js')
		.then((registration) => {
			console.log('SW registered: ', registration);

			// Check for updates
			registration.addEventListener('updatefound', () => {
				console.log('SW update found');
				const newWorker = registration.installing;
				if (newWorker) {
					newWorker.addEventListener('statechange', () => {
						if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
							// New update available
							console.log('New content available, please refresh.');
							// You could show a toast/notification here
						}
					});
				}
			});
		})
		.catch((registrationError) => {
			console.log('SW registration failed: ', registrationError);
		});
}
