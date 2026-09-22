import type { DeckDirection, DeckPageAssignment } from './deck-model';
import type { HalfSlotPose } from './half-slot-scene-model';

export type HalfFlapRenderPose = HalfSlotPose & {
	faceId: string;
	physicalPageSlotId: string;
};

export type HalfFlapTurnFrame = {
	direction: DeckDirection;
	progress: number;
	poses: readonly HalfFlapRenderPose[];
};

export function createHalfFlapTurnFrame(
	settledPoses: readonly HalfSlotPose[],
	pageAssignments: readonly DeckPageAssignment[],
	direction: DeckDirection,
	progress: number
): HalfFlapTurnFrame {
	const normalizedProgress = clampUnit(progress);
	const hingeAngle = normalizedProgress * 180;

	return {
		direction,
		progress: normalizedProgress,
		poses: settledPoses.map((pose, index) => {
			const assignment = pageAssignments[Math.floor(index / 2)];
			const directionSign = direction === 'positive' ? -1 : 1;
			const movement =
				pose.visibility === 'visible' ? directionSign * hingeAngle : 0;
			const isMoving =
				pose.visibility === 'visible' && normalizedProgress > 0 && normalizedProgress < 1;
			const physicalPageSlotId = assignment?.physicalPageSlotId ?? `buffer-${index}`;

			return {
				...pose,
				physicalHalfSlotId: `${physicalPageSlotId}-${pose.side}`,
				physicalPageSlotId,
				faceId: assignment?.page.faceId ?? 'buffered',
				rotationDegrees: pose.rotationDegrees + movement,
				layer: isMoving ? pose.layer + 1 : pose.layer
			};
		})
	};
}

function clampUnit(value: number) {
	return Math.max(0, Math.min(1, value));
}
