// Maths shared by the swipe and the spin.

export function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

// Blend from `from` to `to`: amount 0 gives `from` and 1 gives `to`. Slides tiers between tilts, picks
// per-flap values from the tuning bands, and blends each wobble in by looseness.
export function lerp(from, to, amount) {
	return from + (to - from) * amount;
}

const SPRING_STEP_MS = 4;

/*
	Cut a frame into equal steps for a spring to move on by.

	`frameMs` is how long the frame took, in milliseconds.

	Returns { steps, stepMs }: how many steps, and how long each one is in milliseconds. No step is longer
	than 4 ms, so a spring stays stable however long the frame. A frame of 0 ms gives no steps.
*/
export function springSteps(frameMs) {
	const steps = Math.ceil(frameMs / SPRING_STEP_MS);
	if (steps === 0) {
		return { steps, stepMs: 0 };
	} else {
		return { steps, stepMs: frameMs / steps };
	}
}

/*
	Move a spring (see GLOSSARY.md) on by `frameMs`:

		acceleration = −ω²·offset − 2ζ·ω·velocity

	ω (omega) is a full turn of 2π per `swingMs`, and ζ is `damping`. It's moved
	on in 4 ms steps, so it stays stable however long a frame takes.
*/
export function stepDampedSpring(offset, velocity, frameMs, swingMs, damping) {
	const omega = (2 * Math.PI) / swingMs;
	const { steps, stepMs } = springSteps(frameMs);
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
