# Fixed Clacker Display: Lessons and Guardrails

## Purpose

This document is the reset contract for the `deck-size-rest-angle` branch.

The branch exists to extend the proven four-flap Clacker interaction into a larger fixed physical display with intentional nonzero resting angles. It does not begin by solving recycling, logical page identity, hidden queues, content providers, or a generalized deck engine.

The immediate product goal is narrow:

> A fixed multi-flap Clacker responds to swipes with convincing mechanical motion, preserves direction and inertia, settles naturally, and remains performant.

If that object does not feel correct, additional state layers are prohibited. A smaller working display is more valuable than a larger abstract model that cannot preserve the motion.

## Baseline We Must Preserve

The proven baseline came from the small Clacker prototype and its gesture-model refinement:

- Pointer dragging is direct and 1:1.
- Swipe direction is explicit and axis-specific.
- Release evaluates gesture intent separately from rendering.
- Meaningful flicks can continue with bounded inertia.
- The motion settles and re-arms for another gesture.
- Motion is transform-driven and does not require layout reads.
- Physical upper and lower halves share a hinge and must remain visually continuous.
- The small prototype uses four visible half-slots and is the behavioral reference.

The baseline is authoritative for behavior. New geometry must adapt to it, not replace it before the replacement is proven.

## What Failed On `deck-model-with-recycling`

The dead branch accumulated a sequence of abstractions before the larger physical motion was demonstrated:

- logical deck state and page assignments
- upper/lower return buffers
- hidden backside queues
- completed-turn events
- a new half-slot scene model
- phase-based flap simulation
- multiple renderer rewrites
- a settling lifecycle layered onto an already unstable motion path

These pieces made the code and documents more elaborate, but the visible behavior regressed. The object stopped behaving like the earlier freely spinning four-half prototype. The branch demonstrated an important failure mode:

> A coherent type system and extensive documentation do not compensate for losing the physical behavior that motivated the work.

Specific failed assumptions:

- A logical page pair was treated as if it were the physical moving unit. The physical unit is an individual flap.
- A completed page boundary was treated as an animation target instead of an event along continuous motion.
- Fixed angle offsets and phase multipliers were used as substitutes for a mechanical hinge simulation.
- Logical assignments were changed while the physical trajectory was not yet coherent.
- Rendering and model responsibilities were repeatedly redefined instead of preserving the known-good gesture/render loop.
- Nonzero resting angles were treated as a deck-model problem instead of a static pose baseline.
- Recycling was introduced before a larger fixed physical object had been made convincing.
- Tests proved isolated data transitions while browser behavior became worse.

These are branch guardrails, not merely retrospective commentary.

## Simplified Production Model

The first implementation should have one small pure physical model and the existing gesture loop.

```ts
type Flap = {
	id: string;
	side: 'first' | 'second';
	restAngleDegrees: number;
	label: string;
};

type ClackerMotion = {
	angleDegrees: number;
	velocityDegreesPerMillisecond: number;
	direction: 'positive' | 'negative' | 'none';
	motionState: 'idle' | 'dragging' | 'inertia' | 'settled';
};
```

The fixed collection may contain more than four flaps, for example eight or twelve, but every flap has a permanent physical identity and a static label. There is no recycling in this branch slice.

### Face Continuity

The established `Flap.svelte` visual behavior is authoritative: whenever two neighboring flap faces meet at the visible hinge and read as one page, those two faces must use the same label and background color. A readable page is therefore derived from the current neighboring face relationship, not stored as a permanent page object.

Each physical flap still has distinct front and back faces. As the Clacker rotates, a flap exposes the face appropriate to its orientation; the adjacent exposed face must be assigned the matching visual data when the two surfaces form the user-facing page. This pairing rule applies to every physical adjacency around the fixed flap loop.

The motion pipeline is:

```text
pointer samples
  -> signed drag angle and release velocity
  -> inertial angular motion
  -> fixed physical flap pose projection
  -> transform-only rendering
```

Each tick should:

1. Integrate the current velocity into continuous angular motion.
2. Apply friction to velocity.
3. Project every fixed flap from the current motion state and its static rest angle.
4. Stop only when velocity and residual motion have naturally converged.
5. Never swap content, reorder nodes, or reset a flap to a target page during the motion.

A nonzero resting angle is simply part of the static pose:

```ts
renderAngle = restAngleDegrees + motionOffsetForFlap(flap, motion);
```

It must not introduce a second state machine.

## Physical Rules

### Direction

- A downward swipe moves the visible mechanism in the established downward direction.
- An upward swipe moves it in the established upward direction.
- All flaps use the same signed mechanical direction for a given swipe.
- Side-specific hinge origins may change how a surface appears in perspective, but must not create counter-rotating decks.

### Relative Motion

- At rest, every flap is stationary at its configured nonzero rest angle.
- During motion, the prominent/front flap leads.
- Neighboring flaps follow in physical order; they do not all receive the same angle delta.
- Relative angles evolve continuously as the motion progresses.
- A flap can only become prominent by following the same rolling path as the flap before it.
- No flap may teleport from a buffered or rear position into the front position.
- No flap may pass through another visible flap in the projected pose order.

### Inertia

- Release velocity comes from actual pointer samples.
- A hard flick may produce several turns, subject to a deliberate bounded safety limit.
- A small flick produces a short meaningful movement.
- Friction degrades momentum continuously.
- Completed rotational boundaries are observations/events along the trajectory, not commands to snap to a target.
- Settling is the final low-velocity tail of the same motion, not a separate teleport or replacement pose.

### Performance

- The DOM pool is fixed for the lifetime of the display.
- Motion updates transforms and compositor-friendly styles only.
- The frame loop performs no layout reads and creates no DOM nodes.
- The initial larger pool must be checked on desktop and Android before increasing it.
- If a larger pool cannot remain responsive, the visible count is reduced. Performance is a product requirement, not a later optimization task.

## Explicitly Deferred

The following are out of scope until the fixed physical object is convincing:

- logical page indices
- hidden backside queues
- upper/lower return-buffer state
- content recycling
- asynchronous content
- content-provider APIs
- completed-turn deck ownership
- generalized page/face assignment contracts
- color synthesis
- extraction into an independent library

A future recycling model may be useful, but it must be derived from a working fixed physical display rather than used to discover the display's mechanics.

## Acceptance Gates

No new abstraction is accepted unless the current gate passes in the browser.

### Gate 1: Four-Half Baseline

- Existing four-half motion remains visually and mechanically recognizable.
- Down and up direction remain correct.
- Small gestures re-arm immediately after settling.
- Hard gestures slow down naturally instead of snapping.

### Gate 2: Nonzero Rest Angles

- Add static rest angles only.
- With no pointer input, no flap moves.
- The first drag begins from the configured rest pose without a jump.
- The same four-half motion remains correct.

### Gate 3: Fixed Larger Pool

- Expand to eight or twelve fixed flaps.
- All physical IDs remain stable.
- Relative hinge order remains coherent through a complete swipe.
- No recycling or logical assignment changes are introduced.

### Gate 4: Performance

- Verify desktop and Android interaction.
- Confirm transform-only motion and no frame-loop layout reads.
- Confirm the larger pool does not create a visible input or animation regression.

Only after all four gates pass should recycling or a larger logical deck be discussed.

## AI Collaboration Guardrails

This branch is specifically protected against the failure mode that produced the dead branch.

- Discuss the model before editing it.
- Preserve the last working behavior as the primary acceptance evidence.
- Make one coherent implementation slice, not a chain of speculative compensating patches.
- Do not create a new abstraction merely because an existing behavior is difficult to extend.
- Do not treat passing unit tests as evidence that the browser motion is correct.
- Every substantive change must have a browser check against the current gate.
- If two or three fixes make the visual behavior worse or less explainable, stop and reassess the model.
- Do not continue because code has already been written. Revert the design direction in discussion before adding another layer.
- Prefer deleting an unproven model over preserving it for sunk-cost reasons.
- Keep the branch-level workflow light: discuss the slice, implement it, test it, review it, and commit only after approval.
- Never commit or reset without explicit user authorization.

## Definition Of Success

Success is not the number of types, tests, documents, or state transitions.

Success is a fixed multi-flap Clacker that a person can swipe and immediately recognize as a small mechanical card display:

- it moves in the swipe direction
- the front flap leads
- neighboring flaps follow in order
- relative angles change naturally
- no surfaces phase through each other
- momentum degrades visibly
- the object settles without snapping
- the interaction remains responsive

Everything else is subordinate to that experience.
