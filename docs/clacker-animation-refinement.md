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
- A path toward one unified clacker object that can eventually blend vertical, horizontal, and rotational controls for three color components in either HSL or RGB mode.

## Current State

- The active work is on `refine-clacker-direction-animation`, branched from `feature/three-axis-movement`.
- The worktree is clean after the accepted up/down visual-depth refinements.
- The known vertical target is a split-flap/Rolodex display, not a rotating cylinder.
- Phase one should prove the hinge mechanics with a small static setup before expanding to the fixed recycling pool.
- The current phase-one flap uses `overflow: visible`, hinge-only `rotateX`/`rotateY` transforms without a visible constant `translateZ`, inherited rounded face radii, and a calmer `28rem` perspective.
- Axis-specific pointer coordinates, rotation signs, and labels are now encoded through an explicit axis contract in `Phase1Flap.svelte`.
- Speed, rotation behavior, and perspective currently feel acceptable; remaining up/down changes should be minor polish unless new issues appear.

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

Left/right should use the same split-flap/Rolodex physical metaphor as up/down, rotated 90 degrees.

- Rightward gestures animate the left half forward/right.
- Leftward gestures animate the right half forward/left.
- A committed page movement is exactly 180 degrees.
- The hinge is the center vertical line instead of the center horizontal line.
- The rotation axis is `rotateY` instead of `rotateX`.
- Incoming and outgoing halves overlap at the hinge with stable z-order.
- The interaction should feel like the same mechanism viewed through a different movement axis, not a separate animation style.

The current CSS transform variables are still shared between vertical and horizontal modes. That is fine for the phase-one prototype, but serious left/right behavior should evolve through the axis contract instead of stretching vertical-only assumptions too far.

## Implementation Notes

- The long-term UI target is one clacker object that can seamlessly adjust three color components, such as HSL or RGB, through blended vertical, horizontal, and rotational interactions.
- Left/right implementation should preserve that future shape: keep horizontal behavior as a named axis path that can later compose with vertical and spin controls, rather than building a disconnected demo-only interaction.
- The accepted visual-depth pass removed the visible constant flap `translateZ`; depth should come from hinge rotation rather than translating the whole moving panel toward the user.
- `overflow: visible` is intentional so the moving flap can project outside the deck during rotation.
- `border-radius: inherit` belongs on the rendered flap faces so rounded corners do not depend on clipping at the deck level.
- `will-change: transform` is currently always present on both active halves. Since this is a tiny prototype surface, that is acceptable. Later, if the clacker grows to many slots/panels, only actively moving pieces should receive `will-change`.

## Implementation Steps

- [x] Define the directional animation contract in code or nearby documentation.
- [x] Refine up/down first against the split-flap behavior. Initial speed, rotation, continuity, visual depth, rounded faces, and perspective are accepted.
- [x] Choose the left/right physical metaphor.
- [ ] Implement left/right as a separate animation path through the shared axis contract.
- [ ] Extend the continuity model to buffer-slot recycling when phase two begins.
- [ ] Unify interaction rules across all directions.
- [ ] Polish and verify desktop pointer and mobile touch behavior.

## First Commit Scope

The first implementation commit after this note should only cover the directional animation contract.

That may be a small code-facing contract near the animation component, or another focused documentation change if more discussion is needed before touching animation logic.

## Open Decisions

- Whether the refinement branch should keep the existing local `Phase1Flap.svelte` changes as part of the starting point or preserve them separately.
- Whether phase one should remain limited to two static page pairs or start preparing the 9-slot/18-panel recycling pool.