import tailwindcss from '@tailwindcss/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

// Read package.json to get version
let packageVersion = '1.0.0';
try {
  const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
  packageVersion = packageJson.version;
} catch (error) {
  console.warn('Could not read package.json version, using default:', packageVersion);
}

const buildDate = new Date().toISOString();

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		paraglideVitePlugin({ project: './project.inlang', outdir: './src/lib/paraglide' })
	],
	server: {
		port: 5600,
		host: 'localhost',
		strictPort: true
	},
	preview: {
		port: 5600
	},
	// PWA configuration with version tracking
	define: {
		'__DATE__': JSON.stringify(buildDate),
		'__VERSION__': JSON.stringify(packageVersion),
		'__BUILD_TIME__': Date.now()
	}
});
