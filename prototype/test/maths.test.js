import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clamp, lerp, roundHalfEven, springAtRest, springSteps, stepDampedSpring } from '../maths.js';

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

test('a frame is cut into equal spring steps of 4 ms or less', () => {
	assert.deepEqual(springSteps(10), { steps: 3, stepMs: 10 / 3 });
	assert.deepEqual(springSteps(4), { steps: 1, stepMs: 4 });
});

test('a frame of 0 ms gives no spring steps', () => {
	assert.deepEqual(springSteps(0), { steps: 0, stepMs: 0 });
});

test('a damped spring comes to rest', () => {
	const pulledOut = stepDampedSpring(45, 0, 5000, 300, 0.3);
	assert.equal(springAtRest(pulledOut.offset, pulledOut.velocity), true);
	const pushed = stepDampedSpring(0, 0.5, 5000, 300, 0.3);
	assert.equal(springAtRest(pushed.offset, pushed.velocity), true);
});

test('a spring with damping below 1 overshoots', () => {
	// About half a swing in, the spring is near its first overshoot.
	assert.ok(stepDampedSpring(45, 0, 150, 300, 0.3).offset < 0);
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

test('a value halfway between two neighbours rounds to the even one', () => {
	assert.equal(roundHalfEven(0.25, 1), 0.2);
	assert.equal(roundHalfEven(0.35, 1), 0.4);
	assert.equal(roundHalfEven(2.5, 0), 2);
});

test('a value off halfway rounds to its nearest neighbour', () => {
	assert.equal(roundHalfEven(100 / 12, 1), 8.3);
	assert.equal(roundHalfEven(0.26, 1), 0.3);
});

test('a halfway value that floats store just off half still rounds as a tie', () => {
	assert.equal(roundHalfEven(0.575, 2), 0.58);
	assert.equal(roundHalfEven(0.545, 2), 0.54);
});
