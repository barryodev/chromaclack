<script lang="ts">
	import Flap from './Flap.svelte';

	type Mode = 'vertical' | 'horizontal' | 'spin';

	let { mode = 'vertical', debug = false }: { mode?: Mode; debug?: boolean } = $props();
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
		<Flap axis="vertical" {debug} />
	{:else if mode === 'horizontal'}
		<Flap axis="horizontal" {debug} />
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

	.clacker--spin .segment {
		top: 0;
		width: 50%;
		height: 100%;
		background: #581c87;
		color: #111;
	}

	.segment--left {
		left: 0;
		border-radius: 0.75rem 0 0 0.75rem;
	}

	.segment--right {
		right: 0;
		border-radius: 0 0.75rem 0.75rem 0;
	}

	.clacker--spin .segment--right::after,
	.clacker--spin .flap--horizontal::after {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 1.25rem;
		font-weight: 700;
		content: '1';
	}

	.clacker--spin .flap--horizontal::after {
		content: '1';
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
		background: #581c87;
		color: #111;
		border-radius: 0.75rem 0 0 0.75rem;
		transform-origin: center right;
		transform: rotateY(0deg);
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
