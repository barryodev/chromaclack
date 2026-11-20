import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	SPIN_DETENT_DEGREES,
	nearestDetent,
	rimDistance,
	rimSpeed,
	shortestTurn,
	spinDownDistance,
	spinDownSpeed,
	spinDownTime
} from '../spin.js';

const centre = { x: 0, y: 0 };
const sampleAt = (time, x, y) => ({ x, y, time });

test('a move along the rim counts in full, clockwise forward and counterclockwise backward', () => {
	// On the right of the centre, with screen y pointing down, moving down is clockwise.
	assert.equal(rimDistance({ x: 100, y: -5 }, { x: 100, y: 5 }, centre), 10);
	assert.equal(rimDistance({ x: 100, y: 5 }, { x: 100, y: -5 }, centre), -10);
});

test('a move straight out from the centre, or across the centre itself, goes nowhere round it', () => {
	assert.equal(rimDistance({ x: 100, y: 0 }, { x: 110, y: 0 }, centre), 0);
	assert.equal(rimDistance({ x: -5, y: 0 }, { x: 5, y: 0 }, centre), 0);
});

test('rim speed is the distance round the centre per ms', () => {
	assert.equal(rimSpeed([sampleAt(0, 100, -5), sampleAt(10, 100, 5)], centre), 1);
});

test('rim speed is 0 when no time has passed', () => {
	assert.equal(rimSpeed([sampleAt(0, 100, 0)], centre), 0);
});

// Close enough for maths that runs through exponentials and logarithms.
function assertNear(actual, expected) {
	assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);
}

test('a spin-down starts at its release speed and has not turned yet', () => {
	assertNear(spinDownSpeed(2, 0), 2);
	assertNear(spinDownDistance(2, 0), 0);
});

test('a spin-down reaches each speed at the time spinDownTime gives for it', () => {
	assertNear(spinDownSpeed(2, spinDownTime(2, 0.5)), 0.5);
	assertNear(spinDownSpeed(2, spinDownTime(2, 0)), 0);
});

test("a spin-down's angle grows at its speed", () => {
	// The angle's change over 1 ms, centred on 500 ms, matches the speed at 500 ms.
	const turnedOverOneMs = spinDownDistance(2, 500.5) - spinDownDistance(2, 499.5);
	assert.ok(Math.abs(turnedOverOneMs - spinDownSpeed(2, 500)) < 1e-6);
});

test('the nearest detent rounds to whole detents, either way round', () => {
	assert.equal(nearestDetent(0.4 * SPIN_DETENT_DEGREES), 0);
	assert.equal(nearestDetent(0.6 * SPIN_DETENT_DEGREES), SPIN_DETENT_DEGREES);
	assert.equal(nearestDetent(-0.6 * SPIN_DETENT_DEGREES), -SPIN_DETENT_DEGREES);
	assert.equal(nearestDetent(14 * SPIN_DETENT_DEGREES), 14 * SPIN_DETENT_DEGREES);
});

test('the shortest turn crosses the ±180° line instead of going the long way round', () => {
	assert.equal(shortestTurn(10, 30), 20);
	assert.equal(shortestTurn(170, -170), 20);
	assert.equal(shortestTurn(-170, 170), -20);
});
