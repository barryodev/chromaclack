/**
 * Static SPA switches. These two exports are what turn the whole app into a
 * client-only bundle that `adapter-static` can emit with a fallback document.
 *
 * `prerender = false` tells the adapter not to crawl and snapshot routes at
 * build time. `ssr = false` stops SvelteKit from server-rendering during
 * development and from emitting any server code, so `window`, `fetch` and the
 * Tauri globals the environment adapter depends on are always defined by the
 * time a component runs.
 *
 * They are set in the root layout, so every route inherits them.
 */

export const prerender = false;
export const ssr = false;

/** Client-side routing still works; only the initial render is client-only. */
export const csr = true;

/** Keeps URLs stable across the static host and Tauri's custom protocol. */
export const trailingSlash = 'never';
