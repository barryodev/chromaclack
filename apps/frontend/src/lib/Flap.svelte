<script lang="ts">
	import { onDestroy } from 'svelte';
	import {
		createHalfSlotRing,
		visibleHalfSlotWindow,
		type LogicalFace,
		type PhysicalHalfSlot,
		type SwipeDirection
	} from './flap-model';
	import {
		createGestureModel,
		type GestureEvent,
		type GestureModel,
		type MotionState,
		type ReleaseOutcome
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
	type PageState = {
		label: string;
		background: string;
	};
	export type FlapDiagnostics = {
		axis: Axis;
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
		transformAxis: RotationFunction;
		firstTransform: string;
		secondTransform: string;
		activeHalf: 'first' | 'second' | 'none';
	};

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
	const PAGES: PageState[] = [
		{ label: '1', background: '#581C87' },
		{ label: '2', background: '#C026D3' },
		{ label: '3', background: '#F43F5E' },
		{ label: '4', background: '#F97316' }
	];
	const LOGICAL_FACES = Object.fromEntries(
		PAGES.flatMap((page) => [
			[`page-${page.label}-first`, { id: `page-${page.label}-first`, label: page.label }],
			[`page-${page.label}-second`, { id: `page-${page.label}-second`, label: page.label }]
		])
	) as Record<string, LogicalFace>;
	const INITIAL_HALF_SLOT_RING = createHalfSlotRing(Object.values(LOGICAL_FACES));
	const INITIAL_VISIBLE_HALF_SLOTS = visibleHalfSlotWindow(INITIAL_HALF_SLOT_RING, 0, 4);
	const PHYSICAL_HALF_SLOTS = {
		currentFirst: initialVisibleHalfSlot(0),
		currentSecond: initialVisibleHalfSlot(1),
		nextFirst: initialVisibleHalfSlot(2),
		nextSecond: initialVisibleHalfSlot(3)
	} satisfies Record<string, PhysicalHalfSlot>;

	let {
		axis = 'vertical',
		onDiagnostics
	}: {
		axis?: Axis;
		onDiagnostics?: (diagnostics: FlapDiagnostics) => void;
	} = $props();
	const axisContract = $derived(AXIS_CONTRACTS[axis]);
	const isVertical = $derived(axis === 'vertical');

	const DRAG_SENSITIVITY = 0.6;
	const ANIMATION_SPEED = 0.25;
	const FRICTION_DECAY_PER_SECOND = 3.5;
	const ACCEPTED_SWIPE_ROTATION_DEGREES = 180;
	const VELOCITY_STOP_THRESHOLD = 0.01;

	let currentPageIndex = $state(0);
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
	const currentPage = $derived(pageAt(currentPageIndex));
	const releaseOutcome = $derived<ReleaseOutcome | undefined>(gestureModel.releaseOutcome);
	const turnDirectionSign = $derived(
		releaseOutcome?.type === 'turn' && releaseOutcome.direction === 'positive' ? -1 : 1
	);
	const displayDirectionSign = $derived(
		releaseOutcome?.type === 'turn' ? turnDirectionSign : rotation > 0 ? -1 : 1
	);
	const visualPageIndex = $derived(
		currentPageIndex + gestureModel.completedTurns * turnDirectionSign
	);
	const visualCurrentPage = $derived(pageAt(visualPageIndex));
	const targetPage = $derived(pageAt(visualPageIndex + displayDirectionSign));
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
			currentPageIndex,
			committedPageLabel: currentPage.label,
			visualPageLabel: visualCurrentPage.label,
			targetPageLabel: rotation === 0 ? undefined : targetPage.label,
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
				currentPageIndex +=
					event.outcome.direction === 'positive'
						? -event.outcome.pageCount
						: event.outcome.pageCount;
				logGesture('turn-committed', {
					direction: event.outcome.direction,
					count: event.outcome.pageCount,
					pageIndex: currentPageIndex
				});
			}
			if (event.type === 'settled') {
				logGesture('settled-event', { pageIndex: currentPageIndex });
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
				pageIndex: currentPageIndex
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

	function initialVisibleHalfSlot(index: number): PhysicalHalfSlot {
		const slot = INITIAL_VISIBLE_HALF_SLOTS[index];
		if (slot === undefined) {
			throw new RangeError('Initial visible half-slot is outside the model window.');
		}
		return slot;
	}

	function pageAt(index: number) {
		const page = PAGES[((index % PAGES.length) + PAGES.length) % PAGES.length];
		if (page === undefined) {
			throw new RangeError('Page index is outside the circular page model.');
		}
		return page;
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
	data-accepted-swipe-direction={acceptedSwipeDirection}
	data-current-page-index={currentPageIndex}
	data-committed-turns={committedTurnCount}
	onmousedown={dragStart}
	ontouchstart={dragStart}
	use:nonPassiveTouchMove={dragMove}
	ontouchend={dragEnd}
	ontouchcancel={dragEnd}
	aria-label={axisContract.ariaLabel}
>
	<div class="flip-page flip-page--next" aria-hidden="true">
		<div class="flip-half flip-half--first flip-half--next">
			<span class="flip-face flip-face--front" style={`--page-surface: ${targetPage.background}`}
				>{targetPage.label}</span
			>
			<span
				class="flip-face flip-face--back"
				style={`--page-surface: ${visualCurrentPage.background}`}>{visualCurrentPage.label}</span
			>
		</div>
		<div class="flip-half flip-half--second flip-half--next">
			<span class="flip-face flip-face--front" style={`--page-surface: ${targetPage.background}`}
				>{targetPage.label}</span
			>
			<span
				class="flip-face flip-face--back"
				style={`--page-surface: ${visualCurrentPage.background}`}>{visualCurrentPage.label}</span
			>
		</div>
	</div>
	<div class="flip-page flip-page--current">
		<div class="flip-half flip-half--first flip-half--current flip-half--active-first">
			<span
				class="flip-face flip-face--front"
				style={`--page-surface: ${visualCurrentPage.background}`}>{visualCurrentPage.label}</span
			>
			<span class="flip-face flip-face--back" style={`--page-surface: ${targetPage.background}`}
				>{targetPage.label}</span
			>
		</div>
		<div class="flip-half flip-half--second flip-half--current flip-half--active-second">
			<span
				class="flip-face flip-face--front"
				style={`--page-surface: ${visualCurrentPage.background}`}>{visualCurrentPage.label}</span
			>
			<span class="flip-face flip-face--back" style={`--page-surface: ${targetPage.background}`}
				>{targetPage.label}</span
			>
		</div>
	</div>
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

	.flip-page {
		position: absolute;
		inset: 0;
		transform-style: preserve-3d;
	}

	.flip-page--next {
		z-index: 1;
	}

	.flip-page--current {
		z-index: 2;
	}

	.flip-half {
		position: absolute;
		transform-style: preserve-3d;
		--page-surface: #fff;
	}

	.flip-deck--vertical .flip-half {
		left: 0;
		width: 100%;
		height: 50%;
	}

	.flip-deck--horizontal .flip-half {
		top: 0;
		width: 50%;
		height: 100%;
	}

	.flip-deck--vertical .flip-half--first {
		top: 0;
		transform-origin: center bottom;
		border-radius: 0.75rem 0.75rem 0 0;
	}

	.flip-deck--vertical .flip-half--second {
		bottom: 0;
		transform-origin: center top;
		border-radius: 0 0 0.75rem 0.75rem;
	}

	.flip-deck--horizontal .flip-half--first {
		left: 0;
		transform-origin: right center;
		border-radius: 0.75rem 0 0 0.75rem;
	}

	.flip-deck--horizontal .flip-half--second {
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

	.flip-deck--vertical .flip-half--first .flip-face--front,
	.flip-deck--vertical .flip-half--second .flip-face--back {
		border-radius: 0.75rem 0.75rem 0 0;
	}

	.flip-deck--vertical .flip-half--first .flip-face--back,
	.flip-deck--vertical .flip-half--second .flip-face--front {
		border-radius: 0 0 0.75rem 0.75rem;
	}

	.flip-deck--horizontal .flip-half--first .flip-face--front,
	.flip-deck--horizontal .flip-half--second .flip-face--back {
		border-radius: 0.75rem 0 0 0.75rem;
	}

	.flip-deck--horizontal .flip-half--first .flip-face--back,
	.flip-deck--horizontal .flip-half--second .flip-face--front {
		border-radius: 0 0.75rem 0.75rem 0;
	}

	.flip-face--back {
		transform: rotateX(180deg);
	}

	.flip-deck--horizontal .flip-face--back {
		transform: rotateY(180deg);
	}

	.flip-half--active-first,
	.flip-half--active-second {
		z-index: 3;
		will-change: transform;
	}

	.flip-deck--positive .flip-half--active-first,
	.flip-deck--negative .flip-half--active-second {
		z-index: 4;
	}

	.flip-half--active-first {
		transform: var(--first-transform);
	}

	.flip-half--active-second {
		transform: var(--second-transform);
	}
</style>
