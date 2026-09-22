<script lang="ts">
	import type { HalfSlotDiagnostics } from './half-slot-diagnostics';

	let { diagnostics }: { diagnostics: HalfSlotDiagnostics | undefined } = $props();
</script>

<aside class="debug-panel" aria-label="Half-slot diagnostics">
	<header class="debug-panel__header">
		<span>Half-Slot Diagnostics</span>
		<span class="debug-panel__pulse" aria-hidden="true"></span>
	</header>

	{#if diagnostics}
		<section class="debug-section">
			<h2>Scene</h2>
			<div class="debug-grid">
				<div class="debug-value"><span>State</span><strong>{diagnostics.motionState}</strong></div>
				<div class="debug-value">
					<span>Rotation</span><strong>{diagnostics.rotationDegrees.toFixed(1)}°</strong>
				</div>
				<div class="debug-value">
					<span>Active side</span><strong>{diagnostics.activeSide}</strong>
				</div>
				<div class="debug-value">
					<span>Visible halves</span><strong>{diagnostics.visibleHalfSlotCount}</strong>
				</div>
			</div>
		</section>

		<section class="debug-section">
			<h2>Deck Handoff</h2>
			<div class="debug-grid">
				<div class="debug-value">
					<span>Direction</span><strong>{diagnostics.deckDirection}</strong>
				</div>
				<div class="debug-value">
					<span>Visible faces</span><strong>{diagnostics.visibleFaceIds.join(' / ')}</strong>
				</div>
				<div class="debug-value">
					<span>Return buffer</span><strong>{diagnostics.returnBufferFaceIds.join(' / ')}</strong>
				</div>
				<div class="debug-value">
					<span>Hidden queue</span><strong>{diagnostics.hiddenBacksideQueueCount}</strong>
				</div>
				<div class="debug-value">
					<span>Last turn</span><strong>{diagnostics.lastTurnDirection}</strong>
				</div>
				<div class="debug-value">
					<span>Completed turns</span><strong>{diagnostics.completedTurnCount}</strong>
				</div>
			</div>
		</section>

		<section class="debug-section">
			<h2>Focused Pair</h2>
			<div class="debug-grid">
				<div class="debug-value">
					<span>Face index</span><strong>{diagnostics.activeFaceIndex}</strong>
				</div>
				<div class="debug-value">
					<span>Half slots</span><strong>{diagnostics.activeHalfSlotIds.join(' / ')}</strong>
				</div>
				<div class="debug-value">
					<span>Rest pose</span><strong
						>{diagnostics.focusedPose[0]}° / {diagnostics.focusedPose[1]}°</strong
					>
				</div>
			</div>
		</section>
	{/if}
</aside>

<style>
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
