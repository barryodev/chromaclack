<script lang="ts">
	import { onDestroy } from 'svelte';

	type Mode = 'vertical' | 'horizontal' | 'spin';

	let { mode = 'vertical' }: { mode?: Mode } = $props();
	let flipped = $state(false);

	function toggle() {
		flipped = !flipped;
	}

	// Degrees of rotation per pixel of vertical swipe.
	const VERTICAL_DRAG_SENSITIVITY = 0.6;
	const VERTICAL_ANIMATION_SPEED = 0.25;
	// How quickly the released spin's velocity decays (higher = more friction).
	const VERTICAL_FRICTION_DECAY_PER_SECOND = 3.5;
	// Below this angular speed (deg/ms) the inertia loop stops.
	const VERTICAL_VELOCITY_STOP_THRESHOLD = 0.01;

	let verticalRotation = $state(0);
	let verticalTouchStartY = 0;
	let verticalTouchStartRotation = 0;
	let lastTouchY = 0;
	let lastTouchTime = 0;
	let verticalVelocityDegPerMs = 0;
	let inertiaFrame: number | undefined;

	function cancelInertia() {
		if (inertiaFrame === undefined) return;
		cancelAnimationFrame(inertiaFrame);
		inertiaFrame = undefined;
	}

	// Svelte's declarative touch attributes register as passive, which silently
	// drops preventDefault; attach this one manually so swiping doesn't scroll the page.
	function nonPassiveTouchMove(node: HTMLElement, handler: (event: TouchEvent) => void) {
		node.addEventListener('touchmove', handler, { passive: false });
		return {
			destroy() {
				node.removeEventListener('touchmove', handler);
			}
		};
	}

	function startInertia() {
		if (Math.abs(verticalVelocityDegPerMs) < VERTICAL_VELOCITY_STOP_THRESHOLD) return;

		let lastFrameTime = performance.now();
		function step(now: number) {
			const dtMs = now - lastFrameTime;
			lastFrameTime = now;

			const animationDtMs = dtMs * VERTICAL_ANIMATION_SPEED;
			verticalRotation += verticalVelocityDegPerMs * animationDtMs;
			verticalVelocityDegPerMs *= Math.exp(
				-VERTICAL_FRICTION_DECAY_PER_SECOND * (animationDtMs / 1000)
			);

			if (Math.abs(verticalVelocityDegPerMs) < VERTICAL_VELOCITY_STOP_THRESHOLD) {
				inertiaFrame = undefined;
				return;
			}
			inertiaFrame = requestAnimationFrame(step);
		}
		inertiaFrame = requestAnimationFrame(step);
	}

	function verticalPointerY(event: MouseEvent | TouchEvent) {
		if ('touches' in event) {
			const touch = event.touches[0] ?? event.changedTouches[0];
			return touch?.clientY ?? verticalTouchStartY;
		}
		return event.clientY;
	}

	function verticalDragStart(event: MouseEvent | TouchEvent) {
		cancelInertia();
		const y = verticalPointerY(event);
		verticalTouchStartY = y;
		verticalTouchStartRotation = verticalRotation;
		lastTouchY = y;
		lastTouchTime = performance.now();
		verticalVelocityDegPerMs = 0;

		// Mouse can leave this small element mid-drag; track on window so the
		// swipe/release still registers wherever the cursor ends up.
		if (!('touches' in event)) {
			window.addEventListener('mousemove', verticalDragMove);
			window.addEventListener('mouseup', verticalDragEnd);
		}
	}

	function verticalDragMove(event: MouseEvent | TouchEvent) {
		if ('touches' in event) event.preventDefault();
		const y = verticalPointerY(event);
		const now = performance.now();

		verticalRotation = Math.max(
			-180,
			Math.min(
				180,
				verticalTouchStartRotation + (y - verticalTouchStartY) * VERTICAL_DRAG_SENSITIVITY
			)
		);

		const dt = now - lastTouchTime;
		if (dt > 0) {
			const instantDy = y - lastTouchY;
			verticalVelocityDegPerMs = (instantDy * VERTICAL_DRAG_SENSITIVITY) / dt;
		}
		lastTouchY = y;
		lastTouchTime = now;
	}

	function verticalDragEnd() {
		window.removeEventListener('mousemove', verticalDragMove);
		window.removeEventListener('mouseup', verticalDragEnd);
		startInertia();
	}

	$effect(() => {
		if (mode !== 'vertical') cancelInertia();
	});

	onDestroy(() => {
		cancelInertia();
		window.removeEventListener('mousemove', verticalDragMove);
		window.removeEventListener('mouseup', verticalDragEnd);
	});

	let spinAngle = $state(0);
	let isDragging = $state(false);
	let spinSettling = $state(false);
	let spinCenterX = 0;
	let spinCenterY = 0;
	let previousPointerAngle = 0;

	function pointerPosition(event: MouseEvent | TouchEvent) {
		if ('touches' in event) {
			const touch = event.touches[0] ?? event.changedTouches[0];
			return { x: touch?.clientX ?? spinCenterX, y: touch?.clientY ?? spinCenterY };
		}
		return { x: event.clientX, y: event.clientY };
	}

	function pointerAngle(x: number, y: number) {
		return Math.atan2(y - spinCenterY, x - spinCenterX) * (180 / Math.PI);
	}

	function startSpin(event: MouseEvent | TouchEvent) {
		const element = event.currentTarget as HTMLElement;
		const rect = element.getBoundingClientRect();
		spinCenterX = rect.left + rect.width / 2;
		spinCenterY = rect.top + rect.height / 2;
		const { x, y } = pointerPosition(event);
		previousPointerAngle = pointerAngle(x, y);
		spinSettling = false;
		isDragging = true;
	}

	function dragSpin(event: MouseEvent | TouchEvent) {
		if (!isDragging) return;
		if ('touches' in event) event.preventDefault();

		const { x, y } = pointerPosition(event);
		const currentPointerAngle = pointerAngle(x, y);
		// Shortest-path delta so crossing the -180/180 boundary doesn't jump.
		const delta = ((((currentPointerAngle - previousPointerAngle + 180) % 360) + 360) % 360) - 180;
		spinAngle += delta;
		previousPointerAngle = currentPointerAngle;
	}

	function stopDragging() {
		isDragging = false;
	}

	function releaseSpin() {
		isDragging = false;
		spinSettling = true;
		spinAngle = Math.round(spinAngle / 90) * 90;
	}
</script>

<section class="stage">
	{#if mode === 'vertical'}
		<button
			type="button"
			class="clacker clacker--carousel"
			style={`--top-rotation: ${-Math.max(0, verticalRotation)}deg; --bottom-rotation: ${-Math.min(0, verticalRotation)}deg`}
			onmousedown={verticalDragStart}
			ontouchstart={verticalDragStart}
			use:nonPassiveTouchMove={verticalDragMove}
			ontouchend={verticalDragEnd}
			ontouchcancel={verticalDragEnd}
			aria-label="Swipe to spin"
		>
			<div class="vertical-page vertical-page--next" aria-hidden="true">
				<div class="page-half page-half--top page-half--next" data-number="3"></div>
				<div class="page-half page-half--bottom page-half--next" data-number="4"></div>
			</div>
			<div class="vertical-page vertical-page--current">
				<div
					class="page-half page-half--top page-half--current page-half--active-top"
					data-number="1"
				></div>
				<div
					class="page-half page-half--bottom page-half--current page-half--active-bottom"
					data-number="2"
				></div>
			</div>
		</button>
	{:else if mode === 'horizontal'}
		<button
			type="button"
			class="clacker clacker--horizontal"
			onclick={toggle}
			aria-pressed={flipped}
			aria-label="Flip left or right"
		>
			<span class="segment segment--left"></span>
			<span class="segment segment--right"></span>
			<span class="flap flap--horizontal" class:flipped></span>
		</button>
	{:else if mode === 'spin'}
		<button
			type="button"
			class="clacker clacker--spin"
			class:spin-settling={spinSettling}
			style={`--spin-angle: ${spinAngle}deg`}
			onmousedown={startSpin}
			onmousemove={dragSpin}
			onmouseup={releaseSpin}
			onmouseleave={stopDragging}
			ontouchstart={startSpin}
			ontouchmove={dragSpin}
			ontouchend={releaseSpin}
			aria-label="Hold and rotate"
		>
			<span class="segment segment--left"></span>
			<span class="segment segment--right"></span>
			<span class="flap flap--horizontal"></span>
		</button>
	{/if}
</section>

<style>
	.stage {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 3rem;
	}

	/* Shared geometry for every clacker orientation. */
	.clacker {
		position: relative;
		width: 14rem;
		height: 14rem;
		padding: 0;
		background: none;
		border: none;
		cursor: pointer;
		perspective: 24rem;
	}

	@media (max-width: 28rem) {
		.clacker {
			width: min(14rem, calc(100vw - 2rem));
			height: min(14rem, calc(100vw - 2rem));
		}
	}

	/* Static half shown either side of the hinge, before the flap's axis-specific sizing is applied. */
	.segment {
		position: absolute;
		background: var(--field);
		border: 1px solid var(--border);
	}

	.clacker--horizontal .segment,
	.clacker--spin .segment {
		top: 0;
		width: 50%;
		height: 100%;
	}

	.segment--left {
		left: 0;
		border-radius: 0.75rem 0 0 0.75rem;
	}

	.segment--right {
		right: 0;
		border-radius: 0 0.75rem 0.75rem 0;
	}

	/* Phase 1 uses two fixed page pairs to verify hinge geometry before recycling. */
	.clacker--carousel {
		overflow: hidden;
		border-radius: 0.75rem;
		perspective: 18rem;
		transform-style: preserve-3d;
	}

	.vertical-page {
		position: absolute;
		inset: 0;
		transform-style: preserve-3d;
	}

	.vertical-page--next {
		z-index: 1;
	}

	.vertical-page--current {
		z-index: 2;
	}

	.page-half {
		position: absolute;
		left: 0;
		width: 100%;
		height: 50%;
		--page-surface: #fff;
		transform-style: preserve-3d;
		isolation: isolate;
	}

	.page-half--top {
		top: 0;
		transform-origin: center bottom;
		border-radius: 0.75rem 0.75rem 0 0;
	}

	.page-half--bottom {
		bottom: 0;
		transform-origin: center top;
		border-radius: 0 0 0.75rem 0.75rem;
	}

	.page-half::before,
	.page-half::after {
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

	.page-half::after {
		transform: rotateX(180deg);
	}

	.page-half--active-top,
	.page-half--active-bottom {
		z-index: 3;
		will-change: transform;
	}

	.page-half--active-top {
		transform: translateZ(0.75rem) rotateX(var(--top-rotation));
	}

	.page-half--active-bottom {
		transform: translateZ(0.75rem) rotateX(var(--bottom-rotation));
	}

	/* Moving piece: same transition and accent color, hinge axis differs per orientation. */
	.flap {
		position: absolute;
		background: var(--accent);
		/* Fast fall + slight overshoot/rebound past the stop, rather than a
		   smooth ease-out glide, to read as a mechanical snap. */
		transition: transform 0.55s cubic-bezier(0.65, -0.55, 0.35, 1.5);
	}

	.flap--horizontal {
		top: 0;
		left: 0;
		width: 50%;
		height: 100%;
		border-radius: 0.75rem 0 0 0.75rem;
		transform-origin: center right;
		transform: rotateY(0deg);
	}

	.flap--horizontal.flipped {
		transform: rotateY(180deg);
	}

	/* The whole knob rotates as one rigid unit, not the flap around its hinge. */
	.clacker--spin {
		transform: rotateZ(var(--spin-angle, 0deg));
	}

	/* Only the release snap eases; live dragging stays 1:1 with the pointer. */
	.clacker--spin.spin-settling {
		transition: transform 0.4s ease-out;
	}
</style>
