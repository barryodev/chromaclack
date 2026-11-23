// Pages and what the calling code hears about them (see Pages in GLOSSARY.md). Inside the clacker a page
// index is unbounded, so flaps can be told apart however far a swipe goes. The calling code only ever sees
// pages in its sequence, `{ pageCount, circular }`.

import { SPIN_DETENT_DEGREES, nearestDetent } from './spin.js';
import { completedTicks } from './swipe.js';

// The page in the sequence for an unbounded page index. A circular sequence wraps round. A finite one passes
// it through, until its limits come in DAI-59.
export function sequencePage(index, sequence) {
	if (!sequence.circular) return index;
	// Floored, so a negative index wraps to the end of the sequence rather than below 0.
	const laps = Math.floor(index / sequence.pageCount);
	return index - laps * sequence.pageCount;
}

/*
	The swipe's shown page. `page` is the page the swipe started on, and
	`drawnTravel` is the travel the moving flap is drawn at (see movingTravel),
	which in a fall runs ahead of travel. So the shown page moves on as the
	flap lands, before travel finishes the tick.
*/
export function swipeShownPage(page, drawnTravel) {
	return page + completedTicks(drawnTravel);
}

/*
	The spin's shown page. `spinAngle` is the spin angle in degrees, and
	`seatDetent` is the angle of the detent being seated into, or null when
	not seating. It's the nearest detent's page, or while seating, the seat
	detent's page.
*/
export function spinShownPage(spinAngle, seatDetent) {
	const detent = seatDetent ?? nearestDetent(spinAngle);
	const page = detent / SPIN_DETENT_DEGREES;
	// Rounding just short of −45° gives −0, which a readout would print as "-0".
	return page === 0 ? 0 : page;
}

/*
	What the calling code hears between two snapshots of the clacker, each
	{ page, idle } with an unbounded page: one shown event for each page passed,
	in order, and a current event if the clacker has just come to rest. A snap
	back comes to rest on the page it started from, so it gives only a current
	event.
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
	Calls the handlers with the page events since the last snapshot. Either
	handler can be left out. reset() starts it over without calling them, for
	when the calling code has set the page itself.
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
		// Moved on before the handlers run, so a handler that leads to another report doesn't hear these twice.
		last = snapshot;
		for (const shown of events.shown) onShownPage?.(shown);
		if (events.current) onCurrentPage?.(events.current);
	}
	return { reset, report };
}
