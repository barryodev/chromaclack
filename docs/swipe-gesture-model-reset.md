# Gesture Model Refinement

## Branch Goal

The `gesture-model-refinement` branch will make gesture intent the source of truth. The visual flap transform should render the chosen gesture outcome rather than deciding interaction behavior through animation side effects.

## Why This Is Needed

The current flap interaction model mixes gesture input, inertia timing, and visual transform state into one flow. The result is a swipe that can feel heavy, slow to re-arm, and uncertain after release.

This is not a flap-rendering problem alone. It is a modeling problem: the code is currently expressing the animation behavior as if it were the source of truth, instead of expressing the user gesture as the source of truth.

## The core problem

The current implementation in `Flap.svelte` combines:

- pointer drag position
- derived rotation values
- release velocity
- animation decay timing
- page/transition state

into one flowing state machine without a clean contract between them.

That creates a dead-zone after release because the system continues to run a physics tail even after the gesture has ended. The user is still in a valid motion state, but the flap is still behaving as if it is recovering from the last drag instead of immediately being ready for the next input.

## Design Direction

The next pass should reset the model around explicit gesture states instead of incremental animation tweaks.

### States

- `idle`
- `pointer-down`
- `dragging`
- `release-evaluating`
- `inertia`
- `settled`

### Rules

- Dragging should be 1:1 with pointer movement while the pointer is down.
- Release should evaluate the gesture as a discrete event, not as a continuation of the drag loop.
- Low-velocity release should snap quickly and return to idle.
- High-velocity release may continue briefly with inertia, but only if that inertia is explicitly chosen as a valid continuation of the gesture.
- The visual flap transform should be derived from gesture state, not the other way around.

## Contract

The gesture system should decide the movement outcome first, and the flap visuals should only render that outcome.

In practical terms:

- gesture intent decides whether the swipe is accepted
- an accepted swipe decides the target page state
- transform is only a consequence of that decision
- low-velocity releases use a short snap path
- inertia is reserved for meaningful flicks and has a bounded duration

This makes the interaction easier to reason about and much easier to tune without chasing millions of tiny animation tweaks.

## First Implementation Slice

- Separate input transitions from release evaluation and rendering state.
- Preserve the existing axis contract and page-direction semantics.
- Add pure model tests before changing the Svelte component.
- Add browser assertions for state transitions and rapid re-engagement.
- Keep the DOM and recycling work out of this branch.

## Intended outcome

The user should feel:

- immediate response while dragging
- decisive settling on release
- no dead zone after a completed swipe
- a clean, re-armed gesture loop for the next interaction

That is the target model for the next pass.

## Tuning Order

These are the first likely adjustments to test, in order of likely value:

- Keep drag fully 1:1 while the pointer is active.
- Add the low-velocity snap path.
- Restrict longer inertia to meaningful high-velocity flicks.
- Bound the inertia tail and settle near the accepted boundary.
- Tune sensitivity only after the state transitions are measurable.
- Verify release velocity, inertia duration, threshold crossings, and re-arm timing through tests and diagnostics.

This list is intentionally short and concrete. It is the working direction for the next refinement pass, and it should be used as the focus for subsequent changes.
