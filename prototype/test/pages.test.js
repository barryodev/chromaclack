import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	createPageReporter,
	hasPage,
	movingFlapIndex,
	pageEvents,
	restingFlapPage,
	sequencePage,
	spinShownPage,
	swipeShownPage,
	ticksToLimits,
	tierFlapIndex
} from '../pages.js';
import { SPIN_DETENT_DEGREES } from '../spin.js';
import { TICK_DEGREES } from '../swipe.js';

const circular = { pageCount: 8, circular: true };
const finite = { pageCount: 11, circular: false };

test('a circular sequence wraps an index past either end round to the other', () => {
	assert.equal(sequencePage(3, circular), 3);
	assert.equal(sequencePage(8, circular), 0);
	assert.equal(sequencePage(19, circular), 3);
	assert.equal(sequencePage(-1, circular), 7);
	assert.equal(sequencePage(-8, circular), 0);
	assert.equal(sequencePage(-17, circular), 7);
});

test('a finite sequence passes the index through', () => {
	assert.equal(sequencePage(12, finite), 12);
	assert.equal(sequencePage(-1, finite), -1);
});

test('a finite sequence has pages from its first page to its last, and none past either limit', () => {
	assert.equal(hasPage(0, finite), true);
	assert.equal(hasPage(10, finite), true);
	assert.equal(hasPage(-1, finite), false);
	assert.equal(hasPage(11, finite), false);
});

test('a circular sequence has a page at every index', () => {
	assert.equal(hasPage(-1, circular), true);
	assert.equal(hasPage(8, circular), true);
});

test('a finite sequence counts the ticks back to its first page and forward to its last', () => {
	assert.deepEqual(ticksToLimits(3, finite), { back: 3, forward: 7 });
	assert.deepEqual(ticksToLimits(0, finite), { back: 0, forward: 10 });
	assert.deepEqual(ticksToLimits(10, finite), { back: 10, forward: 0 });
});

test('a circular sequence has no limits either way', () => {
	assert.deepEqual(ticksToLimits(3, circular), { back: Infinity, forward: Infinity });
});

test("the swipe's shown page moves on once the drawn flap reaches the end of its tick, either way", () => {
	const justShort = TICK_DEGREES - 1;
	assert.equal(swipeShownPage(2, justShort), 2);
	assert.equal(swipeShownPage(2, TICK_DEGREES), 3);
	assert.equal(swipeShownPage(2, -justShort), 2);
	assert.equal(swipeShownPage(2, -TICK_DEGREES), 1);
});

test("the swipe's shown page counts every tick the drawn flap has completed", () => {
	const threeTicksAndABit = 3 * TICK_DEGREES + 10;
	assert.equal(swipeShownPage(2, threeTicksAndABit), 5);
	assert.equal(swipeShownPage(2, -threeTicksAndABit), -1);
});

test("the spin's shown page is the nearest detent's, switching halfway between detents", () => {
	const halfway = SPIN_DETENT_DEGREES / 2;
	assert.equal(spinShownPage(halfway - 1, null), 0);
	assert.equal(spinShownPage(halfway + 1, null), 1);
	assert.equal(spinShownPage(-halfway - 1, null), -1);
	assert.equal(spinShownPage(4 * SPIN_DETENT_DEGREES + 1, null), 4);
});

test("the spin's shown page is never −0", () => {
	const justShortOfHalfwayBack = -(SPIN_DETENT_DEGREES / 2 - 1);
	// Strict equal uses Object.is, so it tells −0 from 0.
	assert.equal(spinShownPage(justShortOfHalfwayBack, null), 0);
});

test("while seating, the spin's shown page is the detent being seated into", () => {
	const pastHalfway = SPIN_DETENT_DEGREES * 0.6;
	assert.equal(spinShownPage(pastHalfway, 0), 0);
	assert.equal(spinShownPage(4 * SPIN_DETENT_DEGREES - pastHalfway, 4 * SPIN_DETENT_DEGREES), 4);
});

test('the moving flap is the one between the page and the page the tick turns to', () => {
	assert.equal(movingFlapIndex(5, true), 5);
	assert.equal(movingFlapIndex(5, false), 4);
});

test('the start tiers count up from the page, and the end tiers count down from the page before', () => {
	const offstageTier = 3;
	assert.equal(tierFlapIndex('start', 0, 5), 5);
	assert.equal(tierFlapIndex('start', 1, 5), 6);
	assert.equal(tierFlapIndex('start', 2, 5), 7);
	assert.equal(tierFlapIndex('start', offstageTier, 5), 8);
	assert.equal(tierFlapIndex('end', 0, 5), 4);
	assert.equal(tierFlapIndex('end', 1, 5), 3);
	assert.equal(tierFlapIndex('end', 2, 5), 2);
	assert.equal(tierFlapIndex('end', offstageTier, 5), 1);
});

test('a resting flap shows its front page in the start half, and its back page in the end half', () => {
	assert.equal(restingFlapPage('start', 5), 5);
	assert.equal(restingFlapPage('end', 4), 5);
});

test('on the last page, the start half has no pages past the board', () => {
	const hasPageAt = (tier) => hasPage(restingFlapPage('start', tierFlapIndex('start', tier, 10)), finite);
	const offstageTier = 3;
	assert.equal(hasPageAt(0), true);
	assert.equal(hasPageAt(1), false);
	assert.equal(hasPageAt(2), false);
	assert.equal(hasPageAt(offstageTier), false);
});

test('on the first page, the end half has no pages past the board', () => {
	const hasPageAt = (tier) => hasPage(restingFlapPage('end', tierFlapIndex('end', tier, 0)), finite);
	const offstageTier = 3;
	assert.equal(hasPageAt(0), true);
	assert.equal(hasPageAt(1), false);
	assert.equal(hasPageAt(2), false);
	assert.equal(hasPageAt(offstageTier), false);
});

const moving = (page) => ({ page, idle: false });
const idle = (page) => ({ page, idle: true });

test('each page passed gives one shown event, in order', () => {
	assert.deepEqual(pageEvents(moving(2), moving(3), circular).shown, [{ page: 3, direction: 'forward' }]);
	assert.deepEqual(pageEvents(moving(2), moving(4), circular).shown, [
		{ page: 3, direction: 'forward' },
		{ page: 4, direction: 'forward' }
	]);
});

test('going back gives backward shown events', () => {
	assert.deepEqual(pageEvents(moving(2), moving(0), circular).shown, [
		{ page: 1, direction: 'backward' },
		{ page: 0, direction: 'backward' }
	]);
});

test('no page passed gives no events', () => {
	assert.deepEqual(pageEvents(moving(2), moving(2), circular), { shown: [], current: null });
	assert.deepEqual(pageEvents(idle(2), idle(2), circular), { shown: [], current: null });
});

test("shown events give the page in the sequence, wrapping round a circular sequence's seam", () => {
	assert.deepEqual(pageEvents(moving(7), moving(8), circular).shown, [{ page: 0, direction: 'forward' }]);
	assert.deepEqual(pageEvents(moving(0), moving(-1), circular).shown, [{ page: 7, direction: 'backward' }]);
});

test('coming to rest gives a current event, after the shown events', () => {
	const events = pageEvents(moving(2), idle(3), circular);
	assert.deepEqual(events.shown, [{ page: 3, direction: 'forward' }]);
	assert.deepEqual(events.current, { page: 3 });
});

test('a snap back gives only a current event, on the page it started from', () => {
	assert.deepEqual(pageEvents(moving(2), idle(2), circular), { shown: [], current: { page: 2 } });
});

test('a flick that lands on a limit shows that page and makes it current', () => {
	assert.deepEqual(pageEvents(moving(9), idle(10), finite), {
		shown: [{ page: 10, direction: 'forward' }],
		current: { page: 10 }
	});
	assert.deepEqual(pageEvents(moving(1), idle(0), finite), {
		shown: [{ page: 0, direction: 'backward' }],
		current: { page: 0 }
	});
});

test('a catch, which carries on moving, gives no current event', () => {
	assert.equal(pageEvents(moving(2), moving(2), circular).current, null);
});

test('starting to move gives no current event', () => {
	assert.equal(pageEvents(idle(2), moving(2), circular).current, null);
});

// A stand-in handler that records each event it's called with. Move it to testUtils.js once a second test
// file needs it.
function createSpy() {
	const spy = (event) => spy.calls.push(event);
	spy.calls = [];
	return spy;
}

test('the reporter calls the handlers with the events since the last snapshot', () => {
	const onShownPage = createSpy();
	const onCurrentPage = createSpy();
	const reporter = createPageReporter({ onShownPage, onCurrentPage });
	reporter.reset(idle(0), circular);
	reporter.report(moving(0));
	reporter.report(moving(1));
	reporter.report(idle(2));
	assert.deepEqual(onShownPage.calls, [
		{ page: 1, direction: 'forward' },
		{ page: 2, direction: 'forward' }
	]);
	assert.deepEqual(onCurrentPage.calls, [{ page: 2 }]);
});

test('resetting the reporter calls no handler, and later events count from the reset page', () => {
	const onShownPage = createSpy();
	const onCurrentPage = createSpy();
	const reporter = createPageReporter({ onShownPage, onCurrentPage });
	reporter.reset(moving(0), circular);
	reporter.reset(idle(5), circular);
	assert.deepEqual(onShownPage.calls, []);
	assert.deepEqual(onCurrentPage.calls, []);
	reporter.report(moving(6));
	assert.deepEqual(onShownPage.calls, [{ page: 6, direction: 'forward' }]);
});

test('a handler that leads to another report hears nothing twice', () => {
	const onShownPage = createSpy();
	const reporter = createPageReporter({
		onShownPage(event) {
			onShownPage(event);
			reporter.report(moving(2));
		}
	});
	reporter.reset(moving(0), circular);
	reporter.report(moving(2));
	assert.deepEqual(onShownPage.calls, [
		{ page: 1, direction: 'forward' },
		{ page: 2, direction: 'forward' }
	]);
});

test('the reporter works with either handler left out', () => {
	const reporter = createPageReporter({});
	reporter.reset(moving(0), circular);
	assert.doesNotThrow(() => reporter.report(idle(1)));
});
