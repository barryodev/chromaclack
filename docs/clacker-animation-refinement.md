# Clacker Animation Refinement

## Branch Goal

Refine the clacker's directional animation so vertical and horizontal movement feel intentional, physically coherent, and ready to extend beyond the current phase-one prototype.

The branch should end with:

- Up/down gestures behaving like a split-flap/Rolodex motion.
- Left/right gestures having their own matching directional animation instead of reusing the vertical effect.
- Dragging feeling 1:1 with pointer/touch movement.
- Release behavior snapping cleanly based on distance and velocity.
- Mobile-friendly animation performance: transform-driven motion, with no layout churn during the animation loop.
- A phase-one scope unless the branch explicitly expands into recycling/buffer slots.

## Current State

- The active work is based on `feature/three-axis-movement`.
- `apps/frontend/src/lib/Phase1Flap.svelte` already has uncommitted local changes at the time this note was created.
- The known vertical target is a split-flap/Rolodex display, not a rotating cylinder.
- Phase one should prove the hinge mechanics with a small static setup before expanding to the fixed recycling pool.

## Directional Animation Contract

The branch should make the four directional gestures explicit before polishing implementation details.

### Up/Down

- Downward gestures animate the top half forward/down.
- Upward gestures animate the bottom half forward/up.
- A committed page movement is exactly 180 degrees.
- Incoming and outgoing halves overlap at the hinge with stable z-order.
- The animation should read as independent upper and lower physical halves sharing a center hinge.

### Physical Continuity

- A moving flap must remain visually and physically continuous throughout its travel.
- A flap must not disappear behind a static flap at rest if it would have had to pass through that static flap to get there.
- Z-order may change only at physically defensible moments, such as before motion begins, at the hinge crossing point, or after a settled transition updates logical content.
- In the current phase-one model, where flaps 3 and 4 are static and flaps 1 and 2 move, flap 1 folding down must not teleport behind flap 2.
- Flicking down, letting flap 1 settle, and then flicking up should not reveal a sudden reappearance caused by an inconsistent visual stack.

### Phase-Two Recycling Model

- When the display expands to more visible pages and a larger buffer, the physical continuity rule should extend to the full Rolodex loop.
- A flap that exits the visible face should logically continue around the back of the Rolodex and return to the front/top in the correct order.
- The behind-the-Rolodex travel does not need to be visibly animated, but the slot/content recycling should behave as if that full physical path occurred.
- Recycling should happen only after visible motion settles, while the recycled slot is outside the user's visible window.

### Left/Right

The left/right physical metaphor still needs to be chosen before implementation. Candidate directions:

- A side-hinged flip.
- A lateral mechanical clack.
- A card-like horizontal flap.
- Another distinct motion that fits the clacker better than reusing the vertical split-flap behavior.

Once chosen, left/right should receive its own axis math, moving-panel rules, and z-order rules while sharing the same drag/release/snap principles where practical.

## Implementation Steps

1. Define the directional animation contract in code or nearby documentation.
2. Refine up/down first against the split-flap behavior.
3. Choose the left/right physical metaphor.
4. Implement left/right as a separate animation path.
5. Extend the continuity model to buffer-slot recycling when phase two begins.
6. Unify interaction rules across all directions.
7. Polish and verify desktop pointer and mobile touch behavior.

## First Commit Scope

The first implementation commit after this note should only cover the directional animation contract.

That may be a small code-facing contract near the animation component, or another focused documentation change if more discussion is needed before touching animation logic.

## Open Decisions

- Whether the refinement branch should keep the existing local `Phase1Flap.svelte` changes as part of the starting point or preserve them separately.
- Which physical metaphor should drive the left/right animation.
- Whether phase one should remain limited to two static page pairs or start preparing the 9-slot/18-panel recycling pool.