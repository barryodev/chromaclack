// Rolodex motion: looseness, falls, clacks and bounces (see Rolodex motion in GLOSSARY.md).

import { clamp } from './maths.js';
import { tickBounds } from './swipe.js';

// Looseness runs from 0, where a fast swipe ticks evenly, to 1, where the rolodex wobbles are at full
// strength. Speeds are flap speeds in °/ms, so they suit mouse and touch alike.
export const TIGHT_SPEED = 2; // About 11 ticks a second. At or above it, looseness is 0.
export const LOOSE_SPEED = 0.7; // About 4 ticks a second. At or below it, looseness is 1.
const LOOSENESS_STEEPNESS = 2; // Higher stays tight for longer as the flap slows, then loosens faster.
// In inertia a moving flap falls onto the stack under gravity once it passes its fall point, just past the
// top of its tick. Each flap picks its fall point and pull from these bands, so some balance longer and
// some drop harder.
export const MIN_FALL_POINT = 0.5; // Of the way through the tick, so 0.5 is straight up.
export const MAX_FALL_POINT = 0.6;
export const MIN_FALL_PULL = 0.006; // °/ms² at full looseness. From the top, 0.008 drops a flap in about 150 ms.
export const MAX_FALL_PULL = 0.012;
// A falling flap clacks onto the stack. The clacked flap rebounds towards the hinge on a spring, and the
// flaps beneath it are knocked back by these shares of the rebound, from the one just beneath it down.
export const CLACK_KICK = 0.4; // Spring speed in °/ms per °/ms of impact speed, at full looseness.
export const MIN_CLACK_STRENGTH = 0.7; // Each flap clacks at its own strength from this band.
export const MAX_CLACK_STRENGTH = 1.3;
export const KNOCK_BACK = [0.5, 0.3, 0.15];
export const BOUNCE_SWING_MS = 167; // One swing there and back, if nothing damped it.
export const BOUNCE_DAMPING = 0.35; // Damping ratio. Lower bounces for longer.
export const GRAB_FADE_MS = 60; // Picking a rebounding flap up fades its rebound out over about this long.

// A power curve, so the flap stays tight through most of a slowdown and loosens quickly near LOOSE_SPEED.
export function loosenessAt(speed) {
	const slowedBy = clamp((TIGHT_SPEED - speed) / (TIGHT_SPEED - LOOSE_SPEED), 0, 1);
	return slowedBy ** LOOSENESS_STEEPNESS;
}

// A repeatable 0–1 value for a flap, so it moves the same way each time. `salt` picks a value per effect.
export function flapRandom(flapIndex, salt) {
	const wave = Math.sin(flapIndex * 12.9898 + salt * 78.233) * 43758.5453;
	return wave - Math.floor(wave);
}

// Where the moving flap is drawn, as travel: ahead by how far gravity has pulled it since it started falling.
export function movingTravel(inertia, travel) {
	const fall = inertia?.fall;
	if (!fall || fall.low !== tickBounds(travel)[0]) return travel;
	const fallMs = inertia.elapsedMs - fall.fallStartMs;
	const fallen = travel + (fall.direction * fall.pull * fallMs ** 2) / 2;
	return fall.direction > 0 ? Math.min(fallen, fall.to) : Math.max(fallen, fall.to);
}

// How far `bounces` move a flap in `half` off its drawn angle, in degrees.
export function bounceOffset(bounces, half, flapIndex) {
	const awayFromHinge = half === 'end' ? 1 : -1;
	let offset = 0;
	for (const bounce of bounces) {
		if (bounce.half !== half) continue;
		// Flaps beneath the clacked one sit further from the hinge, so lower indices in the end half.
		const depth = (bounce.clackedIndex - flapIndex) * awayFromHinge;
		if (depth < 0) continue;
		const share = depth === 0 ? -bounce.rebound : KNOCK_BACK[Math.min(depth, KNOCK_BACK.length) - 1];
		offset += share * bounce.offset * awayFromHinge;
	}
	return offset;
}

// Fan easing at full looseness. Tiers in the half the moving flap leaves wait for it to clear, then flop
// forward.
export function easeLeavingTier(progress) {
	return progress ** 3;
}

// Smoothstep. Tiers in the half the moving flap lands in give way as it arrives.
export function easeLandingTier(progress) {
	return progress * progress * (3 - 2 * progress);
}
