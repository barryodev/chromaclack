<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { FlapDiagnostics } from './flap-diagnostics';
	import type { Flap as PhysicalFlap } from './clacker-model';
	import type { Face } from './clacker-model';
	import {
		createGestureModel,
		type GestureEvent,
		type GestureModel,
		type MotionState,
		type ReleaseOutcome,
		type SwipeDirection
	} from './gesture-model';

	type Axis = 'vertical' | 'horizontal';
	type PointerCoordinate = 'clientX' | 'clientY';
	type RotationFunction = 'rotateX' | 'rotateY';
	type AxisContract = {
		coordinate: PointerCoordinate;
		rotationFunction: RotationFunction;
		rotationSign: -1 | 1;
		ariaLabel: string;
	};
	type FlapRole =
		'previous-first' | 'current-first' | 'current-second' | 'following-second' | 'buffered';
	const AXIS_CONTRACTS: Record<Axis, AxisContract> = {
		vertical: {
			coordinate: 'clientY',
			rotationFunction: 'rotateX',
			rotationSign: -1,
			ariaLabel: 'Swipe up or down'
		},
		horizontal: {
			coordinate: 'clientX',
			rotationFunction: 'rotateY',
			rotationSign: 1,
			ariaLabel: 'Swipe left or right'
		}
	};

	let {
		axis = 'vertical',
		flaps,
		onDiagnostics
	}: {
		axis?: Axis;
		flaps: readonly PhysicalFlap[];
		onDiagnostics?: (diagnostics: FlapDiagnostics) => void;
	} = $props();
	const axisContract = $derived(AXIS_CONTRACTS[axis]);
	const isVertical = $derived(axis === 'vertical');

	const DRAG_SENSITIVITY = 0.6;
	const ANIMATION_SPEED = 0.25;
	const FRICTION_DECAY_PER_SECOND = 3.5;
	const ACCEPTED_SWIPE_ROTATION_DEGREES = 180;
	const VELOCITY_STOP_THRESHOLD = 0.01;

	let currentFlapIndex = $state(0);
	let gestureModel = $state<GestureModel>(
		createGestureModel('vertical', {
			dragSensitivity: DRAG_SENSITIVITY,
			acceptedSwipeRotationDegrees: ACCEPTED_SWIPE_ROTATION_DEGREES,
			velocityStopThreshold: VELOCITY_STOP_THRESHOLD,
			frictionDecayPerSecond: FRICTION_DECAY_PER_SECOND,
			animationSpeed: ANIMATION_SPEED
		})
	);
	$effect(() => {
		gestureModel = createGestureModel(axis, {
			dragSensitivity: DRAG_SENSITIVITY,
			acceptedSwipeRotationDegrees: ACCEPTED_SWIPE_ROTATION_DEGREES,
			velocityStopThreshold: VELOCITY_STOP_THRESHOLD,
			frictionDecayPerSecond: FRICTION_DECAY_PER_SECOND,
			animationSpeed: ANIMATION_SPEED
		});
	});
	const rotation = $derived(gestureModel.rotation);
	const motionState = $derived<MotionState>(gestureModel.motionState);
	const acceptedSwipeDirection = $derived<SwipeDirection | undefined>(
		gestureModel.releaseDirection
	);
	const velocityDegPerMs = $derived(gestureModel.velocityDegPerMs);
	const velocityAtRelease = $derived(gestureModel.velocityAtRelease);
	const inertiaDurationMs = $derived(gestureModel.inertiaDurationMs);
	const releaseOutcome = $derived<ReleaseOutcome | undefined>(gestureModel.releaseOutcome);
	const turnDirectionSign = $derived(
		releaseOutcome?.type === 'turn' && releaseOutcome.direction === 'positive' ? -1 : 1
	);
	const displayDirectionSign = $derived(
		releaseOutcome?.type === 'turn' ? turnDirectionSign : rotation > 0 ? -1 : 1
	);
	const visualFlapIndex = $derived(
		currentFlapIndex + gestureModel.completedTurns * turnDirectionSign
	);
	const currentFaces = $derived(facesAt(visualFlapIndex));
	const targetFaces = $derived(facesAt(visualFlapIndex + displayDirectionSign));
	const renderedFlaps = $derived(
		flaps.map((flap) => ({
			flap,
			role: roleFor(flap.position, visualFlapIndex)
		}))
	);
	const turnProgress = $derived(Math.min(1, Math.abs(rotation) / ACCEPTED_SWIPE_ROTATION_DEGREES));
	const firstTransform = $derived(
		`${axisContract.rotationFunction}(${axisContract.rotationSign * Math.max(0, rotation)}deg)`
	);
	const secondTransform = $derived(
		`${axisContract.rotationFunction}(${axisContract.rotationSign * Math.min(0, rotation)}deg)`
	);
	let inertiaFrame: number | undefined;
	let committedTurnCount = $state(0);
	let inertiaTickCount = $state(0);
	let lastInertiaLogTime = 0;
	const activeHalf = $derived<'first' | 'second' | 'none'>(
		rotation > 0 ? 'first' : rotation < 0 ? 'second' : 'none'
	);

	$effect(() => {
		onDiagnostics?.({
			axis,
			motionState,
			rotation,
			velocityDegPerMs,
			velocityAtRelease,
			inertiaDurationMs,
			inertiaTickCount,
			plannedTurnCount: releaseOutcome?.type === 'turn' ? releaseOutcome.pageCount : 0,
			completedTurnCount: gestureModel.completedTurns,
			remainingTurnCount: Math.max(
				0,
				(releaseOutcome?.type === 'turn' ? releaseOutcome.pageCount : 0) -
					gestureModel.completedTurns
			),
			releaseOutcomeType: releaseOutcome?.type ?? 'none',
			outcomeStatus:
				releaseOutcome === undefined
					? 'none'
					: releaseOutcome.type === 'reject'
						? 'rejected'
						: gestureModel.completedTurns >= releaseOutcome.pageCount
							? 'complete'
							: 'pending',
			outcomeComplete:
				releaseOutcome?.type === 'turn' && gestureModel.completedTurns >= releaseOutcome.pageCount,
			acceptedSwipeDirection,
			currentPageIndex: currentFlapIndex,
			committedPageLabel: facesAt(currentFlapIndex).first.label,
			visualPageLabel: currentFaces.first.label,
			targetPageLabel: rotation === 0 ? undefined : targetFaces.first.label,
			transformAxis: axisContract.rotationFunction,
			firstTransform,
			secondTransform,
			activeHalf
		});
	});

	function logGesture(
		event: string,
		values: Record<string, number | string | boolean | undefined>
	) {
		if (!onDiagnostics) return;
		console.info(`[Flap gesture] ${event}`, values);
	}

	function resolveSettledGesture(gesture: GestureModel): GestureModel {
		logGesture('settled', {
			rotation: Number(gesture.rotation.toFixed(2)),
			velocity: Number(gesture.velocityDegPerMs.toFixed(4)),
			inertiaDurationMs: Number(gesture.inertiaDurationMs.toFixed(0)),
			releaseDirection: gesture.releaseDirection ?? 'none'
		});
		return {
			...gesture,
			motionState: 'idle',
			rotation: 0,
			velocityDegPerMs: 0,
			velocityAtRelease: 0,
			completedTurns: 0,
			releaseOutcome: undefined
		};
	}

	function applyGestureEvents(events: GestureEvent[]) {
		for (const event of events) {
			if (event.type === 'outcome-complete' && event.outcome.type === 'turn') {
				committedTurnCount += event.outcome.pageCount;
				currentFlapIndex +=
					event.outcome.direction === 'positive'
						? -event.outcome.pageCount
						: event.outcome.pageCount;
				logGesture('turn-committed', {
					direction: event.outcome.direction,
					count: event.outcome.pageCount,
					pageIndex: currentFlapIndex
				});
			}
			if (event.type === 'settled') {
				logGesture('settled-event', { pageIndex: currentFlapIndex });
			}
		}
		if (events.some((event) => event.type === 'outcome-complete')) {
			logGesture('turns-committed', {
				count: events
					.filter(
						(event): event is Extract<GestureEvent, { type: 'outcome-complete' }> =>
							event.type === 'outcome-complete'
					)
					.reduce(
						(count, event) => count + (event.outcome.type === 'turn' ? event.outcome.pageCount : 0),
						0
					),
				pageIndex: currentFlapIndex
			});
		}
	}

	function cancelInertia() {
		if (inertiaFrame === undefined) return;
		cancelAnimationFrame(inertiaFrame);
		inertiaFrame = undefined;
	}

	function nonPassiveTouchMove(node: HTMLElement, handler: (event: TouchEvent) => void) {
		node.addEventListener('touchmove', handler, { passive: false });
		return {
			destroy() {
				node.removeEventListener('touchmove', handler);
			}
		};
	}

	function pointerPosition(event: MouseEvent | TouchEvent) {
		if ('touches' in event) {
			const touch = event.touches[0] ?? event.changedTouches[0];
			return touch?.[axisContract.coordinate] ?? gestureModel.dragStartPosition;
		}
		return event[axisContract.coordinate];
	}

	function facesAt(index: number): { first: Face; second: Face } {
		const firstFlap = flapAt(index);
		const secondFlap = flapAt(index + 1);
		return {
			first: firstFlap.frontFace,
			second: secondFlap.backFace
		};
	}

	function flapAt(index: number): PhysicalFlap {
		const flap = flaps[((index % flaps.length) + flaps.length) % flaps.length];
		if (flap === undefined) throw new RangeError('Clacker must contain at least one flap.');
		return flap;
	}

	function roleFor(position: number, startIndex: number): FlapRole {
		const relativePosition = modulo(position - startIndex, flaps.length);
		if (relativePosition === 0) return 'current-first';
		if (relativePosition === 1) return 'current-second';
		if (relativePosition === 2) return 'following-second';
		if (relativePosition === flaps.length - 1) return 'previous-first';
		return 'buffered';
	}

	function faceForRole(flap: PhysicalFlap, role: FlapRole): Face {
		return role.endsWith('first') ? flap.frontFace : flap.backFace;
	}

	function oppositeFaceForRole(flap: PhysicalFlap, role: FlapRole): Face {
		return role.endsWith('first') ? flap.backFace : flap.frontFace;
	}

	function modulo(value: number, length: number) {
		return ((value % length) + length) % length;
	}

	function restAngleFor(role: FlapRole) {
		if (!isVertical || flaps.length <= 3) return 0;
		if (role === 'current-first') return -42;
		if (role === 'current-second') return 42;
		if (flaps.length >= 6 && role === 'previous-first') return -36;
		if (flaps.length >= 6 && role === 'following-second') return 36;
		return 0;
	}

	function smoothstep(value: number) {
		const clamped = Math.max(0, Math.min(1, value));
		return clamped * clamped * (3 - 2 * clamped);
	}

	function verticalAngleFor(role: FlapRole) {
		const restAngle = restAngleFor(role);
		const clearance = smoothstep(turnProgress / 0.65);
		const pullAround = smoothstep(turnProgress);
		const activeFirstRotation = axisContract.rotationSign * Math.max(0, rotation);
		const activeSecondRotation = axisContract.rotationSign * Math.min(0, rotation);

		if (rotation > 0) {
			if (role === 'current-first') return restAngle + activeFirstRotation;
			if (role === 'current-second' || role === 'following-second') {
				return restAngle * (1 - clearance);
			}
			if (role === 'previous-first') return restAngle + (-42 - restAngle) * pullAround;
		}

		if (rotation < 0) {
			if (role === 'current-second') return restAngle + activeSecondRotation;
			if (role === 'current-first' || role === 'previous-first') {
				return restAngle * (1 - clearance);
			}
			if (role === 'following-second') return restAngle + (42 - restAngle) * pullAround;
		}

		return restAngle;
	}

	function flapTransformFor(role: FlapRole) {
		if (isVertical) return `rotateX(${verticalAngleFor(role)}deg)`;
		if (role === 'current-first') return firstTransform;
		if (role === 'current-second') return secondTransform;
		return 'none';
	}

	function layerFor(role: FlapRole) {
		if (role === 'buffered') return 0;
		if (rotation > 0 && role === 'current-first') return 5;
		if (rotation < 0 && role === 'current-second') return 5;
		if (role.startsWith('current')) return 4;
		if (role.startsWith('previous') || role.startsWith('following')) return 2;
		return 1;
	}

	function startInertia() {
		let lastFrameTime = performance.now();
		inertiaTickCount = 0;
		lastInertiaLogTime = lastFrameTime;
		logGesture('inertia-start', {
			rotation: Number(gestureModel.rotation.toFixed(2)),
			velocity: Number(gestureModel.velocityDegPerMs.toFixed(4))
		});
		const step = (now: number) => {
			const dtMs = now - lastFrameTime;
			lastFrameTime = now;
			const transition = gestureModel.tick(dtMs);
			const nextGesture = transition.model;
			gestureModel = nextGesture;
			applyGestureEvents(transition.events);
			inertiaTickCount += 1;
			if (now - lastInertiaLogTime >= 100 || nextGesture.motionState === 'settled') {
				lastInertiaLogTime = now;
				logGesture('inertia-sample', {
					tick: inertiaTickCount,
					dtMs: Number(dtMs.toFixed(2)),
					rotation: Number(nextGesture.rotation.toFixed(2)),
					velocity: Number(nextGesture.velocityDegPerMs.toFixed(4)),
					state: nextGesture.motionState
				});
			}

			if (nextGesture.motionState === 'settled') {
				inertiaFrame = undefined;
				gestureModel = resolveSettledGesture(nextGesture);
				return;
			}

			inertiaFrame = requestAnimationFrame(step);
		};
		inertiaFrame = requestAnimationFrame(step);
	}

	function dragStart(event: MouseEvent | TouchEvent) {
		const previousState = gestureModel.motionState;
		cancelInertia();
		const interruption = gestureModel.interruptInertia();
		applyGestureEvents(interruption.events);
		gestureModel = interruption.model;
		const position = pointerPosition(event);
		gestureModel = gestureModel.beginPointerDown(position, performance.now());
		logGesture('pointer-down', {
			from: previousState,
			to: gestureModel.motionState,
			position: Number(position.toFixed(2)),
			rotation: Number(gestureModel.rotation.toFixed(2)),
			inertiaCancelled: previousState === 'inertia'
		});

		if (!('touches' in event)) {
			window.addEventListener('mousemove', dragMove);
			window.addEventListener('mouseup', dragEnd);
		}
	}

	function dragMove(event: MouseEvent | TouchEvent) {
		if ('touches' in event) event.preventDefault();
		const previousState = gestureModel.motionState;
		const position = pointerPosition(event);
		gestureModel = gestureModel.dragTo(position, performance.now());
		if (previousState === 'pointer-down' && gestureModel.motionState === 'dragging') {
			logGesture('dragging-start', {
				from: previousState,
				to: gestureModel.motionState,
				position: Number(position.toFixed(2)),
				rotation: Number(gestureModel.rotation.toFixed(2)),
				velocity: Number(gestureModel.velocityDegPerMs.toFixed(4))
			});
		}
	}

	function dragEnd() {
		window.removeEventListener('mousemove', dragMove);
		window.removeEventListener('mouseup', dragEnd);
		const previousState = gestureModel.motionState;
		const releaseEvaluation = gestureModel.release(performance.now());
		gestureModel = releaseEvaluation.model;
		logGesture('release-evaluating', {
			from: previousState,
			to: gestureModel.motionState,
			rotation: Number(gestureModel.rotation.toFixed(2)),
			velocity: Number(gestureModel.velocityAtRelease.toFixed(4))
		});
		const transition = releaseEvaluation.model.evaluateRelease();
		const released = transition.model;
		gestureModel = released;
		applyGestureEvents(transition.events);
		logGesture('release-outcome', {
			from: releaseEvaluation.model.motionState,
			to: released.motionState,
			rotation: Number(released.rotation.toFixed(2)),
			velocity: Number(released.velocityAtRelease.toFixed(4)),
			releaseDirection: released.releaseDirection ?? 'none',
			turnCount: released.releaseOutcome?.type === 'turn' ? released.releaseOutcome.pageCount : 0,
			settled: transition.events.some((event) => event.type === 'settled')
		});

		if (released.motionState === 'settled') {
			gestureModel = resolveSettledGesture(released);
			return;
		}

		startInertia();
	}

	onDestroy(() => {
		cancelInertia();
		window.removeEventListener('mousemove', dragMove);
		window.removeEventListener('mouseup', dragEnd);
	});
</script>

<button
	type="button"
	class="flip-deck"
	class:flip-deck--vertical={isVertical}
	class:flip-deck--horizontal={!isVertical}
	class:flip-deck--positive={rotation > 0}
	class:flip-deck--negative={rotation < 0}
	style={`--first-transform: ${firstTransform}; --second-transform: ${secondTransform}`}
	data-motion-state={motionState}
	data-flap-count={flaps.length}
	data-accepted-swipe-direction={acceptedSwipeDirection}
	data-current-page-index={currentFlapIndex}
	data-committed-turns={committedTurnCount}
	data-release-outcome={releaseOutcome?.type ?? 'none'}
	data-planned-turns={releaseOutcome?.type === 'turn' ? releaseOutcome.pageCount : 0}
	data-completed-turns={gestureModel.completedTurns}
	data-remaining-turns={Math.max(
		0,
		(releaseOutcome?.type === 'turn' ? releaseOutcome.pageCount : 0) - gestureModel.completedTurns
	)}
	data-committed-page-label={facesAt(currentFlapIndex).first.label}
	data-visual-page-label={currentFaces.first.label}
	onmousedown={dragStart}
	ontouchstart={dragStart}
	use:nonPassiveTouchMove={dragMove}
	ontouchend={dragEnd}
	ontouchcancel={dragEnd}
	aria-label={axisContract.ariaLabel}
>
	{#each renderedFlaps as { flap, role } (flap.id)}
		<div
			class="physical-flap"
			class:physical-flap--first={role.endsWith('first')}
			class:physical-flap--second={role.endsWith('second')}
			class:physical-flap--incoming={role.startsWith('previous') || role.startsWith('following')}
			class:physical-flap--current={role.startsWith('current')}
			class:physical-flap--active-first={role === 'current-first'}
			class:physical-flap--active-second={role === 'current-second'}
			class:physical-flap--buffered={role === 'buffered'}
			class:physical-flap--settling={motionState === 'idle' || motionState === 'settled'}
			data-flap-id={flap.id}
			data-flap-position={flap.position}
			data-flap-role={role}
			data-rest-angle={restAngleFor(role)}
			style={`transform: ${flapTransformFor(role)}; z-index: ${layerFor(role)}`}
		>
			<span
				class="flip-face flip-face--front"
				style={`--page-surface: ${faceForRole(flap, role).background}`}
				>{faceForRole(flap, role).label}</span
			>
			<span
				class="flip-face flip-face--back"
				style={`--page-surface: ${oppositeFaceForRole(flap, role).background}`}
				>{oppositeFaceForRole(flap, role).label}</span
			>
		</div>
	{/each}
</button>

<style>
	.flip-deck {
		position: relative;
		width: 14rem;
		height: 14rem;
		padding: 0;
		background: none;
		border: none;
		border-radius: 0.75rem;
		cursor: pointer;
		perspective: 28rem;
		transform-style: preserve-3d;
		overflow: visible;
	}

	@media (max-width: 28rem) {
		.flip-deck {
			width: min(14rem, calc(100vw - 2rem));
			height: min(14rem, calc(100vw - 2rem));
		}
	}

	.physical-flap {
		position: absolute;
		transform-style: preserve-3d;
		--page-surface: #fff;
		z-index: 1;
	}

	.physical-flap--current {
		z-index: 2;
	}

	.physical-flap--buffered {
		visibility: hidden;
	}

	.physical-flap--settling {
		transition: transform 180ms ease-out, z-index 0s linear 180ms;
	}

	.flip-deck--vertical .physical-flap {
		left: 0;
		width: 100%;
		height: 50%;
	}

	.flip-deck--horizontal .physical-flap {
		top: 0;
		width: 50%;
		height: 100%;
	}

	.flip-deck--vertical .physical-flap--first {
		top: 0;
		transform-origin: center bottom;
		border-radius: 0.75rem 0.75rem 0 0;
	}

	.flip-deck--vertical .physical-flap--second {
		bottom: 0;
		transform-origin: center top;
		border-radius: 0 0 0.75rem 0.75rem;
	}

	.flip-deck--horizontal .physical-flap--first {
		left: 0;
		transform-origin: right center;
		border-radius: 0.75rem 0 0 0.75rem;
	}

	.flip-deck--horizontal .physical-flap--second {
		right: 0;
		transform-origin: left center;
		border-radius: 0 0.75rem 0.75rem 0;
	}

	.flip-face {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border);
		border-radius: inherit;
		background: var(--page-surface);
		color: #111;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 1.25rem;
		font-weight: 700;
		backface-visibility: hidden;
	}

	.flip-deck--vertical .physical-flap--first .flip-face--front,
	.flip-deck--vertical .physical-flap--second .flip-face--back {
		border-radius: 0.75rem 0.75rem 0 0;
	}

	.flip-deck--vertical .physical-flap--first .flip-face--back,
	.flip-deck--vertical .physical-flap--second .flip-face--front {
		border-radius: 0 0 0.75rem 0.75rem;
	}

	.flip-deck--horizontal .physical-flap--first .flip-face--front,
	.flip-deck--horizontal .physical-flap--second .flip-face--back {
		border-radius: 0.75rem 0 0 0.75rem;
	}

	.flip-deck--horizontal .physical-flap--first .flip-face--back,
	.flip-deck--horizontal .physical-flap--second .flip-face--front {
		border-radius: 0 0.75rem 0.75rem 0;
	}

	.flip-face--back {
		transform: rotateX(180deg);
	}

	.flip-deck--horizontal .flip-face--back {
		transform: rotateY(180deg);
	}

	.physical-flap--active-first,
	.physical-flap--active-second {
		z-index: 3;
		will-change: transform;
	}

	.flip-deck--positive .physical-flap--active-first,
	.flip-deck--negative .physical-flap--active-second {
		z-index: 4;
	}

	.physical-flap--active-first {
		transform: var(--first-transform);
	}

	.physical-flap--active-second {
		transform: var(--second-transform);
	}
</style>
