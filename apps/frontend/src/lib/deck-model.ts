export type DeckDirection = 'positive' | 'negative';

export type DeckLogicalPage = {
	id: string;
	faceId: string;
};

export type DeckConfig = {
	visiblePageCount: number;
	upperReturnBufferPageCount: number;
	lowerReturnBufferPageCount: number;
	focusVisiblePageIndex: number;
};

export type DeckHalfSlot = {
	id: string;
	side: 'first' | 'second';
};

export type PhysicalPageSlot = {
	id: string;
	physicalPosition: number;
	halfSlots: readonly [DeckHalfSlot, DeckHalfSlot];
};

export type DeckPageAssignment = {
	physicalPageSlotId: string;
	page: DeckLogicalPage;
};

export type DeckState = {
	config: DeckConfig;
	physicalPageSlots: readonly PhysicalPageSlot[];
	upperReturnBuffer: readonly DeckPageAssignment[];
	visibleWindow: readonly DeckPageAssignment[];
	lowerReturnBuffer: readonly DeckPageAssignment[];
	hiddenBacksideQueue: readonly DeckLogicalPage[];
	direction: DeckDirection;
	completedTurns: number;
};

export type DeckTurnEvent = {
	type: 'turn-completed';
	direction: DeckDirection;
	incomingPage: DeckLogicalPage;
	outgoingPage: DeckLogicalPage;
	incomingPhysicalPageSlotId: string;
	outgoingPhysicalPageSlotId: string;
};

export type DeckTransitionStatus = 'advanced' | 'no-op' | 'exhausted';

export type DeckTransition = {
	state: DeckState;
	status: DeckTransitionStatus;
	events: readonly DeckTurnEvent[];
};

export const DEFAULT_DECK_CONFIG: DeckConfig = {
	visiblePageCount: 5,
	upperReturnBufferPageCount: 2,
	lowerReturnBufferPageCount: 2,
	focusVisiblePageIndex: 2
};

export const COMPACT_DECK_CONFIG: DeckConfig = {
	visiblePageCount: 1,
	upperReturnBufferPageCount: 1,
	lowerReturnBufferPageCount: 1,
	focusVisiblePageIndex: 0
};

export function createDeckState(
	config: DeckConfig = DEFAULT_DECK_CONFIG,
	initialVisibleWindow: readonly DeckLogicalPage[] = defaultVisibleWindow(config),
	initialHiddenBacksideQueue: readonly DeckLogicalPage[] = []
): DeckState {
	validateDeckConfig(config);
	validatePages(initialVisibleWindow, config.visiblePageCount, 'Visible window');
	validateUniquePages([...initialVisibleWindow, ...initialHiddenBacksideQueue]);

	const physicalPageSlots = createPhysicalPageSlots(config);
	const upperPages = Array.from({ length: config.upperReturnBufferPageCount }, (_, index) => ({
		id: `upper-page-${index + 1}`,
		faceId: `upper-face-${index + 1}`
	}));
	const lowerPages = Array.from({ length: config.lowerReturnBufferPageCount }, (_, index) => ({
		id: `lower-page-${index + 1}`,
		faceId: `lower-face-${index + 1}`
	}));
	const activePages = [...upperPages, ...initialVisibleWindow, ...lowerPages];
	validateUniquePages([...activePages, ...initialHiddenBacksideQueue]);

	const assignments = activePages.map((page, index) => ({
		physicalPageSlotId: physicalPageSlots[index]?.id ?? '',
		page
	}));
	const upperEnd = config.upperReturnBufferPageCount;
	const visibleEnd = upperEnd + config.visiblePageCount;

	return {
		config,
		physicalPageSlots,
		upperReturnBuffer: assignments.slice(0, upperEnd),
		visibleWindow: assignments.slice(upperEnd, visibleEnd),
		lowerReturnBuffer: assignments.slice(visibleEnd),
		hiddenBacksideQueue: [...initialHiddenBacksideQueue],
		direction: 'positive',
		completedTurns: 0
	};
}

export function completeDeckTurn(state: DeckState, direction: DeckDirection): DeckTransition {
	if (state.visibleWindow.length === 0) return noOp(state);

	return direction === 'positive' ? advancePositiveTurn(state) : advanceNegativeTurn(state);
}

export function completeDeckTurns(
	state: DeckState,
	direction: DeckDirection,
	count: number
): DeckTransition {
	if (!Number.isInteger(count) || count <= 0) return noOp(state);

	let currentState = state;
	const events: DeckTurnEvent[] = [];
	for (let index = 0; index < count; index += 1) {
		const transition = completeDeckTurn(currentState, direction);
		if (transition.status !== 'advanced') {
			return events.length > 0
				? { state: currentState, status: transition.status, events }
				: transition;
		}
		currentState = transition.state;
		events.push(...transition.events);
	}

	return { state: currentState, status: 'advanced', events };
}

export function visiblePageSlots(state: DeckState): readonly DeckPageAssignment[] {
	return state.visibleWindow;
}

export function bufferedPageSlots(state: DeckState): readonly DeckPageAssignment[] {
	return [...state.upperReturnBuffer, ...state.lowerReturnBuffer];
}

function advancePositiveTurn(state: DeckState): DeckTransition {
	const incoming = state.upperReturnBuffer[0];
	const outgoing = state.visibleWindow.at(-1);
	const recycledSlot = state.lowerReturnBuffer.at(-1);
	const replenishment = state.hiddenBacksideQueue[0];
	if (!incoming || !outgoing || !recycledSlot || !replenishment) return exhausted(state);

	const nextState: DeckState = {
		...state,
		direction: 'positive',
		upperReturnBuffer: [
			...state.upperReturnBuffer.slice(1),
			{ physicalPageSlotId: recycledSlot.physicalPageSlotId, page: replenishment }
		],
		visibleWindow: [incoming, ...state.visibleWindow.slice(0, -1)],
		lowerReturnBuffer: [outgoing, ...state.lowerReturnBuffer.slice(0, -1)],
		hiddenBacksideQueue: [...state.hiddenBacksideQueue.slice(1), recycledSlot.page],
		completedTurns: state.completedTurns + 1
	};

	return advanced(nextState, {
		type: 'turn-completed',
		direction: 'positive',
		incomingPage: incoming.page,
		outgoingPage: outgoing.page,
		incomingPhysicalPageSlotId: incoming.physicalPageSlotId,
		outgoingPhysicalPageSlotId: outgoing.physicalPageSlotId
	});
}

function advanceNegativeTurn(state: DeckState): DeckTransition {
	const incoming = state.lowerReturnBuffer[0];
	const outgoing = state.visibleWindow[0];
	const recycledSlot = state.upperReturnBuffer.at(-1);
	const replenishment = state.hiddenBacksideQueue.at(-1);
	if (!incoming || !outgoing || !recycledSlot || !replenishment) return exhausted(state);

	const nextState: DeckState = {
		...state,
		direction: 'negative',
		upperReturnBuffer: [outgoing, ...state.upperReturnBuffer.slice(0, -1)],
		visibleWindow: [...state.visibleWindow.slice(1), incoming],
		lowerReturnBuffer: [
			...state.lowerReturnBuffer.slice(1),
			{ physicalPageSlotId: recycledSlot.physicalPageSlotId, page: replenishment }
		],
		hiddenBacksideQueue: [recycledSlot.page, ...state.hiddenBacksideQueue.slice(0, -1)],
		completedTurns: state.completedTurns + 1
	};

	return advanced(nextState, {
		type: 'turn-completed',
		direction: 'negative',
		incomingPage: incoming.page,
		outgoingPage: outgoing.page,
		incomingPhysicalPageSlotId: incoming.physicalPageSlotId,
		outgoingPhysicalPageSlotId: outgoing.physicalPageSlotId
	});
}

function createPhysicalPageSlots(config: DeckConfig): readonly PhysicalPageSlot[] {
	const pageSlotCount =
		config.upperReturnBufferPageCount + config.visiblePageCount + config.lowerReturnBufferPageCount;
	return Array.from({ length: pageSlotCount }, (_, index) => {
		const id = `page-slot-${index + 1}`;
		return {
			id,
			physicalPosition: index,
			halfSlots: [
				{ id: `${id}-first`, side: 'first' },
				{ id: `${id}-second`, side: 'second' }
			]
		};
	});
}

function defaultVisibleWindow(config: DeckConfig): readonly DeckLogicalPage[] {
	const focusIndex = config.focusVisiblePageIndex;
	return Array.from({ length: config.visiblePageCount }, (_, index) => {
		const logicalIndex = index - focusIndex;
		return { id: `page-${logicalIndex}`, faceId: `face-${logicalIndex}` };
	});
}

function validateDeckConfig(config: DeckConfig) {
	if (!Number.isInteger(config.visiblePageCount) || config.visiblePageCount <= 0) {
		throw new RangeError('Visible page count must be a positive integer.');
	}
	if (
		!Number.isInteger(config.upperReturnBufferPageCount) ||
		config.upperReturnBufferPageCount < 0
	) {
		throw new RangeError('Upper return buffer count must be a non-negative integer.');
	}
	if (
		!Number.isInteger(config.lowerReturnBufferPageCount) ||
		config.lowerReturnBufferPageCount < 0
	) {
		throw new RangeError('Lower return buffer count must be a non-negative integer.');
	}
	if (
		!Number.isInteger(config.focusVisiblePageIndex) ||
		config.focusVisiblePageIndex < 0 ||
		config.focusVisiblePageIndex >= config.visiblePageCount
	) {
		throw new RangeError('Focus page index must be within the visible page range.');
	}
}

function validatePages(pages: readonly DeckLogicalPage[], expectedCount: number, label: string) {
	if (pages.length !== expectedCount) {
		throw new RangeError(`${label} must contain exactly ${expectedCount} pages.`);
	}
	validateUniquePages(pages);
}

function validateUniquePages(pages: readonly DeckLogicalPage[]) {
	const ids = new Set(pages.map((page) => page.id));
	if (ids.size !== pages.length) throw new RangeError('Deck page IDs must be unique.');
}

function advanced(state: DeckState, event: DeckTurnEvent): DeckTransition {
	return { state, status: 'advanced', events: [event] };
}

function exhausted(state: DeckState): DeckTransition {
	return { state, status: 'exhausted', events: [] };
}

function noOp(state: DeckState): DeckTransition {
	return { state, status: 'no-op', events: [] };
}
