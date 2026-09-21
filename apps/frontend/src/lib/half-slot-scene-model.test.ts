import { describe, expect, it } from 'vitest';

import {
	DEFAULT_HALF_SLOT_SCENE_CONFIG,
	createSettledHalfSlotScene
} from './half-slot-scene-model';

describe('half-slot scene model', () => {
	it('creates a fixed scene with one coherent focused resting page', () => {
		const poses = createSettledHalfSlotScene();
		const active = poses.filter((pose) => pose.isActive);

		expect(poses).toHaveLength(DEFAULT_HALF_SLOT_SCENE_CONFIG.halfSlotCount);
		expect(active).toEqual([
			expect.objectContaining({ side: 'first', logicalFaceIndex: 0, rotationDegrees: 0 }),
			expect.objectContaining({ side: 'second', logicalFaceIndex: 0, rotationDegrees: 0 })
		]);
	});

	it('keeps surrounding half-slots independent around the shared hinge', () => {
		const poses = createSettledHalfSlotScene();
		const visible = poses.filter((pose) => pose.visibility === 'visible');

		expect(visible.map((pose) => pose.logicalFaceIndex)).toEqual([
			-2, -1, 0, 0, 1, 2
		]);
		expect(visible.map((pose) => pose.side)).toEqual([
			'first', 'first', 'first', 'second', 'second', 'second'
		]);
		expect(visible.map((pose) => pose.rotationDegrees)).toEqual([
			-24, -12, 0, 0, 12, 24
		]);
	});

	it('rejects a scene that cannot fit the visible neighborhood', () => {
		expect(() =>
			createSettledHalfSlotScene({ halfSlotCount: 6, visibleNeighborCount: 2, neighborAngleDegrees: 12 })
		).toThrow(RangeError);
	});
});