# ChromaClack

A tactile, gestural color-theory toy. ChromaClack explores color mathematics (Hue, Saturation, and Lightness) through a mechanical, split-flap UI driven entirely by CSS 3D transforms and multi-axis Pointer Events.

This project is designed to run identically across native desktop environments and the web by sharing a single frontend UI and a single Rust backend logic crate.

## Tech Stack

- **Frontend:** SvelteKit (Static SPA Mode)
- **Native OS Host:** Tauri v2
- **Web Cloud Host:** Vercel Serverless Functions
- **Core Logic:** Rust
- **Architecture:** Turborepo, pnpm workspaces, and Cargo workspaces

## Project Structure & Complexity

To keep the application modular, complex environment and build logic is isolated into specific sub-directories:

- **The Environment Adapter (`packages/services/api.ts`):** This service dynamically routes user interactions to either Tauri's native IPC (`invoke`) when running locally, or to Vercel's HTTP endpoints (`fetch`) when running in a browser.
- **Shared Rust Logic (`crates/shared_utils`):** A dependency-free Rust library that compiles directly into both the native Ubuntu executable and Vercel's serverless containers, eliminating duplicated business logic.
- **Vercel API (`api/greet.rs`):** Holds the serverless function wrappers for web deployment.
- **Tauri Client (`apps/desktop/src-tauri`):** Holds the OS-level system window and native capabilities configurations.

## Roadmap & Progress

Development is tracked across 4 distinct phases, moving from structural environment validation through to complex 3D gestural UI and native OS integration.

Track the current progress in [TODO.md](./TODO.md).

For full architecture details, config rationale, and local setup instructions (desktop, web, and Android), see [SETUP.md](./SETUP.md).
