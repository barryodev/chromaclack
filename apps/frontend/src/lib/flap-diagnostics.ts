import type { MotionState, ReleaseOutcome, SwipeDirection } from './gesture-model';

export type FlapDiagnostics = {
	axis: 'vertical' | 'horizontal';
	motionState: MotionState;
	rotation: number;
	velocityDegPerMs: number;
	velocityAtRelease: number;
	inertiaDurationMs: number;
	inertiaTickCount: number;
	plannedTurnCount: number;
	completedTurnCount: number;
	remainingTurnCount: number;
	releaseOutcomeType: ReleaseOutcome['type'] | 'none';
	outcomeStatus: 'none' | 'pending' | 'complete' | 'rejected';
	outcomeComplete: boolean;
	acceptedSwipeDirection?: SwipeDirection;
	currentPageIndex: number;
	committedPageLabel: string;
	visualPageLabel: string;
	targetPageLabel?: string;
	transformAxis: 'rotateX' | 'rotateY';
	firstTransform: string;
	secondTransform: string;
	activeHalf: 'first' | 'second' | 'none';
};
