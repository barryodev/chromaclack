import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addToReleaseWindow, windowVelocity } from '../sampling.js';

const at = (time, position = 0) => ({ position, time });

test('the release window keeps the newest sample from before it, and drops older ones', () => {
	const samples = addToReleaseWindow([at(0), at(50), at(100)], at(150));
	assert.deepEqual(samples, [at(50), at(100), at(150)]);
});

test('the release window keeps the last two samples however old they are', () => {
	assert.deepEqual(addToReleaseWindow([at(0)], at(1000)), [at(0), at(1000)]);
});

test('adding to the release window leaves the samples it was given unchanged', () => {
	const samples = [at(0), at(50), at(100)];
	addToReleaseWindow(samples, at(150));
	assert.deepEqual(samples, [at(0), at(50), at(100)]);
});

test('window velocity runs from the oldest sample to the newest, not the last move', () => {
	assert.equal(windowVelocity([at(0, 0), at(10, 30), at(50, 100)]), 2);
});

test('window velocity is 0 when no time has passed', () => {
	assert.equal(windowVelocity([at(0, 0)]), 0);
});
