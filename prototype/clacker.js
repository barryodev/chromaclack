'use strict';

// Pages are a circular sequence. Each page's two half pages share a colour and label.
const PAGES = [
	{ label: '1', colour: '#581C87' },
	{ label: '2', colour: '#C026D3' },
	{ label: '3', colour: '#F43F5E' },
	{ label: '4', colour: '#F97316' }
];

// Swipe tuning. Angles are in degrees and times in milliseconds.
const FLIP_DEGREES = 180;
const DEGREES_PER_PIXEL = 0.6;
const MIN_RELEASE_SPEED = 0.01; // °/ms. Slower releases don't start inertia.
const FRICTION_PER_SECOND = 3.5;
const INERTIA_TIME_SCALE = 0.25; // Inertia runs on a slowed clock.
const MAX_INERTIA_MS = 3000;
const MAX_FLIPS_PER_SWIPE = 8;

// Spin tuning.
const SPIN_DETENT_DEGREES = 90;

const ARIA_LABELS = {
	vertical: 'Swipe up or down',
	horizontal: 'Swipe left or right',
	spin: 'Hold and rotate'
};

const clacker = document.querySelector('.clacker');
const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
const flaps = Object.fromEntries(
	['start', 'end', 'flipping'].map((name) => {
		const element = clacker.querySelector(`.flap--${name}`);
		return [
			name,
			{
				element,
				front: element.querySelector('.flap-side--front'),
				back: element.querySelector('.flap-side--back')
			}
		];
	})
);
const debugParam = new URLSearchParams(location.search).get('debug');
const debugPanel = debugParam !== null && debugParam !== 'false' ? document.querySelector('.debug') : null;
const debugFields = debugPanel
	? Object.fromEntries([...debugPanel.querySelectorAll('[data-debug]')].map((el) => [el.dataset.debug, el]))
	: {};

/*
	Flip angle is signed so one number covers both directions: positive is a
	forward flip (swipe down or left), negative is backward (swipe up or right).
	`page` only changes when a swipe settles. Until then the shown page is
	page + direction × completedFlips.
*/
const state = {
	mode: 'vertical',
	page: 0,
	phase: 'idle', // idle | dragging | inertia
	angle: 0,
	velocity: 0, // °/ms, forward positive
	direction: 0, // +1 forward, -1 backward, 0 none
	plannedFlips: 0,
	completedFlips: 0,
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
		// Pressing during inertia keeps the flips already completed and drops the rest.
		stopInertia();
		settle(state.direction * state.completedFlips);
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
	state.angle = clamp((position - pointer.start) * DEGREES_PER_PIXEL, -FLIP_DEGREES, FLIP_DEGREES);
	state.velocity = ((position - pointer.last) * DEGREES_PER_PIXEL) / elapsed;
	pointer.last = position;
	pointer.lastTime = now;
}

function releaseSwipe() {
	pointer = null;
	const speed = Math.abs(state.velocity);
	const moving = speed >= MIN_RELEASE_SPEED;
	// Which way to flip, if at all: +1 forward, -1 backward, 0 none.
	let direction = 0;
	if (Math.abs(state.angle) >= FLIP_DEGREES) {
		// The flap was dragged all the way over the hinge, so it flips the way it was dragged.
		direction = Math.sign(state.angle);
	} else if (moving) {
		// The pointer was still moving at release, so the flap flips the way it was going.
		direction = Math.sign(state.velocity);
	}
	// Otherwise the pointer stopped before the flap went over, so nothing flips.

	if (direction === 0) {
		settle(0);
		return;
	}

	// Estimate how far inertia would carry the flap, as whole flips.
	const coastDegrees = (speed * INERTIA_TIME_SCALE * 1000) / FRICTION_PER_SECOND;
	const flips = clamp(Math.ceil((Math.abs(state.angle) + coastDegrees) / FLIP_DEGREES), 1, MAX_FLIPS_PER_SWIPE);

	if (!moving) {
		settle(direction * flips);
		return;
	}

	state.phase = 'inertia';
	state.direction = direction;
	state.plannedFlips = flips;
	state.completedFlips = 0;
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
	// Each time the flap passes 180° one flip completes, and the next flap takes over from 0°.
	const crossed = Math.min(
		Math.floor(Math.abs(raw) / FLIP_DEGREES),
		state.plannedFlips - state.completedFlips
	);
	state.angle = raw - crossed * sign * FLIP_DEGREES;
	state.completedFlips += crossed;
	state.velocity *= Math.exp(-FRICTION_PER_SECOND * (scaledDt / 1000));
	state.inertiaMs += dt;

	if (
		state.completedFlips >= state.plannedFlips ||
		Math.abs(state.velocity) < MIN_RELEASE_SPEED ||
		state.inertiaMs >= MAX_INERTIA_MS
	) {
		// Settling commits every planned flip, even ones inertia didn't finish.
		settle(state.direction * state.plannedFlips);
	}
}

// Commit `pageDelta` and return the clacker to rest. The flap resets to flat instantly.
function settle(pageDelta) {
	state.page += pageDelta;
	state.phase = 'idle';
	state.angle = 0;
	state.velocity = 0;
	state.direction = 0;
	state.plannedFlips = 0;
	state.completedFlips = 0;
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

function setFlap(flap, flipAngle, front, back) {
	flap.element.style.setProperty('--flip-angle', flipAngle);
	paintSide(flap.front, front);
	paintSide(flap.back, back);
}

/*
	At rest, page N's start half is the front of the flipping flap, and its end half
	is the back of the end flap. In a forward flip the flipping flap falls from the
	start half to the end half. Its back carries N+1's end half, and the start flap
	beneath it shows N+1's start half. In a backward flip it rises from the end half
	back up. Its front carries N-1's start half, and the end flap beneath it shows
	N-1's end half.
*/
function renderFlaps() {
	const shown = state.page + state.direction * state.completedFlips;
	const current = pageAt(shown);
	const next = pageAt(shown + 1);
	const previous = pageAt(shown - 1);

	if (state.angle >= 0) {
		setFlap(flaps.start, 0, next, next);
		setFlap(flaps.end, FLIP_DEGREES, current, current);
		setFlap(flaps.flipping, state.angle, current, next);
	} else {
		setFlap(flaps.start, 0, current, current);
		setFlap(flaps.end, FLIP_DEGREES, previous, previous);
		setFlap(flaps.flipping, FLIP_DEGREES + state.angle, previous, current);
	}
}

function renderDebug() {
	if (!debugPanel) return;
	const shown = state.page + state.direction * state.completedFlips;
	debugFields.mode.textContent = state.mode;
	debugFields.phase.textContent = state.phase;
	debugFields.current.textContent = pageAt(state.page).label;
	debugFields.shown.textContent = pageAt(shown).label;
	debugFields.angle.textContent = `${state.angle.toFixed(1)}°`;
	debugFields.velocity.textContent = `${state.velocity.toFixed(4)} °/ms`;
	debugFields.flips.textContent = `${state.completedFlips} / ${state.plannedFlips}`;
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
