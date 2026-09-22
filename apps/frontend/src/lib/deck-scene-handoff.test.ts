import { describe, expect, it } from 'vitest';

import { createSettledHalfSlotScene } from './half-slot-scene-model';
import {
	createInitialDeckState,
	mapDeckStateToSceneInput,
	type DeckState
} from './deck-scene-handoff';

describe('deck scene handoff', () => {
	it('creates an explicit logical window, return buffer, and hidden queue', () => {
		const hiddenBacksideQueue = [{ id: 'page-5', faceId: 'face-5' }];
		const state = createInitialDeckState({ hiddenBacksideQueue });

		expect(state.direction).toBe('positive');
		expect(state.visibleWindow.map((page) => page.faceId)).toEqual([
			'face--2',
			'face--1',
			'face-0',
			'face-1',
			'face-2'
		]);
		expect(state.returnBuffer.map((page) => page.faceId)).toEqual([
			'face--3',
			'face--4',
			'face-3',
			'face-4'
		]);
		expect(state.hiddenBacksideQueue).toEqual(hiddenBacksideQueue);
	});

	it('projects stable active halves and settled poses without mutating deck state', () => {
		const state: DeckState = createInitialDeckState({ direction: 'negative' });
		const sourcePoses = createSettledHalfSlotScene({
			halfSlotCount: 14,
			visibleWindowCount: 2,
			returnBufferCount: 1,
			focusedAngleDegrees: 40,
			innerNeighborAngleDegrees: 30,
			outerNeighborAngleDegrees: 6
		});
		const input = mapDeckStateToSceneInput(state, sourcePoses);

		expect(input.direction).toBe('negative');
		expect(input.activeHalfSlotIds).toEqual(['half-slot-7', 'half-slot-8']);
		expect(input.settledPoses.map((pose) => pose.physicalHalfSlotId)).toEqual(
			sourcePoses.map((pose) => pose.physicalHalfSlotId)
		);
		expect(input.settledPoses.filter((pose) => pose.visibility === 'visible')).toHaveLength(6);
		expect(input.faceAssignments).toEqual(
			expect.arrayContaining([
				{ physicalHalfSlotId: 'half-slot-7', faceId: 'face-0' },
				{ physicalHalfSlotId: 'half-slot-8', faceId: 'face-0' }
			])
		);
		expect(state.direction).toBe('negative');
	});

	it('rejects an invalid visible window count', () => {
		expect(() => createInitialDeckState({ visibleWindowCount: 0 })).toThrow(RangeError);
	});
});
