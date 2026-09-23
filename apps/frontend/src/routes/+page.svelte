<script lang="ts">
	import { page } from '$app/state';
	import Clacker from '$lib/Clacker.svelte';

	type Mode = 'vertical' | 'horizontal' | 'spin';

	let activeMode = $state<Mode>('vertical');
	const debug = $derived(
		page.url.searchParams.has('debug') && page.url.searchParams.get('debug') !== 'false'
	);

	const modes: { id: Mode; label: string }[] = [
		{ id: 'vertical', label: 'Up / Down' },
		{ id: 'horizontal', label: 'Left / Right' },
		{ id: 'spin', label: 'Hold & Spin' }
	];
</script>

<svelte:head>
	<title>ChromaClack</title>
</svelte:head>

<section class="workspace" aria-label="Movement modes">
	<nav class="tabs" aria-label="Select movement mode">
		{#each modes as mode}
			<button
				type="button"
				class:active={activeMode === mode.id}
				aria-selected={activeMode === mode.id}
				role="tab"
				onclick={() => (activeMode = mode.id)}
			>
				{mode.label}
			</button>
		{/each}
	</nav>

	<Clacker mode={activeMode} {debug} config={{ flapCount: 6 }} />
</section>

<style>
	.workspace {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.tabs {
		display: flex;
		gap: 0.25rem;
		padding: 0.25rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--field);
	}

	.tabs button {
		padding: 0.55rem 0.8rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.tabs button.active {
		background: var(--accent);
		color: var(--on-accent);
	}

	.tabs button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	@media (max-width: 28rem) {
		.tabs button {
			padding-inline: 0.55rem;
			font-size: 0.72rem;
		}
	}
</style>
