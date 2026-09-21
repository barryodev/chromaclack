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
	focusedAngleDegrees: number;
	innerNeighborAngleDegrees: number;
	outerNeighborAngleDegrees: number;
};

export const DEFAULT_HALF_SLOT_SCENE_CONFIG: HalfSlotSceneConfig = {
	halfSlotCount: 14,
	visibleNeighborCount: 2,
	focusedAngleDegrees: 40,
	innerNeighborAngleDegrees: 30,
	outerNeighborAngleDegrees: 6
};

export function createSettledHalfSlotScene(
	config: HalfSlotSceneConfig = DEFAULT_HALF_SLOT_SCENE_CONFIG,
	logicalFaceIndex = 0
): HalfSlotPose[] {
	validateSceneConfig(config);
	const visiblePairs = config.visibleNeighborCount * 2 + 1;
	const visibleHalfCount = visiblePairs * 2;
	const bufferHalfCount = config.halfSlotCount - visibleHalfCount;
	const focusFirstIndex = bufferHalfCount / 2 + config.visibleNeighborCount * 2;
	const focusSecondIndex = focusFirstIndex + 1;
	const upperFirstIndexes = Array.from(
		{ length: config.visibleNeighborCount },
		(_, offset) => focusFirstIndex - (config.visibleNeighborCount - offset) * 2
	);
	const lowerSecondIndexes = Array.from(
		{ length: config.visibleNeighborCount },
		(_, offset) => focusSecondIndex + (offset + 1) * 2
	);

	return Array.from({ length: config.halfSlotCount }, (_, index): HalfSlotPose => {
		const side: HalfSlotSide = index % 2 === 0 ? 'first' : 'second';
		const isActive = index === focusFirstIndex || index === focusSecondIndex;
		const upperNeighborIndex = upperFirstIndexes.indexOf(index);
		const lowerNeighborIndex = lowerSecondIndexes.indexOf(index);
		const isUpperNeighbor = upperNeighborIndex >= 0;
		const isLowerNeighbor = lowerNeighborIndex >= 0;
		const isVisible = isActive || isUpperNeighbor || isLowerNeighbor;
		const neighborDistance = isUpperNeighbor
			? config.visibleNeighborCount - upperNeighborIndex
			: isLowerNeighbor
				? lowerNeighborIndex + 1
				: 0;
		const neighborAngleDegrees =
			neighborDistance === 1
				? config.innerNeighborAngleDegrees
				: config.outerNeighborAngleDegrees;
		const rotationDegrees =
			isActive
				? side === 'first'
					? -config.focusedAngleDegrees
					: config.focusedAngleDegrees
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
				? config.visibleNeighborCount + 1
				: config.visibleNeighborCount - neighborDistance + 1,
			visibility: isVisible ? 'visible' : 'buffered',
			isActive
		};
	});
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
