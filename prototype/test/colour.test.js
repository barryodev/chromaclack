import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	COMPONENTS,
	STARTING_COLOUR,
	componentSequence,
	hexOf,
	hslText,
	hslToRgb,
	openingPage,
	readableTextOn,
	relativeLuminance,
	rgbText,
	roundedRgb,
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

test('a tab opens on the page for its value', () => {
	assert.equal(openingPage(210, hue), 14);
	assert.equal(openingPage(70, saturation), 7);
});

test('a lightness between whole percentages opens back on its own detent', () => {
	const detentFive = valueAt(5, lightness); // 41.666…%
	assert.equal(openingPage(detentFive, lightness), 5);
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

test('each primary weighs what WCAG gives it, from nothing for black to all of it for white', () => {
	assert.equal(relativeLuminance({ red: 1, green: 0, blue: 0 }), 0.2126);
	assert.equal(relativeLuminance({ red: 0, green: 1, blue: 0 }), 0.7152);
	assert.equal(relativeLuminance({ red: 0, green: 0, blue: 1 }), 0.0722);
	assert.equal(relativeLuminance({ red: 0, green: 0, blue: 0 }), 0);
	assert.equal(relativeLuminance({ red: 1, green: 1, blue: 1 }), 1);
});

test('a mid grey is darker than halfway, because screens brighten on a curve', () => {
	const midGrey = relativeLuminance({ red: 0.5, green: 0.5, blue: 0.5 });
	assert.equal(midGrey.toFixed(3), '0.214');
});

test('the starting colour reads as rgb(38 128 217) and #2680D9', () => {
	const rgb = roundedRgb(STARTING_COLOUR);
	assert.deepEqual(rgb, { red: 38, green: 128, blue: 217 });
	assert.equal(rgbText(rgb), 'rgb(38 128 217)');
	assert.equal(hexOf(rgb), '#2680D9');
});

test('black and white read as 0 and 255 on every channel', () => {
	const black = { hue: 0, saturation: 0, lightness: 0 };
	const white = { hue: 0, saturation: 0, lightness: 100 };
	assert.deepEqual(roundedRgb(black), { red: 0, green: 0, blue: 0 });
	assert.deepEqual(roundedRgb(white), { red: 255, green: 255, blue: 255 });
});

test('a channel under 16 gets a leading zero in hex', () => {
	assert.equal(hexOf({ red: 10, green: 0, blue: 255 }), '#0A00FF');
});

test('hsl text keeps one decimal of saturation and lightness', () => {
	assert.equal(hslText(STARTING_COLOUR), 'hsl(210 70.0% 50.0%)');
	assert.equal(hslText({ hue: 0, saturation: 0, lightness: valueAt(1, lightness) }), 'hsl(0 0.0% 8.3%)');
});

test('hsl text rounds a value halfway between two neighbours to the even one', () => {
	assert.equal(hslText({ hue: 2.5, saturation: 0.25, lightness: 0.35 }), 'hsl(2 0.2% 0.4%)');
	assert.equal(hslText({ hue: 3.5, saturation: 0.15, lightness: 0.45 }), 'hsl(4 0.2% 0.4%)');
});
