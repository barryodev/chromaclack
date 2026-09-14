<script lang="ts">
	type Mode = 'vertical' | 'horizontal' | 'spin';

	let { mode = 'vertical' }: { mode?: Mode } = $props();
	let flipped = $state(false);

	function toggle() {
		flipped = !flipped;
	}
</script>

<section class="stage">
	{#if mode === 'vertical'}
		<button
			type="button"
			class="clacker clacker--vertical"
			onclick={toggle}
			aria-pressed={flipped}
			aria-label="Flip"
		>
			<span class="segment segment--top"></span>
			<span class="segment segment--bottom"></span>
			<span class="flap flap--vertical" class:flipped></span>
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

	.clacker--vertical .segment {
		left: 0;
		width: 100%;
		height: 50%;
	}

	.segment--top {
		top: 0;
		border-bottom: none;
		border-radius: 0.75rem 0.75rem 0 0;
	}

	.segment--bottom {
		bottom: 0;
		border-top: none;
		border-radius: 0 0 0.75rem 0.75rem;
	}

	.clacker--horizontal .segment {
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

	/* Moving piece: same transition and accent color, hinge axis differs per orientation. */
	.flap {
		position: absolute;
		background: var(--accent);
		/* Fast fall + slight overshoot/rebound past the stop, rather than a
		   smooth ease-out glide, to read as a mechanical snap. */
		transition: transform 0.55s cubic-bezier(0.65, -0.55, 0.35, 1.5);
	}

	.flap--vertical {
		top: 0;
		left: 0;
		width: 100%;
		height: 50%;
		border-radius: 0.75rem 0.75rem 0 0;
		transform-origin: bottom center;
		transform: rotateX(0deg);
	}

	.flap--vertical.flipped {
		transform: rotateX(-180deg);
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
</style>
