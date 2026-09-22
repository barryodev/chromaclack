<script lang="ts">
	import { onDestroy } from 'svelte';
	import {
		completeDeckTurn,
		createDeckState,
		type DeckDirection,
		type DeckPageAssignment
	} from './deck-model';
	import { createGestureModel } from './gesture-model';
	import { createHalfFlapTurnFrame, type HalfFlapRenderPose } from './half-flap-turn-model';
	import { createSettledHalfSlotScene } from './half-slot-scene-model';
	import type { HalfSlotDiagnostics } from './half-slot-diagnostics';

	type PointerCoordinate = 'clientY';
	const POINTER_COORDINATE: PointerCoordinate = 'clientY';
	const DECK_CONFIG = {
		visiblePageCount: 5,
		upperReturnBufferPageCount: 1,
		lowerReturnBufferPageCount: 1,
		focusVisiblePageIndex: 2
	} as const;
	const sourcePoses = createSettledHalfSlotScene({
		halfSlotCount: 14,
		visibleWindowCount: 2,
		returnBufferCount: 1,
		focusedAngleDegrees: 40,
		innerNeighborAngleDegrees: 30,
		outerNeighborAngleDegrees: 6
	});
	const visibleHalfSlotCount = sourcePoses.filter((pose) => pose.visibility === 'visible').length;
	const activeSourcePoses = sourcePoses.filter((pose) => pose.isActive);
	const activeFirstPose = activeSourcePoses.find((pose) => pose.side === 'first');
	const activeSecondPose = activeSourcePoses.find((pose) => pose.side === 'second');
	if (!activeFirstPose || !activeSecondPose) {
		throw new RangeError('Half-slot scene must provide one active half for each side.');
	}

	let {
		debug = false,
		onDiagnostics
	}: {
		debug?: boolean;
		onDiagnostics?: (diagnostics: HalfSlotDiagnostics) => void;
	} = $props();

	let deckState = $state(createDeckState(DECK_CONFIG, undefined, createHiddenPages()));
	let gesture = $state(createGestureModel('vertical'));
	let isDragging = $state(false);
	let dragStartPosition = 0;
	let frameHandle: number | undefined;
	let lastFrameTime = 0;
	let lastTurnDirection = $state<DeckDirection | 'none'>('none');
	let completedTurnCount = $state(0);

	const rotation = $derived(gesture.rotation);
	const activeSide = $derived<'first' | 'second' | 'none'>(
		rotation > 0 ? 'first' : rotation < 0 ? 'second' : 'none'
	);
	const assignments = $derived([
		...deckState.upperReturnBuffer,
		...deckState.visibleWindow,
		...deckState.lowerReturnBuffer
	]);
	const renderDirection = $derived<DeckDirection>(rotation < 0 ? 'negative' : 'positive');
	const renderPoses = $derived<readonly HalfFlapRenderPose[]>(
		createHalfFlapTurnFrame(sourcePoses, assignments, renderDirection, Math.abs(rotation) / 180).poses
	);
	const activeRenderPoses = $derived(renderPoses.filter((pose) => pose.isActive));
	const activeRenderFirst = $derived(activeRenderPoses.find((pose) => pose.side === 'first'));
	const activeRenderSecond = $derived(activeRenderPoses.find((pose) => pose.side === 'second'));

	$effect(() => {
		if (!onDiagnostics || !activeRenderFirst || !activeRenderSecond) return;
		onDiagnostics({
			motionState: isDragging || gesture.motionState === 'inertia' ? 'dragging' : 'settled',
			rotationDegrees: rotation,
			activeSide,
			activeHalfSlotIds: [
				activeRenderFirst.physicalHalfSlotId,
				activeRenderSecond.physicalHalfSlotId
			],
			activeFaceIndex: activeRenderFirst.logicalFaceIndex,
			visibleHalfSlotCount,
			focusedPose: [activeFirstPose.rotationDegrees, activeSecondPose.rotationDegrees],
			deckDirection: deckState.direction,
			visibleFaceIds: deckState.visibleWindow.map((assignment) => assignment.page.faceId),
			returnBufferFaceIds: [
				...deckState.upperReturnBuffer.map((assignment) => assignment.page.faceId),
				...deckState.lowerReturnBuffer.map((assignment) => assignment.page.faceId)
			],
			hiddenBacksideQueueCount: deckState.hiddenBacksideQueue.length,
			lastTurnDirection,
			completedTurnCount
		});
	});

	function createHiddenPages() {
		return Array.from({ length: 18 }, (_, index) => ({
			id: `hidden-page-${index + 1}`,
			faceId: `face-hidden-${index + 1}`
		}));
	}

	function pointerPosition(event: MouseEvent | TouchEvent) {
		if ('touches' in event) {
			const touch = event.touches[0] ?? event.changedTouches[0];
			return touch?.[POINTER_COORDINATE] ?? dragStartPosition;
		}
		return event[POINTER_COORDINATE];
	}

	function startDrag(event: MouseEvent | TouchEvent) {
		stopAnimation();
		isDragging = true;
		dragStartPosition = pointerPosition(event);
		gesture = gesture.beginPointerDown(dragStartPosition, performance.now());
		logDebug('pointer-down', { position: dragStartPosition });
		if (!('touches' in event)) {
			window.addEventListener('mousemove', drag);
			window.addEventListener('mouseup', endDrag);
		}
	}

	function drag(event: MouseEvent | TouchEvent) {
		if (!isDragging) return;
		if ('touches' in event) event.preventDefault();
		gesture = gesture.dragTo(pointerPosition(event), performance.now());
		logDebug('drag-sample', { rotation: Number(rotation.toFixed(1)) });
	}

	function endDrag() {
		if (!isDragging) return;
		isDragging = false;
		const evaluated = gesture.release(performance.now()).model.evaluateRelease();
		gesture = evaluated.model;
		processEvents(evaluated.events);
		window.removeEventListener('mousemove', drag);
		window.removeEventListener('mouseup', endDrag);
		logDebug('release', { rotation: Number(rotation.toFixed(1)), state: gesture.motionState });
		if (gesture.motionState === 'inertia') startAnimation();
	}

	function startAnimation() {
		if (frameHandle !== undefined) return;
		lastFrameTime = performance.now();
		frameHandle = requestAnimationFrame(animationFrame);
	}

	function animationFrame(now: number) {
		frameHandle = undefined;
		const transition = gesture.tick(Math.min(now - lastFrameTime, 64));
		lastFrameTime = now;
		gesture = transition.model;
		processEvents(transition.events);
		if (gesture.motionState === 'inertia') startAnimation();
	}

	function processEvents(events: readonly { type: string; direction?: DeckDirection }[]) {
		for (const event of events) {
			if (event.type === 'turn-completed' && event.direction) {
				const transition = completeDeckTurn(deckState, event.direction);
				if (transition.status === 'advanced') {
					deckState = transition.state;
					lastTurnDirection = event.direction;
					completedTurnCount += 1;
					logDebug('turn-completed', { direction: event.direction, completedTurnCount });
				}
			}
			if (event.type === 'settled') logDebug('settled', { rotation: 0 });
		}
	}

	function stopAnimation() {
		if (frameHandle !== undefined) cancelAnimationFrame(frameHandle);
		frameHandle = undefined;
	}

	function nonPassiveTouchMove(node: HTMLElement, handler: (event: TouchEvent) => void) {
		node.addEventListener('touchmove', handler, { passive: false });
		return { destroy: () => node.removeEventListener('touchmove', handler) };
	}

	function surfaceFor(pose: HalfFlapRenderPose) {
		if (pose.visibility === 'buffered') return '#ffffff';
		const hash = [...pose.faceId].reduce((value, character) => value + character.charCodeAt(0), 0);
		return ['#2563eb', '#d946ef', '#ef4444', '#facc15', '#22d3ee', '#fb923c'][hash % 6];
	}

	function logDebug(event: string, values: Record<string, number | string>) {
		if (debug) console.info(`[Half-slot viewport] ${event}`, values);
	}

	onDestroy(() => {
		stopAnimation();
		window.removeEventListener('mousemove', drag);
		window.removeEventListener('mouseup', endDrag);
	});
</script>

<button
	type="button"
	class="half-slot-viewport"
	data-motion-state={isDragging || gesture.motionState === 'inertia' ? 'dragging' : 'settled'}
	onmousedown={startDrag}
	ontouchstart={startDrag}
	use:nonPassiveTouchMove={drag}
	ontouchend={endDrag}
	ontouchcancel={endDrag}
	aria-label="Swipe up or down"
>
	{#each renderPoses as pose (pose.physicalHalfSlotId)}
		<div
			class="half-slot"
			class:half-slot--first={pose.side === 'first'}
			class:half-slot--second={pose.side === 'second'}
			class:half-slot--active={pose.isActive}
			class:half-slot--buffered={pose.visibility === 'buffered'}
			style={`--scene-angle: ${pose.rotationDegrees}deg; --scene-layer: ${pose.layer}; --scene-surface: ${surfaceFor(pose)}`}
			data-half-slot={pose.physicalHalfSlotId}
			data-logical-face-index={pose.logicalFaceIndex}
			data-face-id={pose.faceId}
		>
			<span>{pose.faceId.replace(/^face-/, '')}</span>
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

	.half-slot-viewport:active { cursor: grabbing; }

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
		font-size: 1.1rem;
		font-weight: 800;
		transform: rotateX(var(--scene-angle));
		transform-style: preserve-3d;
		z-index: var(--scene-layer);
		transition: background-color 90ms linear;
	}

	.half-slot--first { top: 0; transform-origin: center bottom; border-radius: 0.75rem 0.75rem 0 0; }
	.half-slot--second { bottom: 0; transform-origin: center top; border-radius: 0 0 0.75rem 0.75rem; }
	.half-slot--active { box-shadow: 0 0 0 2px color-mix(in srgb, var(--scene-surface), white 48%); }
	.half-slot--buffered { visibility: hidden; }
</style>
