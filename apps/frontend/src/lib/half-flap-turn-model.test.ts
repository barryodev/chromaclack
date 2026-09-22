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

	it('leaves every half exactly at rest when progress is zero', () => {
		const frame = createHalfFlapTurnFrame(poses, assignments, 'positive', 0);
		expect(frame.poses.map((pose) => pose.rotationDegrees)).toEqual(
			poses.map((pose) => pose.rotationDegrees)
		);
	});

	it('moves all six visible half flaps together around the hinge', () => {
		const frame = createHalfFlapTurnFrame(poses, assignments, 'positive', 0.5);
		const visible = frame.poses.filter((pose) => pose.visibility === 'visible');
		const upper = visible.filter((pose) => pose.side === 'first');
		const lower = visible.filter((pose) => pose.side === 'second');

		expect(upper).toHaveLength(3);
		expect(lower).toHaveLength(3);
		expect(upper.every((pose) => pose.rotationDegrees < -40)).toBe(true);
		expect(lower.every((pose) => pose.rotationDegrees < 40)).toBe(true);
	});

	it('clamps progress and mirrors the movement direction', () => {
		const positive = createHalfFlapTurnFrame(poses, assignments, 'positive', 1);
		const negative = createHalfFlapTurnFrame(poses, assignments, 'negative', 1);
		const negativeMidpoint = createHalfFlapTurnFrame(poses, assignments, 'negative', 0.5);

		expect(positive.progress).toBe(1);
		expect(negative.progress).toBe(1);
		expect(createHalfFlapTurnFrame(poses, assignments, 'positive', -1).progress).toBe(0);
		expect(positive.poses[2]?.rotationDegrees).toBe(-186);
		expect(negative.poses[2]?.rotationDegrees).toBe(174);
		expect(negative.poses[7]?.rotationDegrees).toBe(220);
		expect(negativeMidpoint.poses.filter((pose) => pose.visibility === 'visible').every((pose) =>
			pose.rotationDegrees > (poses.find((rest) => rest.physicalHalfSlotId === pose.physicalHalfSlotId)?.rotationDegrees ?? 0)
		)).toBe(true);
	});
});
