import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	COAST_DEGREES_PER_PIXEL,
	MAX_FRICTION_FIT,
	MAX_TICKS_PER_SWIPE,
	MIN_FRICTION_FIT,
	MOUSE_FRICTION,
	SWIPE_LANDINGS,
	TICK_DEGREES,
	coastMotion,
	completedTicks,
	drawnAngle,
	hingeAngle,
	landingsWithin,
	nearestLanding,
	planInertia,
	stoppingDistance,
	stoppingTime,
	swipeRange,
	tickBounds,
	toppleMotion
} from '../swipe.js';

test('completed ticks count whole ticks of travel, forward or backward', () => {
	assert.equal(completedTicks(400), 2);
	assert.equal(completedTicks(-400), -2);
	assert.equal(completedTicks(170), 0);
});

test('the hinge angle is the part of travel inside the tick in progress', () => {
	assert.equal(hingeAngle(400), 40);
	assert.equal(hingeAngle(-400), -40);
});

test('tick bounds are the lowest and highest travel of the tick in progress', () => {
	assert.deepEqual(tickBounds(400), [360, 540]);
	assert.deepEqual(tickBounds(-400), [-540, -360]);
});

test('a flap is drawn at its rest tilt at 0° and at 180° minus it at 180°', () => {
	assert.equal(drawnAngle(0, 42), 42);
	assert.equal(drawnAngle(180, 42), 138);
});

test('swipe landings are every whole tick either way, up to the most ticks a swipe can make', () => {
	assert.equal(SWIPE_LANDINGS[0], -MAX_TICKS_PER_SWIPE * TICK_DEGREES);
	assert.equal(SWIPE_LANDINGS.at(-1), MAX_TICKS_PER_SWIPE * TICK_DEGREES);
	assert.ok(SWIPE_LANDINGS.includes(0));
	assert.ok(SWIPE_LANDINGS.every((landing) => landing % TICK_DEGREES === 0));
});

test("a swipe's range reaches each limit", () => {
	assert.deepEqual(swipeRange({ back: 2, forward: 5 }), { lowest: -360, highest: 900 });
	assert.deepEqual(swipeRange({ back: 0, forward: 10 }), { lowest: 0, highest: 1800 });
});

test("a swipe's range stops at the most ticks a swipe can make, however far the limits are", () => {
	const most = MAX_TICKS_PER_SWIPE * 180;
	assert.deepEqual(swipeRange({ back: Infinity, forward: Infinity }), { lowest: -most, highest: most });
	assert.deepEqual(swipeRange({ back: 3, forward: 100 }), { lowest: -540, highest: most });
});

test('the landings within a range are its whole ticks, both ends included', () => {
	assert.deepEqual(landingsWithin({ lowest: -360, highest: 180 }), [-360, -180, 0, 180]);
});

test('the nearest landing is the closest one to the position', () => {
	assert.equal(nearestLanding(100, [0, 180, 360]), 180);
	assert.equal(nearestLanding(80, [0, 180, 360]), 0);
});

test('doubling friction halves both the stopping distance and the stopping time', () => {
	assert.equal(stoppingDistance(2, 1) / stoppingDistance(2, 2), 2);
	assert.equal(stoppingTime(2, 1) / stoppingTime(2, 2), 2);
});

test('a backward flick plans the mirror image of a forward one', () => {
	const forward = planInertia(0, 2, SWIPE_LANDINGS, 1);
	const backward = planInertia(0, -2, SWIPE_LANDINGS, 1);
	assert.equal(backward.target, -forward.target);
	assert.equal(backward.durationMs, forward.durationMs);
	assert.equal(backward.frictionScale, forward.frictionScale);
});

test("a coast's friction stays in its band around the input's normal friction", () => {
	for (const normalFriction of [1, MOUSE_FRICTION]) {
		const { frictionScale } = planInertia(0, 2, SWIPE_LANDINGS, normalFriction);
		assert.ok(frictionScale >= MIN_FRICTION_FIT * normalFriction);
		assert.ok(frictionScale <= MAX_FRICTION_FIT * normalFriction);
	}
});

test('a coast lands on its target at the end of its duration, without jumping there', () => {
	const plan = planInertia(0, 2, SWIPE_LANDINGS, 1);
	const inertia = { start: 0, velocity: 2, frictionScale: plan.frictionScale, durationMs: plan.durationMs };
	assert.deepEqual(coastMotion(inertia, plan.target, plan.durationMs), {
		travel: plan.target,
		velocity: 0,
		landed: true
	});
	const justBefore = coastMotion(inertia, plan.target, plan.durationMs - 1);
	assert.equal(justBefore.landed, false);
	assert.ok(plan.target - justBefore.travel < 1);
});

test('a swipe released with no speed finishes its tick past 90°, and snaps back short of it', () => {
	assert.equal(planInertia(100, 0, SWIPE_LANDINGS, 1).target, 180);
	assert.equal(planInertia(60, 0, SWIPE_LANDINGS, 1).target, 0);
});

test('a hard flick towards a limit two ticks away coasts to the limit', () => {
	const hardFlick = 3.4 * COAST_DEGREES_PER_PIXEL;
	const plan = planInertia(0, hardFlick, [-180, 0, 180, 360], 1);
	assert.equal(plan.target, 360);
	assert.equal(plan.coasts, true);
});

test('a flick against a limit the flap is already on stays on it', () => {
	const hardFlick = 3.4 * COAST_DEGREES_PER_PIXEL;
	const plan = planInertia(0, hardFlick, [-360, -180, 0], 1);
	assert.equal(plan.target, 0);
});

test('a flap moving away from its landing topples back to it', () => {
	const plan = planInertia(100, -0.05, SWIPE_LANDINGS, 1);
	assert.equal(plan.coasts, false);
	assert.equal(plan.target, 180);
});

test('a topple lands on its target at the end of its duration, without jumping there', () => {
	const plan = planInertia(100, -0.05, SWIPE_LANDINGS, 1);
	const inertia = { start: 100, velocity: -0.05, durationMs: plan.durationMs };
	const landing = toppleMotion(inertia, plan.target, plan.durationMs);
	assert.equal(landing.travel, plan.target);
	assert.equal(landing.landed, true);
	const justBefore = toppleMotion(inertia, plan.target, plan.durationMs - 1);
	assert.equal(justBefore.landed, false);
	assert.ok(plan.target - justBefore.travel < 1);
});
