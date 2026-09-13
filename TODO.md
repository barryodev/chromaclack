# ChromaClack - Project Roadmap

This roadmap tracks the development of the tactile, gestural color-mixing app. The project uses a Turborepo monorepo to isolate a SvelteKit SPA (served via Vercel) and a Tauri v2 native client (compiled for Ubuntu/Desktop) with shared Rust logic.

## Phase 1: Environment Validation & Deployment Pipeline

_Goal: Establish the Turborepo monorepo, prove the environment adapter routes correctly, and validate the local native/web deployment stack before moving into the mechanical UI work._

- [x] Initialize Turborepo with npm/pnpm workspaces.
- [x] Scaffold SvelteKit in `apps/frontend` configured for pure static SPA (`adapter-static`, `ssr = false`).
- [x] Scaffold Tauri v2 in `apps/desktop/src-tauri` using the local SvelteKit dist output.
- [x] Create `crates/shared_utils` Rust library workspace for core logic.
- [x] Implement the "Hello World" Rust function in `shared_utils`.
- [x] Expose the "Hello World" function via a Vercel Serverless Function in `api/greet.rs`.
- [x] Expose the "Hello World" function via a Tauri v2 command and configure `capabilities/default.json`.
- [x] Write the TypeScript Environment Adapter (`if (window.__TAURI__)`) to route the UI submit button to the correct backend.
- [x] Deploy the web app to Vercel and verify the serverless endpoint works in a browser.
- [x] Validate the local web flow with a stable proxy-backed API for `POST /api/greet` during development.
- [x] Verify the repo passes the full local validation pass: format, lint, typecheck, clippy, tests, and build.
- [x] System-wide dependency version check and upgrade
- [x] Connect the Vercel project to the GitHub repo so pushes/merges trigger automatic Preview/Production deployments (was a one-off CLI deploy until now).
- [x] Test the deployment on Android emulator or device and verify the app boots correctly in the Tauri Android flow.
- [ ] Configure a GitHub Action to automatically build the native Ubuntu/Linux executable on push.
- [ ] Document and validate the full local developer workflow for web, desktop, and Android startup.

## Phase 2: The Mechanical CSS Hinge (Vertical Axis)

_Goal: Isolate the 3D CSS rendering and mechanical timing before introducing color math._

- [ ] Create a single 3-piece clacker DOM component (Static Top, Static Bottom, Hinged Flap).
- [ ] Apply `perspective` to the container and `rotateX` to the flap.
- [ ] Bind a click event to trigger the CSS `transition` from `0deg` to `-180deg`.
- [ ] Add an array of letters (A, B, C) and implement `backface-visibility` to swap the letter at exactly 90 degrees.
- [ ] Refine the CSS `cubic-bezier` timing curve so the flap falls with realistic physical weight.
- [ ] Refactor the component to map CSS custom properties (e.g., `--saturation`) instead of text letters.
- [ ] Verify the 3D depth illusion holds up without visual artifacting when transitioning pure color blocks.

## Phase 3: Multi-Axis Gestures & The Rotary Dimmer

_Goal: Replace button clicks with continuous, multi-directional Pointer Events._

- [ ] Attach the standard JavaScript Pointer Events API to the clacker component.
- [ ] Capture the initial X/Y coordinates on `pointerdown`.
- [ ] Calculate the X and Y delta on `pointermove` to distinguish between horizontal and vertical swipes.
- [ ] Map a confirmed vertical swipe delta to trigger the Saturation hinge (Up/Down).
- [ ] Map a confirmed horizontal swipe delta to trigger a Hue hinge (Left/Right, using `rotateY`).
- [ ] Implement a `setTimeout` on `pointerdown` to detect a "long press".
- [ ] If a long press is detected, lock out the hinges and use `Math.atan2()` to calculate a rotation angle based on mouse/finger position.
- [ ] Map the calculated angle to a CSS `rotateZ` transform to simulate a mechanical dimmer switch (Lightness).

## Phase 4: Synthesis & Native OS Share Integration

_Goal: Tie all gestures into a unified HSL state and integrate Tauri's native OS capabilities._

- [ ] Create a centralized Svelte store to hold the master HSL state (Hue, Saturation, Lightness).
- [ ] Update the UI text box to dynamically convert and display the current HSL state as a Hex/RGB string.
- [ ] Add `tauri-plugin-clipboard-manager` (or `tauri-plugin-share`) to the `Cargo.toml` dependencies.
- [ ] Register the plugin inside `src-tauri/capabilities/default.json`.
- [ ] Expand the TypeScript Environment Adapter for a new "Share" action.
- [ ] If running in Vercel/Web: Route the Share action to `navigator.clipboard.writeText()`.
- [ ] If running in Tauri/Ubuntu: Route the Share action to the native Rust plugin to invoke the OS clipboard or share sheet.
- [ ] Perform a final sweep testing simultaneous multi-axis interactions for 60fps performance on both native and web deployments.

## Current milestone

The repo has completed the initial validation milestone, including the monorepo, web endpoint flow (with confirmed CI/CD), desktop native flow, and Android validation on a physical device. The remaining Phase 1 work is a GitHub Action for native Linux builds and developer workflow documentation; after that, the project moves into the mechanical CSS hinge design work (Phase 2).
