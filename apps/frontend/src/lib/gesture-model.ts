export type GestureAxis = 'vertical' | 'horizontal';
export type MotionState = 'idle' | 'dragging' | 'inertia' | 'settled';
export type SwipeDirection = 'positive' | 'negative';

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
	completedTurns: number;
	acceptedSwipeDirection?: SwipeDirection;
	dragSensitivity: number;
	acceptedSwipeRotationDegrees: number;
	velocityStopThreshold: number;
	frictionDecayPerSecond: number;
	animationSpeed: number;
	beginDrag: (position: number, time: number) => GestureModel;
	dragTo: (position: number, time: number) => GestureModel;
	release: (time: number) => GestureModel;
	tick: (dtMs: number) => GestureModel;
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
		completedTurns: 0,
		acceptedSwipeDirection: undefined,
		dragSensitivity: resolved.dragSensitivity,
		acceptedSwipeRotationDegrees: resolved.acceptedSwipeRotationDegrees,
		velocityStopThreshold: resolved.velocityStopThreshold,
		frictionDecayPerSecond: resolved.frictionDecayPerSecond,
		animationSpeed: resolved.animationSpeed,
		beginDrag(position, time) {
			return {
				...this,
				motionState: 'dragging',
				dragStartPosition: position,
				dragStartRotation: this.rotation,
				lastTouchPosition: position,
				lastTouchTime: time,
				velocityDegPerMs: 0,
				velocityAtRelease: 0,
				releaseTimestamp: 0,
				inertiaDurationMs: 0,
				acceptedSwipeDirection: undefined
			};
		},
		dragTo(position, time) {
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
				acceptedSwipeDirection: undefined
			};
		},
		release(time) {
			const nextVelocity = this.velocityDegPerMs;
			const shouldInertia = Math.abs(nextVelocity) >= this.velocityStopThreshold;
			const accepted = shouldInertia
				? undefined
				: acceptedSwipeDirectionForRotation(this.rotation, this.acceptedSwipeRotationDegrees);
			const completedTurns = accepted
				? this.completedTurns + (accepted === 'positive' ? 1 : -1)
				: this.completedTurns;
			const nextRotation = accepted
				? this.rotation - (accepted === 'positive' ? 1 : -1) * this.acceptedSwipeRotationDegrees
				: this.rotation;
			const nextState: GestureModel = {
				...this,
				rotation: nextRotation,
				completedTurns,
				motionState: shouldInertia ? 'inertia' : 'settled',
				velocityAtRelease: nextVelocity,
				releaseTimestamp: time,
				inertiaDurationMs: 0,
				acceptedSwipeDirection: accepted
			};

			if (!shouldInertia) {
				return {
					...nextState,
					velocityDegPerMs: 0,
					rotation: clampRotation(nextRotation)
				};
			}

			return nextState;
		},
		tick(dtMs) {
			if (this.motionState !== 'inertia') {
				return this;
			}

			const animationDtMs = dtMs * this.animationSpeed;
			const rawRotation = this.rotation + this.velocityDegPerMs * animationDtMs;
			const turnDirection = this.velocityDegPerMs >= 0 ? 1 : -1;
			const crossedTurns = Math.floor(Math.abs(rawRotation) / this.acceptedSwipeRotationDegrees);
			const nextRotation = rawRotation - crossedTurns * turnDirection * this.acceptedSwipeRotationDegrees;
			const nextVelocity =
				this.velocityDegPerMs * Math.exp(-this.frictionDecayPerSecond * (animationDtMs / 1000));
			const nextState: GestureModel = {
				...this,
				rotation: nextRotation,
				completedTurns: this.completedTurns + crossedTurns * turnDirection,
				velocityDegPerMs: nextVelocity,
				inertiaDurationMs: this.inertiaDurationMs + dtMs
			};

			if (Math.abs(nextVelocity) < this.velocityStopThreshold) {
				return {
					...nextState,
					motionState: 'settled',
					acceptedSwipeDirection: undefined,
					velocityDegPerMs: 0,
					rotation: clampRotation(nextRotation)
				};
			}

			return nextState;
		}
	};

	return base;
}

export function dragGesture(model: GestureModel, position: number, time: number): GestureModel {
	return model.dragTo(position, time);
}

export function releaseGesture(model: GestureModel, time: number): GestureModel {
	return model.release(time);
}

export function tickGesture(model: GestureModel, dtMs: number): GestureModel {
	return model.tick(dtMs);
}

function clampRotation(value: number): number {
	return Math.max(-180, Math.min(180, value));
}
