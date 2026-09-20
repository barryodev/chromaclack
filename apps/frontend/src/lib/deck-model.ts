import type { SwipeDirection } from './flap-model';

export type DeckConfig = {
	visiblePageCount: number;
	bufferPageCount: number;
	focusVisiblePageIndex: number;
	fanAngleDegrees: number;
	pageDepthOffset: number;
};

export type DeckHalfSlotRole = 'first' | 'second';

export type DeckHalfSlot = {
	id: string;
	role: DeckHalfSlotRole;
};

export type DeckPageSlot = {
	id: string;
	halfSlots: readonly [DeckHalfSlot, DeckHalfSlot];
	logicalPageIndex: number;
};

export type DeckEvent = {
	type: 'turn-completed';
	direction: SwipeDirection;
	focusLogicalPageIndex: number;
	recycledPageSlotId: string;
	recycledLogicalPageIndex: number;
};

export type DeckTransition = {
	model: DeckModel;
	events: DeckEvent[];
};

export type DeckModel = {
	config: DeckConfig;
	pageSlots: readonly DeckPageSlot[];
	completeTurn: (direction: SwipeDirection) => DeckTransition;
};

export const DEFAULT_DECK_CONFIG: DeckConfig = {
	visiblePageCount: 5,
	bufferPageCount: 2,
	focusVisiblePageIndex: 2,
	fanAngleDegrees: 12,
	pageDepthOffset: 1
};

export const COMPACT_DECK_CONFIG: DeckConfig = {
	visiblePageCount: 1,
	bufferPageCount: 1,
	focusVisiblePageIndex: 0,
	fanAngleDegrees: 0,
	pageDepthOffset: 0
};

export function createDeckModel(config: DeckConfig = DEFAULT_DECK_CONFIG): DeckModel {
	validateDeckConfig(config);
	const focusPageSlotIndex = focusPageSlotIndexFor(config);
	const pageSlots = Array.from({ length: pageSlotCount(config) }, (_, index): DeckPageSlot => {
		const slotNumber = index + 1;
		return {
			id: `page-slot-${slotNumber}`,
			halfSlots: [
				{ id: `page-slot-${slotNumber}-first`, role: 'first' },
				{ id: `page-slot-${slotNumber}-second`, role: 'second' }
			],
			logicalPageIndex: index - focusPageSlotIndex
		};
	});

	return createModel(config, pageSlots);
}

export function visiblePageSlots(model: DeckModel): readonly DeckPageSlot[] {
	return model.pageSlots.slice(
		model.config.bufferPageCount,
		model.config.bufferPageCount + model.config.visiblePageCount
	);
}

export function bufferedPageSlots(model: DeckModel): readonly DeckPageSlot[] {
	if (model.config.bufferPageCount === 0) return [];

	return [
		...model.pageSlots.slice(0, model.config.bufferPageCount),
		...model.pageSlots.slice(-model.config.bufferPageCount)
	];
}

export function completeDeckTurn(model: DeckModel, direction: SwipeDirection): DeckTransition {
	return model.completeTurn(direction);
}

function createModel(config: DeckConfig, pageSlots: readonly DeckPageSlot[]): DeckModel {
	return {
		config,
		pageSlots,
		completeTurn(direction) {
			const shiftedSlots =
				direction === 'positive' ? rotateRight(pageSlots) : rotateLeft(pageSlots);
			const recycledSlotIndex = direction === 'positive' ? 0 : shiftedSlots.length - 1;
			const recycledSlot = itemAt(shiftedSlots, recycledSlotIndex);
			const nextFocusLogicalPageIndex = itemAt(
				shiftedSlots,
				focusPageSlotIndexFor(config)
			).logicalPageIndex;
			const recycledLogicalPageIndex =
				nextFocusLogicalPageIndex +
				(direction === 'positive'
					? -(config.bufferPageCount + config.focusVisiblePageIndex)
					: config.visiblePageCount - config.focusVisiblePageIndex - 1 + config.bufferPageCount);
			const nextSlots = shiftedSlots.map((slot, index) =>
				index === recycledSlotIndex ? { ...slot, logicalPageIndex: recycledLogicalPageIndex } : slot
			);

			return {
				model: createModel(config, nextSlots),
				events: [
					{
						type: 'turn-completed',
						direction,
						focusLogicalPageIndex: nextFocusLogicalPageIndex,
						recycledPageSlotId: recycledSlot.id,
						recycledLogicalPageIndex
					}
				]
			};
		}
	};
}

function validateDeckConfig(config: DeckConfig) {
	if (!Number.isInteger(config.visiblePageCount) || config.visiblePageCount <= 0) {
		throw new RangeError('Visible page count must be a positive integer.');
	}
	if (!Number.isInteger(config.bufferPageCount) || config.bufferPageCount < 0) {
		throw new RangeError('Buffer page count must be a non-negative integer.');
	}
	if (
		!Number.isInteger(config.focusVisiblePageIndex) ||
		config.focusVisiblePageIndex < 0 ||
		config.focusVisiblePageIndex >= config.visiblePageCount
	) {
		throw new RangeError('Focus page index must be within the visible page range.');
	}
	if (!Number.isFinite(config.fanAngleDegrees) || !Number.isFinite(config.pageDepthOffset)) {
		throw new RangeError('Deck geometry values must be finite.');
	}
}

function pageSlotCount(config: DeckConfig) {
	return config.visiblePageCount + config.bufferPageCount * 2;
}

function focusPageSlotIndexFor(config: DeckConfig) {
	return config.bufferPageCount + config.focusVisiblePageIndex;
}

function rotateRight<T>(items: readonly T[]): T[] {
	const lastItem = itemAt(items, items.length - 1);
	return [lastItem, ...items.slice(0, -1)];
}

function rotateLeft<T>(items: readonly T[]): T[] {
	const firstItem = itemAt(items, 0);
	return [...items.slice(1), firstItem];
}

function itemAt<T>(items: readonly T[], index: number): T {
	const item = items[index];
	if (item === undefined) throw new RangeError('Deck slot is outside the configured pool.');
	return item;
}
