// The calling code: the toy around the clacker. It owns the tabs, the pages and the mixed colour, and the
// clacker tells it when it moves.

import { createClacker } from './clacker.js';
import {
	COMPONENTS,
	STARTING_COLOUR,
	componentSequence,
	hexOf,
	hslText,
	openingPage,
	readableTextOn,
	rgbText,
	roundedRgb,
	valueAt
} from './colour.js';
import { sequencePage } from './pages.js';

// How long the note under the readout stays up after a copy, in milliseconds.
const READOUT_NOTE_MS = 1200;

// Placeholder face colours until DAI-58 paints the faces from the colour. They repeat round each tab's pages.
const PLACEHOLDER_COLOURS = [
	'#581C87',
	'#C026D3',
	'#F43F5E',
	'#F97316',
	'#EAB308',
	'#22C55E',
	'#06B6D4',
	'#3B82F6'
];
const PLACEHOLDER_ROUND = { pageCount: PLACEHOLDER_COLOURS.length, circular: true };

// The colour component each tab drives.
const TAB_COMPONENTS = { vertical: 'hue', horizontal: 'saturation', spin: 'lightness' };

const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
const readoutValues = Object.fromEntries(
	[...document.querySelectorAll('.readout-value')].map((button) => [button.dataset.value, button])
);
const readoutNote = document.querySelector('.readout-note');
const readoutNoteText = readoutNote.querySelector('.readout-note-text');
let readoutNoteTimer = null;
// Whether the clacker has come to rest since it was last pressed. Until it has, the colour is still
// passing by, so the readout's buttons don't copy.
let clackerAtRest = true;
const clackerElement = document.querySelector('.clacker');
const clacker = createClacker(clackerElement, {
	onShownPage: showComponentPage,
	onCurrentPage: () => {
		clackerAtRest = true;
	}
});
const colour = { ...STARTING_COLOUR };
let shownMode = null;

// Each page's two half pages share a colour, and its label is its page number.
function placeholderPageContent(page) {
	return { label: String(page), colour: PLACEHOLDER_COLOURS[sequencePage(page, PLACEHOLDER_ROUND)] };
}

// The shown tab's component takes the shown page's value, and the background follows it in the same frame.
function showComponentPage({ page }) {
	const name = TAB_COMPONENTS[shownMode];
	colour[name] = valueAt(page, COMPONENTS[name]);
	paintColour();
}

function paintColour() {
	paintBackground();
	paintReadout();
}

function paintBackground() {
	const root = document.documentElement;
	root.style.setProperty('--colour', `hsl(${colour.hue} ${colour.saturation}% ${colour.lightness}%)`);
	root.dataset.text = readableTextOn(colour);
}

function paintReadout() {
	const rgb = roundedRgb(colour);
	readoutValues.hsl.textContent = hslText(colour);
	readoutValues.rgb.textContent = rgbText(rgb);
	readoutValues.hex.textContent = hexOf(rgb);
}

/*
	Copy a readout value's text to the clipboard, and say whether it worked.

	`button` is one of the readout's value buttons. Its text is what gets copied. The clipboard only works
	over HTTPS or on localhost, so on plain HTTP the copy fails and the note says so.
*/
async function copyReadoutValue(button) {
	try {
		await navigator.clipboard.writeText(button.textContent);
		showReadoutNote(true);
	} catch {
		showReadoutNote(false);
	}
}

/*
	Show the note under the readout for READOUT_NOTE_MS, then fade it out.

	`copied` is true if the copy worked, and false if it didn't. Only a copy that worked shows the
	clipboard icon. A second copy before the note fades starts its time again.
*/
function showReadoutNote(copied) {
	readoutNoteText.textContent = copied ? 'Copied' : "Couldn't copy";
	readoutNote.dataset.copied = String(copied);
	readoutNote.classList.add('readout-note--shown');
	clearTimeout(readoutNoteTimer);
	readoutNoteTimer = setTimeout(() => readoutNote.classList.remove('readout-note--shown'), READOUT_NOTE_MS);
}

// Each tab opens on the page or detent for its component's current value.
function showTab(mode) {
	shownMode = mode;
	clackerAtRest = true;
	for (const tab of tabs) tab.setAttribute('aria-selected', String(tab.dataset.mode === mode));
	const name = TAB_COMPONENTS[mode];
	const component = COMPONENTS[name];
	clacker.load({
		mode,
		...componentSequence(component),
		pageContent: placeholderPageContent,
		page: openingPage(colour[name], component)
	});
}

for (const tab of tabs) {
	tab.addEventListener('click', () => {
		if (tab.dataset.mode !== shownMode) showTab(tab.dataset.mode);
	});
}
// A press starts the clacker moving, and the next current-page event, or a tab switch, means it's at rest.
clackerElement.addEventListener('pointerdown', () => {
	clackerAtRest = false;
});
for (const button of Object.values(readoutValues)) {
	button.addEventListener('click', () => {
		if (clackerAtRest) {
			copyReadoutValue(button);
		}
	});
}

paintColour();
showTab('vertical');
