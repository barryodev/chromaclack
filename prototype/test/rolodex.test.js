import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	LOOSE_SPEED,
	TIGHT_SPEED,
	bounceOffset,
	easeLandingTier,
	easeLeavingTier,
	flapRandom,
	loosenessAt,
	movingTravel
} from '../rolodex.js';

test('looseness is 0 at or above the tight speed, and 1 at or below the loose speed', () => {
	assert.equal(loosenessAt(TIGHT_SPEED), 0);
	assert.equal(loosenessAt(TIGHT_SPEED + 1), 0);
	assert.equal(loosenessAt(LOOSE_SPEED), 1);
	assert.equal(loosenessAt(0), 1);
});

test('looseness never drops as the flap slows', () => {
	let previous = loosenessAt(TIGHT_SPEED);
	for (let step = 1; step <= 20; step++) {
		const looseness = loosenessAt(TIGHT_SPEED - (step / 20) * (TIGHT_SPEED - LOOSE_SPEED));
		assert.ok(looseness >= previous);
		previous = looseness;
	}
});

test("a flap's random value is from 0 up to 1, and the same every time", () => {
	for (let flapIndex = -10; flapIndex <= 10; flapIndex++) {
		for (let salt = 0; salt <= 2; salt++) {
			const value = flapRandom(flapIndex, salt);
			assert.ok(value >= 0 && value < 1);
			assert.equal(flapRandom(flapIndex, salt), value);
		}
	}
});

test('each effect gets its own random value for a flap', () => {
	assert.notEqual(flapRandom(3, 0), flapRandom(3, 1));
	assert.notEqual(flapRandom(3, 1), flapRandom(3, 2));
});

test('with no fall, the moving flap is drawn at travel', () => {
	assert.equal(movingTravel(null, 100), 100);
	assert.equal(movingTravel({ fall: null, elapsedMs: 50 }, 100), 100);
});

// A forward fall through the tick from 0 to 180, which started 100 ms into inertia.
const forwardFall = { low: 0, to: 180, direction: 1, fallStartMs: 100, pull: 0.01 };

test('a falling flap is drawn ahead of travel by how far gravity has pulled it', () => {
	// 20 ms into the fall, gravity has pulled it ½ × 0.01 × 20² = 2° ahead.
	assert.equal(movingTravel({ fall: forwardFall, elapsedMs: 120 }, 100), 102);
});

test('a falling flap stops at the end of its tick, forward or backward', () => {
	assert.equal(movingTravel({ fall: forwardFall, elapsedMs: 10_000 }, 100), 180);
	const snapBack = { low: 0, to: 0, direction: -1, fallStartMs: 100, pull: 0.01 };
	assert.equal(movingTravel({ fall: snapBack, elapsedMs: 10_000 }, 100), 0);
});

test('a fall from an earlier tick no longer moves the flap', () => {
	assert.equal(movingTravel({ fall: forwardFall, elapsedMs: 120 }, 200), 200);
});

const bounceAt = (half, clackedIndex, offset, rebound) => ({ half, clackedIndex, offset, velocity: 0, rebound });

test('a bounce moves the clacked flap towards the hinge by its full offset', () => {
	assert.equal(bounceOffset([bounceAt('end', 5, 10, 1)], 'end', 5), -10);
});

test('flaps beneath the clacked one are knocked back less the deeper they sit', () => {
	const bounces = [bounceAt('end', 5, 10, 1)];
	const [justBeneath, twoBeneath, threeBeneath, fourBeneath] = [4, 3, 2, 1].map((flapIndex) =>
		bounceOffset(bounces, 'end', flapIndex)
	);
	assert.ok(justBeneath > twoBeneath && twoBeneath > threeBeneath && threeBeneath > 0);
	// Past the last knock-back share, deeper flaps keep it.
	assert.equal(fourBeneath, threeBeneath);
});

test('flaps in front of the clacked one, and flaps in the other half, are not moved', () => {
	const bounces = [bounceAt('end', 5, 10, 1)];
	assert.equal(bounceOffset(bounces, 'end', 6), 0);
	assert.equal(bounceOffset(bounces, 'start', 4), 0);
});

test('a bounce in the start half mirrors one in the end half', () => {
	const endBounces = [bounceAt('end', 5, 10, 1)];
	const startBounces = [bounceAt('start', 5, 10, 1)];
	for (let depth = 0; depth <= 3; depth++) {
		assert.equal(bounceOffset(startBounces, 'start', 5 + depth), -bounceOffset(endBounces, 'end', 5 - depth));
	}
});

test('a picked-up flap loses its rebound, and the flaps beneath keep their knock-back', () => {
	const bouncing = [bounceAt('end', 5, 10, 1)];
	const pickedUp = [bounceAt('end', 5, 10, 0)];
	assert.equal(bounceOffset(pickedUp, 'end', 5), 0);
	assert.equal(bounceOffset(pickedUp, 'end', 4), bounceOffset(bouncing, 'end', 4));
});

test('both tier easings start at 0 and end at 1, so the fan meets its next pose exactly', () => {
	assert.equal(easeLeavingTier(0), 0);
	assert.equal(easeLeavingTier(1), 1);
	assert.equal(easeLandingTier(0), 0);
	assert.equal(easeLandingTier(1), 1);
});
