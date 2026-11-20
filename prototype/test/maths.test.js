import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clamp, lerp, springAtRest, stepDampedSpring } from '../maths.js';

test('clamp keeps a value inside its range', () => {
	assert.equal(clamp(-5, 0, 10), 0);
	assert.equal(clamp(15, 0, 10), 10);
	assert.equal(clamp(4, 0, 10), 4);
});

test('lerp gives from at 0, to at 1, and halfway at 0.5', () => {
	assert.equal(lerp(10, 20, 0), 10);
	assert.equal(lerp(10, 20, 1), 20);
	assert.equal(lerp(10, 20, 0.5), 15);
});

// Runs a spring in 16 ms frames until it's at rest, keeping every offset it passes through.
function runSpring(offset, velocity, swingMs, damping) {
	const offsets = [];
	let spring = { offset, velocity };
	for (let elapsedMs = 0; elapsedMs < 10_000; elapsedMs += 16) {
		spring = stepDampedSpring(spring.offset, spring.velocity, 16, swingMs, damping);
		offsets.push(spring.offset);
		if (springAtRest(spring.offset, spring.velocity)) return { offsets, atRest: true };
	}
	return { offsets, atRest: false };
}

test('a damped spring comes to rest', () => {
	assert.equal(runSpring(45, 0, 300, 0.3).atRest, true);
	assert.equal(runSpring(0, 0.5, 300, 0.3).atRest, true);
});

test('a spring with damping below 1 overshoots', () => {
	const { offsets } = runSpring(45, 0, 300, 0.3);
	assert.ok(offsets.some((offset) => offset < 0));
});

test('a spring at rest stays where it is', () => {
	assert.deepEqual(stepDampedSpring(0, 0, 16, 300, 0.3), { offset: 0, velocity: 0 });
});

test('one long frame moves the spring the same as several short ones', () => {
	let short = { offset: 45, velocity: 0 };
	for (let index = 0; index < 4; index++) {
		short = stepDampedSpring(short.offset, short.velocity, 4, 300, 0.3);
	}
	assert.deepEqual(stepDampedSpring(45, 0, 16, 300, 0.3), short);
});

test('springAtRest needs both a small offset and a small velocity', () => {
	assert.equal(springAtRest(0.01, 0.001), true);
	assert.equal(springAtRest(1, 0.001), false);
	assert.equal(springAtRest(0.01, 0.1), false);
});
