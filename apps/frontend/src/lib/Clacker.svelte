<script lang="ts">
	let flipped = $state(false);

	function toggle() {
		flipped = !flipped;
	}
</script>

<section class="stage">
	<button type="button" class="clacker" onclick={toggle} aria-pressed={flipped} aria-label="Flip">
		<span class="half half--top"></span>
		<span class="half half--bottom"></span>
		<span class="flap" class:flipped></span>
	</button>
</section>

<style>
	.stage {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 3rem;
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

	/* Rests flush over the top half; a click flips it down to reveal the
	   bottom half, like a physical split-flap card falling forward. */
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
		transition: transform 0.6s ease;
	}

	.flap.flipped {
		transform: rotateX(-180deg);
	}
</style>
