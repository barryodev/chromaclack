import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Set by `tauri dev`/`tauri android dev` so a physical device can reach the
// dev server over the LAN. Undefined for plain web development.
const host = process.env.TAURI_DEV_HOST;

// Set by the Tauri CLI during `tauri build` / `tauri dev`.
const tauriPlatform = process.env.TAURI_ENV_PLATFORM;
const tauriDebug = !!process.env.TAURI_ENV_DEBUG;

export default defineConfig({
	plugins: [sveltekit()],

	// Tauri drives the CLI; keep its output visible.
	clearScreen: false,

	server: {
		// Must match `build.devUrl` in tauri.conf.json, so fail loudly rather
		// than silently moving to another port.
		port: 5173,
		strictPort: true,
		host: host ?? false,
		hmr: host ? { protocol: 'ws', host, port: 5174 } : undefined,
		proxy: {
			'/api': {
				target: 'http://127.0.0.1:8787',
				changeOrigin: true
			}
		},
		fs: {
			// `@repo/services` is a symlinked workspace package that lives
			// outside this app's root; Vite needs permission to read it.
			allow: ['../..']
		}
	},

	// Ship the TypeScript source of workspace packages through Vite's own
	// pipeline instead of esbuild's dependency pre-bundler.
	optimizeDeps: {
		exclude: ['@repo/services']
	},

	build: {
		// Only downlevel when the Tauri CLI is driving the build; the web
		// deploy keeps Vite's modern default target.
		target: tauriPlatform ? (tauriPlatform === 'windows' ? 'chrome105' : 'safari15') : undefined,
		minify: tauriDebug ? false : 'esbuild',
		sourcemap: tauriDebug
	}
});
