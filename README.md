# ChromaClack

ChromaClack is a tactile color-theory toy built around a mechanical split-flap display. Swipe the clacker to explore color components, with the same Svelte interface running in a browser, desktop app, and Android app.

The project is still in interaction prototyping. The current work is about making the gesture model feel immediate and physically coherent before the display grows into a larger recycled flap system.

## Stack

- SvelteKit and TypeScript for the shared frontend
- Tauri v2 for desktop and mobile shells
- Rust for shared backend logic and API handlers
- pnpm, Turborepo, Cargo, and Vercel for the workspace and deployment paths

## Where Things Stand

The web, native, Android, and deployment foundations are working. Vertical and horizontal split-flap motion, page state, diagnostics, and tested half-slot helpers are in place. The next branch is `gesture-model-refinement`, which will reset the gesture state machine before slot recycling or color synthesis is added.

See [TODO.md](TODO.md) for the current roadmap and [SETUP.md](SETUP.md) for local development and deployment details.
