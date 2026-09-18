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

export function acceptedSwipeDirectionForRotation(value: number): SwipeDirection | undefined {
	if (value >= DEFAULT_CONFIG.acceptedSwipeRotationDegrees) return 'positive';
	if (value <= -DEFAULT_CONFIG.acceptedSwipeRotationDegrees) return 'negative';
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
			const accepted = acceptedSwipeDirectionForRotation(this.rotation);
			const shouldInertia = Math.abs(nextVelocity) >= this.velocityStopThreshold;
			const nextState: GestureModel = {
				...this,
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
					rotation: clampRotation(this.rotation)
				};
			}

			return nextState;
		},
		tick(dtMs) {
			if (this.motionState !== 'inertia') {
				return this;
			}

			const animationDtMs = dtMs * this.animationSpeed;
			const nextRotation = clampRotation(this.rotation + this.velocityDegPerMs * animationDtMs);
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
					...nextState,
					motionState: 'settled',
					acceptedSwipeDirection: acceptedSwipeDirectionForRotation(nextRotation),
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
