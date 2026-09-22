<script lang="ts">
	import { onDestroy } from 'svelte';
	import {
		createSettledHalfSlotScene,
		type HalfSlotPose
	} from './half-slot-scene-model';

	type PointerCoordinate = 'clientY';

	const DRAG_SENSITIVITY = 0.6;
	const MAX_ROTATION_DEGREES = 180;
	const POINTER_COORDINATE: PointerCoordinate = 'clientY';
	const poses = createSettledHalfSlotScene();
	const DIAGNOSTIC_SURFACES: Record<number, string> = {
		[-2]: '#2563eb',
		[-1]: '#d946ef',
		0: '#ef4444',
		1: '#facc15',
		2: '#22d3ee'
	};

	let rotation = $state(0);
	let isDragging = $state(false);
	let dragStartPosition = 0;

	function poseStyle(pose: HalfSlotPose) {
		const activeRotation =
			pose.isActive && pose.side === 'first'
				? Math.max(0, rotation)
				: pose.isActive && pose.side === 'second'
					? Math.min(0, rotation)
					: 0;
		return `--scene-angle: ${pose.rotationDegrees - activeRotation}deg; --scene-layer: ${pose.layer}; --scene-surface: ${surfaceFor(pose)}`;
	}

	function surfaceFor(pose: HalfSlotPose) {
		if (pose.visibility === 'buffered') return '#ffffff';
		return DIAGNOSTIC_SURFACES[pose.logicalFaceIndex] ?? '#ffffff';
	}

	function pointerPosition(event: MouseEvent | TouchEvent) {
		if ('touches' in event) {
			const touch = event.touches[0] ?? event.changedTouches[0];
			return touch?.[POINTER_COORDINATE] ?? dragStartPosition;
		}
		return event[POINTER_COORDINATE];
	}

	function startDrag(event: MouseEvent | TouchEvent) {
		isDragging = true;
		dragStartPosition = pointerPosition(event);
		if (!('touches' in event)) {
			window.addEventListener('mousemove', drag);
			window.addEventListener('mouseup', endDrag);
		}
	}

	function drag(event: MouseEvent | TouchEvent) {
		if (!isDragging) return;
		if ('touches' in event) event.preventDefault();
		rotation = clampRotation((pointerPosition(event) - dragStartPosition) * DRAG_SENSITIVITY);
	}

	function endDrag() {
		isDragging = false;
		rotation = 0;
		window.removeEventListener('mousemove', drag);
		window.removeEventListener('mouseup', endDrag);
	}

	function nonPassiveTouchMove(node: HTMLElement, handler: (event: TouchEvent) => void) {
		node.addEventListener('touchmove', handler, { passive: false });
		return {
			destroy() {
				node.removeEventListener('touchmove', handler);
			}
		};
	}

	function clampRotation(value: number) {
		return Math.max(-MAX_ROTATION_DEGREES, Math.min(MAX_ROTATION_DEGREES, value));
	}

	onDestroy(() => {
		window.removeEventListener('mousemove', drag);
		window.removeEventListener('mouseup', endDrag);
	});
</script>

<button
	type="button"
	class="half-slot-viewport"
	data-motion-state={isDragging ? 'dragging' : 'settled'}
	style={`--rotation: ${rotation}deg`}
	onmousedown={startDrag}
	ontouchstart={startDrag}
	use:nonPassiveTouchMove={drag}
	ontouchend={endDrag}
	ontouchcancel={endDrag}
	aria-label="Swipe up or down"
>
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
</button>

<style>
	.half-slot-viewport {
		position: relative;
		width: 14rem;
		height: 14rem;
		padding: 0;
		border: 0;
		background: none;
		cursor: grab;
		perspective: 28rem;
		transform-style: preserve-3d;
		overflow: visible;
	}

	.half-slot-viewport:active {
		cursor: grabbing;
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