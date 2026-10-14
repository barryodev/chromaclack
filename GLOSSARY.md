# Glossary

These are the names for ChromaClack's parts and interactions. Use them in code, issues and conversations with AI. If a concept has no name here, add one before writing code for it.

The clacker is modelled on a mechanical split-flap display, where thin cards on a drum fall over a hinge one at a time. Two rules hold throughout:

- **Pages are logical. Flaps are physical.** A page is a value the clacker can show. A flap is the card that physically moves. The clacker has a small, fixed set of flaps, but it can show any number of pages.
- **Name things by what the user sees, not by sign.** Use up/down/left/right and forward/backward, never positive/negative.

## The clacker

**Clacker**: the single tactile UI element. It shows one page at a time and responds to swipes and spins.

**Axis**: the direction of a swipe, either **vertical** (up/down) or **horizontal** (left/right). An axis is named after the finger's movement, not the hinge. On the vertical axis the hinge runs horizontally and flaps rotate about the screen's X axis (`rotateX`). On the horizontal axis the hinge runs vertically and flaps rotate about the Y axis (`rotateY`).

**Hinge**: the centre line that splits the clacker in two. Flaps rotate about it.

**Half**: one side of the hinge, either the **start half** or the **end half**. In a forward flip, the flap moves from the start half to the end half.

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

**Target page**: the page the clacker will come to rest on once the current swipe's flips finish.

**Next / previous page**: the neighbours of the current page in the sequence. A **forward** flip shows the next page, and a **backward** flip shows the previous one.

## Flaps

**Flap**: a thin card that pivots on the hinge. At rest, every flap lies in either the start half or the end half.

**Flap side**: a flap's **front** or **back**. Each side carries one half page:

- the **front** shows the start half of page _N_, and
- the **back** shows the end half of page _N + 1_.

So at rest, page _N_ is made of two flaps. The start half shows the front of flap _N_. The end half shows the back of flap _N − 1_, the one that flipped most recently.

```
  page 3 at rest (vertical axis)

  ┌────────────┐
  │   3 (top)  │  front of flap C   (C: front = top of 3,    back = bottom of 4)
  ├── hinge ───┤
  │ 3 (bottom) │  back of flap B    (B: front = top of 2,    back = bottom of 3)
  └────────────┘

  Forward flip: flap C falls over the hinge into the bottom half and shows its
  back (bottom of 4). Flap D's front (top of 4) is revealed behind it.
```

**Flip**: one flap passing over the hinge from one half to the other. A flip moves the clacker one page forward or backward. One swipe can produce several flips.

**Flip angle**: how far a flap has rotated about the hinge. 0° is resting in the start half and 180° is resting in the end half. Avoid using bare "rotation" for this, because it collides with spin.

**Rest tilt**: a small angle that flaps hold at rest instead of lying flat against the clacker (DAI-43).

**Recycle**: when a flap goes round the back of the drum, out of view, its sides can be given new half pages. This is how a fixed set of flaps shows an unlimited sequence of pages (DAI-44, DAI-47).

## Swiping

**Swipe**: the user presses on the clacker and moves along an axis. A swipe flips flaps.

| Swipe | Flip direction |
| ----- | -------------- |
| down  | forward        |
| left  | forward        |
| up    | backward       |
| right | backward       |

A swipe has these phases:

- **Drag**: the pointer is down and moving, and the flap follows it.
- **Release**: the pointer lifts.
- **Inertia**: after release, flaps keep flipping and slow down under friction.
- **Settle**: the last flap comes to rest and the target page becomes the current page.

**Snap back**: if a swipe is released before any flap passes the hinge and without enough speed to carry it over, the flap returns to where it started and the page doesn't change.

## Holding and spinning

**Hold**: the user presses on the clacker and keeps the pointer still for a short time before moving. A hold starts a spin. The duration threshold is still to be decided (DAI-46).

**Spin**: after a hold, the user moves the pointer around the clacker's centre, like turning a dimmer knob or a turntable. The whole clacker rotates as one rigid unit in the plane of the screen (`rotateZ`), and no flaps move.

**Spin angle**: how far the clacker has been spun.

**Detent**: an angle the spin snaps to on release, like the clicks on a dimmer.

## Colour

**Colour component**: one value of the colour model, either Hue/Saturation/Lightness or Red/Green/Blue. Each interaction (vertical swipe, horizontal swipe, spin) drives one component.
