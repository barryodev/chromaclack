import type { HalfSlotSide } from './half-slot-scene-model';

export type HalfSlotDiagnostics = {
	motionState: 'settled' | 'dragging';
	rotationDegrees: number;
	activeSide: HalfSlotSide | 'none';
	activeHalfSlotIds: readonly [string, string];
	activeFaceIndex: number;
	visibleHalfSlotCount: number;
	focusedPose: readonly [number, number];
	deckDirection: 'positive' | 'negative';
	visibleFaceIds: readonly string[];
	returnBufferFaceIds: readonly string[];
	hiddenBacksideQueueCount: number;
	lastTurnDirection: 'positive' | 'negative' | 'none';
	completedTurnCount: number;
};
