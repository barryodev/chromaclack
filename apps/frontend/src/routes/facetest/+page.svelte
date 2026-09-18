<script lang="ts">
	type Variant = {
		id: string;
		name: string;
	};

	const angles = [0, 45, 89, 91, 125, 155, 180];
	const variants: Variant[] = [
		{ id: 'none', name: 'Back Plane Only' },
		{ id: 'rotate-z', name: 'Back Print Rotate Z' },
		{ id: 'rotate-x', name: 'Back Print Rotate X' },
		{ id: 'scale-y', name: 'Back Print Scale Y' }
	];

	let angle = $state(125);
</script>

<svelte:head>
	<title>Face Test - ChromaClack</title>
</svelte:head>

<main class="face-lab" style={`--angle: ${-angle}deg`}>
	<header class="lab-header">
		<h1>Face Test</h1>
		<div class="angle-controls" aria-label="Set panel angle">
			{#each angles as option}
				<button type="button" class:active={angle === option} onclick={() => (angle = option)}>
					{option} deg
				</button>
			{/each}
		</div>
	</header>

	<section class="variants" aria-label="Back face orientation variants">
		{#each variants as variant}
			<article class={`variant variant--${variant.id}`} data-variant={variant.id}>
				<header>
					<h2>{variant.name}</h2>
					<span>{angle} deg</span>
				</header>

				<div class="scene">
					<div class="panel">
						<div class="face face--front">
							<span>FRONT</span>
						</div>
						<div class="face face--back">
							<span>BACK</span>
						</div>
					</div>
				</div>
			</article>
		{/each}
	</section>
</main>

<style>
	.face-lab {
		min-height: 100vh;
		padding: 2rem;
		background:
			linear-gradient(135deg, rgba(101, 240, 180, 0.1), transparent 34rem),
			linear-gradient(315deg, rgba(255, 126, 67, 0.12), transparent 30rem),
			#0e1114;
		color: #f8fafc;
	}

	.lab-header {
		display: grid;
		gap: 1rem;
		max-width: 72rem;
		margin: 0 auto 2rem;
	}

	h1,
	h2 {
		margin: 0;
	}

	h1 {
		font-size: clamp(2rem, 6vw, 4.5rem);
		line-height: 0.95;
	}

	.angle-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.angle-controls button {
		padding: 0.55rem 0.7rem;
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.06);
		color: #cbd5e1;
		font: inherit;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.angle-controls button.active {
		border-color: #ff7e43;
		background: #ff7e43;
		color: #111418;
	}

	.variants {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: 1rem;
		max-width: 72rem;
		margin: 0 auto;
	}

	.variant {
		display: grid;
		gap: 1rem;
		padding: 1rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0.75rem;
		background: rgba(255, 255, 255, 0.06);
		box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.25);
	}

	.variant header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.variant h2 {
		font-size: 0.95rem;
	}

	.variant header span {
		color: #94a3b8;
		font-size: 0.78rem;
	}

	.scene {
		position: relative;
		display: grid;
		place-items: center;
		min-height: 14rem;
		perspective: 28rem;
		transform-style: preserve-3d;
	}

	.panel {
		position: relative;
		width: 12rem;
		height: 6rem;
		transform: rotateX(var(--angle));
		transform-origin: center bottom;
		transform-style: preserve-3d;
	}

	.face {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		border: 1px solid rgba(17, 20, 24, 0.8);
		border-radius: 0.65rem 0.65rem 0 0;
		background: #fff;
		color: #111418;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 1.35rem;
		font-weight: 800;
		backface-visibility: hidden;
	}

	.face--front {
		box-shadow: inset 0 -0.25rem 0 rgba(0, 0, 0, 0.05);
	}

	.face--back {
		background: #dffcec;
		transform: rotateX(180deg);
	}

	.variant--rotate-z .face--back span {
		transform: rotate(180deg);
	}

	.variant--rotate-x .face--back span {
		transform: rotateX(180deg);
	}

	.variant--scale-y .face--back span {
		transform: scaleY(-1);
	}
</style>