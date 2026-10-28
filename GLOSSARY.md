# Glossary

These are the names for ChromaClack's parts and interactions. Use them in code, issues and conversations with AI. If a concept has no name here, add one before writing code for it.

The clacker is modelled on a mechanical split-flap display, where thin cards on a drum fall over a hinge one at a time. Two rules hold throughout:

- **Pages are logical. Flaps are physical.** A page is a value the clacker can show. A flap is the card that physically moves. The clacker has a small, fixed set of flaps, but it can show any number of pages.
- **Name things by what the user sees, not by sign.** Use up/down/left/right and forward/backward, never positive/negative.

## The clacker

**Clacker**: the single tactile UI element. It shows one page at a time and responds to swipes and spins.

**Axis**: the direction of a swipe, either **vertical** (up/down) or **horizontal** (left/right). An axis is named after the finger's movement, not the hinge. On the vertical axis the hinge runs horizontally and flaps rotate about the screen's X axis (`rotateX`). On the horizontal axis the hinge runs vertically and flaps rotate about the Y axis (`rotateY`).

**Hinge**: the centre line that splits the clacker in two. Flaps rotate about it.

**Half**: one side of the hinge, either the **start half** or the **end half**. In a forward tick, the flap moves from the start half to the end half.

| Axis       | Start half | End half |
| ---------- | ---------- | -------- |
| Vertical   | top        | bottom   |
| Horizontal | right      | left     |

Use top/bottom/left/right when the axis is known, and start/end when code must work on both axes.

**Drum**: the imaginary spindle the flaps are mounted on. Flaps that aren't visible are "round the back of the drum".

## Pages

**Page**: one complete value the clacker can show, such as a colour with its label. At rest the clacker shows exactly one page. Pages form a circular sequence: after the last page comes the first again.

**Half page**: the start-half or end-half portion of a page. A page is never drawn as one object. Its two half pages are printed on sides of two different flaps.

**Page content**: the data that makes up a page (label, colour, and so on). Content can be assigned to a flap side late, while that flap is round the back of the drum.

**Current page**: the page shown at rest, or the last page that was fully shown.

**Target page**: the page the clacker will come to rest on once the current swipe's ticks finish.

**Next / previous page**: the neighbours of the current page in the sequence. A **forward** tick shows the next page, and a **backward** tick shows the previous one.

## Flaps

**Flap**: a thin card that pivots on the hinge. At rest, every flap lies in either the start half or the end half.

**Flap side**: a flap's **front** or **back**. Each side carries one half page:

- the **front** shows the start half of page _N_, and
- the **back** shows the end half of page _N + 1_.

So at rest, page _N_ is made of two flaps. The start half shows the front of flap _N_. The end half shows the back of flap _N − 1_, the one that ticked over most recently.

```
  page 3 at rest (vertical axis)

  ┌────────────┐
  │   3 (top)  │  front of flap C   (C: front = top of 3,    back = bottom of 4)
  ├── hinge ───┤
  │ 3 (bottom) │  back of flap B    (B: front = top of 2,    back = bottom of 3)
  └────────────┘

  Forward tick: flap C falls over the hinge into the bottom half and shows its
  back (bottom of 4). Flap D's front (top of 4) is revealed behind it.
```

**Tick**: one flap passing over the hinge from one half to the other. A tick moves the clacker one page forward or backward. One swipe can produce several ticks. It was called a "flip" before, which looks too much like "flap".

**Hinge angle**: how far a flap has rotated about the hinge. 0° is resting in the start half and 180° is resting in the end half. Avoid using bare "rotation" for this, because it collides with spin.

**Travel**: how far a swipe has turned flaps over the hinge since it started, counted across ticks. A caught swipe starts at the hinge angle it was caught at, and any other swipe at 0. Each 180° is one tick, so 360° of forward travel is two forward ticks. Forward travel counts up and backward travel counts down. The hinge angle is the part of travel inside the tick in progress, and the ticks completed so far are the whole 180°s.

**Moving flap**: the flap that turns about the hinge during a swipe. It stands in for tier 0 of the half it starts in. The other flaps rest in the tiers, named by half and tier, such as **start tier 1** or **end tier 0**.

**Rest tilt**: a small angle that flaps hold at rest instead of lying flat against the clacker (DAI-43). The tilt is applied when the flaps are drawn, and the hinge angle still runs 0–180°. On the spin tab every rest tilt is 0°, so the clacker lies flat like a record (DAI-45).

**Tier**: a pair of resting flaps, one in the start half and one in the end half, at the same depth. **Tier 0** is the pair closest to the user, **tier 1** sits behind it, and **tier 2** behind that. The clacker shows at most three tiers, because more would be visual clutter. Tiers further back hold smaller rest tilts. Tier 0 shows the current page. Behind it, the start half of tier _k_ shows the start half of page _N + k_, and the end half of tier _k_ shows the end half of page _N − k_.

**Fan**: all the resting tiers together, spread out at their decreasing rest tilts like a fanned stack of cards.

**Offstage flap**: a flap in no tier, round the back of the drum and out of view. In a forward tick an offstage flap joins the fan behind the back start tier, and the back end tier's flap goes offstage. A backward tick does the reverse. A clacker keeps only a few offstage flaps however many pages it has, because pages are painted onto flaps as they come round.

**Recycle**: when a flap goes offstage, its sides can be given new half pages. This is how a fixed set of flaps shows an unlimited sequence of pages (DAI-44, DAI-47).

## Swiping

**Swipe**: the user presses on the clacker and moves along an axis. A swipe ticks flaps over the hinge.

| Swipe | Tick direction |
| ----- | -------------- |
| down  | forward        |
| left  | forward        |
| up    | backward       |
| right | backward       |

A swipe has these phases:

- **Drag**: the pointer is down and moving, and the flap follows it. A long enough drag ticks through pages by itself, without inertia.
- **Release**: the pointer lifts.
- **Inertia**: after release, flaps keep ticking over and slow down under friction, ending on a landing.
- **Settle**: the last flap comes to rest and the target page becomes the current page.

**Release speed**: how fast the pointer was moving along the axis when it lifted, measured over its last 80 ms or so of movement rather than its last move alone. If the finger stopped before lifting, the release speed is close to zero. Inertia starts from it.

**Landing**: a position inertia can stop on. For a swipe it's a travel of a whole number of ticks, where every flap rests in a half. For a spin it's a detent. It isn't called a "rest", because that word already means at rest and rest tilt.

**Natural stop**: where the coast would leave the flap under normal friction. Inertia ends on the landing nearest the natural stop, so 90° into a tick is the tipping point. If the natural stop is past 90°, the flap finishes the tick. If it's short of 90°, the flap goes back to the tick's start.

**Coast**: inertia when friction can carry the flap to its landing. The flap starts at the release speed, slows under friction and comes to a stop. Friction is air resistance plus stopping friction. Normal friction depends on the input: a mouse gets about 70% more than touch or pen, because a small mouse flick moves the pointer fast. It goes by the kind of pointer, not the device, so a touchscreen laptop gets the touch feel when touched. Friction is fitted for each swipe so the coast ends exactly on its landing, but only within a band around normal friction, so the flap never looks like it's floating or braking hard. A coast that can't stop in time stops dead on its landing with a clack.

**Air resistance**: the part of a coast's friction that grows with the square of the flap's speed. A hard flick sheds speed quickly, so its coast stays short. It isn't called "air drag", because drag is already a swipe phase.

**Stopping friction**: a small, steady slowing on top of air resistance, so the coast comes to a full stop in finite time instead of slowing forever. It used to be called "stopping speed".

**Topple**: inertia when a coast can't reach the landing, because the flap is moving too slowly or away from it. The flap is pulled steadily towards the landing, forward or backward, like a card tipping over under gravity, and stops dead on it with a clack. It starts at the release speed. Moving towards the landing, it speeds up from there. Moving away, it slows, turns and falls back. A swipe released with no speed is just a topple.

**Snap back**: when a swipe ends where it started and the page doesn't change, because its natural stop is short of 90° into the first tick. The flap coasts back, or topples back if it's moving too slowly or forward.

**Catch**: pressing on the clacker during inertia. The ticks inertia has already completed are kept, and a new drag picks the flap up at its current hinge angle, so it doesn't jump.

## Rolodex motion

As a swipe slows, the clacker starts to move like a real rolodex: flaps fall onto the stack and bounce. A fast spin keeps a steady, even tick, the way a heavy rolodex spinning fast does.

**Looseness**: how much rolodex motion a tick shows, from 0 (tight) to 1 (loose). It comes from the flap's speed: tight above a set speed, loose below a lower one, and rising steeply as the flap nears the slower speed. Each tick takes its looseness as it starts and keeps it until it ends, so a tick's shape never changes partway through.

**Fall**: in inertia, the clacker carries a moving flap up until it passes its **fall point**, just past the top of its tick. Then gravity takes over and the flap falls onto the stack, ahead of travel, and waits there for travel to finish the tick. The **pull** of gravity scales with looseness, so a fast spin doesn't fall at all. Each flap has its own fall point and pull, so some balance longer and some drop harder. It isn't called the "tipping point", because that's the 90° that decides whether a swipe finishes its tick.

**Clack**: a falling flap landing on the stack in a half. Its strength comes from how fast the flap hits, times looseness, times the flap's own strength. Ticks dragged by hand don't clack, because a card pushed onto the stack by hand lands gently.

**Bounce**: what a clack sets off, a short damped spring in the half the flap landed in. The clacked flap **rebounds** towards the hinge and settles back, and the flaps beneath it are **knocked back** towards flat, less the deeper they sit. Picking up a rebounding flap fades its rebound out. No flap is ever drawn past the one in front of it, so a flap moving onto a bouncing one pushes it along instead of passing through it.

## Holding and spinning

**Hold**: the user presses on the clacker and keeps the pointer still for a short time before moving. A hold starts a spin. The duration threshold is still to be decided (DAI-46).

**Spin**: after a hold, the user moves the pointer around the clacker's centre, like turning a dimmer knob or a turntable. The whole clacker rotates as one rigid unit in the plane of the screen (`rotateZ`), and no flaps move.

**Spin angle**: how far the clacker has been spun.

**Detent**: an angle the spin snaps to on release, like the clicks on a dimmer.

## Colour

**Colour component**: one value of the colour model, either Hue/Saturation/Lightness or Red/Green/Blue. Each interaction (vertical swipe, horizontal swipe, spin) drives one component.
