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
	type PageState = {
		label: string;
		background: string;
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

	let { axis = 'vertical', debug = false }: { axis?: Axis; debug?: boolean } = $props();
	const axisContract = $derived(AXIS_CONTRACTS[axis]);
	const isVertical = $derived(axis === 'vertical');

	const DRAG_SENSITIVITY = 0.6;
	const ANIMATION_SPEED = 0.25;
	const FRICTION_DECAY_PER_SECOND = 3.5;
	const ACCEPTED_SWIPE_ROTATION_DEGREES = 180;
	const VELOCITY_STOP_THRESHOLD = 0.01;

	let currentPageIndex = $state(0);
	let rotation = $state(0);
	let motionState = $state<MotionState>('idle');
	let acceptedSwipeDirection = $state<SwipeDirection | undefined>();
	const currentPage = $derived(pageAt(currentPageIndex));
	const nextPage = $derived(pageAt(currentPageIndex + 1));
	const previousPage = $derived(pageAt(currentPageIndex - 1));
	const targetPage = $derived(rotation > 0 ? previousPage : nextPage);
	const debugPositions = $derived([
		{ name: 'previousPage', page: previousPage },
		{ name: 'currentPage', page: currentPage },
		{ name: 'nextPage', page: nextPage },
		{ name: 'targetPage', page: targetPage }
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
	let velocityAtRelease = 0;
	let releaseTimestamp = 0;
	let inertiaStartTimestamp = 0;
	let inertiaDurationMs = 0;
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

	function pageAt(index: number) {
		const page = PAGES[((index % PAGES.length) + PAGES.length) % PAGES.length];
		if (page === undefined) {
			throw new RangeError('Page index is outside the circular page model.');
		}
		return page;
	}

	function acceptedSwipeDirectionForRotation(value: number): SwipeDirection | undefined {
		if (value >= ACCEPTED_SWIPE_ROTATION_DEGREES) return 'positive';
		if (value <= -ACCEPTED_SWIPE_ROTATION_DEGREES) return 'negative';
	}

	function settleMotion() {
		const direction = acceptedSwipeDirectionForRotation(rotation);
		motionState = 'settled';
		acceptedSwipeDirection = direction;

		if (direction) {
			currentPageIndex += direction === 'positive' ? -1 : 1;
			rotation = 0;
		}
	}

	function startInertia() {
		velocityAtRelease = velocityDegPerMs;
		releaseTimestamp = performance.now();
		inertiaStartTimestamp = releaseTimestamp;
		inertiaDurationMs = 0;

		if (Math.abs(velocityDegPerMs) < VELOCITY_STOP_THRESHOLD) {
			settleMotion();
			return;
		}

		motionState = 'inertia';
		let lastFrameTime = performance.now();
		function step(now: number) {
			const dtMs = now - lastFrameTime;
			lastFrameTime = now;
			inertiaDurationMs = now - inertiaStartTimestamp;

			const animationDtMs = dtMs * ANIMATION_SPEED;
			rotation = Math.max(-180, Math.min(180, rotation + velocityDegPerMs * animationDtMs));
			velocityDegPerMs *= Math.exp(-FRICTION_DECAY_PER_SECOND * (animationDtMs / 1000));

			if (Math.abs(velocityDegPerMs) < VELOCITY_STOP_THRESHOLD) {
				inertiaFrame = undefined;
				settleMotion();
				inertiaDurationMs = now - inertiaStartTimestamp;
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
		<div class="flip-half flip-half--first flip-half--next">
			<span class="flip-face flip-face--front" style={`--page-surface: ${targetPage.background}`}
				>{targetPage.label}</span
			>
			<span class="flip-face flip-face--back" style={`--page-surface: ${currentPage.background}`}
				>{currentPage.label}</span
			>
		</div>
		<div class="flip-half flip-half--second flip-half--next">
			<span class="flip-face flip-face--front" style={`--page-surface: ${targetPage.background}`}
				>{targetPage.label}</span
			>
			<span class="flip-face flip-face--back" style={`--page-surface: ${currentPage.background}`}
				>{currentPage.label}</span
			>
		</div>
	</div>
	<div class="flip-page flip-page--current">
		<div class="flip-half flip-half--first flip-half--current flip-half--active-first">
			<span class="flip-face flip-face--front" style={`--page-surface: ${currentPage.background}`}
				>{currentPage.label}</span
			>
			<span class="flip-face flip-face--back" style={`--page-surface: ${previousPage.background}`}
				>{previousPage.label}</span
			>
		</div>
		<div class="flip-half flip-half--second flip-half--current flip-half--active-second">
			<span class="flip-face flip-face--front" style={`--page-surface: ${currentPage.background}`}
				>{currentPage.label}</span
			>
			<span class="flip-face flip-face--back" style={`--page-surface: ${nextPage.background}`}
				>{nextPage.label}</span
			>
		</div>
	</div>
</button>

{#if debug}
	<aside class="debug-panel" aria-label="Flap diagnostics">
		<header class="debug-panel__header">
			<span>Flap Diagnostics</span>
			<span class="debug-panel__pulse" aria-hidden="true"></span>
		</header>

		<div class="debug-metrics">
			<div class="debug-metric debug-metric--wide">
				<span>Axis</span>
				<strong>{axis}</strong>
			</div>
			<div class="debug-metric debug-metric--wide">
				<span>Motion</span>
				<strong class="debug-status debug-status--{motionState}">{motionState}</strong>
			</div>
			<div class="debug-metric">
				<span>Swipe</span>
				<strong>{acceptedSwipeDirection ?? 'none'}</strong>
			</div>
			<div class="debug-metric">
				<span>Rotation</span>
				<strong>{rotation.toFixed(2)}°</strong>
			</div>
			<div class="debug-metric">
				<span>Velocity</span>
				<strong>{velocityDegPerMs.toFixed(4)}</strong>
			</div>
			<div class="debug-metric">
				<span>Release</span>
				<strong>{velocityAtRelease.toFixed(4)}</strong>
			</div>
			<div class="debug-metric debug-metric--wide">
				<span>Elapsed</span>
				<strong>{Math.max(0, performance.now() - releaseTimestamp).toFixed(0)} ms</strong>
			</div>
			<div class="debug-metric debug-metric--wide">
				<span>Inertia</span>
				<strong>{inertiaDurationMs.toFixed(0)} ms</strong>
			</div>
			<div class="debug-metric debug-metric--wide">
				<span>Threshold</span>
				<strong>{Math.abs(velocityDegPerMs) < VELOCITY_STOP_THRESHOLD ? 'below' : 'above'}</strong>
			</div>
		</div>

		<section class="debug-section">
			<h2>Pages</h2>
			{#each debugPositions as position}
				<div class="debug-row">
					<span>{position.name}</span>
					<strong>{position.page.label}</strong>
					<small>{position.page.background} / page index {currentPageIndex}</small>
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

	.debug-panel {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
		z-index: 10;
		width: min(27rem, calc(100vw - 2rem));
		max-height: min(31rem, calc(100vh - 2rem));
		margin: 0;
		padding: 0.9rem;
		overflow: auto;
		border: 1px solid rgba(34, 211, 238, 0.35);
		border-radius: 0.9rem;
		background:
			linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(10, 14, 20, 0.95)),
			linear-gradient(135deg, rgba(34, 211, 238, 0.14), rgba(59, 130, 246, 0.08));
		box-shadow:
			0 0 0 1px rgba(148, 163, 184, 0.18),
			0 1rem 2.5rem rgba(15, 23, 42, 0.72),
			0 0 2rem rgba(34, 211, 238, 0.16);
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
		margin-bottom: 0.8rem;
		padding-bottom: 0.45rem;
		border-bottom: 1px solid rgba(34, 211, 238, 0.2);
		color: #dbeafe;
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	.debug-panel__pulse {
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 999px;
		background: #2dd4bf;
		box-shadow: 0 0 0.8rem rgba(45, 212, 191, 0.95);
		animation: pulse 1.2s ease-in-out infinite;
	}

	.debug-metrics {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
		margin-bottom: 0.8rem;
	}

	.debug-metric {
		display: flex;
		flex-direction: column;
		gap: 0.24rem;
		padding: 0.5rem 0.55rem;
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 0.55rem;
		background: linear-gradient(180deg, rgba(9, 14, 20, 0.9), rgba(15, 23, 42, 0.7));
		box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.08);
	}

	.debug-metric--wide {
		grid-column: span 2;
	}

	.debug-metric span {
		color: #7dd3fc;
		font-size: 0.58rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.debug-metric strong {
		color: #f8fafc;
		font-size: 0.82rem;
		font-weight: 700;
	}

	.debug-status {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.12rem 0.45rem;
		border-radius: 999px;
		font-size: 0.7rem;
		text-transform: uppercase;
	}

	.debug-status--idle {
		background: rgba(148, 163, 184, 0.12);
		color: #cbd5e1;
	}

	.debug-status--dragging {
		background: rgba(250, 204, 21, 0.12);
		color: #fde68a;
	}

	.debug-status--inertia {
		background: rgba(34, 211, 238, 0.12);
		color: #a5f3fc;
	}

	.debug-status--settled {
		background: rgba(52, 211, 153, 0.12);
		color: #a7f3d0;
	}

	.debug-section {
		margin-top: 0.7rem;
		padding: 0.6rem;
		border: 1px solid rgba(148, 163, 184, 0.16);
		border-radius: 0.6rem;
		background: rgba(15, 23, 42, 0.54);
	}

	.debug-section h2 {
		margin: 0 0 0.45rem;
		color: #cbd5e1;
		font-size: 0.6rem;
		letter-spacing: 0.15em;
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

	.debug-row span,
	.debug-row small {
		color: #94a3b8;
	}

	.debug-row strong {
		color: #f8fafc;
	}

	.debug-ring {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.debug-ring__chip {
		padding: 0.2rem 0.45rem;
		border: 1px solid rgba(45, 212, 191, 0.4);
		border-radius: 999px;
		background: rgba(13, 148, 136, 0.12);
		color: #a7f3d0;
		font-size: 0.58rem;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.6;
			transform: scale(1.2);
		}
	}
</style>
