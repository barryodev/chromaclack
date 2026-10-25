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
const FRICTION_PER_SECOND = 3.5;
const STOPPING_SPEED = 0.02; // °/ms. Dry friction on top of FRICTION_PER_SECOND, so inertia stops in finite time.
// Inertia fits its friction to end on a landing, clamped to this band around FRICTION_PER_SECOND.
const MIN_FRICTION_FIT = 0.5;
const MAX_FRICTION_FIT = 2;
const TOPPLE_ACCELERATION = 0.003; // °/ms². A 90° topple takes about 250 ms.
const INERTIA_TIME_SCALE = 0.25; // Inertia runs on a slowed clock.
const SLOW_MO_FACTOR = 0.2; // ?debug slow-mo slows inertia and the spin settle by this much.
const MAX_TICKS_PER_SWIPE = 8;

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
	started, in degrees. It's signed so one number covers both directions:
	positive is forward (swipe down or left), negative is backward (swipe up or
	right). It's unwrapped, so 360 is two forward ticks, and the hinge angle and
	completed ticks are both worked out from it. `page` only changes when a
	swipe settles or is caught. Until then shownPage() adds the ticks
	completed so far.
*/
const state = {
	mode: 'vertical',
	page: 0,
	phase: 'idle', // idle | dragging | inertia
	travel: 0,
	velocity: 0, // °/ms, forward positive
	target: 0, // The travel inertia settles on, a whole number of ticks.
	inertia: null, // { start, velocity, friction, coastEnd, coastMs, elapsedMs }, see releaseSwipe.
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
	pointer = { id: event.pointerId, start, last: position, lastTime: performance.now() };
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
	const now = performance.now();
	const position = axisPosition(event);
	const elapsed = Math.max(now - pointer.lastTime, 1);
	state.travel = clamp((position - pointer.start) * DEGREES_PER_PIXEL, -TICK_DEGREES, TICK_DEGREES);
	state.velocity = ((position - pointer.last) * DEGREES_PER_PIXEL) / elapsed;
	pointer.last = position;
	pointer.lastTime = now;
}

// Every travel a swipe can settle on: the start, and each whole tick either way up to MAX_TICKS_PER_SWIPE.
const SWIPE_LANDINGS = Array.from(
	{ length: 2 * MAX_TICKS_PER_SWIPE + 1 },
	(_, i) => (i - MAX_TICKS_PER_SWIPE) * TICK_DEGREES
);

function releaseSwipe() {
	pointer = null;
	const plan = planInertia(state.travel, state.velocity, SWIPE_LANDINGS);
	state.phase = 'inertia';
	state.target = plan.target;
	state.inertia = {
		start: state.travel,
		velocity: state.velocity,
		friction: plan.friction,
		coastEnd: plan.coastEnd,
		coastMs: plan.coastMs,
		elapsedMs: 0
	};
	startInertia();
}

// Inertia

/*
	Inertia is a coast, then a topple if the coast doesn't end on its landing.

	The coast slows the flap under two frictions, on its slowed clock. Viscous
	friction slows it in proportion to its speed, like the old inertia. A small
	dry friction, STOPPING_SPEED, adds a steady drag on top, so the flap comes
	to a stop in finite time instead of slowing forever.

	stoppingTime, stoppingDistance and coastMotion all use the exact solution
	of the coast, so they must change together. Working out the position from
	elapsed time, rather than stepping it frame by frame, means inertia lands
	exactly where it was planned.
*/
function stoppingTime(speed, friction) {
	return Math.log1p(speed / STOPPING_SPEED) / friction;
}

function stoppingDistance(speed, friction) {
	return (speed - STOPPING_SPEED * Math.log1p(speed / STOPPING_SPEED)) / friction;
}

function nearestLanding(position, landings) {
	return landings.reduce((best, landing) =>
		Math.abs(landing - position) < Math.abs(best - position) ? landing : best
	);
}

/*
	Plan inertia from `position`, moving at `velocity`, to end on one of
	`landings`: positions inertia can stop on, whole-tick travels for a swipe
	and detents for spin (DAI-45). It aims for the landing nearest the natural
	stop and fits friction so the coast stops there, within the
	MIN_FRICTION_FIT–MAX_FRICTION_FIT band. A topple closes any gap the
	clamped coast leaves.
*/
function planInertia(position, velocity, landings) {
	const speed = Math.abs(velocity);
	const direction = Math.sign(velocity);
	const normalFriction = FRICTION_PER_SECOND / 1000;
	const target = nearestLanding(position + direction * stoppingDistance(speed, normalFriction), landings);
	const distance = (target - position) * direction;
	// stoppingDistance is inversely proportional to friction, so this lands exactly on distance.
	const fitted = distance > 0 ? stoppingDistance(speed, 1) / distance : Infinity;
	const friction = clamp(fitted, MIN_FRICTION_FIT * normalFriction, MAX_FRICTION_FIT * normalFriction);
	// With no more than the fitted friction the coast gets to the target, so it ends there.
	const reachesTarget = distance > 0 && friction <= fitted;
	const coastEnd = reachesTarget ? target : position + direction * stoppingDistance(speed, friction);
	const coastMs = stoppingTime(speed, friction) / INERTIA_TIME_SCALE;
	return { target, friction, coastEnd, coastMs };
}

function startInertia() {
	let lastFrame = performance.now();
	const step = (now) => {
		// Slow-mo scales the frame time, so inertia's clock runs slower too.
		const dt = (now - lastFrame) * timeScale();
		lastFrame = now;
		tickInertia(dt);
		render();
		inertiaFrame = state.phase === 'inertia' ? requestAnimationFrame(step) : null;
	};
	inertiaFrame = requestAnimationFrame(step);
}

function stopInertia() {
	if (inertiaFrame !== null) cancelAnimationFrame(inertiaFrame);
	inertiaFrame = null;
}

// Where the coast has carried the flap `ms` after release. It's over once it stops or reaches coastEnd.
function coastMotion(inertia, ms) {
	const speed = Math.abs(inertia.velocity);
	const direction = Math.sign(inertia.velocity);
	const t = Math.min(ms, inertia.coastMs) * INERTIA_TIME_SCALE;
	const decay = Math.exp(-inertia.friction * t);
	const coasted = ((speed + STOPPING_SPEED) * (1 - decay)) / inertia.friction - STOPPING_SPEED * t;
	if (ms >= inertia.coastMs || coasted >= Math.abs(inertia.coastEnd - inertia.start)) {
		return { travel: inertia.coastEnd, velocity: 0, over: true };
	}
	return {
		travel: inertia.start + direction * coasted,
		velocity: direction * ((speed + STOPPING_SPEED) * decay - STOPPING_SPEED),
		over: false
	};
}

// Where a topple from a standstill at `from` has carried the flap `ms` later, on the normal clock.
function toppleMotion(from, to, ms) {
	const gap = to - from;
	const toppled = Math.min((TOPPLE_ACCELERATION * ms ** 2) / 2, Math.abs(gap));
	return {
		travel: from + Math.sign(gap) * toppled,
		velocity: Math.sign(gap) * TOPPLE_ACCELERATION * ms,
		landed: toppled >= Math.abs(gap)
	};
}

/*
	Move the flap to where inertia has carried it after `dt` more ms, and settle
	once it lands. A topple only has a gap to close when the coast stopped
	short, which takes its full coastMs. A coast cut off at its target leaves no
	gap, so the topple lands at once.
*/
function tickInertia(dt) {
	const inertia = state.inertia;
	inertia.elapsedMs += dt;
	const coast = coastMotion(inertia, inertia.elapsedMs);
	const motion = coast.over
		? toppleMotion(inertia.coastEnd, state.target, Math.max(inertia.elapsedMs - inertia.coastMs, 0))
		: coast;
	state.travel = motion.travel;
	state.velocity = motion.velocity;
	// The topple stops on the target, so settling there doesn't move the flap.
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
	else releaseSwipe();
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
