# Half-Slot Scene Redesign

## Status

This document supersedes the page-slot renderer direction in `recycled-deck-model.md`. It records the redesign agreed after the page-card renderer produced occlusion, incoherent handoffs, and visual noise.

The existing two-page prototype remains the behavioral baseline. The current renderer experiments after `dc3d05b` are not part of this design.

## Branch Implementation Approach

`HalfSlotViewport` and `/half-slot-lab` are the controlled vertical-renderer foundation for this branch. One viewport owns the scene dimensions, perspective, half-slot poses, and pointer input, so initial, dragging, and released states share one projection environment.

The lab's accepted first checkpoint is:

- Initial output is already a valid settled half-slot pose.
- Upward drag moves only the focused second half; downward drag moves only the focused first half.
- Releasing returns to the exact initial settled pose.
- No face recycling, logical advancement, or inertia handoff is introduced until this scene is extended deliberately.

The legacy vertical `Flap` implementation is retained as behavioral reference only. It is not a migration source for the half-slot viewport. Its state structure, logging, diagnostics data, and renderer assumptions must not be copied into the new implementation by default.

The diagnostic panel may preserve its visual presentation, but new half-slot diagnostics begin from the half-slot scene's actual state and are added only when they help validate the new model.

## Goal

Build a fixed, configurable pool of independent physical half-slots that can spin as a pleasing approximation of a split-flap display or Rolodex.

The renderer is not required to show any fixed count of complete, readable pages. It should expose a tunable visual neighborhood that gives a convincing sense of free rotation around a shared axle.

The current branch should aim for multiple visible pages at rest, not a hard-coded "five page pairs" rule. That count was a visual placeholder and should remain a tuning preset rather than a mechanical contract.

## Current Branch Checklist

1. Keep the logical deck and gesture models as the durable truth. The deck owns page direction, focus, buffer ordering, and completed-turn transitions. The half-slot scene owns physical IDs, hinge motion, visibility, and stable pose ordering.
2. Keep the Svelte viewport as a thin adapter over those states. It normalizes pointer input, binds CSS transforms, and manages DOM event wiring; it does not become the source of truth for page movement.
3. Make the visible page count a configurable visual preset instead of a sacred rule. The actual acceptance target is a multi-page scene that invites interaction and preserves the Rolodex feel.
4. Keep the full-page abstraction out of the physical renderer. A page remains a logical resting composition; the active moving unit is the physical half-slot.
5. Validate the branch against the shared-hinge contract before expanding to larger recycled decks: multiple visible pages, stable hinge overlap, coherent z-order, and a settled pose that reads as a layered stack.
6. Add a minimal recycle boundary only after the scene and hinge behavior are physically coherent. Recycled content must change only at a completed turn boundary and never expose partial state mid-motion.
7. Treat a working multi-page half-slot scene as the milestone for this branch. Do not force a larger or more elaborate deck until the visual and mechanical contract is stable.
8. Verify behavior on desktop and Android using the same transform-only motion contract: no DOM churn, no layout reads during motion, and no hidden half-slot teleporting through the hinge.

## Logical Deck State Contract

The deck should model the full circular logical sequence separately from the small render neighborhood. The renderer need only show the active window; the logical ring may be much larger.

```ts
export type DeckDirection = 'positive' | 'negative';

export type DeckLogicalPage = {
	id: string;
	faceId: string;
};

export type DeckState = {
	direction: DeckDirection;
	visibleWindow: readonly DeckLogicalPage[];
	returnBuffer: readonly DeckLogicalPage[];
	hiddenBacksideQueue: readonly DeckLogicalPage[];
};
```

Interpretation:

- `visibleWindow` is the current active neighborhood around the hinge; these pages are in the user-visible stack.
- `returnBuffer` is the nearest outgoing/incoming page ring just outside the visible window. It is the handoff zone for pages that are about to be recycled or re-introduced to the front side.
- `hiddenBacksideQueue` is the remainder of the full circular logical deck. These pages still exist in the ring, still have order, but they are behind the active window and not yet eligible to enter the return buffer.
- `direction` is an explicit deck contract: `positive` advances the logical ring toward the outgoing/backside side; `negative` advances it toward the incoming/front side. This matches the same sign used by the gesture model's `SwipeDirection` contract, where a positive turn walks the logical index in the same direction the current interaction expects.

This allows a fixed viewport to render only a small slice of a much larger alphabet or content deck while preserving the full ring order underneath.

## Physical Primitive

A half-slot is the physical unit:

- It has a stable DOM identity.
- It is either the first or second half of a composed resting page.
- It has an ordered physical position in the Rolodex loop.
- It owns one logical face assignment.
- It may be active, visible, or buffered.

A page is not a physical renderer unit. It is a logical resting composition when adjacent first and second half-slots display matching face content.

## Half-Slot Deck Truth

The pure deck model owns only deterministic physical/logical state:

```ts
type PhysicalHalfSlot = {
	id: string;
	side: 'first' | 'second';
	physicalPosition: number;
	logicalFaceIndex: number;
};

type HalfSlotDeckConfig = {
	halfSlotCount: number;
	bufferHalfSlotCount: number;
};
```

`halfSlotCount` must be a positive even number. A deck instance fixes its DOM pool size; changing the configuration deliberately rebuilds the deck outside active interaction.

A completed $180^\circ$ turn advances ordered half-slot positions and recycles only buffered half-slot face assignments. It never creates, removes, or changes the IDs of rendered physical halves.

## Renderer Pose Scene

The renderer derives an ordered pose scene from deck truth and gesture state:

```ts
type HalfSlotPose = {
	physicalHalfSlotId: string;
	logicalFaceIndex: number;
	side: 'first' | 'second';
	rotationDegrees: number;
	layer: number;
	visibility: 'visible' | 'buffered';
	isActive: boolean;
};
```

The initial pose generator should expose a small, configurable neighborhood around the active hinge. Visual density, rest angles, layers, and camera settings are renderer tuning values, not deck-state requirements.

## Hinge Contract

The established directional contract remains authoritative:

- Downward gestures animate the active first half forward/down.
- Upward gestures animate the active second half forward/up.
- The accepted page movement is exactly $180^\circ$.
- Incoming and outgoing halves overlap at the shared center hinge with explicit, physically defensible z-order.
- A moving half must not disappear behind or teleport through another half.

Only the active half receives per-frame transform updates in the initial renderer. Neighboring half-slot pose changes occur at discrete completed-turn boundaries.

### Shared-Axle Depth Rule

Do not use a constant `translateZ` offset to pop an individual half-slot or card toward the viewer. This has been tried and reverted on multiple branches: it makes that surface appear to leave the shared axle, breaking the continuous physical rotation illusion.

Depth must come from hinge rotation, perspective, and physically consistent pose ordering. Layer rank may control paint order, but it must not be used as a substitute for moving a resting physical half closer to the viewer.

## Visual Scope

The target is a free-spinning, pleasing approximation of a real split-flap/Rolodex. It deliberately does not require five visible page pairs or any other fixed count of fully readable cards.

The half-slot pose scene makes later renderer-only fidelity possible without changing deck or gesture truth. Examples include increased visual density, grouped settling delays, or a cascade where nearby half-slots gather and settle together. None of these effects are current scope.

## Revised Implementation Slices

1. Replace page-slot deck ownership with a pure half-slot deck model, including stable identities, face assignments, ordered positions, buffering, direction shifts, and wraparound tests.
2. Establish the standalone half-slot viewport as the vertical renderer base: static pose, one camera root, drag-only active-half behavior, and initial/settled pose parity.
3. Add new half-slot diagnostics from scene state, retaining only the existing panel's visual shell if useful.
4. Connect completed-turn gesture events to discrete half-slot advancement. Verify up/down, long flicks, reversal, and interruption.
5. Add buffered-half face recycling with a minimal synchronous content resolver.
6. Tune pose density, z-order, camera, and optional settle effects only after the physical scene and handoff are coherent.

## Verification

- Pure half-slot deck tests cover configuration validation, stable IDs, face assignment shifts, direction, and wraparound.
- Pure pose-generator tests cover active-half direction, visibility, layer rank, and composed resting pages.
- Browser checks prove stable DOM identity, composed-face continuity at rest, one $180^\circ$ active-half turn, and interruption behavior.
- Visual review confirms shared-hinge continuity before performance tuning.
- Android and desktop checks confirm transform-only motion and no frame-loop layout reads.
