# Swipe Gesture Model Reset

## Why this note exists

The current flap interaction model is mixing gesture input, inertia timing, and visual transform state into a single uncertain flow. The result is a swipe that feels heavy, slow to re-arm, and slightly rusty after release.

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

## Design direction

The next pass should reset the model around explicit gesture states instead of incremental animation tweaks.

### Proposed states

- idle
- pointer-down
- dragging
- release-evaluating
- inertia
- settled

### Rules

- Dragging should be 1:1 with pointer movement while the pointer is down.
- Release should evaluate the gesture as a discrete event, not as a continuation of the drag loop.
- Low-velocity release should snap quickly and return to idle.
- High-velocity release may continue briefly with inertia, but only if that inertia is explicitly chosen as a valid continuation of the gesture.
- The visual flap transform should be derived from gesture state, not the other way around.

## Key decision

The gesture system should decide the movement outcome first, and the flap visuals should only render that outcome.

In practical terms:

- gesture intent decides whether the swipe is accepted
- accepted swipe decides target page state
- transform is only a consequence of that decision

This makes the interaction easier to reason about and much easier to tune without chasing millions of tiny animation tweaks.

## Why this matters

The earlier branch work improved materially when we stopped editing the flap animation in isolation and instead fixed the underlying state model. This is the same class of problem.

We should not preserve the current inertia logic as the foundation for the next pass. It is a prototype artifact, not a durable interaction model.

## Intended outcome

The user should feel:

- immediate response while dragging
- decisive settling on release
- no dead zone after a completed swipe
- a clean, re-armed gesture loop for the next interaction

That is the target model for the next pass.

## Candidate tuning experiments

These are the first likely adjustments to test, in order of likely value:

- Reduce the inertia tail length after release.
- Add a fast snap path for low-velocity releases instead of keeping the drag in a lingering inertia loop.
- Keep the drag fully 1:1 with pointer movement while the pointer is active.
- Restrict longer inertia to only meaningful high-velocity flicks.
- Reduce drag sensitivity slightly to avoid the heavy, mechanical feel.
- Short-circuit the settle path when the flap is already near the accepted boundary.
- Verify behavior using the debug panel values for release velocity, inertia duration, and threshold crossings.

This list is intentionally short and concrete. It is the working direction for the next refinement pass, and it should be used as the focus for subsequent changes.
