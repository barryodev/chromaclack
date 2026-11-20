// Swipe physics: ticks, landings and inertia (see Swiping in GLOSSARY.md). Angles are in degrees and times
// in milliseconds.

import { clamp } from './maths.js';

export const TICK_DEGREES = 180;
// How far a drag turns the flap, and how fast a release sets it coasting. Kept apart so drag feel can change
// without re-tuning the frictions below, which were tuned with the coast at 0.6.
export const DRAG_DEGREES_PER_PIXEL = 2; // A phone's width only fits a few ticks of finger drag at less.
export const MOUSE_DRAG_DEGREES_PER_PIXEL = 0.6; // A small hand movement drags a mouse a long way.
export const COAST_DEGREES_PER_PIXEL = 0.6;
// A 3.4 px/ms flick, a hard one on a phone, coasts about 9 ticks in about 1.9 s.
const AIR_RESISTANCE = 0.00025; // Per degree. Slows the coast in proportion to its speed².
const STOPPING_FRICTION = 0.0008; // °/ms². A steady slowing on top, so the coast stops in finite time.
// A small mouse flick moves the pointer fast, so mouse coasts get this much more friction than touch or pen.
export const MOUSE_FRICTION = 1.7;
// Inertia fits its friction to end on a landing, within this band around the input's normal friction.
export const MIN_FRICTION_FIT = 0.5;
export const MAX_FRICTION_FIT = 2;
const TOPPLE_ACCELERATION = 0.0013; // °/ms². A 90° topple from a standstill takes about 370 ms.
export const MAX_TICKS_PER_SWIPE = 30; // A safety net only. Friction keeps real flicks well short of it.

// Whole ticks completed by `travel`, signed like travel.
export function completedTicks(travel) {
	return Math.trunc(travel / TICK_DEGREES);
}

// Signed hinge angle of the moving flap within the tick in progress, from −180 to 180.
export function hingeAngle(travel) {
	return travel - completedTicks(travel) * TICK_DEGREES;
}

// The lowest and highest travel of the tick in progress.
export function tickBounds(travel) {
	const base = completedTicks(travel) * TICK_DEGREES;
	return hingeAngle(travel) >= 0 ? [base, base + TICK_DEGREES] : [base - TICK_DEGREES, base];
}

/*
	The angle a flap is drawn at, in degrees. Rest tilt is applied only when
	drawing, and the swipe maths stays in hinge-angle space. A hinge angle of
	0–180 is drawn from restTilt to 180 − restTilt, so no flap is ever drawn
	flat. Resting flaps lean towards the viewer like a book opened a little short
	of flat, fanned out by tier.
*/
export function drawnAngle(angle, restTilt) {
	return restTilt + (angle * (TICK_DEGREES - 2 * restTilt)) / TICK_DEGREES;
}

// Every travel a swipe can settle on: the start, and each whole tick either way up to MAX_TICKS_PER_SWIPE.
export const SWIPE_LANDINGS = Array.from(
	{ length: 2 * MAX_TICKS_PER_SWIPE + 1 },
	(_, index) => (index - MAX_TICKS_PER_SWIPE) * TICK_DEGREES
);

/*
	Inertia is a coast if friction can carry the flap to its landing, and a
	topple if it can't.

	The coast starts at the release speed and slows under two frictions. Air
	resistance grows with speed², so a hard flick sheds speed fast and its
	tail stays short. Stopping friction is a steady slowing on top, so the
	flap stops in finite time instead of slowing forever.

	With c = AIR_RESISTANCE and s = STOPPING_FRICTION, both multiplied by the
	fitted friction scale, speed v follows dv/dt = −(c·v² + s). Its exact
	solution, with θ₀ = atan(v₀·√(c/s)) and ω = √(c·s), is

		v(t) = √(s/c) · tan(θ₀ − ω·t)
		distance(t) = ln(cos(θ₀ − ω·t) / cos θ₀) / c

	and the flap stops when θ₀ − ω·t reaches 0. Scaling both frictions by one
	factor divides the stopping distance and time by it, which is how
	planInertia fits a coast to its landing.

	stoppingTime, stoppingDistance and coastMotion all use this solution, so
	they must change together. Working out the position from elapsed time,
	rather than stepping it frame by frame, means inertia lands exactly where
	it was planned.
*/
// The scaled frictions and the values the exact solution above needs, for a coast starting at `speed`.
function coastFormulaInputs(speed, frictionScale) {
	const airResistance = AIR_RESISTANCE * frictionScale;
	const stoppingFriction = STOPPING_FRICTION * frictionScale;
	// √(s/c), the speed where both frictions slow the flap equally.
	const balanceSpeed = Math.sqrt(stoppingFriction / airResistance);
	return {
		airResistance,
		balanceSpeed,
		startPhase: Math.atan(speed / balanceSpeed),
		phaseRate: Math.sqrt(airResistance * stoppingFriction)
	};
}

export function stoppingTime(speed, frictionScale) {
	const { startPhase, phaseRate } = coastFormulaInputs(speed, frictionScale);
	return startPhase / phaseRate;
}

export function stoppingDistance(speed, frictionScale) {
	const { airResistance, startPhase } = coastFormulaInputs(speed, frictionScale);
	return -Math.log(Math.cos(startPhase)) / airResistance;
}

export function nearestLanding(position, landings) {
	return landings.reduce((best, landing) =>
		Math.abs(landing - position) < Math.abs(best - position) ? landing : best
	);
}

/*
	Plan inertia from `position`, moving at `velocity`, to end on one of
	`landings`: positions inertia can stop on, the whole-tick travels.
	`normalFriction` scales both frictions for the input. It aims for the landing nearest the natural stop and fits
	friction so the coast stops there, within the
	MIN_FRICTION_FIT–MAX_FRICTION_FIT band around `normalFriction`. If the
	clamped coast can't get there, the flap topples there instead.
*/
export function planInertia(position, velocity, landings, normalFriction) {
	const speed = Math.abs(velocity);
	const direction = Math.sign(velocity);
	const naturalDistance = stoppingDistance(speed, normalFriction);
	const target = nearestLanding(position + direction * naturalDistance, landings);
	const distance = (target - position) * direction;
	// stoppingDistance is inversely proportional to the friction scale, so this lands exactly on distance.
	const fitted = distance > 0 ? (normalFriction * naturalDistance) / distance : Infinity;
	const frictionScale = clamp(fitted, MIN_FRICTION_FIT * normalFriction, MAX_FRICTION_FIT * normalFriction);
	// With no more than the fitted friction the coast gets to the target, so it ends there.
	if (distance > 0 && frictionScale <= fitted) {
		return { target, coasts: true, frictionScale, durationMs: stoppingTime(speed, frictionScale) };
	}
	return { target, coasts: false, frictionScale: 0, durationMs: toppleTime(target - position, velocity) };
}

// Where the coast towards `to` has carried the flap `ms` after release. It lands once it stops or reaches `to`.
export function coastMotion(inertia, to, ms) {
	const direction = Math.sign(inertia.velocity);
	const { airResistance, balanceSpeed, startPhase, phaseRate } = coastFormulaInputs(
		Math.abs(inertia.velocity),
		inertia.frictionScale
	);
	const phase = startPhase - phaseRate * Math.min(ms, inertia.durationMs);
	const coasted = Math.log(Math.cos(phase) / Math.cos(startPhase)) / airResistance;
	if (ms >= inertia.durationMs || coasted >= Math.abs(to - inertia.start)) {
		return { travel: to, velocity: 0, landed: true };
	}
	return {
		travel: inertia.start + direction * coasted,
		velocity: direction * balanceSpeed * Math.tan(phase),
		landed: false
	};
}

/*
	A topple pulls the flap steadily towards its landing, like gravity. It
	starts at the release velocity, so a flap moving towards its landing speeds
	up from there, and one moving away slows, turns and falls back. toppleTime
	and toppleMotion must change together.
*/
export function toppleTime(gap, velocity) {
	const speedTowards = velocity * Math.sign(gap);
	const reach = Math.sqrt(speedTowards ** 2 + 2 * TOPPLE_ACCELERATION * Math.abs(gap));
	return (reach - speedTowards) / TOPPLE_ACCELERATION;
}

// Where the topple towards `to` has carried the flap `ms` after release.
export function toppleMotion(inertia, to, ms) {
	const pull = Math.sign(to - inertia.start) * TOPPLE_ACCELERATION;
	const time = Math.min(ms, inertia.durationMs);
	const velocity = inertia.velocity + pull * time;
	if (ms >= inertia.durationMs) return { travel: to, velocity, landed: true };
	return { travel: inertia.start + inertia.velocity * time + (pull * time ** 2) / 2, velocity, landed: false };
}
