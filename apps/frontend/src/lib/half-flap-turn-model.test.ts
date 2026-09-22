import { describe, expect, it } from 'vitest';

import { createDeckState } from './deck-model';
import { createHalfFlapTurnFrame } from './half-flap-turn-model';
import { createSettledHalfSlotScene } from './half-slot-scene-model';

describe('half-flap turn model', () => {
	const poses = createSettledHalfSlotScene({
		halfSlotCount: 14,
		visibleWindowCount: 2,
		returnBufferCount: 1,
		focusedAngleDegrees: 40,
		innerNeighborAngleDegrees: 30,
		outerNeighborAngleDegrees: 6
	});
	const deck = createDeckState({
		visiblePageCount: 5,
		upperReturnBufferPageCount: 1,
		lowerReturnBufferPageCount: 1,
		focusVisiblePageIndex: 2
	});
	const assignments = [...deck.upperReturnBuffer, ...deck.visibleWindow, ...deck.lowerReturnBuffer];

	it('leaves every half exactly at rest before the rolling wave starts', () => {
		const frame = createHalfFlapTurnFrame(poses, assignments, 'positive', 0);

		expect(frame.poses.map((pose) => pose.rotationDegrees)).toEqual(
			poses.map((pose) => pose.rotationDegrees)
		);
		expect(frame.poses.every((pose) => pose.phase === 0)).toBe(true);
	});

	it('lets the leading half move before its neighbors follow', () => {
		const early = createHalfFlapTurnFrame(poses, assignments, 'positive', 0.05);
		const moving = early.poses.filter((pose) => pose.phase > 0);
		const settled = early.poses.filter((pose) => pose.visibility === 'visible' && pose.phase === 0);

		expect(moving).toHaveLength(1);
		expect(moving[0]?.isActive).toBe(true);
		expect(settled).toHaveLength(5);
	});

	it('forms a sequential rolling wave instead of gluing all flaps together', () => {
		const frame = createHalfFlapTurnFrame(poses, assignments, 'positive', 0.7);
		const visible = frame.poses.filter((pose) => pose.visibility === 'visible');
		const phases = visible.map((pose) => pose.phase);

		expect(new Set(phases).size).toBeGreaterThan(3);
		expect(phases.filter((phase) => phase > 0 && phase < 1).length).toBeGreaterThan(0);
		expect(phases.filter((phase) => phase === 1).length).toBeGreaterThan(0);
	});

	it('reverses the leading half and rolling order for the opposite direction', () => {
		const positive = createHalfFlapTurnFrame(poses, assignments, 'positive', 0.05);
		const negative = createHalfFlapTurnFrame(poses, assignments, 'negative', 0.05);

		expect(positive.poses.find((pose) => pose.phase > 0)?.side).toBe('first');
		expect(negative.poses.find((pose) => pose.phase > 0)?.side).toBe('second');
		expect(positive.poses.find((pose) => pose.phase > 0)?.rotationDegrees).toBeLessThan(-40);
		expect(negative.poses.find((pose) => pose.phase > 0)?.rotationDegrees).toBeGreaterThan(40);
	});

	it('clamps progress and preserves stable physical identities', () => {
		const frame = createHalfFlapTurnFrame(poses, assignments, 'negative', 2);

		expect(frame.progress).toBe(1);
		expect(frame.poses.map((pose) => pose.physicalHalfSlotId)).toEqual(
			assignments.flatMap((assignment) => [
				`${assignment.physicalPageSlotId}-first`,
				`${assignment.physicalPageSlotId}-second`
			])
		);
	});
});
