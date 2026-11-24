import { clamp, lerp, springAtRest, stepDampedSpring } from './maths.js';
import {
	createPageReporter,
	movingFlapIndex,
	restingFlapPage,
	sequencePage,
	spinShownPage,
	swipeShownPage,
	tierFlapIndex
} from './pages.js';
import {
	BOUNCE_DAMPING,
	BOUNCE_SWING_MS,
	CLACK_KICK,
	GRAB_FADE_MS,
	MAX_CLACK_STRENGTH,
	MAX_FALL_POINT,
	MAX_FALL_PULL,
	MIN_CLACK_STRENGTH,
	MIN_FALL_POINT,
	MIN_FALL_PULL,
	bounceOffset,
	flapRandom,
	loosenessAt,
	movingTravel,
	tierSlides
} from './rolodex.js';
import { addToReleaseWindow, windowVelocity } from './sampling.js';
import {
	SEAT_DAMPING,
	SEAT_SPEED,
	SEAT_SWING_MS,
	SPIN_DETENT_DEGREES,
	nearestDetent,
	rimSpeed,
	shortestTurn,
	spinDownDistance,
	spinDownSpeed,
	spinDownTime
} from './spin.js';
import {
	COAST_DEGREES_PER_PIXEL,
	DRAG_DEGREES_PER_PIXEL,
	MAX_TICKS_PER_SWIPE,
	MOUSE_DRAG_DEGREES_PER_PIXEL,
	MOUSE_FRICTION,
	SWIPE_LANDINGS,
	TICK_DEGREES,
	coastMotion,
	completedTicks,
	drawnAngle,
	hingeAngle,
	planInertia,
	tickBounds,
	toppleMotion
} from './swipe.js';

// Rest tilt in degrees, one per tier from front (tier 0) to back. Tiers further back lean less.
const REST_TILTS = [42, 36, 30];
// The spin tab lies flat, so a spin looks like turning a record.
const FLAT_TILTS = REST_TILTS.map(() => 0);

const SLOW_MO_FACTOR = 0.2; // ?debug slow-mo slows inertia and the seat by this much.

const ARIA_LABELS = {
	vertical: 'Swipe up or down',
	horizontal: 'Swipe left or right',
	spin: 'Spin'
};

// The page's one clacker, until DAI-64 gives each clacker its own state. createClacker sets it up.
let clacker = null;

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
	hinge angle and completed ticks are both worked out from it. `page` is the
	current page. It only changes when a swipe settles or is caught, or a spin
	seats. Until then travelPage() adds the ticks completed so far.
*/
const state = {
	mode: 'vertical',
	page: 0,
	phase: 'idle', // idle | dragging | inertia, and spin-down | seating on the spin tab
	travel: 0,
	velocity: 0, // °/ms, forward positive
	target: 0, // The travel inertia settles on, a whole number of ticks.
	inertia: null, // { start, velocity, releaseLooseness, coasts, frictionScale, durationMs, elapsedMs, fall }
	heldLooseness: null, // { page, forward, looseness } for the tick in progress, see tickLooseness.
	releaseSpeed: 0, // px/ms, the last swipe's release speed, for the ?debug readout.
	spinAngle: 0,
	spinVelocity: 0, // °/ms, clockwise positive
	spinDown: null, // { start, velocity, elapsedMs, handoverMs }
	spinDetent: 0 // The detent the seat pulls towards.
};

let sequence = null; // { pageCount, circular, pageContent } from the calling code, see load.
let reporter = null; // Tells the calling code about page events. render() feeds it each frame.
const lastEvents = { shown: null, current: null }; // For the ?debug readout.
let pointer = null;
let inertiaLoop = null;
let spinLoop = null;
let slowMo = false; // Only the ?debug panel can turn this on.

// How fast motion the clacker drives itself runs: 1 normally, SLOW_MO_FACTOR in slow-mo.
function timeScale() {
	return slowMo ? SLOW_MO_FACTOR : 1;
}

/*
	Run `onFrame(frameMs)` once per frame, just before the browser paints, for
	as long as it returns true. frameMs is the time since the last frame,
	scaled by timeScale(), so slow-mo slows everything the clacker drives
	itself. Inertia, bounces and spin each run on one of these.

	requestAnimationFrame(step) asks the browser to call step once, for the
	next frame. While onFrame says it's still moving, step asks for the frame
	after. That isn't recursion: each step returns before the next frame
	comes. What moves lives in state, and step only keeps the time of the
	last frame.

	Returns the loop: `running` says whether it's still going, and stop()
	cancels the next frame.
*/
function startFrameLoop(onFrame) {
	const loop = { running: true, stop: null };
	let lastFrame = performance.now();
	let frameRequest = null;
	const step = (now) => {
		const frameMs = (now - lastFrame) * timeScale();
		lastFrame = now;
		loop.running = onFrame(frameMs);
		if (loop.running) frameRequest = requestAnimationFrame(step);
	};
	loop.stop = () => {
		cancelAnimationFrame(frameRequest);
		loop.running = false;
	};
	frameRequest = requestAnimationFrame(step);
	return loop;
}

function pageAt(index) {
	return sequence.pageContent(sequencePage(index, sequence));
}

// The page travel has reached, counting the ticks completed in the current swipe. The fan is painted from it.
function travelPage() {
	return state.page + completedTicks(state.travel);
}

// See Shown page in GLOSSARY.md.
function shownPage() {
	if (state.mode === 'spin') {
		return spinShownPage(state.spinAngle, seatDetent());
	} else {
		return swipeShownPage(state.page, movingTravel(state.inertia, state.travel));
	}
}

// The page the fan is painted from. Nothing ticks on the spin tab, so there the face shows the shown page.
function facePage() {
	if (state.mode === 'spin') {
		return shownPage();
	} else {
		return travelPage();
	}
}

// The moving flap's hinge angle where it's drawn, which can be ahead of travel as it falls.
function drawnHingeAngle() {
	return movingTravel(state.inertia, state.travel) - completedTicks(state.travel) * TICK_DEGREES;
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
	return tiltsForMode()[clamp(tier, 0, REST_TILTS.length - 1)];
}

function tiltsForMode() {
	return state.mode === 'spin' ? FLAT_TILTS : REST_TILTS;
}

// Pointer position along the swipe axis, oriented so forward is positive.
function axisPosition(event) {
	return state.mode === 'vertical' ? event.clientY : -event.clientX;
}

// Swipe

function startSwipe(event) {
	if (state.phase === 'inertia') catchFlap();
	const position = axisPosition(event);
	const degreesPerPixel =
		event.pointerType === 'mouse' ? MOUSE_DRAG_DEGREES_PER_PIXEL : DRAG_DEGREES_PER_PIXEL;
	// Offset the start so the drag carries on from the caught flap's travel. It's 0 when idle.
	const start = position - state.travel / degreesPerPixel;
	const samples = [{ position, time: event.timeStamp }];
	pointer = { id: event.pointerId, start, degreesPerPixel, samples };
	// Either flap at the hinge could end up under the finger, depending on which way the drag goes.
	grabBounces([travelPage(), travelPage() - 1]);
	state.phase = 'dragging';
	state.velocity = 0;
}

// Keep the completed ticks, and pick the flap up where it's drawn.
function catchFlap() {
	const angle = drawnHingeAngle();
	stopInertia();
	state.page = travelPage();
	state.travel = angle;
	state.target = 0;
	state.inertia = null;
}

function dragSwipe(event) {
	// Phones batch several moves into one event. The coalesced ones give the release window more samples.
	const moves = event.getCoalescedEvents?.() ?? [];
	for (const move of moves.length > 0 ? moves : [event]) addSample(move);
	const position = axisPosition(event);
	// A drag can tick through pages by itself, as far as inertia could land.
	const maxTravel = MAX_TICKS_PER_SWIPE * TICK_DEGREES;
	state.travel = clamp((position - pointer.start) * pointer.degreesPerPixel, -maxTravel, maxTravel);
	state.velocity = windowVelocity(pointer.samples) * pointer.degreesPerPixel;
}

function addSample(event) {
	const sample = { position: axisPosition(event), time: event.timeStamp };
	pointer.samples = addToReleaseWindow(pointer.samples, sample);
}

function releaseSwipe(event) {
	// The lift's own sample shows if the finger stopped before lifting. A cancel's position isn't reliable.
	if (event.type === 'pointerup') addSample(event);
	const releaseVelocity = windowVelocity(pointer.samples);
	state.velocity = releaseVelocity * COAST_DEGREES_PER_PIXEL;
	state.releaseSpeed = Math.abs(releaseVelocity);
	pointer = null;
	const normalFriction = event.pointerType === 'mouse' ? MOUSE_FRICTION : 1;
	const plan = planInertia(state.travel, state.velocity, SWIPE_LANDINGS, normalFriction);
	state.phase = 'inertia';
	state.target = plan.target;
	state.inertia = {
		start: state.travel,
		velocity: state.velocity,
		releaseLooseness: loosenessAt(Math.abs(state.velocity)),
		fall: null, // See updateFall.
		coasts: plan.coasts,
		frictionScale: plan.frictionScale,
		durationMs: plan.durationMs,
		elapsedMs: 0
	};
	startInertia();
}

// Inertia

function startInertia() {
	inertiaLoop = startFrameLoop((frameMs) => {
		tickInertia(frameMs);
		render();
		return state.phase === 'inertia';
	});
}

function stopInertia() {
	inertiaLoop?.stop();
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
	checkClack(inertia, motion.landed);
	// Both motions stop on the target, so settling there doesn't move the flap.
	if (motion.landed) settle(state.target / TICK_DEGREES);
	else updateFall(inertia);
}

// Looseness

/*
	The looseness of the tick in progress. It's sampled from the flap's speed
	as the tick starts and held until it ends, so a tick's shape never changes
	partway through. A tick is known by the shown page and its direction.
*/
function tickLooseness() {
	const page = travelPage();
	const forward = hingeAngle(state.travel) >= 0;
	const held = state.heldLooseness;
	if (held?.page !== page || held.forward !== forward) {
		state.heldLooseness = { page, forward, looseness: loosenessAt(Math.abs(state.velocity)) };
	}
	return state.heldLooseness.looseness;
}

// Falling

// A flap's own fall point, pull and clack strength (see Fall and Clack in GLOSSARY.md). They come from its
// page in the sequence, so the flap moves the same way each time it comes round a circular sequence.
function ownFlapRandom(flapIndex, salt) {
	return flapRandom(sequencePage(flapIndex, sequence), salt);
}

/*
	The clacker carries a moving flap up to the top of its tick. Once inertia
	carries it past its fall point, gravity takes over and it falls ahead
	of travel onto the stack, where it waits for travel to finish the tick.
	The pull scales with looseness, so a fast swipe keeps an even motion.
	Progress is measured from the end of the tick inertia is moving away
	from, so a snap back falls back over the top towards the start half.

	`fall` is { low, to, direction, fallStartMs, pull, flapIndex, looseness,
	clacked } for the tick in progress, or null until the flap passes its fall
	point. It's dropped at each new tick.
*/
function updateFall(inertia) {
	const [low, high] = tickBounds(state.travel);
	if (inertia.fall?.low === low) return;
	inertia.fall = null;
	const direction = state.target > state.travel ? 1 : -1;
	const covered = (state.travel - (direction > 0 ? low : high)) * direction;
	const flapIndex = movingFlapIndex(travelPage(), hingeAngle(state.travel) >= 0);
	const fallPoint = lerp(MIN_FALL_POINT, MAX_FALL_POINT, ownFlapRandom(flapIndex, 0));
	if (covered < fallPoint * TICK_DEGREES) return;
	// The tick inertia was released in uses the looseness at release, since its held looseness is the drag's.
	const releasedHere = inertia.start > low && inertia.start < high;
	const looseness = releasedHere ? inertia.releaseLooseness : tickLooseness();
	const pull = lerp(MIN_FALL_PULL, MAX_FALL_PULL, ownFlapRandom(flapIndex, 1)) * looseness;
	const to = direction > 0 ? high : low;
	const fallStartMs = inertia.elapsedMs;
	inertia.fall = { low, to, direction, fallStartMs, pull, flapIndex, looseness, clacked: false };
}

// Clack, knock-back and rebound

/*
	Each clack starts a bounce: a spring in the half the flap landed in.
	Its `offset` is how far the clacked flap has rebounded towards the hinge, in
	drawn degrees, and the flaps beneath it are knocked back by KNOCK_BACK
	shares of it. A bounce tracks its flap by index, not by element, so it
	carries on when the moving flap hands over to a tier at the end of a tick.
	Bounces run on their own frame loop, so they carry on after settle.
*/
const bounces = []; // { half, clackedIndex, offset, velocity, rebound, grabbed }
let bounceLoop = null;

// Clack once the falling flap reaches the stack, or once travel gets there first or inertia lands.
function checkClack(inertia, landed) {
	const fall = inertia.fall;
	if (!fall || fall.clacked) return;
	const fallMs = inertia.elapsedMs - fall.fallStartMs;
	const travelThere = (state.travel - fall.to) * fall.direction >= 0;
	if (!landed && !travelThere && movingTravel(state.inertia, state.travel) !== fall.to) return;
	fall.clacked = true;
	const impactSpeed = Math.abs(state.velocity) + fall.pull * fallMs;
	const strength = lerp(MIN_CLACK_STRENGTH, MAX_CLACK_STRENGTH, ownFlapRandom(fall.flapIndex, 2));
	const kick = impactSpeed * fall.looseness * strength * CLACK_KICK;
	if (kick <= 0) return;
	const half = fall.direction > 0 ? 'end' : 'start';
	bounces.push({ half, clackedIndex: fall.flapIndex, offset: 0, velocity: kick, rebound: 1, grabbed: false });
	startBounces();
}

// One loop moves every bounce, so a clack while bounces are moving just joins it.
function startBounces() {
	if (bounceLoop?.running) return;
	bounceLoop = startFrameLoop((frameMs) => {
		stepBounces(frameMs);
		// Inertia renders every frame itself.
		if (state.phase !== 'inertia') render();
		return bounces.length > 0;
	});
}

// Move each bounce's spring on by `frameMs` and drop the ones at rest.
function stepBounces(frameMs) {
	for (const bounce of bounces) {
		const spring = stepDampedSpring(bounce.offset, bounce.velocity, frameMs, BOUNCE_SWING_MS, BOUNCE_DAMPING);
		bounce.offset = spring.offset;
		bounce.velocity = spring.velocity;
		if (bounce.grabbed) bounce.rebound = Math.max(0, bounce.rebound - frameMs / GRAB_FADE_MS);
	}
	for (let index = bounces.length - 1; index >= 0; index--) {
		const bounce = bounces[index];
		if (springAtRest(bounce.offset, bounce.velocity)) bounces.splice(index, 1);
	}
}

// The finger takes over these flaps, so their rebounds fade out. The knock-backs beneath carry on.
function grabBounces(flapIndices) {
	for (const bounce of bounces) if (flapIndices.includes(bounce.clackedIndex)) bounce.grabbed = true;
}

// Commit `pageDelta` and return the clacker to rest. The flap resets to the start half instantly.
function settle(pageDelta) {
	state.page += pageDelta;
	state.phase = 'idle';
	state.travel = 0;
	state.velocity = 0;
	state.target = 0;
	state.inertia = null;
	state.heldLooseness = null;
}

// Spin

function pointerAngle(event) {
	const { centre } = pointer;
	return (Math.atan2(event.clientY - centre.y, event.clientX - centre.x) * 180) / Math.PI;
}

// Start a spin drag where the pointer pressed. A press during a spin-down or seat is a catch, so the clacker
// stops where it's drawn.
function startSpin(event) {
	stopSpinMotion();
	state.spinVelocity = 0;
	state.spinDown = null;
	const rect = clacker.getBoundingClientRect();
	pointer = {
		id: event.pointerId,
		centre: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
		// The layout width, since a turned clacker's bounding box is wider than the clacker.
		rimRadius: clacker.offsetWidth / 2,
		samples: []
	};
	pointer.lastAngle = pointerAngle(event);
	addSpinSample(event);
	state.phase = 'dragging';
}

// Turn the clacker 1:1 with the pointer's angle round the centre, and sample the pointer for the release speed.
function dragSpin(event) {
	// Phones batch several moves into one event. The coalesced ones give the release window more samples.
	const moves = event.getCoalescedEvents?.() ?? [];
	for (const move of moves.length > 0 ? moves : [event]) addSpinSample(move);
	const angle = pointerAngle(event);
	state.spinAngle += shortestTurn(pointer.lastAngle, angle);
	pointer.lastAngle = angle;
}

function addSpinSample(event) {
	const sample = { x: event.clientX, y: event.clientY, time: event.timeStamp };
	pointer.samples = addToReleaseWindow(pointer.samples, sample);
}

/*
	The spin keeps the pointer's speed along the rim, turned into a spin at the
	rim radius, so a flick near the centre doesn't spin wildly. A fast release
	spins down and a slow one seats straight away. A cancel does the same, so
	the clacker never stops between detents.
*/
function releaseSpin(event) {
	// The lift's own sample shows if the finger stopped before lifting. A cancel's position isn't reliable.
	if (event.type === 'pointerup') addSpinSample(event);
	const releaseRimSpeed = rimSpeed(pointer.samples, pointer.centre);
	state.releaseSpeed = Math.abs(releaseRimSpeed);
	state.spinVelocity = ((releaseRimSpeed / pointer.rimRadius) * 180) / Math.PI;
	pointer = null;
	if (Math.abs(state.spinVelocity) > SEAT_SPEED) startSpinDown();
	else startSeat();
	startSpinMotion();
}

function startSpinDown() {
	const speed = Math.abs(state.spinVelocity);
	state.phase = 'spin-down';
	state.spinDown = {
		start: state.spinAngle,
		velocity: state.spinVelocity,
		elapsedMs: 0,
		handoverMs: spinDownTime(speed, SEAT_SPEED)
	};
}

// Turn the clacker to where the spin-down has carried it after `frameMs` more ms, and seat it once it's slow.
function stepSpinDown(frameMs) {
	const spinDown = state.spinDown;
	spinDown.elapsedMs = Math.min(spinDown.elapsedMs + frameMs, spinDown.handoverMs);
	const direction = Math.sign(spinDown.velocity);
	const speed = Math.abs(spinDown.velocity);
	state.spinAngle = spinDown.start + direction * spinDownDistance(speed, spinDown.elapsedMs);
	state.spinVelocity = direction * spinDownSpeed(speed, spinDown.elapsedMs);
	if (spinDown.elapsedMs === spinDown.handoverMs) startSeat();
}

// Seat into the detent nearest where the spin-down would stop from here, carrying on at the spin's velocity.
function startSeat() {
	const speed = Math.abs(state.spinVelocity);
	const stopDistance = spinDownDistance(speed, spinDownTime(speed, 0));
	const naturalStop = state.spinAngle + Math.sign(state.spinVelocity) * stopDistance;
	state.phase = 'seating';
	state.spinDown = null;
	state.spinDetent = nearestDetent(naturalStop);
}

// Turn the clacker through its spin-down and seat until it comes to rest.
function startSpinMotion() {
	spinLoop = startFrameLoop((frameMs) => {
		if (state.phase === 'spin-down') stepSpinDown(frameMs);
		else stepSeat(frameMs);
		render();
		return state.phase === 'spin-down' || state.phase === 'seating';
	});
}

// The detent the spin is seating into, or null when it isn't seating.
function seatDetent() {
	return state.phase === 'seating' ? state.spinDetent : null;
}

// Stop the spin's frame loop, leaving the clacker where it's drawn. A catch uses this to stop it dead.
function stopSpinMotion() {
	spinLoop?.stop();
}

// Move the seat's spring on by `frameMs`, and land on the detent once it's at rest. Its page becomes current.
function stepSeat(frameMs) {
	const offset = state.spinAngle - state.spinDetent;
	const spring = stepDampedSpring(offset, state.spinVelocity, frameMs, SEAT_SWING_MS, SEAT_DAMPING);
	state.spinAngle = state.spinDetent + spring.offset;
	state.spinVelocity = spring.velocity;
	if (!springAtRest(spring.offset, spring.velocity)) return;
	state.page = spinShownPage(state.spinDetent, null);
	state.spinAngle = state.spinDetent;
	state.spinVelocity = 0;
	state.phase = 'idle';
}

// Pointer wiring

// Until the first load() there are no pages, so the clacker ignores input, just as render() draws nothing.
function pressPointer(event) {
	if (pointer || event.button !== 0 || !sequence) return;
	clacker.setPointerCapture(event.pointerId);
	if (state.mode === 'spin') startSpin(event);
	else startSwipe(event);
	render();
}

function movePointer(event) {
	if (!pointer || event.pointerId !== pointer.id) return;
	if (state.mode === 'spin') dragSpin(event);
	else dragSwipe(event);
	render();
}

// A pointer lifting or being cancelled releases the drag, and a spin or a swipe handles its own release.
function endPointer(event) {
	if (!pointer || event.pointerId !== pointer.id) return;
	if (state.mode === 'spin') releaseSpin(event);
	else releaseSwipe(event);
	render();
}

// The calling code's API

/*
	Turn `element` into the clacker, and return its controls: load() and
	repaint(). The handlers are optional, and hear the page events:
	onShownPage({ page, direction }) and onCurrentPage({ page }), with pages
	in the loaded sequence. They run before the frame is painted, so content
	they change shows in the same frame.
*/
export function createClacker(element, { onShownPage, onCurrentPage } = {}) {
	if (clacker) throw new Error('The prototype has one clacker, until DAI-64 gives each its own state.');
	clacker = element;
	clacker.append(...flapsBackToFront.map((flap) => flap.element));
	// Each handler also records its event for the ?debug readout.
	reporter = createPageReporter({
		onShownPage(event) {
			lastEvents.shown = event;
			onShownPage?.(event);
		},
		onCurrentPage(event) {
			lastEvents.current = event;
			onCurrentPage?.(event);
		}
	});
	clacker.addEventListener('pointerdown', pressPointer);
	clacker.addEventListener('pointermove', movePointer);
	clacker.addEventListener('pointerup', endPointer);
	clacker.addEventListener('pointercancel', endPointer);
	return { load, repaint: render };
}

/*
	Start the clacker over at rest on `page`, driven by `mode` (vertical,
	horizontal or spin). `pageContent(page)` gives a page's { label, colour }
	for each page in a sequence of `pageCount` pages, wrapping round if it's
	`circular`. It's asked many times a frame, so it must be quick, and give the
	same answer within a frame. Loading calls no handler.
*/
function load({ mode, pageCount, circular, pageContent, page }) {
	stopAllMotion();
	settle(0);
	bounces.length = 0;
	sequence = { pageCount, circular, pageContent };
	state.mode = mode;
	state.page = page;
	resetSpin(mode === 'spin' ? page : 0);
	lastEvents.shown = null;
	lastEvents.current = null;
	reporter.reset(pageSnapshot(), sequence);
	render();
}

// Stop every frame loop and let go of the pointer, leaving the clacker where it's drawn.
function stopAllMotion() {
	stopInertia();
	stopSpinMotion();
	if (pointer && clacker.hasPointerCapture(pointer.id)) clacker.releasePointerCapture(pointer.id);
	pointer = null;
}

// Put the spin at rest on `page`'s detent. Each detent is a page, counting from page 0 at 0°.
function resetSpin(page) {
	state.spinAngle = page * SPIN_DETENT_DEGREES;
	state.spinVelocity = 0;
	state.spinDown = null;
}

function pageSnapshot() {
	return { page: shownPage(), idle: state.phase === 'idle' };
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
function setFlap(flap, drawn, front, back) {
	flap.element.style.setProperty('--drawn-angle', drawn);
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

	As the tick progresses, each tier slides one place towards its pose for the
	next page, linearly when tight and eased when loose. In a forward tick start
	tiers move forward and end tiers move back, and a backward tick is the
	mirror image. When the tick completes every flap already sits in the next
	page's rest pose, so nothing jumps. Offstage flaps wait behind the back tier
	at its tilt, already showing their pages. A back tier rising away uncovers
	one, and a back tier being covered by the tier in front goes offstage.
*/
function renderFlaps() {
	const page = facePage();
	const forward = hingeAngle(state.travel) >= 0;
	// The fan follows the moving flap as it's drawn, so the stacks react as it falls, not as travel catches up.
	const angle = drawnHingeAngle();
	const slides = tierSlides(Math.abs(angle) / TICK_DEGREES, tickLooseness(), forward);
	const movingDrawn = placeMovingFlap(page, forward, angle);
	placeHalf('start', page, forward, slides.start, movingDrawn);
	placeHalf('end', page, forward, slides.end, movingDrawn);
}

/*
	Place the moving flap for a tick and paint its pages. It keeps tier 0's tilt for the whole tick.

	`page` is the page the fan is painted from, `forward` is the tick's direction, and `angle` is the
	moving flap's drawn hinge angle, from −180 to 180 (see drawnHingeAngle).

	Returns the angle the moving flap is drawn at, in degrees, after any bounce.
*/
function placeMovingFlap(page, forward, angle) {
	const flapIndex = movingFlapIndex(page, forward);
	const plainAngle = drawnAngle(forward ? angle : TICK_DEGREES + angle, tierTilt(0));
	const half = plainAngle < TICK_DEGREES / 2 ? 'start' : 'end';
	const drawn = plainAngle + bounceOffset(bounces, half, flapIndex);
	// Nothing ticks on the spin tab, so the moving flap lies level with end tier 0. Lifted, perspective draws it
	// a fraction bigger than the flap beside it.
	flaps.moving.element.style.setProperty('--lift', `${state.mode === 'spin' ? 0 : 1}px`);
	setFlap(flaps.moving, drawn, pageAt(flapIndex), pageAt(flapIndex + 1));
	return drawn;
}

/*
	Place one half's tiers and its offstage flap, from the hinge out, and paint their pages.

	`half` is 'start' or 'end', `page` is the page the fan is painted from, and `forward` is the tick's
	direction. `slide` is how far this half's tiers have slid towards their next pose, from 0 to 1 (see
	tierSlides). `movingDrawn` is the angle the moving flap is drawn at.

	The moving flap stands in for tier 0 of the half it leaves, so that tier's own flap is hidden. In the
	half it leaves, each tier slides towards the tier in front, and in the half it lands in, towards the
	tier behind.
*/
function placeHalf(half, page, forward, slide, movingDrawn) {
	const leaving = forward === (half === 'start');
	let frontmost = movingDrawn;
	flaps[half].forEach((flap, tier) => {
		flap.element.hidden = leaving && tier === 0;
		const towards = leaving ? tier - 1 : tier + 1;
		const tilt = lerp(tierTilt(tier), tierTilt(towards), slide);
		frontmost = placeRestingFlap(flap, half, tilt, tierFlapIndex(half, tier, page), frontmost);
	});
	const offstageTier = REST_TILTS.length;
	const offstageIndex = tierFlapIndex(half, offstageTier, page);
	placeRestingFlap(flaps.offstage[half], half, tierTilt(offstageTier), offstageIndex, frontmost);
}

/*
	Place a resting flap and paint its page on both sides.

	`flap` is the flap to place, resting in `half` ('start' or 'end') at rest tilt `tilt`, in degrees.
	`flapIndex` is its flap index (see Flaps in pages.js). `frontmost` is the angle the flap in front of it
	is drawn at.

	No flap is drawn past the one in front of it, so a bouncing flap gets pushed along instead of passed
	through. Returns the angle the next flap out mustn't pass: this flap's, or `frontmost` again if this
	flap is hidden.
*/
function placeRestingFlap(flap, half, tilt, flapIndex, frontmost) {
	const restAngle = half === 'start' ? 0 : TICK_DEGREES;
	const bounced = drawnAngle(restAngle, tilt) + bounceOffset(bounces, half, flapIndex);
	const drawn = half === 'start' ? Math.min(bounced, frontmost) : Math.max(bounced, frontmost);
	const page = pageAt(restingFlapPage(half, flapIndex));
	setFlap(flap, drawn, page, page);
	return flap.element.hidden ? frontmost : drawn;
}

// Fill the ?debug readout from state.
function renderDebug() {
	if (!debugPanel) return;
	const shown = shownPage();
	debugFields.mode.textContent = state.mode;
	debugFields.phase.textContent = state.phase;
	debugFields.current.textContent = sequencePage(state.page, sequence);
	debugFields.shown.textContent = sequencePage(shown, sequence);
	debugFields.shownEvent.textContent = lastEvents.shown
		? `${lastEvents.shown.page} ${lastEvents.shown.direction}`
		: '–';
	debugFields.currentEvent.textContent = lastEvents.current?.page ?? '–';
	debugFields.travel.textContent = `${state.travel.toFixed(1)}° / ${state.target}°`;
	debugFields.angle.textContent = `${hingeAngle(state.travel).toFixed(1)}°`;
	debugFields.velocity.textContent = `${state.velocity.toFixed(4)} °/ms`;
	const nowLooseness = loosenessAt(Math.abs(state.velocity));
	debugFields.looseness.textContent = `${tickLooseness().toFixed(2)} (now ${nowLooseness.toFixed(2)})`;
	debugFields.releaseSpeed.textContent = `${state.releaseSpeed.toFixed(2)} px/ms`;
	debugFields.ticks.textContent = `${completedTicks(state.travel)} / ${state.target / TICK_DEGREES}`;
	debugFields.spin.textContent = `${state.spinAngle.toFixed(1)}°`;
	debugFields.spinVelocity.textContent = `${state.spinVelocity.toFixed(4)} °/ms`;
	debugFields.slowMo.textContent = slowMo ? `${SLOW_MO_FACTOR}×` : 'off';
	slowMoToggle.checked = slowMo;
}

// Tell the calling code about any page events first, so content its handlers change shows in this frame.
function render() {
	if (!sequence) return;
	reporter.report(pageSnapshot());
	clacker.dataset.mode = state.mode;
	clacker.dataset.axis = state.mode === 'vertical' ? 'vertical' : 'horizontal';
	clacker.setAttribute('aria-label', ARIA_LABELS[state.mode]);
	clacker.style.setProperty('--spin-angle', state.spinAngle);
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
