import { describe, expect, it } from 'vitest';

import {
	COMPACT_DECK_CONFIG,
	DEFAULT_DECK_CONFIG,
	completeDeckTurn,
	createDeckModel,
	bufferedPageSlots,
	visiblePageSlots,
	type DeckConfig
} from './deck-model';

describe('deck model', () => {
	it('creates the default fixed page and half-slot pool', () => {
		const model = createDeckModel();

		expect(model.config).toEqual(DEFAULT_DECK_CONFIG);
		expect(model.pageSlots).toHaveLength(9);
		expect(model.pageSlots[0]).toMatchObject({
			id: 'page-slot-1',
			logicalPageIndex: -4,
			halfSlots: [
				{ id: 'page-slot-1-first', role: 'first' },
				{ id: 'page-slot-1-second', role: 'second' }
			]
		});
		expect(visiblePageSlots(model).map((slot) => slot.logicalPageIndex)).toEqual([-2, -1, 0, 1, 2]);
		expect(bufferedPageSlots(model).map((slot) => slot.logicalPageIndex)).toEqual([-4, -3, 3, 4]);
	});

	it('supports the compact preset', () => {
		const model = createDeckModel(COMPACT_DECK_CONFIG);

		expect(model.pageSlots).toHaveLength(3);
		expect(visiblePageSlots(model).map((slot) => slot.logicalPageIndex)).toEqual([0]);
		expect(bufferedPageSlots(model).map((slot) => slot.logicalPageIndex)).toEqual([-1, 1]);
	});

	it('supports a deck with no buffers', () => {
		const model = createDeckModel({
			...COMPACT_DECK_CONFIG,
			bufferPageCount: 0
		});

		expect(visiblePageSlots(model).map((slot) => slot.logicalPageIndex)).toEqual([0]);
		expect(bufferedPageSlots(model)).toEqual([]);
	});

	it('rejects invalid configuration', () => {
		const invalidConfig = (overrides: Partial<DeckConfig>) => ({
			...DEFAULT_DECK_CONFIG,
			...overrides
		});

		expect(() => createDeckModel(invalidConfig({ visiblePageCount: 0 }))).toThrow(RangeError);
		expect(() => createDeckModel(invalidConfig({ bufferPageCount: -1 }))).toThrow(RangeError);
		expect(() => createDeckModel(invalidConfig({ focusVisiblePageIndex: 5 }))).toThrow(RangeError);
		expect(() => createDeckModel(invalidConfig({ fanAngleDegrees: Number.NaN }))).toThrow(
			RangeError
		);
	});

	it('advances one positive turn while recycling the hidden upper buffer slot', () => {
		const model = createDeckModel();
		const transition = completeDeckTurn(model, 'positive');

		expect(transition.model.pageSlots.map((slot) => slot.id)).toEqual([
			'page-slot-9',
			'page-slot-1',
			'page-slot-2',
			'page-slot-3',
			'page-slot-4',
			'page-slot-5',
			'page-slot-6',
			'page-slot-7',
			'page-slot-8'
		]);
		expect(visiblePageSlots(transition.model).map((slot) => slot.logicalPageIndex)).toEqual([
			-3, -2, -1, 0, 1
		]);
		expect(transition.events).toEqual([
			{
				type: 'turn-completed',
				direction: 'positive',
				focusLogicalPageIndex: -1,
				recycledPageSlotId: 'page-slot-9',
				recycledLogicalPageIndex: -5
			}
		]);
	});

	it('advances one negative turn while recycling the hidden lower buffer slot', () => {
		const model = createDeckModel();
		const transition = completeDeckTurn(model, 'negative');

		expect(visiblePageSlots(transition.model).map((slot) => slot.logicalPageIndex)).toEqual([
			-1, 0, 1, 2, 3
		]);
		expect(transition.events[0]).toMatchObject({
			direction: 'negative',
			focusLogicalPageIndex: 1,
			recycledPageSlotId: 'page-slot-1',
			recycledLogicalPageIndex: 5
		});
	});

	it('preserves every page and half-slot identity across repeated turns', () => {
		const initial = createDeckModel();
		const initialPageIds = initial.pageSlots.map((slot) => slot.id).sort();
		const initialHalfIds = initial.pageSlots
			.flatMap((slot) => slot.halfSlots.map((half) => half.id))
			.sort();
		const advanced = completeDeckTurn(
			completeDeckTurn(completeDeckTurn(initial, 'positive').model, 'positive').model,
			'negative'
		).model;

		expect(advanced.pageSlots.map((slot) => slot.id).sort()).toEqual(initialPageIds);
		expect(
			advanced.pageSlots.flatMap((slot) => slot.halfSlots.map((half) => half.id)).sort()
		).toEqual(initialHalfIds);
	});

	it('wraps physical slots while logical indices continue across a full pool rotation', () => {
		const initial = createDeckModel();
		let advanced = initial;

		for (let turn = 0; turn < initial.pageSlots.length; turn += 1) {
			advanced = completeDeckTurn(advanced, 'positive').model;
		}

		expect(advanced.pageSlots.map((slot) => slot.id)).toEqual(
			initial.pageSlots.map((slot) => slot.id)
		);
		expect(visiblePageSlots(advanced).map((slot) => slot.logicalPageIndex)).toEqual([
			-11, -10, -9, -8, -7
		]);
	});
});
