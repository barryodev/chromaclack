# Roadmap

ChromaClack is being built in layers: validate the platforms, prove the mechanical interaction, then connect it to color state and native capabilities.

## Complete

- Monorepo with pnpm/Turborepo and Cargo workspaces.
- Static SvelteKit SPA shared by web, Tauri desktop, and Android.
- Vercel Rust API and Tauri IPC adapter using the same shared Rust crate.
- Local web, desktop, Android, and deployment workflows.
- GitHub-triggered native Linux build workflow.
- Vertical and horizontal split-flap animation prototype.
- Axis-specific drag handling with `rotateX` and `rotateY` paths.
- Circular page state and pure half-slot ring helpers with unit tests.
- Gesture diagnostics, frontend unit tests, and Playwright interaction captures.

## Current Branch: Gesture Model Refinement

The current branch is `gesture-model-refinement`. Its purpose is to make gesture intent the source of truth and make the visual flap transform a consequence of that intent.

- [ ] Define explicit pointer-down, dragging, release-evaluating, inertia, and settled transitions.
- [ ] Keep active dragging 1:1 with pointer movement.
- [ ] Decide page-turn acceptance at release, including distance and velocity rules.
- [ ] Make low-velocity releases snap quickly and re-arm immediately.
- [ ] Restrict inertia to meaningful flicks and bound its duration.
- [ ] Add tests for rapid re-engagement, opposite-direction gestures, and release outcomes.
- [ ] Add focused browser assertions for motion state and committed page changes.

## Next: Recycled Flap Display

- [ ] Wire the tested half-slot ring into the rendered component.
- [ ] Expand the static prototype to five visible page pairs with two buffer pairs above and below.
- [ ] Keep the DOM fixed while recycling content only after a transition settles.
- [ ] Verify physical continuity and z-order at the hinge across repeated turns.
- [ ] Validate transform-only animation behavior on Android and desktop.

## Later: Color Synthesis

- [ ] Introduce a centralized HSL or RGB state model.
- [ ] Map vertical, horizontal, and rotational controls to color components.
- [ ] Replace placeholder page labels and colors with generated color faces.
- [ ] Display the current color as HSL, RGB, and hexadecimal values.
- [ ] Add native and web clipboard/share actions.

## Verification

The focused frontend checks are:

```sh
pnpm --filter @repo/frontend test
pnpm --filter @repo/frontend check
pnpm --filter @repo/frontend test:e2e
```

The full workspace validation command is `pnpm verify`. See [SETUP.md](SETUP.md) for platform-specific startup commands.
