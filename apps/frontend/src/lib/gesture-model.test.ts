import { describe, expect, it } from 'vitest';

import {
	createGestureModel,
	dragGesture,
	releaseGesture,
	tickGesture,
	acceptedSwipeDirectionForRotation,
	type GestureAxis
} from './gesture-model';

describe('gesture model', () => {
	it('starts in the idle state and records the drag start', () => {
		const model = createGestureModel('vertical');

		expect(model.motionState).toBe('idle');
		expect(model.rotation).toBe(0);
		expect(model.dragStartPosition).toBe(0);
	});

	it('enters pointer-down before movement begins', () => {
		const model = createGestureModel('vertical').beginPointerDown(100, 50);

		expect(model.motionState).toBe('pointer-down');
		expect(model.dragStartPosition).toBe(100);
		expect(model.lastTouchTime).toBe(50);
	});

	it('enters release-evaluating before choosing a release outcome', () => {
		const model = createGestureModel('vertical').beginPointerDown(100, 50);
		const evaluating = model.release(80);

		expect(evaluating.model.motionState).toBe('release-evaluating');
		expect(evaluating.model.releaseTimestamp).toBe(80);
		expect(evaluating.events).toEqual([]);
	});

	it('ignores movement and release outside an active pointer lifecycle', () => {
		const model = createGestureModel('vertical');

		expect(model.dragTo(100, 50)).toBe(model);
		expect(model.release(50)).toEqual({ model, events: [] });
	});

	it('updates rotation and velocity while dragging', () => {
		const model = createGestureModel('vertical');
		const started = model.beginPointerDown(100, 50);
		const moved = started.dragTo(170, 80);

		expect(moved.motionState).toBe('dragging');
		expect(moved.rotation).toBeGreaterThan(0);
		expect(moved.velocityDegPerMs).toBeGreaterThan(0);
	});

	it('settles immediately when released with low velocity', () => {
		const model = createGestureModel('vertical');
		const started = model.beginPointerDown(100, 50);
		const moved = started.dragTo(100.1, 150);
		const released = moved.release(200).model.evaluateRelease().model;

		expect(released.motionState).toBe('settled');
		expect(released.rotation).toBeLessThanOrEqual(180);
	});

	it('keeps rotational inertia when released with a strong enough velocity', () => {
		const model = createGestureModel('vertical');
		const started = model.beginPointerDown(100, 50);
		const moved = started.dragTo(220, 80);
		const released = moved.release(200).model.evaluateRelease().model;

		expect(released.motionState).toBe('inertia');
		expect(released.velocityDegPerMs).toBeGreaterThan(0.01);
		expect(released.rotation).toBeGreaterThan(0);
	});

	it('emits one positive turn event for an accepted release', () => {
		const model = createGestureModel('vertical', { velocityStopThreshold: 1 });
		const moved = model.beginPointerDown(100, 50).dragTo(500, 1050);
		const released = moved.release(2050).model.evaluateRelease();

		expect(released.model.motionState).toBe('settled');
		expect(released.events).toEqual([
			{ type: 'turn-committed', direction: 'positive' },
			{ type: 'settled' }
		]);
	});

	it('emits a negative turn event for an opposite accepted release', () => {
		const model = createGestureModel('vertical', { velocityStopThreshold: 1 });
		const moved = model.beginPointerDown(500, 50).dragTo(100, 1050);
		const released = moved.release(2050).model.evaluateRelease();

		expect(released.model.motionState).toBe('settled');
		expect(released.events).toEqual([
			{ type: 'turn-committed', direction: 'negative' },
			{ type: 'settled' }
		]);
	});

	it('continues inertia across multiple completed turns', () => {
		const model = createGestureModel('vertical');
		const started = model.beginPointerDown(100, 50);
		const moved = started.dragTo(220, 80);
		const released = moved.release(200).model.evaluateRelease().model;
		const turning = tickGesture(released, 1000);

		expect(turning.model.motionState).toBe('inertia');
		expect(turning.events).toHaveLength(3);
		expect(turning.events.every((event) => event.type === 'turn-committed')).toBe(true);
		expect(turning.model.rotation).toBeGreaterThanOrEqual(0);
		expect(turning.model.rotation).toBeLessThan(180);
	});

	it('uses the accepted threshold to decide direction', () => {
		expect(acceptedSwipeDirectionForRotation(180)).toBe('positive');
		expect(acceptedSwipeDirectionForRotation(-180)).toBe('negative');
		expect(acceptedSwipeDirectionForRotation(90)).toBeUndefined();
	});

	it('decays inertia until the velocity drops below the stop threshold', () => {
		const model = createGestureModel('vertical', {
			velocityStopThreshold: 0.01,
			frictionDecayPerSecond: 3.5
		});
		const started = model.beginPointerDown(100, 50);
		const moved = started.dragTo(220, 80);
		const released = moved.release(200).model.evaluateRelease().model;
		const settled = tickGesture(released, 8000);

		expect(settled.model.motionState).toBe('settled');
		expect(settled.model.rotation).toBeLessThan(180);
		expect(settled.events.at(-1)).toEqual({ type: 'settled' });
	});

	it('supports horizontal gestures with the opposite rotation direction contract', () => {
		const model = createGestureModel('horizontal');
		const started = model.beginPointerDown(100, 50);
		const moved = started.dragTo(220, 80);

		expect(moved.rotation).toBeGreaterThan(0);
		expect(moved.axis).toBe<GestureAxis>('horizontal');
	});

	it('keeps opposite transitions independent after inertia settles', () => {
		const model = createGestureModel('vertical');
		const positive = model
			.beginPointerDown(100, 50)
			.dragTo(220, 80)
			.release(200)
			.model.evaluateRelease().model;
		const positiveTurn = tickGesture(positive, 1000);
		const negative = positiveTurn.model
			.beginPointerDown(220, 1200)
			.dragTo(100, 1230)
			.release(1300)
			.model.evaluateRelease().model;
		const negativeTurn = tickGesture(negative, 1000);

		expect(positiveTurn.events.some((event) => event.type === 'turn-committed')).toBe(true);
		expect(negativeTurn.events.some((event) => event.type === 'turn-committed')).toBe(true);
		expect(
			negativeTurn.events.every(
				(event) => event.type === 'turn-committed' && event.direction === 'negative'
			)
		).toBe(true);
	});
});
