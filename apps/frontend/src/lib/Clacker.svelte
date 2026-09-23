<script lang="ts">
	import Flap from './Flap.svelte';
	import { createClackerConfig, createFlaps, type ClackerConfig } from './clacker-model';
	import type { FlapDiagnostics } from './flap-diagnostics';

	type Mode = 'vertical' | 'horizontal' | 'spin';

	let {
		mode = 'vertical',
		debug = false,
		config
	}: {
		mode?: Mode;
		debug?: boolean;
		config: ClackerConfig;
	} = $props();
	const clackerConfig = $derived(createClackerConfig(config));
	const flaps = $derived(createFlaps(clackerConfig, (position, side) => {
		const pairedPosition =
			side === 'front'
				? position
				: (position - 1 + clackerConfig.flapCount) % clackerConfig.flapCount;
		return {
			id: `face-${pairedPosition + 1}`,
			label: `${pairedPosition + 1}`,
			background: `hsl(${(pairedPosition * 47) % 360} 72% 56%)`
		};
	}));
	let spinAngle = $state(0);
	let isDragging = $state(false);
	let spinSettling = $state(false);
	let spinCenterX = 0;
	let spinCenterY = 0;
	let previousPointerAngle = 0;
	let flapDiagnostics = $state<FlapDiagnostics | undefined>();
	const spinMotionState = $derived(isDragging ? 'dragging' : spinSettling ? 'settling' : 'idle');
	const activeFlapDiagnostics = $derived(mode === 'spin' ? undefined : flapDiagnostics);

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

	function updateFlapDiagnostics(nextDiagnostics: FlapDiagnostics) {
		flapDiagnostics = nextDiagnostics;
	}
</script>

<section class="stage">
	{#if mode === 'vertical'}
		<Flap {flaps} axis="vertical" onDiagnostics={debug ? updateFlapDiagnostics : undefined} />
	{:else if mode === 'horizontal'}
		<Flap {flaps} axis="horizontal" onDiagnostics={debug ? updateFlapDiagnostics : undefined} />
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
			data-flap-count={clackerConfig.flapCount}
		>
			<span class="segment segment--left"></span>
			<span class="segment segment--right"></span>
			<span class="flap flap--horizontal"></span>
		</button>
	{/if}

	{#if debug}
		<aside class="debug-panel" aria-label="Flap diagnostics">
			<header class="debug-panel__header">
				<span>Runtime Diagnostics</span>
				<span class="debug-panel__pulse" aria-hidden="true"></span>
			</header>

			<section class="debug-section">
				<h2>Runtime</h2>
				<div class="debug-grid">
					<div class="debug-value"><span>Mode</span><strong>{mode}</strong></div>
					<div class="debug-value">
						<span>Render path</span><strong
							>{mode === 'spin'
								? 'Clacker spin'
								: `Flap ${activeFlapDiagnostics?.axis ?? mode}`}</strong
						>
					</div>
					<div class="debug-value">
						<span>Component state</span><strong
							>{mode === 'spin'
								? spinMotionState
								: (activeFlapDiagnostics?.motionState ?? 'waiting')}</strong
						>
					</div>
					<div class="debug-value">
						<span>Angle</span><strong
							>{mode === 'spin'
								? `${spinAngle.toFixed(1)}°`
								: `${(activeFlapDiagnostics?.rotation ?? 0).toFixed(1)}°`}</strong
						>
					</div>
				</div>
			</section>

			{#if activeFlapDiagnostics}
				<section class="debug-section">
					<h2>Gesture Model</h2>
					<div class="debug-grid">
						<div class="debug-value">
							<span>State</span><strong>{activeFlapDiagnostics.motionState}</strong>
						</div>
						<div class="debug-value">
							<span>Last release</span><strong
								>{activeFlapDiagnostics.acceptedSwipeDirection ?? 'none'}</strong
							>
						</div>
						<div class="debug-value">
							<span>Velocity</span><strong
								>{activeFlapDiagnostics.velocityDegPerMs.toFixed(4)} °/ms</strong
							>
						</div>
						<div class="debug-value">
							<span>Release velocity</span><strong
								>{activeFlapDiagnostics.velocityAtRelease.toFixed(4)} °/ms</strong
							>
						</div>
						<div class="debug-value">
							<span>Inertia</span><strong
								>{activeFlapDiagnostics.inertiaDurationMs.toFixed(0)} ms</strong
							>
						</div>
						<div class="debug-value">
							<span>Frames</span><strong>{activeFlapDiagnostics.inertiaTickCount}</strong>
						</div>
						<div class="debug-value">
							<span>Outcome</span><strong>{activeFlapDiagnostics.releaseOutcomeType}</strong>
						</div>
						<div class="debug-value">
							<span>Outcome status</span><strong>{activeFlapDiagnostics.outcomeStatus}</strong>
						</div>
					</div>
				</section>

				<section class="debug-section">
					<h2>Visual State</h2>
					<div class="debug-grid">
						<div class="debug-value">
							<span>Axis</span><strong>{activeFlapDiagnostics.transformAxis}</strong>
						</div>
						<div class="debug-value">
							<span>Active half</span><strong>{activeFlapDiagnostics.activeHalf}</strong>
						</div>
						<div class="debug-value">
							<span>First transform</span><strong>{activeFlapDiagnostics.firstTransform}</strong>
						</div>
						<div class="debug-value">
							<span>Second transform</span><strong>{activeFlapDiagnostics.secondTransform}</strong>
						</div>
					</div>
				</section>

				<section class="debug-section">
					<h2>Page Model</h2>
					<div class="debug-grid">
						<div class="debug-value">
							<span>Committed page</span><strong>{activeFlapDiagnostics.committedPageLabel}</strong>
						</div>
						<div class="debug-value">
							<span>Visual page</span><strong>{activeFlapDiagnostics.visualPageLabel}</strong>
						</div>
						<div class="debug-value">
							<span>Final target</span><strong
								>{activeFlapDiagnostics.targetPageLabel ?? 'none'}</strong
							>
						</div>
						<div class="debug-value">
							<span>Progress</span><strong
								>{activeFlapDiagnostics.completedTurnCount} / {activeFlapDiagnostics.plannedTurnCount}</strong
							>
						</div>
						<div class="debug-value">
							<span>Remaining</span><strong>{activeFlapDiagnostics.remainingTurnCount}</strong>
						</div>
						<div class="debug-value">
							<span>Committed index</span><strong>{activeFlapDiagnostics.currentPageIndex}</strong>
						</div>
					</div>
				</section>
			{:else if mode === 'spin'}
				<section class="debug-section">
					<h2>Spin State</h2>
					<div class="debug-grid">
						<div class="debug-value"><span>State</span><strong>{spinMotionState}</strong></div>
						<div class="debug-value">
							<span>Angle</span><strong>{spinAngle.toFixed(1)}°</strong>
						</div>
						<div class="debug-value">
							<span>Snap target</span><strong>{Math.round(spinAngle / 90) * 90}°</strong>
						</div>
					</div>
				</section>
			{/if}
		</aside>
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

	.debug-panel {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
		z-index: 10;
		width: min(27rem, calc(100vw - 2rem));
		max-height: min(31rem, calc(100vh - 2rem));
		padding: 0.9rem;
		overflow: auto;
		border: 1px solid rgba(34, 211, 238, 0.35);
		border-radius: 0.9rem;
		background: linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(10, 14, 20, 0.95));
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

	.debug-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.45rem;
	}

	.debug-value {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.45rem;
		border: 1px solid rgba(148, 163, 184, 0.16);
		border-radius: 0.45rem;
		background: rgba(9, 14, 20, 0.6);
	}

	.debug-value span {
		color: #7dd3fc;
		font-size: 0.56rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.debug-value strong {
		overflow-wrap: anywhere;
		color: #f8fafc;
		font-size: 0.76rem;
		font-weight: 700;
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
