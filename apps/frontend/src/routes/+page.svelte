<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ApiError,
		activeTransport,
		greet,
		TRANSPORT_LABEL,
		type GreetResult,
		type Transport
	} from '@repo/services';

	let name = $state('');
	let result = $state<GreetResult | null>(null);
	let error = $state<string | null>(null);
	let pending = $state(false);

	// Resolved after mount: the Tauri globals are injected into the webview,
	// so the check is only meaningful on the client.
	let detected = $state<Transport | null>(null);
	onMount(() => {
		detected = activeTransport();
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		pending = true;
		error = null;
		try {
			result = await greet(name);
		} catch (cause) {
			result = null;
			error = cause instanceof ApiError ? cause.message : 'Unexpected error';
		} finally {
			pending = false;
		}
	}
</script>

<svelte:head>
	<title>Greeter</title>
</svelte:head>

<section class="card">
	<header>
		<h1>Greeter</h1>
		<p class="sub">
			One SvelteKit UI, two backends, one shared Rust function.
			{#if detected}
				This build is talking to <strong>{TRANSPORT_LABEL[detected]}</strong>.
			{/if}
		</p>
	</header>

	<form onsubmit={submit}>
		<label for="name">Your name</label>
		<div class="row">
			<input
				id="name"
				type="text"
				bind:value={name}
				placeholder="Barry"
				autocomplete="off"
				disabled={pending}
			/>
			<button type="submit" disabled={pending}>
				{pending ? 'Sending…' : 'Submit'}
			</button>
		</div>
	</form>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{:else if result}
		<output>
			<span class="message">{result.message}</span>
			<span class="badge" data-transport={result.transport}>
				{TRANSPORT_LABEL[result.transport]}
			</span>
			<span class="runtime">runtime: {result.runtime}</span>
		</output>
	{/if}
</section>

<style>
	.card {
		width: min(34rem, 100%);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	h1 {
		margin: 0 0 0.25rem;
		font-size: 1.75rem;
		letter-spacing: -0.02em;
	}

	.sub {
		margin: 0;
		color: var(--muted);
		font-size: 0.9rem;
		line-height: 1.5;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	input {
		flex: 1 1 12rem;
		min-width: 0;
		padding: 0.6rem 0.75rem;
		font: inherit;
		color: inherit;
		background: var(--field);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
	}

	input:focus-visible,
	button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	button {
		padding: 0.6rem 1.1rem;
		font: inherit;
		font-weight: 600;
		color: var(--on-accent);
		background: var(--accent);
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
	}

	button:disabled,
	input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	output {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
		padding: 1rem;
		background: var(--field);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
	}

	.message {
		font-size: 1.1rem;
		font-weight: 600;
	}

	.badge {
		padding: 0.15rem 0.55rem;
		font-size: 0.75rem;
		font-weight: 700;
		border-radius: 999px;
		white-space: nowrap;
	}

	.badge[data-transport='tauri-ipc'] {
		color: #0b3c2d;
		background: #7ee0b8;
	}

	.badge[data-transport='vercel-fetch'] {
		color: #2b1a00;
		background: #ffb866;
	}

	.runtime {
		font-size: 0.75rem;
		color: var(--muted);
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.error {
		margin: 0;
		padding: 0.75rem 1rem;
		color: var(--danger-fg);
		background: var(--danger-bg);
		border-radius: 0.5rem;
		font-size: 0.9rem;
	}
</style>
