import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createPageReporter, pageEvents, sequencePage } from '../pages.js';

// A stand-in handler that records each event it's called with. Move it to testUtils.js once a second test
// file needs it.
function createSpy() {
	const spy = (event) => spy.calls.push(event);
	spy.calls = [];
	return spy;
}

const circular = { pageCount: 8, circular: true };
const finite = { pageCount: 11, circular: false };
const moving = (page) => ({ page, idle: false });
const idle = (page) => ({ page, idle: true });

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

test('a catch, which carries on moving, gives no current event', () => {
	assert.equal(pageEvents(moving(2), moving(2), circular).current, null);
});

test('starting to move gives no current event', () => {
	assert.equal(pageEvents(idle(2), moving(2), circular).current, null);
});

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
