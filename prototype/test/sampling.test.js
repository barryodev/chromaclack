import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addToReleaseWindow, windowVelocity } from '../sampling.js';

const sampleAt = (time, position) => ({ position, time });

test('the release window keeps the newest sample from before it, and drops older ones', () => {
	const samples = addToReleaseWindow([sampleAt(0, 0), sampleAt(50, 0), sampleAt(100, 0)], sampleAt(150, 0));
	assert.deepEqual(samples, [sampleAt(50, 0), sampleAt(100, 0), sampleAt(150, 0)]);
});

test('the release window keeps the last two samples however old they are', () => {
	assert.deepEqual(addToReleaseWindow([sampleAt(0, 0)], sampleAt(1000, 0)), [sampleAt(0, 0), sampleAt(1000, 0)]);
});

test('window velocity runs from the oldest sample to the newest, not the last move', () => {
	assert.equal(windowVelocity([sampleAt(0, 0), sampleAt(10, 30), sampleAt(50, 100)]), 2);
});

test('window velocity is 0 when no time has passed', () => {
	assert.equal(windowVelocity([sampleAt(0, 0)]), 0);
});
