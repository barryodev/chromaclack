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
const MIN_RELEASE_SPEED = 0.01; // °/ms. Slower releases don't start inertia.
const FRICTION_PER_SECOND = 3.5;
const INERTIA_TIME_SCALE = 0.25; // Inertia runs on a slowed clock.
const MAX_INERTIA_MS = 3000;
const MAX_TICKS_PER_SWIPE = 8;

// Spin tuning.
const SPIN_DETENT_DEGREES = 90;

const ARIA_LABELS = {
	vertical: 'Swipe up or down',
	horizontal: 'Swipe left or right',
	spin: 'Hold and rotate'
};

const clacker = document.querySelector('.clacker');
const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];

/*
	One resting flap per tier in each half, plus the moving flap. Lift pushes back
	tiers a hair away from the viewer and keeps the moving flap on top of tier 0,
	so flaps meeting along the hinge don't fight over which one paints.
*/
function createFlap(name, restTilt, lift) {
	const element = document.createElement('div');
	element.className = `flap flap--${name}`;
	element.setAttribute('aria-hidden', 'true');
	element.style.setProperty('--rest-tilt', restTilt);
	element.style.setProperty('--lift', `${lift}px`);
	const front = document.createElement('div');
	front.className = 'flap-side flap-side--front';
	const back = document.createElement('div');
	back.className = 'flap-side flap-side--back';
	element.append(front, back);
	return { element, front, back };
}

const flaps = {
	start: REST_TILTS.map((tilt, tier) => createFlap('start', tilt, -tier)),
	end: REST_TILTS.map((tilt, tier) => createFlap('end', tilt, -tier)),
	moving: createFlap('moving', REST_TILTS[0], 1)
};
// Back to front, so DOM order matches draw order.
for (let tier = REST_TILTS.length - 1; tier >= 0; tier--) {
	flaps.start[tier].element.dataset.tier = tier;
	flaps.end[tier].element.dataset.tier = tier;
	clacker.append(flaps.start[tier].element, flaps.end[tier].element);
}
clacker.append(flaps.moving.element);
const debugParam = new URLSearchParams(location.search).get('debug');
const debugPanel = debugParam !== null && debugParam !== 'false' ? document.querySelector('.debug') : null;
const debugFields = debugPanel
	? Object.fromEntries([...debugPanel.querySelectorAll('[data-debug]')].map((el) => [el.dataset.debug, el]))
	: {};

/*
	Hinge angle is signed so one number covers both directions: positive is a
	forward tick (swipe down or left), negative is backward (swipe up or right).
	`page` only changes when a swipe settles. Until then the shown page is
	page + direction × completedTicks.
*/
const state = {
	mode: 'vertical',
	page: 0,
	phase: 'idle', // idle | dragging | inertia
	angle: 0,
	velocity: 0, // °/ms, forward positive
	direction: 0, // +1 forward, -1 backward, 0 none
	plannedTicks: 0,
	completedTicks: 0,
	inertiaMs: 0,
	spinAngle: 0,
	spinSettling: false
};

let pointer = null;
let inertiaFrame = null;

function pageAt(index) {
	return PAGES[((index % PAGES.length) + PAGES.length) % PAGES.length];
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

// Pointer position along the swipe axis, oriented so forward is positive.
function axisPosition(event) {
	return state.mode === 'vertical' ? event.clientY : -event.clientX;
}

// Swipe

function startSwipe(event) {
	if (state.phase === 'inertia') {
		// Pressing during inertia keeps the ticks already completed and drops the rest.
		stopInertia();
		settle(state.direction * state.completedTicks);
	}
	const position = axisPosition(event);
	pointer = { id: event.pointerId, start: position, last: position, lastTime: performance.now() };
	state.phase = 'dragging';
	state.angle = 0;
	state.velocity = 0;
}

function dragSwipe(event) {
	const now = performance.now();
	const position = axisPosition(event);
	const elapsed = Math.max(now - pointer.lastTime, 1);
	state.angle = clamp((position - pointer.start) * DEGREES_PER_PIXEL, -TICK_DEGREES, TICK_DEGREES);
	state.velocity = ((position - pointer.last) * DEGREES_PER_PIXEL) / elapsed;
	pointer.last = position;
	pointer.lastTime = now;
}

function releaseSwipe() {
	pointer = null;
	const speed = Math.abs(state.velocity);
	const moving = speed >= MIN_RELEASE_SPEED;
	// Which way to tick, if at all: +1 forward, -1 backward, 0 none.
	let direction = 0;
	if (Math.abs(state.angle) >= TICK_DEGREES) {
		// The flap was dragged all the way over the hinge, so it ticks over the way it was dragged.
		direction = Math.sign(state.angle);
	} else if (moving) {
		// The pointer was still moving at release, so the flap ticks over the way it was going.
		direction = Math.sign(state.velocity);
	}
	// Otherwise the pointer stopped before the flap went over, so nothing ticks over.

	if (direction === 0) {
		settle(0);
		return;
	}

	// Estimate how far inertia would carry the flap, as whole ticks.
	const coastDegrees = (speed * INERTIA_TIME_SCALE * 1000) / FRICTION_PER_SECOND;
	const ticks = clamp(Math.ceil((Math.abs(state.angle) + coastDegrees) / TICK_DEGREES), 1, MAX_TICKS_PER_SWIPE);

	if (!moving) {
		settle(direction * ticks);
		return;
	}

	state.phase = 'inertia';
	state.direction = direction;
	state.plannedTicks = ticks;
	state.completedTicks = 0;
	state.inertiaMs = 0;
	state.velocity = speed * direction;
	startInertia();
}

function startInertia() {
	let lastFrame = performance.now();
	const step = (now) => {
		const dt = now - lastFrame;
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

function tickInertia(dt) {
	const scaledDt = dt * INERTIA_TIME_SCALE;
	const raw = state.angle + state.velocity * scaledDt;
	const sign = state.velocity >= 0 ? 1 : -1;
	// Each time the flap passes 180° one tick completes, and the next flap takes over from 0°.
	const crossed = Math.min(
		Math.floor(Math.abs(raw) / TICK_DEGREES),
		state.plannedTicks - state.completedTicks
	);
	state.angle = raw - crossed * sign * TICK_DEGREES;
	state.completedTicks += crossed;
	state.velocity *= Math.exp(-FRICTION_PER_SECOND * (scaledDt / 1000));
	state.inertiaMs += dt;

	if (
		state.completedTicks >= state.plannedTicks ||
		Math.abs(state.velocity) < MIN_RELEASE_SPEED ||
		state.inertiaMs >= MAX_INERTIA_MS
	) {
		// Settling commits every planned tick, even ones inertia didn't finish.
		settle(state.direction * state.plannedTicks);
	}
}

// Commit `pageDelta` and return the clacker to rest. The flap resets to the start half instantly.
function settle(pageDelta) {
	state.page += pageDelta;
	state.phase = 'idle';
	state.angle = 0;
	state.velocity = 0;
	state.direction = 0;
	state.plannedTicks = 0;
	state.completedTicks = 0;
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

function setFlap(flap, hingeAngle, front, back) {
	flap.element.style.setProperty('--hinge-angle', hingeAngle);
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
	The tiers hold their tilt during a tick, so they jump to their new pages when
	the tick completes.
*/
function renderFlaps() {
	const shown = state.page + state.direction * state.completedTicks;
	const forward = state.angle >= 0;

	flaps.start.forEach((flap, tier) => {
		const page = pageAt(shown + tier);
		setFlap(flap, 0, page, page);
		flap.element.hidden = forward && tier === 0;
	});
	flaps.end.forEach((flap, tier) => {
		const page = pageAt(shown - tier);
		setFlap(flap, TICK_DEGREES, page, page);
		flap.element.hidden = !forward && tier === 0;
	});

	if (forward) {
		setFlap(flaps.moving, state.angle, pageAt(shown), pageAt(shown + 1));
	} else {
		setFlap(flaps.moving, TICK_DEGREES + state.angle, pageAt(shown - 1), pageAt(shown));
	}
}

function renderDebug() {
	if (!debugPanel) return;
	const shown = state.page + state.direction * state.completedTicks;
	debugFields.mode.textContent = state.mode;
	debugFields.phase.textContent = state.phase;
	debugFields.current.textContent = pageAt(state.page).label;
	debugFields.shown.textContent = pageAt(shown).label;
	debugFields.angle.textContent = `${state.angle.toFixed(1)}°`;
	debugFields.velocity.textContent = `${state.velocity.toFixed(4)} °/ms`;
	debugFields.ticks.textContent = `${state.completedTicks} / ${state.plannedTicks}`;
	debugFields.spin.textContent = `${state.spinAngle.toFixed(1)}°`;
}

function render() {
	clacker.dataset.mode = state.mode;
	clacker.dataset.axis = state.mode === 'vertical' ? 'vertical' : 'horizontal';
	clacker.setAttribute('aria-label', ARIA_LABELS[state.mode]);
	clacker.style.setProperty('--spin-angle', state.spinAngle);
	clacker.classList.toggle('is-settling', state.spinSettling);
	for (const tab of tabs) tab.setAttribute('aria-selected', String(tab.dataset.mode === state.mode));
	renderFlaps();
	renderDebug();
}

if (debugPanel) debugPanel.hidden = false;
render();
