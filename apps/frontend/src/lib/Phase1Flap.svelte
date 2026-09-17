<script lang="ts">
	import { onDestroy } from 'svelte';

	type Axis = 'vertical' | 'horizontal';

	let { axis = 'vertical' }: { axis?: Axis } = $props();
	const isVertical = $derived(axis === 'vertical');

	const DRAG_SENSITIVITY = 0.6;
	const ANIMATION_SPEED = 0.25;
	const FRICTION_DECAY_PER_SECOND = 3.5;
	const VELOCITY_STOP_THRESHOLD = 0.01;

	let rotation = $state(0);
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
			return isVertical
				? (touch?.clientY ?? touchStartPosition)
				: (touch?.clientX ?? touchStartPosition);
		}
		return isVertical ? event.clientY : event.clientX;
	}

	function startInertia() {
		if (Math.abs(velocityDegPerMs) < VELOCITY_STOP_THRESHOLD) return;

		let lastFrameTime = performance.now();
		function step(now: number) {
			const dtMs = now - lastFrameTime;
			lastFrameTime = now;

			const animationDtMs = dtMs * ANIMATION_SPEED;
			rotation = Math.max(-180, Math.min(180, rotation + velocityDegPerMs * animationDtMs));
			velocityDegPerMs *= Math.exp(-FRICTION_DECAY_PER_SECOND * (animationDtMs / 1000));

			if (Math.abs(velocityDegPerMs) < VELOCITY_STOP_THRESHOLD) {
				inertiaFrame = undefined;
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
	style={`--positive-rotation: ${(isVertical ? -1 : 1) * Math.max(0, rotation)}deg; --negative-rotation: ${(isVertical ? -1 : 1) * Math.min(0, rotation)}deg`}
	onmousedown={dragStart}
	ontouchstart={dragStart}
	use:nonPassiveTouchMove={dragMove}
	ontouchend={dragEnd}
	ontouchcancel={dragEnd}
	aria-label={isVertical ? 'Swipe up or down' : 'Swipe left or right'}
>
	<div class="flip-page flip-page--next" aria-hidden="true">
		<div class="flip-half flip-half--first flip-half--next" data-number="3"></div>
		<div class="flip-half flip-half--second flip-half--next" data-number="4"></div>
	</div>
	<div class="flip-page flip-page--current">
		<div
			class="flip-half flip-half--first flip-half--current flip-half--active-first"
			data-number="1"
		></div>
		<div
			class="flip-half flip-half--second flip-half--current flip-half--active-second"
			data-number="2"
		></div>
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
		perspective: 18rem;
		transform-style: preserve-3d;
		overflow: hidden;
	}

	.flip-deck--vertical {
		--first-transform: translateZ(0.75rem) rotateX(var(--positive-rotation));
		--second-transform: translateZ(0.75rem) rotateX(var(--negative-rotation));
	}

	.flip-deck--horizontal {
		--first-transform: translateZ(0.75rem) rotateY(var(--positive-rotation));
		--second-transform: translateZ(0.75rem) rotateY(var(--negative-rotation));
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
</style>
