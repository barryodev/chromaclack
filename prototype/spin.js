// Spin physics: rim speed, spin-down and detents (see Spinning in GLOSSARY.md). Angles are in degrees and
// times in milliseconds.

import { clamp } from './maths.js';

export const SPIN_DETENT_DEGREES = 90;
// A 3.4 px/ms flick along the rim, a hard one on a phone, spins down about 3½ turns in about 2.3 s.
const SPIN_SPEED_FRICTION = 0.001; // Per ms. Slows the spin-down in proportion to its speed.
const SPIN_STOPPING_FRICTION = 0.0002; // °/ms². A steady slowing on top, so the spin-down stops in time.
export const SEAT_SPEED = 0.15; // °/ms. Below this the spin-down hands over to the seat.
// A seat pulls the clacker into its detent on a damped spring, so it overshoots a little and bounces back.
export const SEAT_SWING_MS = 333; // One swing there and back, if nothing damped it.
export const SEAT_DAMPING = 0.34; // Damping ratio. A seat from 45° out overshoots about 14°.

/*
	The pointer's speed along the rim in px/ms, clockwise positive, across the
	release window. Each move between samples counts only its part going round
	the centre, so a flick straight out from the centre doesn't spin. Adding up
	the moves, rather than measuring straight from the oldest sample to the
	newest, keeps a fast flick curving round the rim from being cut short.
*/
export function rimSpeed(samples, centre) {
	const elapsedMs = samples.at(-1).time - samples[0].time;
	if (elapsedMs <= 0) {
		return 0;
	} else {
		let distance = 0;
		for (let index = 1; index < samples.length; index++) {
			distance += rimDistance(samples[index - 1], samples[index], centre);
		}
		return distance / elapsedMs;
	}
}

// How far the pointer went round `centre` between two samples, in px, clockwise positive.
export function rimDistance(from, to, centre) {
	const radiusX = (from.x + to.x) / 2 - centre.x;
	const radiusY = (from.y + to.y) / 2 - centre.y;
	const radius = Math.hypot(radiusX, radiusY);
	if (radius === 0) {
		return 0;
	} else {
		// The cross product of radius and move. Screen y points down, so positive is clockwise.
		return (radiusX * (to.y - from.y) - radiusY * (to.x - from.x)) / radius;
	}
}

/*
	A spin-down slows under spin friction. With k = SPIN_SPEED_FRICTION and
	s = SPIN_STOPPING_FRICTION, speed v follows dv/dt = −(k·v + s). Its exact
	solution, with b = s/k, the speed where both frictions slow the spin equally, is

		v(t) = (v₀ + b) · e^(−k·t) − b
		distance(t) = ((v₀ + b) · (1 − e^(−k·t)) − s·t) / k

	spinDownSpeed, spinDownDistance and spinDownTime all use it, so they must
	change together. Working out the angle from elapsed time, rather than
	stepping it frame by frame, keeps it the same at any frame rate.
*/
const SPIN_BALANCE_SPEED = SPIN_STOPPING_FRICTION / SPIN_SPEED_FRICTION;

export function spinDownSpeed(speed, ms) {
	return (speed + SPIN_BALANCE_SPEED) * Math.exp(-SPIN_SPEED_FRICTION * ms) - SPIN_BALANCE_SPEED;
}

export function spinDownDistance(speed, ms) {
	const slowed = (speed + SPIN_BALANCE_SPEED) * (1 - Math.exp(-SPIN_SPEED_FRICTION * ms));
	return (slowed - SPIN_STOPPING_FRICTION * ms) / SPIN_SPEED_FRICTION;
}

// How long a spin-down takes to slow from `fromSpeed` to `toSpeed`.
export function spinDownTime(fromSpeed, toSpeed) {
	return Math.log((fromSpeed + SPIN_BALANCE_SPEED) / (toSpeed + SPIN_BALANCE_SPEED)) / SPIN_SPEED_FRICTION;
}

// The detent nearest `angle`.
export function nearestDetent(angle) {
	return Math.round(angle / SPIN_DETENT_DEGREES) * SPIN_DETENT_DEGREES;
}

// The turn from angle `from` to angle `to` the shortest way round, so crossing the ±180° line doesn't jump a
// full turn.
export function shortestTurn(from, to) {
	let turn = to - from;
	if (turn > 180) turn -= 360;
	if (turn < -180) turn += 360;
	return turn;
}

/*
	The detent a seat pulls towards.

	`naturalStop` is the spin angle, in degrees, where the spin-down would stop from here. `range` is
	{ lowest, highest }, the spin angles the spin can reach (spinRange in pages.js gives it).

	Returns the detent nearest `naturalStop`, but never one past a limit. A natural stop past a limit gives
	that limit's detent.
*/
export function seatAim(naturalStop, range) {
	return clamp(nearestDetent(naturalStop), range.lowest, range.highest);
}

/*
	The spin's velocity once the finger lets go.

	`angle` is the spin angle, in degrees, at release. `velocity` is the spin release speed in °/ms,
	clockwise positive. `range` is { lowest, highest }, the spin angles the spin can reach (spinRange in
	pages.js gives it).

	Returns 0 if the drag was held at a limit and the finger was still heading past it, because the finger
	was holding the clacker there. Otherwise it returns `velocity` unchanged.
*/
export function heldReleaseVelocity(angle, velocity, range) {
	const heldAtLowest = (angle === range.lowest && velocity < 0);
	const heldAtHighest = (angle === range.highest && velocity > 0);
	if (heldAtLowest || heldAtHighest) {
		return 0;
	} else {
		return velocity;
	}
}
