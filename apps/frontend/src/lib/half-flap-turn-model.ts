import type { DeckDirection, DeckPageAssignment } from './deck-model';
import type { HalfSlotPose } from './half-slot-scene-model';

export type HalfFlapRenderPose = HalfSlotPose & {
	faceId: string;
	physicalPageSlotId: string;
	phase: number;
};

export type HalfFlapTurnFrame = {
	direction: DeckDirection;
	progress: number;
	poses: readonly HalfFlapRenderPose[];
};

const PHASE_DELAY = 0.16;

export function createHalfFlapTurnFrame(
	settledPoses: readonly HalfSlotPose[],
	pageAssignments: readonly DeckPageAssignment[],
	direction: DeckDirection,
	progress: number
): HalfFlapTurnFrame {
	const normalizedProgress = clampUnit(progress);
	const turnOrder = visibleTurnOrder(settledPoses, direction);
	const waveSpan = 1 + Math.max(0, turnOrder.length - 1) * PHASE_DELAY;
	const directionSign = direction === 'positive' ? -1 : 1;

	return {
		direction,
		progress: normalizedProgress,
		poses: settledPoses.map((pose, index) => {
			const assignment = pageAssignments[Math.floor(index / 2)];
			const orderIndex = turnOrder.indexOf(pose.physicalHalfSlotId);
			const phase =
				orderIndex < 0
					? 0
					: clampUnit((normalizedProgress * waveSpan - orderIndex * PHASE_DELAY) / 1);
			const isMoving = phase > 0 && phase < 1;
			const physicalPageSlotId = assignment?.physicalPageSlotId ?? `buffer-${index}`;

			return {
				...pose,
				physicalHalfSlotId: `${physicalPageSlotId}-${pose.side}`,
				physicalPageSlotId,
				faceId: assignment?.page.faceId ?? 'buffered',
				phase,
				rotationDegrees: pose.rotationDegrees + directionSign * phase * 180,
				layer: isMoving ? pose.layer + 1 : pose.layer
			};
		})
	};
}

function visibleTurnOrder(poses: readonly HalfSlotPose[], direction: DeckDirection) {
	const visible = poses.filter((pose) => pose.visibility === 'visible');
	const leadingSide = direction === 'positive' ? 'first' : 'second';

	return visible
		.slice()
		.sort((left, right) => {
			const leftPriority = left.isActive && left.side === leadingSide ? 0 : left.isActive ? 1 : 2;
			const rightPriority = right.isActive && right.side === leadingSide ? 0 : right.isActive ? 1 : 2;
			return leftPriority - rightPriority || right.layer - left.layer;
		})
		.map((pose) => pose.physicalHalfSlotId);
}

function clampUnit(value: number) {
	return Math.max(0, Math.min(1, value));
}
