export type GestureAxis = 'vertical' | 'horizontal';
export type MotionState =
	'idle' | 'pointer-down' | 'dragging' | 'release-evaluating' | 'inertia' | 'settling' | 'settled';
export type SwipeDirection = 'positive' | 'negative';
export type ReleaseOutcome =
	{ type: 'reject' } | { type: 'turn'; direction: SwipeDirection; pageCount: number };
export type GestureEvent =
	{ type: 'turn-completed'; direction: SwipeDirection } | { type: 'settled' };
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
	maxInertiaDurationMs?: number;
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
	releaseOutcome?: ReleaseOutcome;
	completedTurns: number;
	releaseDirection?: SwipeDirection;
	dragSensitivity: number;
	acceptedSwipeRotationDegrees: number;
	velocityStopThreshold: number;
	frictionDecayPerSecond: number;
	animationSpeed: number;
	maxInertiaDurationMs: number;
	beginPointerDown: (position: number, time: number) => GestureModel;
	dragTo: (position: number, time: number) => GestureModel;
	release: (time: number) => GestureTransition;
	evaluateRelease: () => GestureTransition;
	interruptInertia: () => GestureTransition;
	tick: (dtMs: number) => GestureTransition;
};

const DEFAULT_CONFIG: Required<GestureModelConfig> = {
	dragSensitivity: 0.6,
	acceptedSwipeRotationDegrees: 180,
	velocityStopThreshold: 0.01,
	frictionDecayPerSecond: 3.5,
	animationSpeed: 0.25,
	maxInertiaDurationMs: 3000
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
		releaseDirection: undefined,
		dragSensitivity: resolved.dragSensitivity,
		acceptedSwipeRotationDegrees: resolved.acceptedSwipeRotationDegrees,
		velocityStopThreshold: resolved.velocityStopThreshold,
		frictionDecayPerSecond: resolved.frictionDecayPerSecond,
		animationSpeed: resolved.animationSpeed,
		maxInertiaDurationMs: resolved.maxInertiaDurationMs,
		beginPointerDown(position, time) {
			if (
				this.motionState !== 'idle' &&
				this.motionState !== 'settled' &&
				this.motionState !== 'inertia' &&
				this.motionState !== 'settling'
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
				completedTurns: 0,
				releaseOutcome: undefined,
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
					releaseTimestamp: time,
					releaseOutcome: undefined,
					completedTurns: 0
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
			const releaseDirection =
				accepted ?? (shouldInertia ? directionForVelocity(nextVelocity) : undefined);
			const pageCount = releaseDirection
				? shouldInertia
					? Math.min(
							8,
							Math.max(
								1,
								Math.ceil(
									(Math.abs(this.rotation) +
										(Math.abs(nextVelocity) * this.animationSpeed * 1000) /
											this.frictionDecayPerSecond) /
										this.acceptedSwipeRotationDegrees
								)
							)
						)
					: 1
				: 0;
			const outcome: ReleaseOutcome =
				releaseDirection && pageCount > 0
					? { type: 'turn', direction: releaseDirection, pageCount }
					: { type: 'reject' };
			const outcomeVelocity =
				outcome.type === 'turn'
					? Math.abs(nextVelocity) * (outcome.direction === 'positive' ? 1 : -1)
					: 0;
			const nextState: GestureModel = {
				...this,
				motionState: shouldInertia && outcome.type === 'turn' ? 'inertia' : 'settled',
				velocityDegPerMs: outcomeVelocity,
				velocityAtRelease: nextVelocity,
				releaseTimestamp: this.releaseTimestamp,
				inertiaDurationMs: 0,
				releaseDirection,
				releaseOutcome: outcome,
				completedTurns: 0
			};

			if (!shouldInertia || outcome.type === 'reject') {
				const acceptedTurn = outcome.type === 'turn';
				return {
					model: {
						...nextState,
						motionState: acceptedTurn ? 'settling' : 'settled',
						velocityDegPerMs: 0,
						rotation: acceptedTurn ? this.rotation : 0,
						completedTurns: outcome.type === 'turn' ? outcome.pageCount : 0
					},
					events: [
						...(outcome.type === 'turn'
							? Array.from({ length: outcome.pageCount }, () => ({
									type: 'turn-completed' as const,
									direction: outcome.direction
								}))
							: []),
							...(acceptedTurn ? [] : [{ type: 'settled' as const }])
					]
				};
			}

			return { model: nextState, events: [] };
		},
		interruptInertia() {
			if (this.motionState !== 'inertia' && this.motionState !== 'settling') {
				return { model: this, events: [] };
			}

			return {
				model: {
					...this,
					motionState: 'settled',
					rotation: 0,
					velocityDegPerMs: 0,
					velocityAtRelease: 0,
					releaseOutcome: undefined,
					completedTurns: 0
				},
				events: [{ type: 'settled' }]
			};
		},
		tick(dtMs) {
			if (this.motionState === 'settling') {
				const settleFactor = Math.exp(-this.frictionDecayPerSecond * (dtMs / 1000));
				const nextRotation = this.rotation * settleFactor;
				if (Math.abs(nextRotation) < 0.5) {
					return {
						model: { ...this, motionState: 'settled', rotation: 0 },
						events: [{ type: 'settled' }]
					};
				}
				return { model: { ...this, rotation: nextRotation }, events: [] };
			}
			if (this.motionState !== 'inertia') {
				return { model: this, events: [] };
			}

			const animationDtMs = dtMs * this.animationSpeed;
			const rawRotation = this.rotation + this.velocityDegPerMs * animationDtMs;
			const turnDirection = this.velocityDegPerMs >= 0 ? 1 : -1;
			const plannedTurns = this.releaseOutcome?.type === 'turn' ? this.releaseOutcome.pageCount : 0;
			const physicalCrossedTurns = Math.floor(
				Math.abs(rawRotation) / this.acceptedSwipeRotationDegrees
			);
			const crossedTurns = Math.min(
				physicalCrossedTurns,
				Math.max(0, plannedTurns - this.completedTurns)
			);
			const nextRotation =
				rawRotation -
				physicalCrossedTurns * turnDirection * this.acceptedSwipeRotationDegrees;
			const nextVelocity =
				this.velocityDegPerMs * Math.exp(-this.frictionDecayPerSecond * (animationDtMs / 1000));
			const nextState: GestureModel = {
				...this,
				rotation: nextRotation,
				velocityDegPerMs: nextVelocity,
				inertiaDurationMs: this.inertiaDurationMs + dtMs,
				completedTurns: this.completedTurns + crossedTurns
			};
			const reachedPlannedTurnCount = plannedTurns > 0 && nextState.completedTurns >= plannedTurns;

			const turnEvents = Array.from({ length: crossedTurns }, () => ({
				type: 'turn-completed' as const,
				direction: this.releaseDirection as SwipeDirection
			}));

			if (
				reachedPlannedTurnCount ||
				Math.abs(nextVelocity) < this.velocityStopThreshold ||
				nextState.inertiaDurationMs >= this.maxInertiaDurationMs
			) {
				return {
					model: {
						...nextState,
						motionState: 'settling',
						releaseDirection: this.releaseDirection,
						velocityDegPerMs: nextVelocity,
						completedTurns: nextState.completedTurns
					},
					events: turnEvents
				};
			}

			return {
				model: nextState,
				events: turnEvents
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

function directionForVelocity(value: number): SwipeDirection | undefined {
	if (value > 0) return 'positive';
	if (value < 0) return 'negative';
	return undefined;
}

function clampRotation(value: number): number {
	return Math.max(-180, Math.min(180, value));
}
