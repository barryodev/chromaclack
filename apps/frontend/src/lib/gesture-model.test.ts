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

	it('updates rotation and velocity while dragging', () => {
		const model = createGestureModel('vertical');
		const started = model.beginDrag(100, 50);
		const moved = started.dragTo(170, 80);

		expect(moved.motionState).toBe('dragging');
		expect(moved.rotation).toBeGreaterThan(0);
		expect(moved.velocityDegPerMs).toBeGreaterThan(0);
	});

	it('settles immediately when released with low velocity', () => {
		const model = createGestureModel('vertical');
		const started = model.beginDrag(100, 50);
		const moved = started.dragTo(100.1, 150);
		const released = moved.release(200);

		expect(released.motionState).toBe('settled');
		expect(released.rotation).toBeLessThanOrEqual(180);
	});

	it('keeps rotational inertia when released with a strong enough velocity', () => {
		const model = createGestureModel('vertical');
		const started = model.beginDrag(100, 50);
		const moved = started.dragTo(220, 80);
		const released = moved.release(200);

		expect(released.motionState).toBe('inertia');
		expect(released.velocityDegPerMs).toBeGreaterThan(0.01);
		expect(released.rotation).toBeGreaterThan(0);
	});

	it('continues inertia across multiple completed turns', () => {
		const model = createGestureModel('vertical');
		const started = model.beginDrag(100, 50);
		const moved = started.dragTo(220, 80);
		const released = moved.release(200);
		const turning = tickGesture(released, 1000);

		expect(turning.motionState).toBe('inertia');
		expect(turning.completedTurns).toBe(3);
		expect(turning.rotation).toBeGreaterThanOrEqual(0);
		expect(turning.rotation).toBeLessThan(180);
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
		const started = model.beginDrag(100, 50);
		const moved = started.dragTo(220, 80);
		const released = moved.release(200);
		const settled = tickGesture(released, 8000);

		expect(settled.motionState).toBe('settled');
		expect(settled.rotation).toBeLessThan(180);
		expect(settled.completedTurns).toBeGreaterThan(0);
	});

	it('supports horizontal gestures with the opposite rotation direction contract', () => {
		const model = createGestureModel('horizontal');
		const started = model.beginDrag(100, 50);
		const moved = started.dragTo(220, 80);

		expect(moved.rotation).toBeGreaterThan(0);
		expect(moved.axis).toBe<GestureAxis>('horizontal');
	});
});
