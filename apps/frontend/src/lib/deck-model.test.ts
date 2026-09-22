import { describe, expect, it } from 'vitest';

import {
	COMPACT_DECK_CONFIG,
	DEFAULT_DECK_CONFIG,
	bufferedPageSlots,
	completeDeckTurn,
	completeDeckTurns,
	createDeckState,
	visiblePageSlots,
	type DeckConfig,
	type DeckLogicalPage
} from './deck-model';

function pages(ids: readonly string[]): DeckLogicalPage[] {
	return ids.map((id) => ({ id, faceId: `face-${id}` }));
}

describe('deck state machine', () => {
	it('creates a fixed physical pool with explicit upper and lower buffers', () => {
		const state = createDeckState();

		expect(state.config).toEqual(DEFAULT_DECK_CONFIG);
		expect(state.physicalPageSlots).toHaveLength(9);
		expect(state.physicalPageSlots[0]).toMatchObject({
			id: 'page-slot-1',
			halfSlots: [
				{ id: 'page-slot-1-first', side: 'first' },
				{ id: 'page-slot-1-second', side: 'second' }
			]
		});
		expect(visiblePageSlots(state).map((slot) => slot.page.faceId)).toEqual([
			'face--2',
			'face--1',
			'face-0',
			'face-1',
			'face-2'
		]);
		expect(state.upperReturnBuffer.map((slot) => slot.page.faceId)).toEqual([
			'upper-face-1',
			'upper-face-2'
		]);
		expect(state.lowerReturnBuffer.map((slot) => slot.page.faceId)).toEqual([
			'lower-face-1',
			'lower-face-2'
		]);
	});

	it('supports the compact fixed pool', () => {
		const state = createDeckState(COMPACT_DECK_CONFIG);

		expect(state.physicalPageSlots).toHaveLength(3);
		expect(state.visibleWindow).toHaveLength(1);
		expect(state.upperReturnBuffer).toHaveLength(1);
		expect(state.lowerReturnBuffer).toHaveLength(1);
	});

	it('rejects invalid counts, focus, duplicate pages, and visible input length', () => {
		const invalidConfig = (overrides: Partial<DeckConfig>) => ({
			...DEFAULT_DECK_CONFIG,
			...overrides
		});

		expect(() => createDeckState(invalidConfig({ visiblePageCount: 0 }))).toThrow(RangeError);
		expect(() => createDeckState(invalidConfig({ upperReturnBufferPageCount: -1 }))).toThrow(
			RangeError
		);
		expect(() => createDeckState(invalidConfig({ lowerReturnBufferPageCount: -1 }))).toThrow(
			RangeError
		);
		expect(() => createDeckState(invalidConfig({ focusVisiblePageIndex: 5 }))).toThrow(RangeError);
		expect(() =>
			createDeckState(DEFAULT_DECK_CONFIG, pages(['same', 'same', 'same', 'same', 'same']))
		).toThrow(RangeError);
		expect(() => createDeckState(DEFAULT_DECK_CONFIG, pages(['one']))).toThrow(RangeError);
	});

	it('advances one positive turn and replenishes the upper side from hidden pages', () => {
		const state = createDeckState(
			DEFAULT_DECK_CONFIG,
			pages(['v0', 'v1', 'v2', 'v3', 'v4']),
			pages(['hidden-0', 'hidden-1'])
		);
		const transition = completeDeckTurn(state, 'positive');

		expect(transition.status).toBe('advanced');
		expect(transition.state.visibleWindow.map((slot) => slot.page.id)).toEqual([
			'upper-page-1',
			'v0',
			'v1',
			'v2',
			'v3'
		]);
		expect(transition.state.upperReturnBuffer.map((slot) => slot.page.id)).toEqual([
			'upper-page-2',
			'hidden-0'
		]);
		expect(transition.state.lowerReturnBuffer.map((slot) => slot.page.id)).toEqual([
			'v4',
			'lower-page-1'
		]);
		expect(transition.state.hiddenBacksideQueue.map((page) => page.id)).toEqual([
			'hidden-1',
			'lower-page-2'
		]);
		expect(transition.events[0]).toMatchObject({
			direction: 'positive',
			incomingPage: { id: 'upper-page-1' },
			outgoingPage: { id: 'v4' }
		});
	});

	it('advances one negative turn and replenishes the lower side from the hidden deque', () => {
		const state = createDeckState(
			DEFAULT_DECK_CONFIG,
			pages(['v0', 'v1', 'v2', 'v3', 'v4']),
			pages(['hidden-0', 'hidden-1'])
		);
		const transition = completeDeckTurn(state, 'negative');

		expect(transition.status).toBe('advanced');
		expect(transition.state.visibleWindow.map((slot) => slot.page.id)).toEqual([
			'v1',
			'v2',
			'v3',
			'v4',
			'lower-page-1'
		]);
		expect(transition.state.upperReturnBuffer.map((slot) => slot.page.id)).toEqual([
			'v0',
			'upper-page-1'
		]);
		expect(transition.state.lowerReturnBuffer.map((slot) => slot.page.id)).toEqual([
			'lower-page-2',
			'hidden-1'
		]);
		expect(transition.state.hiddenBacksideQueue.map((page) => page.id)).toEqual([
			'upper-page-2',
			'hidden-0'
		]);
	});

	it('preserves physical IDs and restores state after a positive and negative reversal', () => {
		const state = createDeckState(
			DEFAULT_DECK_CONFIG,
			pages(['v0', 'v1', 'v2', 'v3', 'v4']),
			pages(['h0', 'h1'])
		);
		const physicalIds = state.physicalPageSlots.map((slot) => slot.id);
		const halfIds = state.physicalPageSlots.flatMap((slot) =>
			slot.halfSlots.map((half) => half.id)
		);
		const positive = completeDeckTurn(state, 'positive').state;
		const restored = completeDeckTurn(positive, 'negative').state;

		expect(restored.visibleWindow).toEqual(state.visibleWindow);
		expect(restored.upperReturnBuffer).toEqual(state.upperReturnBuffer);
		expect(restored.lowerReturnBuffer).toEqual(state.lowerReturnBuffer);
		expect(restored.hiddenBacksideQueue).toEqual(state.hiddenBacksideQueue);
		expect(restored.physicalPageSlots.map((slot) => slot.id)).toEqual(physicalIds);
		expect(
			restored.physicalPageSlots.flatMap((slot) => slot.halfSlots.map((half) => half.id))
		).toEqual(halfIds);
	});

	it('supports repeated turns and reports partial exhaustion', () => {
		const state = createDeckState(COMPACT_DECK_CONFIG, pages(['v0']), pages(['h0', 'h1']));
		const transition = completeDeckTurns(state, 'positive', 5);

		expect(transition.status).toBe('advanced');
		expect(transition.events).toHaveLength(5);
		expect(transition.state.completedTurns).toBe(5);
		expect(
			completeDeckTurn(createDeckState(COMPACT_DECK_CONFIG, pages(['v0'])), 'positive')
		).toMatchObject({
			status: 'exhausted',
			events: []
		});
	});

	it('returns the original state for non-positive turn counts and keeps buffer helpers complete', () => {
		const state = createDeckState();

		expect(completeDeckTurns(state, 'positive', 0)).toEqual({
			state,
			status: 'no-op',
			events: []
		});
		expect(completeDeckTurns(state, 'positive', -1).state).toBe(state);
		expect(bufferedPageSlots(state)).toHaveLength(4);
	});
});
