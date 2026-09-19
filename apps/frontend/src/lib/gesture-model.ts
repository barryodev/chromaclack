export type GestureAxis = 'vertical' | 'horizontal';
export type MotionState =
	'idle' | 'pointer-down' | 'dragging' | 'release-evaluating' | 'inertia' | 'settled';
export type SwipeDirection = 'positive' | 'negative';
export type GestureEvent =
	{ type: 'turn-committed'; direction: SwipeDirection } | { type: 'settled' };
export type GestureTransition = {
	model: GestureModel;
	events: GestureEvent[];
};

export type GestureModelConfig = {
	dragSensitivity?: number;
	acceptedSwipeRotationDegrees?: number;
	velocityStopThreshold?: number;
	frictionDecayPerSecond?: number;
	animationSpeed?: number;
};

export type GestureModel = {
	axis: GestureAxis;
	motionState: MotionState;
	rotation: number;
	dragStartPosition: number;
	dragStartRotation: number;
	lastTouchPosition: number;
	lastTouchTime: number;
	velocityDegPerMs: number;
	velocityAtRelease: number;
	releaseTimestamp: number;
	inertiaDurationMs: number;
	releaseDirection?: SwipeDirection;
	dragSensitivity: number;
	acceptedSwipeRotationDegrees: number;
	velocityStopThreshold: number;
	frictionDecayPerSecond: number;
	animationSpeed: number;
	beginPointerDown: (position: number, time: number) => GestureModel;
	dragTo: (position: number, time: number) => GestureModel;
	release: (time: number) => GestureTransition;
	evaluateRelease: () => GestureTransition;
	tick: (dtMs: number) => GestureTransition;
};

const DEFAULT_CONFIG: Required<GestureModelConfig> = {
	dragSensitivity: 0.6,
	acceptedSwipeRotationDegrees: 180,
	velocityStopThreshold: 0.01,
	frictionDecayPerSecond: 3.5,
	animationSpeed: 0.25
};

export function acceptedSwipeDirectionForRotation(
	value: number,
	acceptedSwipeRotationDegrees = DEFAULT_CONFIG.acceptedSwipeRotationDegrees
): SwipeDirection | undefined {
	if (value >= acceptedSwipeRotationDegrees) return 'positive';
	if (value <= -acceptedSwipeRotationDegrees) return 'negative';
	return undefined;
}

export function createGestureModel(
	axis: GestureAxis,
	config: GestureModelConfig = {}
): GestureModel {
	const resolved = {
		...DEFAULT_CONFIG,
		...config
	};

	const base: GestureModel = {
		axis,
		motionState: 'idle',
		rotation: 0,
		dragStartPosition: 0,
		dragStartRotation: 0,
		lastTouchPosition: 0,
		lastTouchTime: 0,
		velocityDegPerMs: 0,
		velocityAtRelease: 0,
		releaseTimestamp: 0,
		inertiaDurationMs: 0,
		releaseDirection: undefined,
		dragSensitivity: resolved.dragSensitivity,
		acceptedSwipeRotationDegrees: resolved.acceptedSwipeRotationDegrees,
		velocityStopThreshold: resolved.velocityStopThreshold,
		frictionDecayPerSecond: resolved.frictionDecayPerSecond,
		animationSpeed: resolved.animationSpeed,
		beginPointerDown(position, time) {
			if (
				this.motionState !== 'idle' &&
				this.motionState !== 'settled' &&
				this.motionState !== 'inertia'
			)
				return this;
			return {
				...this,
				motionState: 'pointer-down',
				dragStartPosition: position,
				dragStartRotation: this.rotation,
				lastTouchPosition: position,
				lastTouchTime: time,
				velocityDegPerMs: 0,
				velocityAtRelease: 0,
				releaseTimestamp: 0,
				inertiaDurationMs: 0,
				releaseDirection: undefined
			};
		},
		dragTo(position, time) {
			if (this.motionState !== 'pointer-down' && this.motionState !== 'dragging') return this;
			const elapsed = Math.max(time - this.lastTouchTime, 1);
			const deltaFromDragStart = (position - this.dragStartPosition) * this.dragSensitivity;
			const nextRotation = clampRotation(this.dragStartRotation + deltaFromDragStart);
			const nextVelocity = ((position - this.lastTouchPosition) * this.dragSensitivity) / elapsed;

			return {
				...this,
				motionState: 'dragging',
				rotation: nextRotation,
				lastTouchPosition: position,
				lastTouchTime: time,
				velocityDegPerMs: nextVelocity,
				releaseDirection: undefined
			};
		},
		release(time) {
			if (this.motionState !== 'pointer-down' && this.motionState !== 'dragging') {
				return { model: this, events: [] };
			}

			return {
				model: {
					...this,
					motionState: 'release-evaluating',
					velocityAtRelease: this.velocityDegPerMs,
					releaseTimestamp: time
				},
				events: []
			};
		},
		evaluateRelease() {
			if (this.motionState !== 'release-evaluating') return { model: this, events: [] };

			const nextVelocity = this.velocityDegPerMs;
			const shouldInertia = Math.abs(nextVelocity) >= this.velocityStopThreshold;
			const accepted = acceptedSwipeDirectionForRotation(
				this.rotation,
				this.acceptedSwipeRotationDegrees
			);
			const releaseDirection = accepted ?? directionForVelocity(nextVelocity);
			const nextRotation = accepted
				? this.rotation - (accepted === 'positive' ? 1 : -1) * this.acceptedSwipeRotationDegrees
				: this.rotation;
			const nextState: GestureModel = {
				...this,
				rotation: nextRotation,
				motionState: shouldInertia ? 'inertia' : 'settled',
				velocityAtRelease: this.velocityAtRelease,
				releaseTimestamp: this.releaseTimestamp,
				inertiaDurationMs: 0,
				releaseDirection
			};

			if (!shouldInertia) {
				return {
					model: {
						...nextState,
						velocityDegPerMs: 0,
						rotation: clampRotation(nextRotation)
					},
					events: [
						...(accepted ? [{ type: 'turn-committed' as const, direction: accepted }] : []),
						{ type: 'settled' }
					]
				};
			}

			return { model: nextState, events: [] };
		},
		tick(dtMs) {
			if (this.motionState !== 'inertia') {
				return { model: this, events: [] };
			}

			const animationDtMs = dtMs * this.animationSpeed;
			const rawRotation = this.rotation + this.velocityDegPerMs * animationDtMs;
			const turnDirection = this.velocityDegPerMs >= 0 ? 1 : -1;
			const crossedTurns = Math.floor(Math.abs(rawRotation) / this.acceptedSwipeRotationDegrees);
			const nextRotation =
				rawRotation - crossedTurns * turnDirection * this.acceptedSwipeRotationDegrees;
			const nextVelocity =
				this.velocityDegPerMs * Math.exp(-this.frictionDecayPerSecond * (animationDtMs / 1000));
			const nextState: GestureModel = {
				...this,
				rotation: nextRotation,
				velocityDegPerMs: nextVelocity,
				inertiaDurationMs: this.inertiaDurationMs + dtMs
			};

			if (Math.abs(nextVelocity) < this.velocityStopThreshold) {
				return {
					model: {
						...nextState,
						motionState: 'settled',
						releaseDirection: this.releaseDirection,
						velocityDegPerMs: 0,
						rotation: clampRotation(nextRotation)
					},
					events: [...turnEvents(crossedTurns, turnDirection), { type: 'settled' }]
				};
			}

			return {
				model: nextState,
				events: turnEvents(crossedTurns, turnDirection)
			};
		}
	};

	return base;
}

export function dragGesture(model: GestureModel, position: number, time: number): GestureModel {
	return model.dragTo(position, time);
}

export function releaseGesture(model: GestureModel, time: number): GestureTransition {
	return model.release(time);
}

export function tickGesture(model: GestureModel, dtMs: number): GestureTransition {
	return model.tick(dtMs);
}

function turnEvents(count: number, direction: 1 | -1): GestureEvent[] {
	return Array.from({ length: count }, () => ({
		type: 'turn-committed' as const,
		direction: direction > 0 ? ('positive' as const) : ('negative' as const)
	}));
}

function directionForVelocity(value: number): SwipeDirection | undefined {
	if (value > 0) return 'positive';
	if (value < 0) return 'negative';
	return undefined;
}

function clampRotation(value: number): number {
	return Math.max(-180, Math.min(180, value));
}
