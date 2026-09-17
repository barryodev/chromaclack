<script lang="ts">
	import { onDestroy } from 'svelte';
	import {
		createHalfSlotRing,
		visibleHalfSlotWindow,
		type LogicalFace,
		type PhysicalHalfSlot,
		type SwipeDirection
	} from './flap-model';

	type Axis = 'vertical' | 'horizontal';
	type MotionState = 'idle' | 'dragging' | 'inertia' | 'settled';
	type PointerCoordinate = 'clientX' | 'clientY';
	type RotationFunction = 'rotateX' | 'rotateY';
	type AxisContract = {
		coordinate: PointerCoordinate;
		rotationFunction: RotationFunction;
		rotationSign: -1 | 1;
		ariaLabel: string;
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
	const LOGICAL_FACES = {
		face1: { id: 'face-1', label: '1' },
		face2: { id: 'face-2', label: '2' },
		face3: { id: 'face-3', label: '3' },
		face4: { id: 'face-4', label: '4' }
	} satisfies Record<string, LogicalFace>;
	const INITIAL_HALF_SLOT_RING = createHalfSlotRing(Object.values(LOGICAL_FACES));
	const INITIAL_VISIBLE_HALF_SLOTS = visibleHalfSlotWindow(INITIAL_HALF_SLOT_RING, 0, 4);
	const PHYSICAL_HALF_SLOTS = {
		currentFirst: initialVisibleHalfSlot(0),
		currentSecond: initialVisibleHalfSlot(1),
		nextFirst: initialVisibleHalfSlot(2),
		nextSecond: initialVisibleHalfSlot(3)
	} satisfies Record<string, PhysicalHalfSlot>;

	let { axis = 'vertical', debug = false }: { axis?: Axis; debug?: boolean } = $props();
	const axisContract = $derived(AXIS_CONTRACTS[axis]);
	const isVertical = $derived(axis === 'vertical');

	const DRAG_SENSITIVITY = 0.6;
	const ANIMATION_SPEED = 0.25;
	const FRICTION_DECAY_PER_SECOND = 3.5;
	const ACCEPTED_SWIPE_ROTATION_DEGREES = 180;
	const VELOCITY_STOP_THRESHOLD = 0.01;

	let rotation = $state(0);
	let motionState = $state<MotionState>('idle');
	let acceptedSwipeDirection = $state<SwipeDirection | undefined>();
	const debugPositions = $derived([
		{ name: 'nextFirst', slot: PHYSICAL_HALF_SLOTS.nextFirst },
		{ name: 'nextSecond', slot: PHYSICAL_HALF_SLOTS.nextSecond },
		{ name: 'currentFirst', slot: PHYSICAL_HALF_SLOTS.currentFirst },
		{ name: 'currentSecond', slot: PHYSICAL_HALF_SLOTS.currentSecond }
	]);
	const debugRing = $derived(INITIAL_HALF_SLOT_RING.map((slot, index) => ({ index, slot })));
	const debugVisibleSlots = $derived(
		INITIAL_VISIBLE_HALF_SLOTS.map((slot, index) => ({ index, slot }))
	);
	const firstTransform = $derived(
		`${axisContract.rotationFunction}(${axisContract.rotationSign * Math.max(0, rotation)}deg)`
	);
	const secondTransform = $derived(
		`${axisContract.rotationFunction}(${axisContract.rotationSign * Math.min(0, rotation)}deg)`
	);
	let touchStartPosition = 0;
	let touchStartRotation = 0;
	let lastTouchPosition = 0;
	let lastTouchTime = 0;
	let velocityDegPerMs = 0;
	let inertiaFrame: number | undefined;

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
			return touch?.[axisContract.coordinate] ?? touchStartPosition;
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

	function acceptedSwipeDirectionForRotation(value: number): SwipeDirection | undefined {
		if (value >= ACCEPTED_SWIPE_ROTATION_DEGREES) return 'positive';
		if (value <= -ACCEPTED_SWIPE_ROTATION_DEGREES) return 'negative';
	}

	function settleMotion() {
		motionState = 'settled';
		acceptedSwipeDirection = acceptedSwipeDirectionForRotation(rotation);
	}

	function startInertia() {
		if (Math.abs(velocityDegPerMs) < VELOCITY_STOP_THRESHOLD) {
			settleMotion();
			return;
		}

		motionState = 'inertia';
		let lastFrameTime = performance.now();
		function step(now: number) {
			const dtMs = now - lastFrameTime;
			lastFrameTime = now;

			const animationDtMs = dtMs * ANIMATION_SPEED;
			rotation = Math.max(-180, Math.min(180, rotation + velocityDegPerMs * animationDtMs));
			velocityDegPerMs *= Math.exp(-FRICTION_DECAY_PER_SECOND * (animationDtMs / 1000));

			if (Math.abs(velocityDegPerMs) < VELOCITY_STOP_THRESHOLD) {
				inertiaFrame = undefined;
				settleMotion();
				return;
			}
			inertiaFrame = requestAnimationFrame(step);
		}
		inertiaFrame = requestAnimationFrame(step);
	}

	function dragStart(event: MouseEvent | TouchEvent) {
		cancelInertia();
		const position = pointerPosition(event);
		touchStartPosition = position;
		touchStartRotation = rotation;
		lastTouchPosition = position;
		lastTouchTime = performance.now();
		velocityDegPerMs = 0;
		motionState = 'dragging';
		acceptedSwipeDirection = undefined;

		if (!('touches' in event)) {
			window.addEventListener('mousemove', dragMove);
			window.addEventListener('mouseup', dragEnd);
		}
	}

	function dragMove(event: MouseEvent | TouchEvent) {
		if ('touches' in event) event.preventDefault();
		const position = pointerPosition(event);
		const now = performance.now();

		rotation = Math.max(
			-180,
			Math.min(180, touchStartRotation + (position - touchStartPosition) * DRAG_SENSITIVITY)
		);

		const dt = now - lastTouchTime;
		if (dt > 0) {
			velocityDegPerMs = ((position - lastTouchPosition) * DRAG_SENSITIVITY) / dt;
		}
		lastTouchPosition = position;
		lastTouchTime = now;
	}

	function dragEnd() {
		window.removeEventListener('mousemove', dragMove);
		window.removeEventListener('mouseup', dragEnd);
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
	onmousedown={dragStart}
	ontouchstart={dragStart}
	use:nonPassiveTouchMove={dragMove}
	ontouchend={dragEnd}
	ontouchcancel={dragEnd}
	aria-label={axisContract.ariaLabel}
>
	<div class="flip-page flip-page--next" aria-hidden="true">
		<div
			class="flip-half flip-half--first flip-half--next"
			data-number={PHYSICAL_HALF_SLOTS.nextFirst.face.label}
		></div>
		<div
			class="flip-half flip-half--second flip-half--next"
			data-number={PHYSICAL_HALF_SLOTS.nextSecond.face.label}
		></div>
	</div>
	<div class="flip-page flip-page--current">
		<div
			class="flip-half flip-half--first flip-half--current flip-half--active-first"
			data-number={PHYSICAL_HALF_SLOTS.currentFirst.face.label}
		></div>
		<div
			class="flip-half flip-half--second flip-half--current flip-half--active-second"
			data-number={PHYSICAL_HALF_SLOTS.currentSecond.face.label}
		></div>
	</div>
</button>

{#if debug}
	<aside class="debug-panel" aria-label="Flap diagnostics">
		<header class="debug-panel__header">
			<span>Flap Diagnostics</span>
			<span class="debug-panel__pulse" aria-hidden="true"></span>
		</header>

		<div class="debug-metrics">
			<div class="debug-metric">
				<span>Axis</span>
				<strong>{axis}</strong>
			</div>
			<div class="debug-metric">
				<span>Motion</span>
				<strong>{motionState}</strong>
			</div>
			<div class="debug-metric">
				<span>Swipe</span>
				<strong>{acceptedSwipeDirection ?? 'none'}</strong>
			</div>
			<div class="debug-metric">
				<span>Rotation</span>
				<strong>{rotation.toFixed(2)} deg</strong>
			</div>
		</div>

		<section class="debug-section">
			<h2>Visual Positions</h2>
			{#each debugPositions as position}
				<div class="debug-row">
					<span>{position.name}</span>
					<strong>{position.slot.face.label}</strong>
					<small>{position.slot.id} / {position.slot.face.id}</small>
				</div>
			{/each}
		</section>

		<section class="debug-section">
			<h2>Visible Window</h2>
			{#each debugVisibleSlots as item}
				<div class="debug-row debug-row--compact">
					<span>#{item.index}</span>
					<strong>{item.slot.face.label}</strong>
					<small>{item.slot.id} / {item.slot.role}</small>
				</div>
			{/each}
		</section>

		<section class="debug-section">
			<h2>Ring</h2>
			<div class="debug-ring">
				{#each debugRing as item}
					<span class="debug-ring__chip">{item.index}: {item.slot.face.label}</span>
				{/each}
			</div>
		</section>
	</aside>
{/if}

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
		isolation: isolate;
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

	.flip-half::before,
	.flip-half::after {
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
		content: attr(data-number);
	}

	.flip-half::after {
		transform: rotateX(180deg);
	}

	.flip-deck--horizontal .flip-half::after {
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

	.debug-panel {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
		z-index: 10;
		width: min(25rem, calc(100vw - 2rem));
		max-height: min(28rem, calc(100vh - 2rem));
		margin: 0;
		padding: 0.85rem;
		overflow: auto;
		border: 1px solid rgba(255, 255, 255, 0.16);
		border-radius: 0.75rem;
		background:
			linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04)),
			rgba(12, 15, 18, 0.94);
		box-shadow: 0 1.25rem 3rem rgba(0, 0, 0, 0.38);
		color: #f8fafc;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.72rem;
		line-height: 1.35;
		text-align: left;
		backdrop-filter: blur(14px);
	}

	.debug-panel__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.75rem;
		color: #e2e8f0;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.debug-panel__pulse {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 999px;
		background: #65f0b4;
		box-shadow: 0 0 0.8rem rgba(101, 240, 180, 0.85);
	}

	.debug-metrics {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.45rem;
		margin-bottom: 0.85rem;
	}

	.debug-metric,
	.debug-section {
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 0.5rem;
		background: rgba(255, 255, 255, 0.055);
	}

	.debug-metric {
		display: grid;
		gap: 0.15rem;
		padding: 0.5rem;
	}

	.debug-metric span,
	.debug-row span,
	.debug-row small {
		color: #94a3b8;
	}

	.debug-metric strong,
	.debug-row strong {
		color: #f8fafc;
		font-weight: 800;
	}

	.debug-section {
		padding: 0.55rem;
	}

	.debug-section + .debug-section {
		margin-top: 0.55rem;
	}

	.debug-section h2 {
		margin: 0 0 0.45rem;
		color: #cbd5e1;
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.debug-row {
		display: grid;
		grid-template-columns: minmax(6rem, 1fr) auto minmax(7rem, 1fr);
		gap: 0.5rem;
		align-items: center;
		padding: 0.28rem 0;
	}

	.debug-row--compact {
		grid-template-columns: 2rem auto minmax(7rem, 1fr);
	}

	.debug-row + .debug-row {
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}

	.debug-ring {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.debug-ring__chip {
		padding: 0.24rem 0.4rem;
		border: 1px solid rgba(101, 240, 180, 0.22);
		border-radius: 999px;
		background: rgba(101, 240, 180, 0.08);
		color: #dffcec;
	}
</style>
