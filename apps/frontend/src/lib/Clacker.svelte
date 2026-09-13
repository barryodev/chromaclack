<section class="stage">
	<div class="clacker">
		<div class="half half--top"></div>
		<div class="half half--bottom"></div>
		<div class="flap"></div>
	</div>
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
		width: 12rem;
		height: 16rem;
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

	/* Static tilt only, to prove the 3D depth reads correctly before any
	   click-driven transition or letter/color content is added. */
	.flap {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 50%;
		background: var(--accent);
		border-radius: 0.75rem 0.75rem 0 0;
		transform-origin: bottom center;
		transform: rotateX(-55deg);
	}
</style>
