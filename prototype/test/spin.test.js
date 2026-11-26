import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	SPIN_DETENT_DEGREES,
	recoil,
	heldReleaseVelocity,
	nearestDetent,
	rimDistance,
	rimSpeed,
	seatAim,
	shortestTurn,
	spinDownDistance,
	spinDownSpeed,
	spinDownTime,
	spinDownTimeTo,
	stepSpinSeat
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

// Within `tolerance` of expected, since maths through exponentials and logarithms is rarely exact.
function assertNear(actual, expected, tolerance) {
	assert.ok(Math.abs(actual - expected) < tolerance, `${actual} is not within ${tolerance} of ${expected}`);
}

test('a spin-down starts at its release speed and has not turned yet', () => {
	assertNear(spinDownSpeed(2, 0), 2, 1e-9);
	assertNear(spinDownDistance(2, 0), 0, 1e-9);
});

test('a spin-down reaches each speed at the time spinDownTime gives for it', () => {
	assertNear(spinDownSpeed(2, spinDownTime(2, 0.5)), 0.5, 1e-9);
	assertNear(spinDownSpeed(2, spinDownTime(2, 0)), 0, 1e-9);
});

test("a spin-down's angle grows at its speed", () => {
	// The angle's change over 1 ms, centred on 500 ms, matches the speed at 500 ms. A 1 ms step only
	// estimates the speed, to within about 6e-8 °/ms here, so the tolerance is looser than for exact formulas.
	const turnedOverOneMs = spinDownDistance(2, 500.5) - spinDownDistance(2, 499.5);
	assertNear(turnedOverOneMs, spinDownSpeed(2, 500), 1e-6);
});

test('a spin-down has turned the distance at the time spinDownTimeTo gives, without passing it', () => {
	const hitMs = spinDownTimeTo(2, 300);
	assertNear(spinDownDistance(2, hitMs), 300, 1e-6);
	assert.ok(spinDownDistance(2, hitMs) <= 300);
});

test('a spin-down that stops short of the distance never reaches it', () => {
	const stopDistance = spinDownDistance(2, spinDownTime(2, 0));
	assert.equal(spinDownTimeTo(2, stopDistance + 1), Infinity);
	assert.equal(spinDownTimeTo(2, Infinity), Infinity);
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

// Spin angles from page 0's detent to page 12's, like the lightness tab.
const range = { lowest: 0, highest: 12 * SPIN_DETENT_DEGREES };

test('a seat inside the range aims at the detent nearest the natural stop', () => {
	assert.equal(seatAim(4.4 * SPIN_DETENT_DEGREES, range), 4 * SPIN_DETENT_DEGREES);
	assert.equal(seatAim(4.6 * SPIN_DETENT_DEGREES, range), 5 * SPIN_DETENT_DEGREES);
});

test('a natural stop past a limit seats into that limit', () => {
	assert.equal(seatAim(15 * SPIN_DETENT_DEGREES, range), 12 * SPIN_DETENT_DEGREES);
	assert.equal(seatAim(-3 * SPIN_DETENT_DEGREES, range), 0);
});

test('a release held at a limit, still heading past it, keeps no speed', () => {
	assert.equal(heldReleaseVelocity(range.highest, 0.8, range), 0);
	assert.equal(heldReleaseVelocity(range.lowest, -0.8, range), 0);
});

test('a release heading back inside from a limit, or anywhere off one, keeps its speed', () => {
	assert.equal(heldReleaseVelocity(range.highest, -0.8, range), -0.8);
	assert.equal(heldReleaseVelocity(range.lowest, 0.8, range), 0.8);
	assert.equal(heldReleaseVelocity(5 * SPIN_DETENT_DEGREES, 0.8, range), 0.8);
});

test('a recoil puts an angle past a limit back on it, heading back inside', () => {
	const pastHighest = recoil(range.highest + 3, 0.5, range);
	assert.equal(pastHighest.angle, range.highest);
	assert.ok(pastHighest.velocity < 0);
	const pastLowest = recoil(range.lowest - 3, -0.5, range);
	assert.equal(pastLowest.angle, range.lowest);
	assert.ok(pastLowest.velocity > 0);
});

test('inside the range, or on a limit, a recoil leaves the angle and velocity as they are', () => {
	const inside = 5 * SPIN_DETENT_DEGREES;
	assert.deepEqual(recoil(inside, 0.5, range), { angle: inside, velocity: 0.5 });
	assert.deepEqual(recoil(range.highest, 0.5, range), { angle: range.highest, velocity: 0.5 });
});

test('a seat into a limit, heading for it, comes to rest there and never passes it', () => {
	let seat = { angle: range.highest - 20, velocity: 0.5, detent: range.highest };
	// This seat rests in about 25 frames of 16 ms. The cap of 125, two seconds, only stops a seat that never
	// rests from looping forever.
	for (let frame = 0; frame < 125 && !seat.atRest; frame++) {
		seat = stepSpinSeat(seat, 16, range);
		assert.ok(seat.angle <= range.highest, `frame ${frame} passed the limit, at ${seat.angle}°`);
	}
	assert.equal(seat.atRest, true);
});
