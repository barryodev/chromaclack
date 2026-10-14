# ChromaClack

ChromaClack is a toy for exploring colour theory through a single tactile UI element. It has three interaction modes. Swiping up/down and left/right flips the clacker like a mechanical split-flap rolodex. Hold-and-rotate turns it like a dimmer switch. Each axis maps to a colour component (Hue/Saturation/Lightness or Red/Green/Blue), so you can mix values and watch the colour change. The same Svelte interface runs in a browser, as a desktop app, and on Android.

## Stack

- SvelteKit and TypeScript for the shared frontend (static SPA)
- Tauri v2 for desktop and mobile shells
- Rust for the shared crate and the Vercel serverless API
- pnpm, Turborepo, Cargo, and Vercel for the workspace and deployment paths

## Status

The cross-platform foundations work: one shared Rust function serves web, desktop, and Android. The flap interaction is being reset around a small, isolated CSS prototype that is verified by eye in the browser before it returns to the monorepo. The current gesture-model prototype stays in place until then.

## Links

- [ChromaClack: the good, the bad and the ugly](https://www.barryodev.io/posts/chroma-clack-the-good-the-bad-and-the-ugly) — retrospective on the project so far
- [Linear project](https://linear.app/barryodev/project/chromaclack-2e8504a557ec/overview) — roadmap and issues
- [SETUP.md](SETUP.md) — architecture, local development, and deployment
- [GLOSSARY.md](GLOSSARY.md) — names for the clacker's parts and interactions
