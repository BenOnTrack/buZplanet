import tailwindcss from '@tailwindcss/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import devtoolsJson from 'vite-plugin-devtools-json';

// Read package.json to get version
let packageVersion = '1.0.0';
try {
	const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
	packageVersion = packageJson.version;
} catch (error) {
	console.warn('Could not read package.json version, using default:', packageVersion);
}

const buildDate = new Date().toISOString();

export default defineConfig(({ mode }) => {
	const isProduction = mode === 'production';

	return {
		plugins: [
			tailwindcss(),
			sveltekit(),
			// Only include devtools in development
			...(!isProduction ? [devtoolsJson()] : []),
			paraglideVitePlugin({ project: './project.inlang', outdir: './src/lib/paraglide' })
		],
		server: {
			port: 5600,
			host: 'localhost',
			strictPort: true,
			// For WASM compatibility
			headers: {
				'Cross-Origin-Embedder-Policy': 'require-corp',
				'Cross-Origin-Opener-Policy': 'same-origin',
				'Access-Control-Allow-Origin': '*'
			}
		},
		preview: {
			port: 5600,
			// Also add headers for preview mode
			headers: {
				'Cross-Origin-Embedder-Policy': 'require-corp',
				'Cross-Origin-Opener-Policy': 'same-origin',
				'Access-Control-Allow-Origin': '*'
			}
		},
		optimizeDeps: {
			exclude: ['@sqlite.org/sqlite-wasm'],
			include: [
				'maplibre-gl',
				'@mapbox/vector-tile',
				'pbf',
				'p-defer',
				'@turf/distance',
				'@turf/helpers'
			],
			esbuildOptions: {
				target: 'es2022'
			}
		},
		// Worker configuration for better memory management
		worker: {
			format: 'es',
			rollupOptions: {
				output: {
					entryFileNames: 'worker-[name]-[hash].js',
					format: 'es'
				}
			}
		},
		build: {
			target: 'es2022',
			commonjsOptions: {
				transformMixedEsModules: true
			}
		},
		// PWA configuration with version tracking
		define: {
			__DATE__: JSON.stringify(buildDate),
			__VERSION__: JSON.stringify(packageVersion),
			__BUILD_TIME__: Date.now()
		}
	};
});
