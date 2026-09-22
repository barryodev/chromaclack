<script lang="ts">
	import { page } from '$app/state';
	import HalfSlotDiagnosticsPanel from '$lib/HalfSlotDiagnosticsPanel.svelte';
	import type { HalfSlotDiagnostics } from '$lib/half-slot-diagnostics';
	import HalfSlotViewport from '$lib/HalfSlotViewport.svelte';

	const debug = $derived(
		page.url.searchParams.has('debug') && page.url.searchParams.get('debug') !== 'false'
	);
	let diagnostics = $state<HalfSlotDiagnostics | undefined>();

	function updateDiagnostics(nextDiagnostics: HalfSlotDiagnostics) {
		diagnostics = nextDiagnostics;
	}
</script>

<svelte:head>
	<title>Half-Slot Lab</title>
</svelte:head>

<HalfSlotViewport {debug} onDiagnostics={debug ? updateDiagnostics : undefined} />

{#if debug}
	<HalfSlotDiagnosticsPanel {diagnostics} />
{/if}
