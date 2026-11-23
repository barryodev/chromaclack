// The calling code: the toy around the clacker. It owns the tabs and the pages, and the clacker tells it
// when it moves.

import { createClacker } from './clacker.js';

// Test pages until DAI-58 paints the faces from the colour. Each page's two half pages share a colour and
// label.
const TEST_PAGES = [
	{ label: '1', colour: '#581C87' },
	{ label: '2', colour: '#C026D3' },
	{ label: '3', colour: '#F43F5E' },
	{ label: '4', colour: '#F97316' },
	{ label: '5', colour: '#EAB308' },
	{ label: '6', colour: '#22C55E' },
	{ label: '7', colour: '#06B6D4' },
	{ label: '8', colour: '#3B82F6' }
];

const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
const clacker = createClacker(document.querySelector('.clacker'));
let shownMode = null;

function testPageContent(page) {
	return TEST_PAGES[page];
}

// Each tab starts the clacker over on the first page, until DAI-57 holds one colour across the tabs.
function showTab(mode) {
	shownMode = mode;
	for (const tab of tabs) tab.setAttribute('aria-selected', String(tab.dataset.mode === mode));
	clacker.load({ mode, pageCount: TEST_PAGES.length, circular: true, pageContent: testPageContent, page: 0 });
}

for (const tab of tabs) {
	tab.addEventListener('click', () => {
		if (tab.dataset.mode !== shownMode) showTab(tab.dataset.mode);
	});
}
showTab('vertical');
