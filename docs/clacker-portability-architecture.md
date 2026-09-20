# Clacker Portability Architecture

## Status

This is a deferred architectural goal. It does not authorize a package split, a plugin system, or framework adapter work in the current branches.

Revisit this work after ChromaClack has proven its recycling display, color synthesis, and native flows, and before beginning a second framework implementation.

## Goal

Make the clacker mechanics portable across rendering frameworks without compromising the focused Svelte implementation that proves the interaction.

The eventual shape is:

- A dependency-free TypeScript mechanics core.
- A framework-neutral CSS and markup contract for shared geometry, transform, and z-order rules.
- Framework-specific adapters, beginning with Svelte and later React and Vue.
- A thin Next.js integration only if React integration needs Next-specific client or SSR ergonomics.

The mechanics core must not depend on Svelte, the DOM, browser events, CSS strings, `requestAnimationFrame`, or any framework runtime.

## Proposed Package Shape

```text
packages/
  clacker-core/       Pure TypeScript mechanics and public types
  clacker-styles/     Framework-neutral structural CSS
  clacker-svelte/     Svelte binding and components
  clacker-react/      Future React binding and components
  clacker-vue/        Future Vue binding and components
  clacker-next/       Optional future Next.js integration over React
```

This layout is a destination, not an immediate implementation plan. Do not create a runtime plugin registry unless multiple adapters prove that a shared lifecycle abstraction is necessary.

## Responsibility Boundaries

### Mechanics Core

The core owns deterministic, side-effect-free state transitions:

- Gesture lifecycle, release decisions, inertia progression, and interruption.
- Logical page state, physical half-slot identity, visible windows, and post-settle recycling.
- Render-ready numeric state such as rotation, active half, turn direction, stable slot IDs, and logical face assignments.
- Configuration defaults and validation.

The core returns state and events. It neither reads input events nor schedules frames nor mutates the DOM.

### Framework Adapter

An adapter owns framework and platform integration:

- Normalize pointer or touch input to coordinates and timestamps.
- Schedule and cancel animation frames.
- Subscribe reactive UI state to core state transitions.
- Render the adapter's keyed markup with fixed physical-slot IDs.
- Map numeric render state to CSS custom properties and adapter-specific classes.
- Surface diagnostics through the framework's normal observation patterns.

### Styles

Shared styles own the mechanical visual contract:

- Hinge geometry and half-panel placement.
- Transform origins, perspective, back-face orientation, and z-order rules.
- CSS custom properties and state classes consumed by adapter markup.

The stylesheet does not own state, event handling, or semantic content. Adapter markup must document and preserve the selectors and custom properties it relies on.

## Current Seams

The existing model modules are already framework-independent:

- [apps/frontend/src/lib/gesture-model.ts](../apps/frontend/src/lib/gesture-model.ts) contains the pure gesture state machine and its events.
- [apps/frontend/src/lib/flap-model.ts](../apps/frontend/src/lib/flap-model.ts) contains logical faces, physical half-slots, and circular-window helpers.
- Their unit tests are DOM-free and move with the future mechanics package.
- [docs/clacker-animation-refinement.md](clacker-animation-refinement.md) and [docs/swipe-gesture-model-reset.md](swipe-gesture-model-reset.md) describe framework-agnostic mechanical and interaction contracts.

These seams should be preserved as the clacker evolves, but they should not be extracted prematurely.

## Known Extraction Friction

The future extraction branch should address the following concrete coupling in [apps/frontend/src/lib/Flap.svelte](../apps/frontend/src/lib/Flap.svelte):

- Svelte runes and lifecycle hooks own model initialization and diagnostics observation.
- Mouse and touch listeners, coordinate extraction, and `preventDefault` behavior are embedded in the component.
- The `requestAnimationFrame` loop mutates Svelte state directly and is cancelled through DOM lifecycle code.
- Markup, page placeholder content, transform string generation, and CSS custom-property wiring are co-located.
- Gesture tuning values are repeated in the component and the model defaults, creating two sources of truth.

When touching these areas for present feature work, prefer small, independently testable helpers and render-ready state. Do not introduce an adapter API or package boundary just to anticipate extraction.

## Current-Branch Constraints

Until extraction begins:

- Keep new gesture and deck mechanics pure where practical.
- Keep physical-slot identity distinct from logical face or content assignment.
- Do not place DOM access, Svelte runes, event listeners, or frame scheduling in model helpers.
- Prefer numeric state and stable IDs over generated markup or framework-specific render instructions.
- Keep framework rendering, input normalization, and frame orchestration local to the Svelte layer.

## Extraction Trigger And Scope

Begin extraction only when the Svelte implementation has proven the recycled deck and color model, and a second rendering framework is about to be implemented.

The extraction branch should then:

1. Move the pure gesture, deck, and diagnostic types with their unit tests into `clacker-core`.
2. Establish a documented core render-state API and a single configuration source of truth.
3. Move shared mechanical CSS into `clacker-styles` with an explicit markup/custom-property contract.
4. Refactor the Svelte implementation into a framework adapter without changing verified behavior.
5. Re-run unit, browser, and physical-device checks before introducing another framework adapter.

## Non-Goals

- No current package split or public package API.
- No runtime plugin system.
- No cross-framework feature-parity commitment before the Svelte implementation is mature.
- No speculative abstraction that makes the current recycling work harder to understand or verify.
