# Clacker Animation Contract

## Purpose

This document records the mechanical behavior that the clacker must preserve while its gesture model and rendering implementation evolve.

The current prototype already demonstrates:

- Up/down gestures behaving like a split-flap/Rolodex motion.
- Left/right gestures having their own matching directional animation instead of reusing the vertical effect.
- axis-specific vertical and horizontal movement
- a circular page model
- tested logical-face and physical-half-slot helpers
- transform-driven motion in the current small prototype

The gesture model is the next refinement target. Recycling and color synthesis remain future work.

## Current Rendering State

- The known vertical target is a split-flap/Rolodex display, not a rotating cylinder.
- The phase-one prototype uses a small static setup with four visible half-slots.
- `Flap.svelte` owns the current interaction loop and derives its initial visible slots from the tested model helpers.
- The current flap uses hinge-only `rotateX`/`rotateY` transforms, `overflow: visible`, inherited face radii, and a `28rem` perspective.
- Logical faces describe displayed content; physical half-slots are the future recycling unit.
- The current colors and labels are placeholders, not the final HSL/RGB synthesis surface.

## Directional Animation Contract

The branch should make the four directional gestures explicit before polishing implementation details.

### Up/Down

- Downward gestures animate the top half forward/down.
- Upward gestures animate the bottom half forward/up.
- An accepted swipe movement is exactly 180 degrees.
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
- An accepted swipe movement is exactly 180 degrees.
- The hinge is the center vertical line instead of the center horizontal line.
- The rotation axis is `rotateY` instead of `rotateX`.
- Incoming and outgoing halves overlap at the hinge with stable z-order.
- The interaction should feel like the same mechanism viewed through a different movement axis, not a separate animation style.

The current CSS transform variables are still shared between vertical and horizontal modes. That is fine for the phase-one prototype, but serious left/right behavior should evolve through the axis contract instead of stretching vertical-only assumptions too far.

## Rendering Notes

- Vertical and horizontal page-state behavior share the same circular page model: positive down/right swipes settle to the previous page, and negative up/left swipes settle to the next page.
- Future model logic should be developed in framework-agnostic code with unit tests before changing the visible Svelte behavior.
- Page pairs are a composed/resting interpretation of neighboring half-slots, not the primitive recycling unit.
- The accepted visual-depth pass removed the visible constant flap `translateZ`; depth should come from hinge rotation rather than translating the whole moving panel toward the user.
- `overflow: visible` is intentional so the moving flap can project outside the deck during rotation.
- `border-radius: inherit` belongs on the rendered flap faces so rounded corners do not depend on clipping at the deck level.
- Back-face orientation was isolated in `/facetest`: an explicit back plane with `rotateX(180deg)` renders its child text upright without a text counter-transform. Counter-rotating the printed content with `rotate(180deg)`, `rotateX(180deg)`, or `scaleY(-1)` makes the text wrong.
- Future explicit front/back flap markup should rotate the back face plane, not the printed content inside it.
- `will-change: transform` is currently always present on both active halves. Since this is a tiny prototype surface, that is acceptable. Later, if the clacker grows to many slots/panels, only actively moving pieces should receive `will-change`.

## Status

- [x] Define the directional animation contract.
- [x] Refine vertical and horizontal hinge behavior.
- [x] Add the initial logical-face and physical-half-slot model with unit tests.
- [x] Verify desktop pointer behavior for vertical and horizontal page-state swipes.
- [ ] Reset the gesture model around explicit input and release states.
- [ ] Extend continuity to the fixed recycling pool.
- [ ] Add rotational-axis state and color synthesis.

## Future Mechanical Rules

- Five complete page pairs should be visible at rest, with two buffer pairs above and below.
- A committed page movement is exactly 180 degrees.
- Recycling occurs only after a transition settles and never changes DOM size during motion.
- A moving flap keeps a stable, physically defensible z-order through the hinge.
- Animation work remains transform-driven and free of layout reads in the frame loop.
