import type { HalfSlotPose } from './half-slot-scene-model';

export type DeckDirection = 'positive' | 'negative';

export type DeckLogicalPage = {
	id: string;
	faceId: string;
};

export type DeckState = {
	direction: DeckDirection;
	visibleWindow: readonly DeckLogicalPage[];
	returnBuffer: readonly DeckLogicalPage[];
	hiddenBacksideQueue: readonly DeckLogicalPage[];
};

export type HalfSlotSceneInput = {
	direction: DeckDirection;
	settledPoses: readonly HalfSlotPose[];
	activeHalfSlotIds: readonly [string, string];
	faceAssignments: readonly {
		physicalHalfSlotId: string;
		faceId: string;
	}[];
	visibleFaceIds: readonly string[];
	returnBufferFaceIds: readonly string[];
	hiddenBacksideQueueCount: number;
};

export type InitialDeckStateConfig = {
	visibleWindowCount?: number;
	returnBufferCount?: number;
	hiddenBacksideQueue?: readonly DeckLogicalPage[];
	direction?: DeckDirection;
};

export function createInitialDeckState(config: InitialDeckStateConfig = {}): DeckState {
	const visibleWindowCount = config.visibleWindowCount ?? 5;
	const returnBufferCount = config.returnBufferCount ?? 2;
	validateCount(visibleWindowCount, 'Visible window count', false);
	validateCount(returnBufferCount, 'Return buffer count', true);

	const focusIndex = Math.floor(visibleWindowCount / 2);
	const visibleWindow = Array.from({ length: visibleWindowCount }, (_, index) =>
		createLogicalPage(index - focusIndex)
	);
	const returnBuffer = [
		...Array.from({ length: returnBufferCount }, (_, index) =>
			createLogicalPage(-focusIndex - index - 1)
		),
		...Array.from({ length: returnBufferCount }, (_, index) =>
			createLogicalPage(visibleWindowCount - focusIndex + index)
		)
	];

	return {
		direction: config.direction ?? 'positive',
		visibleWindow,
		returnBuffer,
		hiddenBacksideQueue: config.hiddenBacksideQueue ?? []
	};
}

export function mapDeckStateToSceneInput(
	state: DeckState,
	settledPoses: readonly HalfSlotPose[]
): HalfSlotSceneInput {
	const activePoses = settledPoses.filter((pose) => pose.isActive);
	const activeFirstPose = activePoses.find((pose) => pose.side === 'first');
	const activeSecondPose = activePoses.find((pose) => pose.side === 'second');
	if (!activeFirstPose || !activeSecondPose) {
		throw new RangeError('Scene handoff requires one active half for each side.');
	}

	const focusIndex = Math.floor(state.visibleWindow.length / 2);
	const visibleByOffset = new Map(
		state.visibleWindow.map((page, index) => [index - focusIndex, page])
	);
	const bufferPages = state.returnBuffer;
	let bufferIndex = 0;
	const faceAssignments: { physicalHalfSlotId: string; faceId: string }[] = [];
	const projectedPoses = settledPoses.map((pose) => {
		const page = visibleByOffset.get(pose.logicalFaceIndex);
		if (page) {
			faceAssignments.push({ physicalHalfSlotId: pose.physicalHalfSlotId, faceId: page.faceId });
			return { ...pose, logicalFaceIndex: pose.logicalFaceIndex };
		}

		const bufferedPage = bufferPages[bufferIndex % Math.max(bufferPages.length, 1)];
		bufferIndex += 1;
		if (bufferedPage) {
			faceAssignments.push({
				physicalHalfSlotId: pose.physicalHalfSlotId,
				faceId: bufferedPage.faceId
			});
		}
		return {
			...pose,
			logicalFaceIndex: bufferedPage ? pose.logicalFaceIndex : 0
		};
	});

	return {
		direction: state.direction,
		settledPoses: projectedPoses,
		activeHalfSlotIds: [activeFirstPose.physicalHalfSlotId, activeSecondPose.physicalHalfSlotId],
		faceAssignments,
		visibleFaceIds: state.visibleWindow.map((page) => page.faceId),
		returnBufferFaceIds: state.returnBuffer.map((page) => page.faceId),
		hiddenBacksideQueueCount: state.hiddenBacksideQueue.length
	};
}

function createLogicalPage(logicalIndex: number): DeckLogicalPage {
	return {
		id: `page-${logicalIndex}`,
		faceId: `face-${logicalIndex}`
	};
}

function validateCount(value: number, label: string, allowZero: boolean) {
	if (!Number.isInteger(value) || (allowZero ? value < 0 : value <= 0)) {
		throw new RangeError(
			`${label} must be ${allowZero ? 'a non-negative' : 'a positive'} integer.`
		);
	}
}
