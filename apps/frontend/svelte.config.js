import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * Single-page-app configuration.
 *
 * `adapter-static` + a `fallback` document is SvelteKit's supported SPA mode:
 * nothing is server-rendered, the whole app is one HTML file plus JS, and the
 * client router takes over on load. That is exactly what Tauri needs (it
 * serves `build/` off the local filesystem, where no Node server exists) and
 * it is what lets Vercel treat `apps/frontend/build` as plain static output
 * with the Rust functions living beside it under /api.
 *
 * @type {import('@sveltejs/kit').Config}
 */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			// Every unmatched path is served this document; the client router
			// then resolves the route. Required because no page is prerendered.
			fallback: 'index.html',
			precompress: false,
			strict: true
		})
		// NOTE: leave `paths.relative` at its default (false). Root-absolute
		// asset URLs are what make deep links work on Vercel, where /any/deep
		// /link is rewritten to the same index.html; relative URLs would
		// resolve against the requested path and 404. Tauri serves the bundle
		// from the root of its custom protocol, so absolute paths are correct
		// there too.
	}
};

export default config;
