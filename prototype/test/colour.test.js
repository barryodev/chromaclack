import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	COMPONENTS,
	STARTING_COLOUR,
	componentSequence,
	hslToRgb,
	openingPage,
	readableTextOn,
	valueAt
} from '../colour.js';

const { hue, saturation, lightness } = COMPONENTS;

test('hue wraps round 24 pages, and saturation and lightness have a page at both 0% and 100%', () => {
	assert.deepEqual(componentSequence(hue), { pageCount: 24, circular: true });
	assert.deepEqual(componentSequence(saturation), { pageCount: 11, circular: false });
	assert.deepEqual(componentSequence(lightness), { pageCount: 13, circular: false });
});

test('each page is one step further up its component', () => {
	assert.equal(valueAt(0, hue), 0);
	assert.equal(valueAt(23, hue), 345);
	assert.equal(valueAt(7, saturation), 70);
	assert.equal(valueAt(10, saturation), 100);
	assert.equal(valueAt(12, lightness), 100);
});

test('a lightness detent that lands on a whole percentage gives it exactly', () => {
	assert.equal(valueAt(3, lightness), 25);
	assert.equal(valueAt(6, lightness), 50);
});

test('a page past either end of saturation or lightness gives the value at that end', () => {
	assert.equal(valueAt(13, saturation), 100);
	assert.equal(valueAt(-2, saturation), 0);
	assert.equal(valueAt(14, lightness), 100);
	assert.equal(valueAt(-1, lightness), 0);
});

test('a tab opens on the page for its value, so a page round-trips through its value', () => {
	assert.equal(openingPage(210, hue), 14);
	assert.equal(openingPage(70, saturation), 7);
	assert.equal(openingPage(valueAt(5, lightness), lightness), 5);
});

test('the starting colour sits on a page of every component', () => {
	for (const [name, component] of Object.entries(COMPONENTS)) {
		const page = openingPage(STARTING_COLOUR[name], component);
		assert.equal(valueAt(page, component), STARTING_COLOUR[name]);
	}
});

test('the primaries come out as full red, green and blue', () => {
	assert.deepEqual(hslToRgb({ hue: 0, saturation: 100, lightness: 50 }), { red: 1, green: 0, blue: 0 });
	assert.deepEqual(hslToRgb({ hue: 120, saturation: 100, lightness: 50 }), { red: 0, green: 1, blue: 0 });
	assert.deepEqual(hslToRgb({ hue: 240, saturation: 100, lightness: 50 }), { red: 0, green: 0, blue: 1 });
});

test('no saturation gives a grey whatever the hue, and the ends of lightness give black and white', () => {
	const quarterGrey = { red: 0.25, green: 0.25, blue: 0.25 };
	assert.deepEqual(hslToRgb({ hue: 90, saturation: 0, lightness: 25 }), quarterGrey);
	assert.deepEqual(hslToRgb({ hue: 90, saturation: 100, lightness: 0 }), { red: 0, green: 0, blue: 0 });
	assert.deepEqual(hslToRgb({ hue: 90, saturation: 100, lightness: 100 }), { red: 1, green: 1, blue: 1 });
});

test('pale colours get black text and deep ones white', () => {
	assert.equal(readableTextOn({ hue: 0, saturation: 0, lightness: 100 }), 'black');
	assert.equal(readableTextOn({ hue: 60, saturation: 100, lightness: 50 }), 'black');
	assert.equal(readableTextOn({ hue: 0, saturation: 0, lightness: 0 }), 'white');
	assert.equal(readableTextOn({ hue: 240, saturation: 100, lightness: 50 }), 'white');
});
