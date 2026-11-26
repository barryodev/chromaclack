// Pages and what the calling code hears about them (see Pages in GLOSSARY.md). Inside the clacker a page
// index is unbounded, so flaps can be told apart however far a swipe goes. The calling code only ever sees
// pages in its sequence.

/*
	Sequences

	A sequence is { pageCount, circular }:
	- `pageCount` is how many pages it has, numbered 0 to pageCount − 1.
	- `circular` is true if the page after the last is the first again, and false if the sequence is
	  finite. A finite sequence's first and last pages are limits (see Limit in GLOSSARY.md), and past
	  them there are no pages. Until DAI-60 gives the spin its limits, its shown page can still go past
	  them.
	The clacker's sequence also holds `pageContent`, which this file doesn't use.
*/

/*
	Flaps

	A flap index is a whole number, unbounded like a page index. Flap i sits between page i and page
	i + 1: its front carries page i's start half, and its back carries page i + 1's end half. A half is
	'start' or 'end'.
*/

import { SPIN_DETENT_DEGREES, nearestDetent } from './spin.js';
import { completedTicks } from './swipe.js';

/*
	The page in the sequence that an unbounded page index stands for.

	`index` is the page index to look up. Inside the clacker a page index counts on past the last page and
	below 0 as a swipe goes, so it can be any whole number. `sequence` is the pages the clacker turns
	through: `pageCount`, how many there are, and `circular`, true if the page after the last is the first
	again.

	Returns the page index in the sequence. For a circular sequence, `index` is wrapped round into 0 to
	pageCount − 1, so pageCount is page 0 and −1 is the last page. For a finite sequence, `index` is
	returned unchanged, and past a limit it isn't a page in the sequence (see hasPage).
*/
export function sequencePage(index, sequence) {
	if (!sequence.circular) {
		return index;
	} else {
		// Floored, so a negative index wraps to the end of the sequence rather than below 0.
		const laps = Math.floor(index / sequence.pageCount);
		return index - laps * sequence.pageCount;
	}
}

/*
	Whether a page index has a page behind it.

	`index` is the page index to check. Inside the clacker a page index counts on past the last page and
	below 0 as a swipe goes, so it can be any whole number. `sequence` is the pages the clacker turns
	through: `pageCount`, how many there are, and `circular`, true if the page after the last is the first
	again.

	Returns true for any index in a circular sequence, because the pages wrap round. In a finite sequence
	it's true from 0 to pageCount − 1, and false past either end, where there are no pages.
*/
export function hasPage(index, sequence) {
	if (sequence.circular) {
		return true;
	} else {
		return (index >= 0 && index < sequence.pageCount);
	}
}

/*
	How far a swipe can go from a page before it reaches a limit (see Limit in GLOSSARY.md).

	`page` is the page index the swipe starts from, from 0 to pageCount − 1. `sequence` is the pages the
	clacker turns through: `pageCount`, how many there are, and `circular`, true if the page after the last
	is the first again.

	Returns { back, forward }: how many whole ticks back the first page is, and how many forward the last
	page is. Both are Infinity for a circular sequence, which has no limits.
*/
export function ticksToLimits(page, sequence) {
	if (sequence.circular) {
		return { back: Infinity, forward: Infinity };
	} else {
		return { back: page, forward: sequence.pageCount - 1 - page };
	}
}

/*
	The page the user sees during a swipe.

	`page` is the unbounded index of the page the swipe started on. `drawnTravel` is how far the moving
	flap is drawn as having turned since the swipe started, in degrees, counting up going forward and down
	going back (movingTravel in rolodex.js gives it). In a fall it runs ahead of the swipe's travel,
	because the flap drops onto the stack before travel finishes the tick.

	Returns `page` moved on by one for each whole tick (180°) of drawnTravel, forward or back, as an
	unbounded index. So the page changes as the flap lands.
*/
export function swipeShownPage(page, drawnTravel) {
	return page + completedTicks(drawnTravel);
}

/*
	The page the user sees during a spin.

	`spinAngle` is the clacker's spin angle in degrees. It counts the total turn, so it isn't wrapped to
	one turn. `seatDetent` is the angle, in degrees, of the detent the spin is seating into, or null when
	it isn't seating.

	Returns a page index: while seating, the seat detent's page, and otherwise the page of the detent
	nearest spinAngle. Each detent is a page, counting from page 0 at 0°, so 90° is page 1 and −90° is
	page −1. The index is unbounded, and sequencePage wraps it into the sequence.
*/
export function spinShownPage(spinAngle, seatDetent) {
	const detent = seatDetent ?? nearestDetent(spinAngle);
	const page = detent / SPIN_DETENT_DEGREES;
	// Rounding just short of −45° gives −0, which a readout would print as "-0".
	if (page === 0) {
		return 0;
	} else {
		return page;
	}
}

/*
	The flap that turns over in a tick from a page.

	`page` is the unbounded index of the page the tick starts from. `forward` is true for a forward tick
	and false for a backward one.

	Returns a flap index (see Flaps above): `page` going forward, and `page` − 1 going back.
*/
export function movingFlapIndex(page, forward) {
	if (forward) {
		return page;
	} else {
		return page - 1;
	}
}

/*
	The flap resting at a tier in one half of the fan, when the fan is painted from a page.

	`half` is 'start' or 'end'. `tier` is the tier number, from 0 next to the hinge outwards. One past the
	back tier is the offstage flap's place. `page` is the unbounded index of the page the fan is painted
	from.

	Returns a flap index (see Flaps above): `page` + `tier` in the start half, and `page` − 1 − `tier` in
	the end half.
*/
export function tierFlapIndex(half, tier, page) {
	if (half === 'start') {
		return page + tier;
	} else {
		return page - 1 - tier;
	}
}

/*
	The page a resting flap shows. A resting flap shows the same page on both of its sides.

	`half` is the half the flap rests in, 'start' or 'end'. `flapIndex` is its flap index (see Flaps
	above).

	Returns the unbounded index of the page whose half faces the user: the page on the flap's front in the
	start half, and the page on its back in the end half.
*/
export function restingFlapPage(half, flapIndex) {
	if (half === 'start') {
		return flapIndex;
	} else {
		return flapIndex + 1;
	}
}

/*
	The page events between two snapshots of the clacker, which the reporter passes on to the calling code.

	`before` and `after` are snapshots, each { page, idle }. `page` is the page the user sees, as an
	unbounded index, and `idle` is true when the clacker is at rest. `sequence` is the pages the clacker
	turns through: `pageCount`, how many there are, and `circular`, true if the page after the last is the
	first again. Nothing passed in is changed.

	Returns { shown, current }:
	- `shown` is a list with one { page, direction } for each page from before.page to after.page, in the
	  order they were passed, ending on after.page. `direction` is 'forward' if the page index went up and
	  'backward' if it went down. The list is empty if the page didn't change.
	- `current` is { page } with after.page if the clacker went from moving to idle between the two
	  snapshots, or null otherwise. So a release that comes back to rest on the page it started from gives
	  an empty `shown` and a `current`.
	Every page returned is wrapped into the sequence by sequencePage.
*/
export function pageEvents(before, after, sequence) {
	const step = after.page > before.page ? 1 : -1;
	const direction = step > 0 ? 'forward' : 'backward';
	const shown = [];
	let page = before.page;
	while (page !== after.page) {
		page += step;
		shown.push({ page: sequencePage(page, sequence), direction });
	}
	const cameToRest = after.idle && !before.idle;
	const current = cameToRest ? { page: sequencePage(after.page, sequence) } : null;
	return { shown, current };
}

/*
	Creates a reporter, which works out the page events from each new snapshot of the clacker and calls
	the calling code's handlers with them.

	`onShownPage` is called with each shown event, { page, direction }, and `onCurrentPage` with each
	current event, { page } (see pageEvents). Either can be left out.

	Returns { reset, report }, which both take a snapshot, { page, idle } as in pageEvents:
	- reset(snapshot, sequence) sets the snapshot to count from and the sequence to wrap pages into, and
	  calls no handler. The clacker calls it from load(), where the calling code sets the page itself. It
	  must be called before the first report().
	- report(snapshot) calls the handlers with the events between the last snapshot and this one: the
	  shown events in order, then the current event if there is one. This snapshot becomes the one the
	  next report() counts from.
*/
export function createPageReporter({ onShownPage, onCurrentPage }) {
	let last = null;
	let sequence = null;
	function reset(snapshot, newSequence) {
		last = snapshot;
		sequence = newSequence;
	}
	function report(snapshot) {
		const events = pageEvents(last, snapshot, sequence);
		// Moved on before the handlers run, so a handler that leads to another report doesn't hear these
		// twice.
		last = snapshot;
		for (const shown of events.shown) onShownPage?.(shown);
		if (events.current) onCurrentPage?.(events.current);
	}
	return { reset, report };
}
