// Maths shared by the swipe and the spin.

export function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

// Blend from `from` to `to`: amount 0 gives `from` and 1 gives `to`. Slides tiers between tilts, picks
// per-flap values from the tuning bands, and blends each wobble in by looseness.
export function lerp(from, to, amount) {
	return from + (to - from) * amount;
}

// A spring moves on in steps no longer than this, so it stays stable however long a frame takes.
export const SPRING_STEP_MS = 4;

/*
	Move a spring (see GLOSSARY.md) on by `frameMs`:

		acceleration = −ω²·offset − 2ζ·ω·velocity

	ω (omega) is a full turn of 2π per `swingMs`, and ζ is `damping`. It's moved
	on in 4 ms steps, so it stays stable however long a frame takes.
*/
export function stepDampedSpring(offset, velocity, frameMs, swingMs, damping) {
	const omega = (2 * Math.PI) / swingMs;
	const steps = Math.ceil(frameMs / SPRING_STEP_MS);
	const stepMs = frameMs / steps;
	for (let index = 0; index < steps; index++) {
		const springPull = -(omega ** 2) * offset;
		const dampingPull = 2 * damping * omega * velocity;
		velocity += (springPull - dampingPull) * stepMs;
		offset += velocity * stepMs;
	}
	return { offset, velocity };
}

// Close enough to rest, in degrees and °/ms, that snapping the spring there doesn't show.
export function springAtRest(offset, velocity) {
	return Math.abs(offset) < 0.05 && Math.abs(velocity) < 0.002;
}
