'use strict';

// Pages are a circular sequence. Each page's two half pages share a colour and label.
const PAGES = [
	{ label: '1', colour: '#581C87' },
	{ label: '2', colour: '#C026D3' },
	{ label: '3', colour: '#F43F5E' },
	{ label: '4', colour: '#F97316' },
	{ label: '5', colour: '#EAB308' },
	{ label: '6', colour: '#22C55E' },
	{ label: '7', colour: '#06B6D4' },
	{ label: '8', colour: '#3B82F6' }
];

// Rest tilt in degrees, one per tier from front (tier 0) to back. Tiers further back lean less.
const REST_TILTS = [42, 36, 30];

// Swipe tuning. Angles are in degrees and times in milliseconds.
const TICK_DEGREES = 180;
const DEGREES_PER_PIXEL = 0.6;
// A 3.4 px/ms flick, a hard one on a phone, coasts about 9 ticks in about 1.9 s.
const AIR_RESISTANCE = 0.00025; // Per degree. Slows the coast in proportion to its speed².
const STOPPING_FRICTION = 0.0008; // °/ms². A steady slowing on top, so the coast stops in finite time.
// A small mouse flick moves the pointer fast, so mouse coasts get this much more friction than touch or pen.
const MOUSE_FRICTION = 1.7;
// Inertia fits its friction to end on a landing, within this band around the input's normal friction.
const MIN_FRICTION_FIT = 0.5;
const MAX_FRICTION_FIT = 2;
const TOPPLE_ACCELERATION = 0.0013; // °/ms². A 90° topple from a standstill takes about 370 ms.
const SLOW_MO_FACTOR = 0.2; // ?debug slow-mo slows inertia and the spin settle by this much.
const MAX_TICKS_PER_SWIPE = 30; // A safety net only. Friction keeps real flicks well short of it.
const RELEASE_WINDOW_MS = 80; // Release speed is measured over the pointer's last moves in this window.

// Spin tuning.
const SPIN_DETENT_DEGREES = 90;
const SPIN_SETTLE_MS = 400; // How long the release snap to a detent takes.

const ARIA_LABELS = {
	vertical: 'Swipe up or down',
	horizontal: 'Swipe left or right',
	spin: 'Hold and rotate'
};

const clacker = document.querySelector('.clacker');
const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];

// Build one flap with a front and back side. `dataset` tags it so it's easy to find in DevTools.
function createFlap(name, lift, dataset = {}) {
	const element = document.createElement('div');
	element.className = `flap flap--${name}`;
	element.setAttribute('aria-hidden', 'true');
	element.style.setProperty('--lift', `${lift}px`);
	Object.assign(element.dataset, dataset);
	const front = document.createElement('div');
	front.className = 'flap-side flap-side--front';
	const back = document.createElement('div');
	back.className = 'flap-side flap-side--back';
	element.append(front, back);
	return { element, front, back };
}

/*
	Each half gets one resting flap per tier in REST_TILTS and one offstage flap
	behind its back tier, plus the moving flap shared by both halves. Lift pushes
	each tier a hair further from the viewer than the one in front of it and
	keeps the moving flap on top of tier 0, so flaps meeting along the hinge
	don't fight over which one paints.

	One offstage flap per half is enough. A tick only moves each half by one
	tier, so at most one flap arrives or leaves at the back of each half. In a
	multi-tick inertia, renderFlaps repaints every flap's pages from the shown
	page at each tick boundary, so the same offstage flap is reused.
*/
const flaps = {
	start: REST_TILTS.map((_, tier) => createFlap('start', -tier, { tier })),
	end: REST_TILTS.map((_, tier) => createFlap('end', -tier, { tier })),
	offstage: {
		start: createFlap('start', -REST_TILTS.length, { offstage: '' }),
		end: createFlap('end', -REST_TILTS.length, { offstage: '' })
	},
	moving: createFlap('moving', 1)
};

// Back to front, so DOM order matches draw order.
const tiersBackToFront = REST_TILTS.map((_, tier) => tier).reverse();
const flapsBackToFront = [
	flaps.offstage.start,
	flaps.offstage.end,
	...tiersBackToFront.flatMap((tier) => [flaps.start[tier], flaps.end[tier]]),
	flaps.moving
];
clacker.append(...flapsBackToFront.map((flap) => flap.element));

const debugParam = new URLSearchParams(location.search).get('debug');
const debugPanel = debugParam !== null && debugParam !== 'false' ? document.querySelector('.debug') : null;
const debugFields = debugPanel
	? Object.fromEntries([...debugPanel.querySelectorAll('[data-debug]')].map((el) => [el.dataset.debug, el]))
	: {};

/*
	Travel is how far the swipe has turned flaps over the hinge since it
	started, in degrees. A caught swipe starts at the hinge angle it was
	caught at, and any other swipe at 0. It's signed so one number covers both
	directions: positive is forward (swipe down or left), negative is backward
	(swipe up or right). It's unwrapped, so 360 is two forward ticks, and the
	hinge angle and completed ticks are both worked out from it. `page` only
	changes when a swipe settles or is caught. Until then shownPage() adds the
	ticks completed so far.
*/
const state = {
	mode: 'vertical',
	page: 0,
	phase: 'idle', // idle | dragging | inertia
	travel: 0,
	velocity: 0, // °/ms, forward positive
	target: 0, // The travel inertia settles on, a whole number of ticks.
	inertia: null, // { start, velocity, coasts, frictionScale, durationMs, elapsedMs }, see releaseSwipe.
	releaseSpeed: 0, // px/ms, the last swipe's release speed, for the ?debug readout.
	spinAngle: 0,
	spinSettling: false
};

let pointer = null;
let inertiaFrame = null;
let slowMo = false; // Only the ?debug panel can turn this on.

// How fast motion the clacker drives itself runs: 1 normally, SLOW_MO_FACTOR in slow-mo.
function timeScale() {
	return slowMo ? SLOW_MO_FACTOR : 1;
}

function pageAt(index) {
	return PAGES[((index % PAGES.length) + PAGES.length) % PAGES.length];
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

// Whole ticks the current swipe has completed, signed like travel.
function completedTicks() {
	return Math.trunc(state.travel / TICK_DEGREES);
}

// Signed hinge angle of the moving flap within the tick in progress, from −180 to 180.
function hingeAngle() {
	return state.travel - completedTicks() * TICK_DEGREES;
}

// The page on show right now, counting the ticks completed in the current swipe.
function shownPage() {
	return state.page + completedTicks();
}

/*
	Rest tilt for a tier, where tier 0 is the front and REST_TILTS.length - 1 the
	back. Two indices outside that range come up while a tier slides towards
	its neighbour during a tick, and both are clamped:

	- REST_TILTS.length, one past the back, is the offstage position. The back
	  tier slides towards it as it goes offstage, or comes from it as it's
	  uncovered. It holds the back tier's tilt, so flaps arriving or leaving at
	  the back don't move, and offstage flaps wait there.
	- -1, one in front of tier 0, only comes up for the tier 0 flap hidden under
	  the moving flap, so its value never shows.
*/
function tierTilt(tier) {
	return REST_TILTS[clamp(tier, 0, REST_TILTS.length - 1)];
}

/*
	The angle a flap is drawn at, in degrees. Rest tilt is applied only when
	drawing, and the swipe maths stays in hinge-angle space. A hinge angle of
	0–180 is drawn from restTilt to 180 − restTilt, so no flap is ever drawn
	flat. Resting flaps lean towards the viewer like a book opened a little short
	of flat, fanned out by tier.
*/
function drawnAngle(hingeAngle, restTilt) {
	return restTilt + (hingeAngle * (TICK_DEGREES - 2 * restTilt)) / TICK_DEGREES;
}

// Pointer position along the swipe axis, oriented so forward is positive.
function axisPosition(event) {
	return state.mode === 'vertical' ? event.clientY : -event.clientX;
}

// Swipe

function startSwipe(event) {
	if (state.phase === 'inertia') catchFlap();
	const position = axisPosition(event);
	// Offset the start so the drag carries on from the caught flap's travel. It's 0 when idle.
	const start = position - state.travel / DEGREES_PER_PIXEL;
	pointer = { id: event.pointerId, start, samples: [{ position, time: event.timeStamp }] };
	state.phase = 'dragging';
	state.velocity = 0;
}

// Keep the ticks inertia has completed and leave the flap at its hinge angle, so the shown pages don't change.
function catchFlap() {
	stopInertia();
	const angle = hingeAngle();
	state.page = shownPage();
	state.travel = angle;
	state.target = 0;
	state.inertia = null;
}

function dragSwipe(event) {
	// Phones batch several moves into one event. The coalesced ones give the release window more samples.
	const moves = event.getCoalescedEvents?.() ?? [];
	for (const move of moves.length > 0 ? moves : [event]) addSample(move);
	const position = axisPosition(event);
	state.travel = clamp((position - pointer.start) * DEGREES_PER_PIXEL, -TICK_DEGREES, TICK_DEGREES);
	state.velocity = windowVelocity(pointer.samples);
}

// Record where the pointer was and when, keeping one sample from just before the release window.
function addSample(event) {
	const samples = pointer.samples;
	samples.push({ position: axisPosition(event), time: event.timeStamp });
	const windowStart = event.timeStamp - RELEASE_WINDOW_MS;
	while (samples.length > 2 && samples[1].time <= windowStart) samples.shift();
}

// Velocity in °/ms across the window, so one short last move can't stand in for the whole swipe.
function windowVelocity(samples) {
	const oldest = samples[0];
	const newest = samples.at(-1);
	const elapsedMs = newest.time - oldest.time;
	return elapsedMs > 0 ? ((newest.position - oldest.position) * DEGREES_PER_PIXEL) / elapsedMs : 0;
}

// Every travel a swipe can settle on: the start, and each whole tick either way up to MAX_TICKS_PER_SWIPE.
const SWIPE_LANDINGS = Array.from(
	{ length: 2 * MAX_TICKS_PER_SWIPE + 1 },
	(_, index) => (index - MAX_TICKS_PER_SWIPE) * TICK_DEGREES
);

function releaseSwipe(event) {
	// The lift's own sample shows if the finger stopped before lifting. A cancel's position isn't reliable.
	if (event.type === 'pointerup') addSample(event);
	state.velocity = windowVelocity(pointer.samples);
	state.releaseSpeed = Math.abs(state.velocity) / DEGREES_PER_PIXEL;
	pointer = null;
	const normalFriction = event.pointerType === 'mouse' ? MOUSE_FRICTION : 1;
	const plan = planInertia(state.travel, state.velocity, SWIPE_LANDINGS, normalFriction);
	state.phase = 'inertia';
	state.target = plan.target;
	state.inertia = {
		start: state.travel,
		velocity: state.velocity,
		coasts: plan.coasts,
		frictionScale: plan.frictionScale,
		durationMs: plan.durationMs,
		elapsedMs: 0
	};
	startInertia();
}

// Inertia

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

function stoppingTime(speed, frictionScale) {
	const { startPhase, phaseRate } = coastFormulaInputs(speed, frictionScale);
	return startPhase / phaseRate;
}

function stoppingDistance(speed, frictionScale) {
	const { airResistance, startPhase } = coastFormulaInputs(speed, frictionScale);
	return -Math.log(Math.cos(startPhase)) / airResistance;
}

function nearestLanding(position, landings) {
	return landings.reduce((best, landing) =>
		Math.abs(landing - position) < Math.abs(best - position) ? landing : best
	);
}

/*
	Plan inertia from `position`, moving at `velocity`, to end on one of
	`landings`: positions inertia can stop on, whole-tick travels for a swipe
	and detents for spin (DAI-45). `normalFriction` scales both frictions for
	the input. It aims for the landing nearest the natural stop and fits
	friction so the coast stops there, within the
	MIN_FRICTION_FIT–MAX_FRICTION_FIT band around `normalFriction`. If the
	clamped coast can't get there, the flap topples there instead.
*/
function planInertia(position, velocity, landings, normalFriction) {
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

function startInertia() {
	let lastFrame = performance.now();
	const step = (now) => {
		// Slow-mo scales the frame time, so inertia's clock runs slower too.
		const frameMs = (now - lastFrame) * timeScale();
		lastFrame = now;
		tickInertia(frameMs);
		render();
		inertiaFrame = state.phase === 'inertia' ? requestAnimationFrame(step) : null;
	};
	inertiaFrame = requestAnimationFrame(step);
}

function stopInertia() {
	if (inertiaFrame !== null) cancelAnimationFrame(inertiaFrame);
	inertiaFrame = null;
}

// Where the coast towards `to` has carried the flap `ms` after release. It lands once it stops or reaches `to`.
function coastMotion(inertia, to, ms) {
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
function toppleTime(gap, velocity) {
	const speedTowards = velocity * Math.sign(gap);
	const reach = Math.sqrt(speedTowards ** 2 + 2 * TOPPLE_ACCELERATION * Math.abs(gap));
	return (reach - speedTowards) / TOPPLE_ACCELERATION;
}

// Where the topple towards `to` has carried the flap `ms` after release.
function toppleMotion(inertia, to, ms) {
	const pull = Math.sign(to - inertia.start) * TOPPLE_ACCELERATION;
	const time = Math.min(ms, inertia.durationMs);
	const velocity = inertia.velocity + pull * time;
	if (ms >= inertia.durationMs) return { travel: to, velocity, landed: true };
	return { travel: inertia.start + inertia.velocity * time + (pull * time ** 2) / 2, velocity, landed: false };
}

// Move the flap to where inertia has carried it after `frameMs` more ms, and settle once it lands.
function tickInertia(frameMs) {
	const inertia = state.inertia;
	inertia.elapsedMs += frameMs;
	const motion = inertia.coasts
		? coastMotion(inertia, state.target, inertia.elapsedMs)
		: toppleMotion(inertia, state.target, inertia.elapsedMs);
	state.travel = motion.travel;
	state.velocity = motion.velocity;
	// Both motions stop on the target, so settling there doesn't move the flap.
	if (motion.landed) settle(state.target / TICK_DEGREES);
}

// Commit `pageDelta` and return the clacker to rest. The flap resets to the start half instantly.
function settle(pageDelta) {
	state.page += pageDelta;
	state.phase = 'idle';
	state.travel = 0;
	state.velocity = 0;
	state.target = 0;
	state.inertia = null;
}

// Spin

function pointerAngle(event) {
	return (Math.atan2(event.clientY - pointer.centreY, event.clientX - pointer.centreX) * 180) / Math.PI;
}

function startSpin(event) {
	const rect = clacker.getBoundingClientRect();
	pointer = {
		id: event.pointerId,
		centreX: rect.left + rect.width / 2,
		centreY: rect.top + rect.height / 2
	};
	pointer.lastAngle = pointerAngle(event);
	state.phase = 'dragging';
	state.spinSettling = false;
}

function dragSpin(event) {
	const angle = pointerAngle(event);
	// Shortest-path delta, so crossing the ±180° line doesn't jump a full turn.
	const delta = ((((angle - pointer.lastAngle + 180) % 360) + 360) % 360) - 180;
	state.spinAngle += delta;
	pointer.lastAngle = angle;
}

function releaseSpin(snap) {
	pointer = null;
	state.phase = 'idle';
	if (!snap) return;
	state.spinAngle = Math.round(state.spinAngle / SPIN_DETENT_DEGREES) * SPIN_DETENT_DEGREES;
	state.spinSettling = true;
}

// Pointer wiring

clacker.addEventListener('pointerdown', (event) => {
	if (pointer || event.button !== 0) return;
	clacker.setPointerCapture(event.pointerId);
	if (state.mode === 'spin') startSpin(event);
	else startSwipe(event);
	render();
});

clacker.addEventListener('pointermove', (event) => {
	if (!pointer || event.pointerId !== pointer.id) return;
	if (state.mode === 'spin') dragSpin(event);
	else dragSwipe(event);
	render();
});

function endPointer(event) {
	if (!pointer || event.pointerId !== pointer.id) return;
	if (state.mode === 'spin') releaseSpin(event.type === 'pointerup');
	else releaseSwipe(event);
	render();
}

clacker.addEventListener('pointerup', endPointer);
clacker.addEventListener('pointercancel', endPointer);

// Mode tabs. Switching mode starts the clacker over on the first page.

for (const tab of tabs) {
	tab.addEventListener('click', () => {
		const mode = tab.dataset.mode;
		if (mode === state.mode) return;
		stopInertia();
		if (pointer && clacker.hasPointerCapture(pointer.id)) clacker.releasePointerCapture(pointer.id);
		pointer = null;
		settle(0);
		state.page = 0;
		state.spinSettling = false;
		state.mode = mode;
		render();
	});
}

// Rendering

function paintSide(side, page) {
	side.textContent = page.label;
	side.style.setProperty('--page-colour', page.colour);
}

/*
	Place a flap at its drawn angle and paint a page on each side. Only the
	moving flap has different pages on its front and back. Every resting flap
	shows one page on both sides.
*/
function setFlap(flap, hingeAngle, restTilt, front, back) {
	flap.element.style.setProperty('--drawn-angle', drawnAngle(hingeAngle, restTilt));
	paintSide(flap.front, front);
	paintSide(flap.back, back);
}

/*
	At rest, start tier k shows page N+k and end tier k shows page N-k. The moving
	flap stands in for tier 0 of the half it starts in, so that tier's own flap is
	hidden. In a forward tick the moving flap falls from the start half to the end
	half. Its back carries N+1's end half, and start tier 1 beneath it shows N+1's
	start half. In a backward tick it rises from the end half back up. Its front
	carries N-1's start half, and end tier 1 beneath it shows N-1's end half.

	As the tick progresses, each tier slides linearly one place towards its pose
	for the next page. In a forward tick start tiers move forward and end tiers
	move back, and a backward tick is the mirror image. When the tick completes
	every flap already sits in the next page's rest pose, so nothing jumps.
	Offstage flaps wait behind the back tier at its tilt, already showing their
	pages. A back tier rising away uncovers one, and a back tier being covered
	by the tier in front goes offstage.
*/
function renderFlaps() {
	const shown = shownPage();
	const angle = hingeAngle();
	const forward = angle >= 0;
	const progress = Math.abs(angle) / TICK_DEGREES;
	const slideTilt = (tier, towards) => tierTilt(tier) + (tierTilt(towards) - tierTilt(tier)) * progress;

	flaps.start.forEach((flap, tier) => {
		const page = pageAt(shown + tier);
		setFlap(flap, 0, slideTilt(tier, forward ? tier - 1 : tier + 1), page, page);
		flap.element.hidden = forward && tier === 0;
	});
	flaps.end.forEach((flap, tier) => {
		const page = pageAt(shown - tier);
		setFlap(flap, TICK_DEGREES, slideTilt(tier, forward ? tier + 1 : tier - 1), page, page);
		flap.element.hidden = !forward && tier === 0;
	});

	const offstageTilt = tierTilt(REST_TILTS.length);
	const startOffstagePage = pageAt(shown + REST_TILTS.length);
	const endOffstagePage = pageAt(shown - REST_TILTS.length);
	setFlap(flaps.offstage.start, 0, offstageTilt, startOffstagePage, startOffstagePage);
	setFlap(flaps.offstage.end, TICK_DEGREES, offstageTilt, endOffstagePage, endOffstagePage);

	// The moving flap keeps tier 0's tilt for the whole tick.
	if (forward) {
		setFlap(flaps.moving, angle, REST_TILTS[0], pageAt(shown), pageAt(shown + 1));
	} else {
		setFlap(flaps.moving, TICK_DEGREES + angle, REST_TILTS[0], pageAt(shown - 1), pageAt(shown));
	}
}

// Fill the ?debug readout from state.
function renderDebug() {
	if (!debugPanel) return;
	const shown = shownPage();
	debugFields.mode.textContent = state.mode;
	debugFields.phase.textContent = state.phase;
	debugFields.current.textContent = pageAt(state.page).label;
	debugFields.shown.textContent = pageAt(shown).label;
	debugFields.travel.textContent = `${state.travel.toFixed(1)}° / ${state.target}°`;
	debugFields.angle.textContent = `${hingeAngle().toFixed(1)}°`;
	debugFields.velocity.textContent = `${state.velocity.toFixed(4)} °/ms`;
	debugFields.releaseSpeed.textContent = `${state.releaseSpeed.toFixed(2)} px/ms`;
	debugFields.ticks.textContent = `${completedTicks()} / ${state.target / TICK_DEGREES}`;
	debugFields.spin.textContent = `${state.spinAngle.toFixed(1)}°`;
	debugFields.slowMo.textContent = slowMo ? `${SLOW_MO_FACTOR}×` : 'off';
	slowMoToggle.checked = slowMo;
}

function render() {
	clacker.dataset.mode = state.mode;
	clacker.dataset.axis = state.mode === 'vertical' ? 'vertical' : 'horizontal';
	clacker.setAttribute('aria-label', ARIA_LABELS[state.mode]);
	clacker.style.setProperty('--spin-angle', state.spinAngle);
	clacker.style.setProperty('--spin-settle-duration', `${SPIN_SETTLE_MS / timeScale()}ms`);
	clacker.classList.toggle('is-settling', state.spinSettling);
	for (const tab of tabs) tab.setAttribute('aria-selected', String(tab.dataset.mode === state.mode));
	renderFlaps();
	renderDebug();
}

/*
	Slow-mo toggle: the checkbox in the debug panel, or the S key. Both are wired
	up only with ?debug, so S does nothing on the normal page.
*/
const slowMoToggle = debugPanel?.querySelector('[data-debug-control="slow-mo"]');

function setSlowMo(on) {
	slowMo = on;
	render();
}

if (debugPanel) {
	debugPanel.hidden = false;
	slowMoToggle.addEventListener('change', () => setSlowMo(slowMoToggle.checked));
	document.addEventListener('keydown', (event) => {
		if (event.key.toLowerCase() !== 's' || event.repeat) return;
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		setSlowMo(!slowMo);
	});
}
render();
