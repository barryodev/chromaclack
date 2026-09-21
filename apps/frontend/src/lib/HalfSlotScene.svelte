<script lang="ts">
	import {
		createSettledHalfSlotScene,
		type HalfSlotPose
	} from './half-slot-scene-model';

	const poses = createSettledHalfSlotScene();

	function poseStyle(pose: HalfSlotPose) {
		return `--scene-angle: ${pose.rotationDegrees}deg; --scene-layer: ${pose.layer}; --scene-surface: ${surfaceFor(pose.logicalFaceIndex)}`;
	}

	function surfaceFor(index: number) {
		const hue = ((index * 47) % 360 + 360) % 360;
		return `hsl(${hue} 72% 58%)`;
	}
</script>

<div class="half-slot-scene" aria-label="Static half-slot Rolodex scene">
	{#each poses as pose (pose.physicalHalfSlotId)}
		<div
			class="half-slot"
			class:half-slot--first={pose.side === 'first'}
			class:half-slot--second={pose.side === 'second'}
			class:half-slot--active={pose.isActive}
			class:half-slot--buffered={pose.visibility === 'buffered'}
			style={poseStyle(pose)}
			data-half-slot={pose.physicalHalfSlotId}
			data-logical-face-index={pose.logicalFaceIndex}
		>
			<span>{pose.logicalFaceIndex}</span>
		</div>
	{/each}
</div>

<style>
	.half-slot-scene {
		position: relative;
		width: 14rem;
		height: 14rem;
		perspective: 28rem;
		transform-style: preserve-3d;
	}

	.half-slot {
		position: absolute;
		left: 0;
		width: 100%;
		height: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid color-mix(in srgb, var(--scene-surface), #111 24%);
		background: var(--scene-surface);
		color: #101216;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 1.25rem;
		font-weight: 800;
		transform: rotateX(var(--scene-angle));
		transform-style: preserve-3d;
		z-index: var(--scene-layer);
	}

	.half-slot--first {
		top: 0;
		transform-origin: center bottom;
		border-radius: 0.75rem 0.75rem 0 0;
	}

	.half-slot--second {
		bottom: 0;
		transform-origin: center top;
		border-radius: 0 0 0.75rem 0.75rem;
	}

	.half-slot--active {
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--scene-surface), white 48%);
	}

	.half-slot--buffered {
		visibility: hidden;
	}
</style>