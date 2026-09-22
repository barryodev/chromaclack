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
			expect.objectContaining({ side: 'first', logicalFaceIndex: 0, rotationDegrees: -40 }),
			expect.objectContaining({ side: 'second', logicalFaceIndex: 0, rotationDegrees: 40 })
		]);
	});

	it('keeps surrounding half-slots independent around the shared hinge', () => {
		const poses = createSettledHalfSlotScene();
		const visible = poses.filter((pose) => pose.visibility === 'visible');

		expect(visible.map((pose) => pose.logicalFaceIndex)).toEqual([-2, -1, 0, 0, 1, 2]);
		expect(visible.map((pose) => pose.side)).toEqual([
			'first',
			'first',
			'first',
			'second',
			'second',
			'second'
		]);
		expect(visible.map((pose) => pose.rotationDegrees)).toEqual([-6, -30, -40, 40, 30, 6]);
	});

	it('accepts explicit visible-window and return-buffer settings for a multi-page scene', () => {
		const poses = createSettledHalfSlotScene({
			halfSlotCount: 14,
			visibleWindowCount: 2,
			returnBufferCount: 1,
			focusedAngleDegrees: 40,
			innerNeighborAngleDegrees: 30,
			outerNeighborAngleDegrees: 8
		});

		expect(poses).toHaveLength(14);
		expect(
			poses.filter((pose) => pose.visibility === 'visible').map((pose) => pose.logicalFaceIndex)
		).toEqual([-2, -1, 0, 0, 1, 2]);
	});

	it('rejects a scene that cannot fit the visible neighborhood', () => {
		expect(() =>
			createSettledHalfSlotScene({
				halfSlotCount: 6,
				visibleNeighborCount: 2,
				focusedAngleDegrees: 40,
				innerNeighborAngleDegrees: 36,
				outerNeighborAngleDegrees: 6
			})
		).toThrow(RangeError);
	});
});
