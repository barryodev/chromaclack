export type HalfSlotSide = 'first' | 'second';

export type HalfSlotPose = {
	physicalHalfSlotId: string;
	logicalFaceIndex: number;
	side: HalfSlotSide;
	rotationDegrees: number;
	layer: number;
	visibility: 'visible' | 'buffered';
	isActive: boolean;
};

export type HalfSlotSceneConfig = {
	halfSlotCount: number;
	visibleNeighborCount: number;
	visibleWindowCount: number;
	returnBufferCount: number;
	focusedAngleDegrees: number;
	innerNeighborAngleDegrees: number;
	outerNeighborAngleDegrees: number;
};

export type HalfSlotSceneConfigInput = Partial<
	Pick<HalfSlotSceneConfig, 'visibleNeighborCount' | 'visibleWindowCount' | 'returnBufferCount'>
> &
	Omit<HalfSlotSceneConfig, 'visibleNeighborCount' | 'visibleWindowCount' | 'returnBufferCount'>;

export const DEFAULT_HALF_SLOT_SCENE_CONFIG: HalfSlotSceneConfig = {
	halfSlotCount: 14,
	visibleNeighborCount: 2,
	visibleWindowCount: 2,
	returnBufferCount: 1,
	focusedAngleDegrees: 40,
	innerNeighborAngleDegrees: 30,
	outerNeighborAngleDegrees: 6
};

export function createSettledHalfSlotScene(
	config: HalfSlotSceneConfigInput = DEFAULT_HALF_SLOT_SCENE_CONFIG,
	logicalFaceIndex = 0
): HalfSlotPose[] {
	const normalized = normalizeSceneConfig(config);
	validateSceneConfig(normalized);
	const visiblePairs = normalized.visibleNeighborCount * 2 + 1;
	const visibleHalfCount = visiblePairs * 2;
	const bufferHalfCount = normalized.halfSlotCount - visibleHalfCount;
	const focusFirstIndex = bufferHalfCount / 2 + normalized.visibleNeighborCount * 2;
	const focusSecondIndex = focusFirstIndex + 1;
	const upperFirstIndexes = Array.from(
		{ length: normalized.visibleNeighborCount },
		(_, offset) => focusFirstIndex - (normalized.visibleNeighborCount - offset) * 2
	);
	const lowerSecondIndexes = Array.from(
		{ length: normalized.visibleNeighborCount },
		(_, offset) => focusSecondIndex + (offset + 1) * 2
	);

	return Array.from({ length: normalized.halfSlotCount }, (_, index): HalfSlotPose => {
		const side: HalfSlotSide = index % 2 === 0 ? 'first' : 'second';
		const isActive = index === focusFirstIndex || index === focusSecondIndex;
		const upperNeighborIndex = upperFirstIndexes.indexOf(index);
		const lowerNeighborIndex = lowerSecondIndexes.indexOf(index);
		const isUpperNeighbor = upperNeighborIndex >= 0;
		const isLowerNeighbor = lowerNeighborIndex >= 0;
		const isVisible = isActive || isUpperNeighbor || isLowerNeighbor;
		const neighborDistance = isUpperNeighbor
			? normalized.visibleNeighborCount - upperNeighborIndex
			: isLowerNeighbor
				? lowerNeighborIndex + 1
				: 0;
		const neighborAngleDegrees =
			neighborDistance === 1
				? normalized.innerNeighborAngleDegrees
				: normalized.outerNeighborAngleDegrees;
		const rotationDegrees = isActive
			? side === 'first'
				? -normalized.focusedAngleDegrees
				: normalized.focusedAngleDegrees
			: isUpperNeighbor
				? -neighborAngleDegrees
				: isLowerNeighbor
					? neighborAngleDegrees
					: 0;

		return {
			physicalHalfSlotId: `half-slot-${index + 1}`,
			logicalFaceIndex: logicalFaceIndex + (isUpperNeighbor ? -neighborDistance : neighborDistance),
			side,
			rotationDegrees: rotationDegrees === 0 ? 0 : rotationDegrees,
			layer: isActive
				? normalized.visibleNeighborCount + 1
				: normalized.visibleNeighborCount - neighborDistance + 1,
			visibility: isVisible ? 'visible' : 'buffered',
			isActive
		};
	});
}

function normalizeSceneConfig(config: HalfSlotSceneConfigInput): HalfSlotSceneConfig {
	const visibleNeighborCount = config.visibleWindowCount ?? config.visibleNeighborCount ?? 2;
	return {
		...config,
		visibleNeighborCount,
		returnBufferCount: config.returnBufferCount ?? 1,
		visibleWindowCount: config.visibleWindowCount ?? visibleNeighborCount
	};
}

function validateSceneConfig(config: HalfSlotSceneConfig) {
	if (
		!Number.isInteger(config.halfSlotCount) ||
		config.halfSlotCount < 2 ||
		config.halfSlotCount % 2
	) {
		throw new RangeError('Half-slot count must be an even integer of at least two.');
	}
	if (!Number.isInteger(config.visibleNeighborCount) || config.visibleNeighborCount < 0) {
		throw new RangeError('Visible neighbor count must be a non-negative integer.');
	}
	if (config.visibleNeighborCount * 4 + 2 > config.halfSlotCount) {
		throw new RangeError('Half-slot scene needs room for the requested visible neighbors.');
	}
	if (
		!Number.isFinite(config.focusedAngleDegrees) ||
		!Number.isFinite(config.innerNeighborAngleDegrees) ||
		!Number.isFinite(config.outerNeighborAngleDegrees)
	) {
		throw new RangeError('Half-slot pose angles must be finite.');
	}
}
