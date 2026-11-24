// The calling code: the toy around the clacker. It owns the tabs, the pages and the mixed colour, and the
// clacker tells it when it moves.

import { createClacker } from './clacker.js';
import {
	COMPONENTS,
	STARTING_COLOUR,
	componentSequence,
	openingPage,
	readableTextOn,
	valueAt
} from './colour.js';
import { sequencePage } from './pages.js';

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
const clacker = createClacker(document.querySelector('.clacker'), { onShownPage: showComponentPage });
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
	paintBackground();
}

function paintBackground() {
	const root = document.documentElement;
	root.style.setProperty('--colour', `hsl(${colour.hue} ${colour.saturation}% ${colour.lightness}%)`);
	root.dataset.text = readableTextOn(colour);
}

// Each tab opens on the page or detent for its component's current value.
function showTab(mode) {
	shownMode = mode;
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
paintBackground();
showTab('vertical');
