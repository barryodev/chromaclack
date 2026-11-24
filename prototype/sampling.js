// Sampling the pointer over the release window (see GLOSSARY.md), shared by the swipe and the spin.

const RELEASE_WINDOW_MS = 80;

// The samples with `sample` added, dropping those before the window except the newest of them.
export function addToReleaseWindow(samples, sample) {
	const kept = [...samples, sample];
	const windowStart = sample.time - RELEASE_WINDOW_MS;
	while (kept.length > 2 && kept[1].time <= windowStart) kept.shift();
	return kept;
}

// Pointer velocity in px/ms across the window, so one short last move can't stand in for the whole swipe.
export function windowVelocity(samples) {
	const oldest = samples[0];
	const newest = samples.at(-1);
	const elapsedMs = newest.time - oldest.time;
	if (elapsedMs > 0) {
		return (newest.position - oldest.position) / elapsedMs;
	} else {
		return 0;
	}
}
