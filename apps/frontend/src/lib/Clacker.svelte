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
		<button type="button" class="clacker" onclick={toggle} aria-pressed={flipped} aria-label="Flip">
			<span class="half half--top"></span>
			<span class="half half--bottom"></span>
			<span class="flap" class:flipped></span>
		</button>
	{:else if mode === 'horizontal'}
		<button
			type="button"
			class="horizontal-clacker"
			class:flipped
			onclick={toggle}
			aria-pressed={flipped}
			aria-label="Flip left or right"
		>
			<span class="horizontal-half horizontal-half--left"></span>
			<span class="horizontal-half horizontal-half--right"></span>
			<span class="horizontal-flap"></span>
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

	.horizontal-clacker {
		position: relative;
		width: 14rem;
		height: 14rem;
		padding: 0;
		background: none;
		border: none;
		cursor: pointer;
		perspective: 24rem;
	}

	.horizontal-half,
	.horizontal-flap {
		position: absolute;
		top: 0;
		width: 50%;
		height: 100%;
		background: var(--field);
		border: 1px solid var(--border);
	}

	.horizontal-half--left {
		left: 0;
		border-radius: 0.75rem 0 0 0.75rem;
	}

	.horizontal-half--right {
		right: 0;
		border-radius: 0 0.75rem 0.75rem 0;
	}

	.horizontal-flap {
		left: 0;
		background: var(--accent);
		border-radius: 0.75rem 0 0 0.75rem;
		transform-origin: center right;
		transform: rotateY(0deg);
		transition: transform 0.55s cubic-bezier(0.65, -0.55, 0.35, 1.5);
	}

	.horizontal-clacker.flipped .horizontal-flap {
		transform: rotateY(180deg);
	}

	@media (max-width: 28rem) {
		.horizontal-clacker {
			width: min(14rem, calc(100vw - 2rem));
			height: min(14rem, calc(100vw - 2rem));
		}
	}

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

	.half {
		position: absolute;
		left: 0;
		width: 100%;
		height: 50%;
		background: var(--field);
		border: 1px solid var(--border);
		overflow: hidden;
	}

	.half--top {
		top: 0;
		border-bottom: none;
		border-radius: 0.75rem 0.75rem 0 0;
	}

	.half--bottom {
		bottom: 0;
		border-top: none;
		border-radius: 0 0 0.75rem 0.75rem;
	}

	.flap {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 50%;
		background: var(--accent);
		border-radius: 0.75rem 0.75rem 0 0;
		transform-origin: bottom center;
		transform: rotateX(0deg);
		/* Fast fall + slight overshoot/rebound past the stop, rather than a
		   smooth ease-out glide, to read as a mechanical snap. */
		transition: transform 0.55s cubic-bezier(0.65, -0.55, 0.35, 1.5);
	}

	.flap.flipped {
		transform: rotateX(-180deg);
	}

</style>
