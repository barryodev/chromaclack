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

## Complete: Gesture Model Refinement

- Explicit pointer-down, dragging, release-evaluating, inertia, and settled transitions.
- 1:1 active dragging with deterministic release evaluation.
- Bounded multi-page outcomes selected before animation.
- Intermediate page resolution from the circular page model.
- One-time page commitment at outcome completion.
- Explicit inertia duration boundary and rapid re-engagement behavior.
- Focused diagnostics, unit tests, browser assertions, and physical Android smoke testing.

## Deferred Gesture Follow-ups

- [ ] Recompute or decay release velocity when pointer-up follows a pause after the last move.
- [ ] Add a browser regression test for pausing before release and verify that stale velocity does not trigger inertia.

## Next Branch: Recycled Flap Display

- [ ] Add the pure configurable deck model and wire its fixed slot pool into the rendered component.
- [ ] Expand the static prototype into a layered Rolodex stack; begin with five visible page pairs and two buffer pairs on each side, while keeping the counts tunable.
- [ ] Animate only the focused page pair per turn; advance stack roles and recycle hidden buffer content at each completed whole-page boundary.
- [ ] Preserve a compact configuration for dense multi-clacker displays using the same mechanics.
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
