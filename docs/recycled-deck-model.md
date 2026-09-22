# Configurable Recycled Deck Model

> Superseded for renderer and deck ownership by [half-slot-scene-redesign.md](half-slot-scene-redesign.md). This document remains as the historical page-slot design record and proposed lifecycle discussion.

## Status

This document defines the next mechanical phase after the gesture-model refinement: a fixed, configurable Rolodex-style page deck with recycling at completed whole-page boundaries.

It is a design contract for the branch. It does not begin the later portability package extraction described in [clacker-portability-architecture.md](clacker-portability-architecture.md).

## Purpose

The current prototype proves a two-page hinge interaction. The next display should rest as a layered front stack around a shared Rolodex axle: several complete page pairs remain visible behind the active page, and additional page pairs sit outside the visible range as recycling buffers.

The display must support dynamic content. When a page pair has moved outside the visible range and is recycled around the deck, the host application can supply new content for its two physical halves. ChromaClack will use this to show incremental color changes; another application may show a counter or unrelated page content.

## Model Boundaries

The system has three separate responsibilities:

```text
gesture model -> deck model -> content provider -> framework renderer
```

The deck direction must remain explicit in the model so the render layer never guesses whether a page is moving in or out of the visible stack. We use the same sign convention as the gesture model: `positive` moves toward the outgoing/backside side of the ring; `negative` moves toward the incoming/front side.

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

This makes the hidden backside queue a real logical state, not an accidental render artifact. The ring may contain far more pages than the viewport can show at once; only a small neighborhood is surfaced for motion and display.

### Gesture Model

The existing gesture model remains responsible for pointer lifecycle, release evaluation, bounded inertia, interruption, and the resolved turn direction/count. It does not know slot geometry or page content.

### Deck Model

The deck model is a new pure state engine. It owns:

- A fixed set of physical page slots and their stable identities.
- Two physical half-slots per page slot.
- Slot roles: visible, upper buffer, or lower buffer.
- Resting layered-stack positions relative to an explicit focus position.
- Logical page indices assigned to physical page slots.
- Recycling at completed whole-page boundaries and the content refresh requests it produces.

It does not read browser events, schedule animation frames, call application callbacks, or render markup.

### Content Provider

The host application owns semantic content and application state. It receives a recycled page's logical index and returns the two face payloads for that page.

For the first implementation, content resolution is synchronous and atomic: the adapter obtains both half-face payloads and applies them together while the physical page is buffered and out of visual range. Async loading, partial page updates, and visible content replacement are explicitly out of scope until a later contract defines their loading behavior.

### Framework Renderer

The Svelte layer owns input normalization, animation-frame scheduling, keyed DOM rendering, and CSS-property binding. It renders a fixed number of physical slots for a deck instance. It does not create or remove slots during motion.

## Configurable Deck Geometry

The visible and buffered page counts are tuning variables, not structural constants.

```ts
type DeckConfig = {
  visiblePageCount: number;
  bufferPageCount: number;
  focusVisiblePageIndex: number;
  fanAngleDegrees: number;
  pageDepthOffset: number;
};
```

Derived pool size is:

$$
\text{pageSlotCount} = \text{visiblePageCount} + 2 \times \text{bufferPageCount}
$$

$$
\text{halfSlotCount} = 2 \times \text{pageSlotCount}
$$

The initial visual test preset is five visible page pairs with two buffer pairs on each side, producing nine page slots and eighteen half-slots. It is not a permanent requirement.

`visiblePageCount` may be odd or even. `focusVisiblePageIndex` identifies the interaction focus explicitly, so an eight-page stack does not require inventing a false central page. Configuration validation must ensure:

- `visiblePageCount` is a positive integer.
- `bufferPageCount` is a non-negative integer.
- `focusVisiblePageIndex` is a valid visible-page index.
- Fan and depth values are finite and within renderer-defined safe limits.

Changing this configuration rebuilds the deck outside an active interaction. It must not resize the pool during a drag, inertia phase, or completed-turn update.

## Physical And Logical State

Every rendered page has separate physical and logical identity:

- `physicalPageSlotId` is permanent and keys the DOM node.
- `physicalHalfSlotId` is permanent and keys each of the two flap panels.
- `restingPosition` is derived from the page slot's place in the visible fan or buffers.
- `logicalPageIndex` identifies the sequence position whose content the slot currently displays.
- `content` is the two face payloads supplied for that logical page.

Recycling changes a buffered slot's logical index and content assignment. It never changes physical IDs or the number of rendered nodes.

## Proposed Deck Lifecycle Events And Content Refresh

The following is a proposed integration shape, not an agreed public API. It is included to guide discussion of dynamic content and must be revisited before implementation.

One option is for the deck engine to emit typed events without invoking user code, with the framework adapter subscribing application callbacks to those events. That would preserve a pure, deterministic deck model while giving hosts an ergonomic callback API.

The initial lifecycle events are:

```ts
type PageLeavesVisualSpace = {
  type: 'page-leaves-visual-space';
  physicalPageSlotId: string;
  logicalPageIndex: number;
  direction: 'positive' | 'negative';
};

type PageEntersPreRenderBuffer<FaceContent> = {
  type: 'page-enters-pre-render-buffer';
  physicalPageSlotId: string;
  logicalPageIndex: number;
  direction: 'positive' | 'negative';
  content: PageContent<FaceContent>;
};

type PageContent<FaceContent> = {
  first: FaceContent;
  second: FaceContent;
};
```

In this proposal, `page-leaves-visual-space` is an observation event. It would let host code update its own domain state as a page exits the visible stack. A counter could increment here, and ChromaClack could advance its color state.

`page-enters-pre-render-buffer` would occur only when the page has reached a hidden buffer position and can safely receive its next logical assignment. The adapter could provide a reference to that page's two face payloads so the host callback can update both halves together. The update would be applied atomically before the page can return to visible space.

The host callback shape could be adapter-specific, for example:

```ts
type DeckCallbacks<FaceContent> = {
  onPageLeavesVisualSpace?: (event: PageLeavesVisualSpace) => void;
  onPageEntersPreRenderBuffer?: (event: PageEntersPreRenderBuffer<FaceContent>) => void;
};
```

Under this proposal, the content callback is agnostic about why a logical index means a particular color or counter value:

- ChromaClack can derive a subtle saturation increment from the logical index and its centralized color state.
- A counter can return the matching number for both halves of a page.
- Other uses can provide text, imagery, or independently composed upper and lower faces.

Content must not change a visible slot during motion. External application-state changes may update the deck only through a later, explicitly designed refresh path; they must not bypass this recycling contract.

## Recycling Choreography

1. The gesture model resolves an accepted outcome and animates it using the existing interaction contract.
2. The renderer continues to display the fixed physical pool throughout drag and inertia.
3. Each time motion crosses a complete 180-degree page boundary, the gesture model emits one completed-turn transition.
4. The deck model applies one logical page shift for that transition while preserving its physical slots.
5. A potential event-based design emits `page-leaves-visual-space` for every slot crossing out of the visible stack.
6. It identifies slots that have entered a hidden pre-render buffer and emits `page-enters-pre-render-buffer` for them.
7. The adapter could run subscribed callbacks and commit all page-content changes atomically before the next completed-turn transition.
8. When no further motion remains, the gesture becomes settled and is ready for a new input sequence.

This ordering prevents a user from seeing an in-place face change and prevents interruption or rapid re-engagement from observing partly recycled state. Each recycle update should be a bounded synchronous state transition, not a continuous per-frame operation or an arbitrary delay.

## Geometry And Z-Order

At rest, the visible page pairs form a layered front stack around a shared axle. Each page remains a complete upper/lower pair with its own hinge. Buffer pages sit beyond the visible stack and are positioned or hidden such that they cannot be seen while their content is refreshed.

During a turn, active-page emphasis preserves performance and visual clarity:

- The focused page pair performs the visible 180-degree hinge rotation in a clear foreground layer.
- Neighboring pages remain at their resting layered-stack poses during that rotation.
- At the completed-turn boundary, physical slot roles advance discretely into the next stable stack arrangement.
- Only the active pair receives per-frame transform updates; any resting-pose handoff must remain a short, discrete boundary operation.
- Down/right motion advances in the positive direction; up/left motion advances in the negative direction.
- The moving half has a physically defensible z-order through its hinge crossing.
- A panel must not teleport behind another page in a way that contradicts its apparent path.

This is deterministic kinematic choreography, not collision detection or whole-stack physics. The generalized deck renderer needs an explicit resting z-order based on slot position plus an active-moving-half override. Recycling is allowed only while a slot is buffered, so moving a logical assignment from the lower buffer to the upper buffer, or the reverse, cannot cause a visible layer jump.

The exact stack-angle, depth, and z-index formulas are implementation tuning work. They must be derived from `DeckConfig`, not encoded as fixed positions for a five-page example.

## Performance Rules

- The deck has a fixed DOM size for the lifetime of a configuration instance.
- Motion updates transforms and related compositor-friendly properties only.
- The frame loop performs no layout reads and does not allocate/remove DOM nodes.
- Recycling occurs at each completed whole-page boundary, updating only hidden buffered slots in one bounded state transition.
- The initial configurable pool must be profiled on desktop and Android before increasing default visible or buffer counts.
- A compact configuration may use one visible page with a minimal buffer pool for dense multi-clacker displays. It uses the same deck and gesture contracts as the layered configuration.

## Verification Plan

The implementation should add focused checks in this order:

1. Pure deck-model tests for configuration validation, fixed physical IDs, logical assignment shifts, wraparound, and emitted content refresh requests.
2. Renderer tests that prove DOM node count and keys remain stable across repeated turns.
3. Browser tests for multi-turn outcomes, repeated wraparound, immediate re-engagement after atomic recycle, and content labels/backgrounds matching their logical indices.
4. Visual captures for the layered resting geometry, foreground hinge crossing, discrete role handoff, z-order continuity, and buffer invisibility.
5. Desktop and physical Android checks for transform-only motion and responsive re-engagement at the chosen initial preset.

## Risks To Preserve In Implementation Planning

- Logical indices must be opaque application coordinates. A counter may be unbounded while a color component may clamp or wrap; the deck must not impose a finite content cycle.
- Even visible page counts require a visual checkpoint. `focusVisiblePageIndex` makes them representable, but the focus and hinge arrangement must be chosen deliberately rather than treated as a centered odd stack.
- The two-page prototype proves only local hinge ordering. Static layered geometry and generalized resting plus active z-order need their own visual checkpoint before recycling is wired in.
- Async content is excluded from the first contract. Allowing it without a loading/consistency model could reveal stale, partial, or visibly changing pages.
- Rapid re-engagement must observe either the complete pre-recycle state or the complete post-recycle state, never an intermediate assignment. The adapter must treat recycling and content changes as one bounded atomic update.

## Deferred Decisions

- The initial values for stack angle, depth, visible count, and buffer count are visual tuning decisions.
- Whether dynamic content is supplied through lifecycle callbacks, a content provider, or another adapter API remains open. The proposed events above are one candidate design.
- Async content loading and loading placeholders need a separate consistency contract.
- A generalized API for external updates to already visible content is deferred.
- The core/adapter package split remains deferred until the extraction trigger in [clacker-portability-architecture.md](clacker-portability-architecture.md) is met.

## Proposed Implementation Slices

These slices are review checkpoints, not fixed promises. Visual and interaction findings may change their order or scope.

- [ ] Deck model and contracts: add pure `DeckConfig`, stable page and half-slot identities, compact/default presets, logical-index progression, and completed-turn transitions. Cover configuration validation, stable IDs, positive/negative shifts, wraparound, and compact mode with unit tests.
- [ ] Static layered renderer: render the fixed keyed pool with placeholder labels, configurable resting stack poses, focus selection, hidden buffers, and generalized resting z-order. Review full and compact configurations before gesture integration.
- [ ] Foreground turn integration: connect completed-turn gesture events to deck advancement while preserving active-half hinge motion and keeping neighboring pages at rest. Verify single turns, long flicks, reversals, and interruption.
- [ ] Hidden-buffer content lifecycle: prove a minimal synchronous counter-label resolver before color synthesis. Verify completed turns update only buffered content and never expose partial assignments.
- [ ] Continuity and performance hardening: tune role handoffs and z-order, capture browser evidence, exercise dense compact instances, and validate transform-only behavior on desktop and Android.