import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			platformProxy: {
				enabled: true
			}
		}),
		serviceWorker: {
			register: true // Enable SvelteKit's service worker
		},
		alias: {
			$paraglide: 'src/paraglide'
		}
	}
};

export default config;
