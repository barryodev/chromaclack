import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	COMPONENTS,
	STARTING_COLOUR,
	componentSequence,
	cssColour,
	hexOf,
	hslText,
	hslToRgb,
	openingPage,
	pageColour,
	readableTextOn,
	relativeLuminance,
	rgbText,
	roundedRgb,
	valueAt
} from '../colour.js';

// The tests' own components, cut into 24 hue steps, 10 saturation steps and 12 lightness steps. Retuning
// the real step sizes doesn't change what these tests expect.
const hueFixture = { range: 360, steps: 24, circular: true };
const saturationFixture = { range: 100, steps: 10, circular: false };
const lightnessFixture = { range: 100, steps: 12, circular: false };

test('a circular component has a page per step, and a finite one has a page at both ends', () => {
	assert.deepEqual(componentSequence(hueFixture), { pageCount: 24, circular: true });
	assert.deepEqual(componentSequence(saturationFixture), { pageCount: 11, circular: false });
});

test('each page is one step further up its component', () => {
	assert.equal(valueAt(0, hueFixture), 0);
	assert.equal(valueAt(23, hueFixture), 345);
	assert.equal(valueAt(7, saturationFixture), 70);
	assert.equal(valueAt(10, saturationFixture), 100);
	assert.equal(valueAt(12, lightnessFixture), 100);
});

test('a lightness detent that lands on a whole percentage gives it exactly', () => {
	assert.equal(valueAt(3, lightnessFixture), 25);
	assert.equal(valueAt(6, lightnessFixture), 50);
});

test('a tab opens on the page for its value', () => {
	assert.equal(openingPage(210, hueFixture), 14);
	assert.equal(openingPage(70, saturationFixture), 7);
});

test('a lightness between whole percentages opens back on its own detent', () => {
	const detentFive = valueAt(5, lightnessFixture); // 41.666…%
	assert.equal(openingPage(detentFive, lightnessFixture), 5);
});

test('the starting colour sits on a page of every component', () => {
	for (const [name, component] of Object.entries(COMPONENTS)) {
		const page = openingPage(STARTING_COLOUR[name], component);
		assert.equal(valueAt(page, component), STARTING_COLOUR[name]);
	}
});

// A colour for the tests that don't care whether it sits on a page.
const azure = { hue: 210, saturation: 70, lightness: 50 };

test("a page's face takes its own component from the page and holds the other two", () => {
	const firstHue = pageColour(0, 'hue', azure);
	const lastSaturation = pageColour(COMPONENTS.saturation.steps, 'saturation', azure);
	const lastLightness = pageColour(COMPONENTS.lightness.steps, 'lightness', azure);
	assert.deepEqual(firstHue, { hue: 0, saturation: 70, lightness: 50 });
	assert.deepEqual(lastSaturation, { hue: 210, saturation: 100, lightness: 50 });
	assert.deepEqual(lastLightness, { hue: 210, saturation: 70, lightness: 100 });
});

test("a page's face leaves the mixed colour as it was", () => {
	const colour = { ...STARTING_COLOUR };
	pageColour(0, 'hue', colour);
	assert.deepEqual(colour, STARTING_COLOUR);
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

test('azure reads as rgb(38 128 217) and #2680D9', () => {
	const rgb = roundedRgb(azure);
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
	assert.equal(hslText(azure), 'hsl(210 70.0% 50.0%)');
	assert.equal(hslText({ hue: 0, saturation: 0, lightness: 100 / 12 }), 'hsl(0 0.0% 8.3%)');
});

test('hsl text rounds a value halfway between two neighbours to the even one', () => {
	assert.equal(hslText({ hue: 2.5, saturation: 0.25, lightness: 0.35 }), 'hsl(2 0.2% 0.4%)');
	assert.equal(hslText({ hue: 3.5, saturation: 0.15, lightness: 0.45 }), 'hsl(4 0.2% 0.4%)');
});

test('css colour writes the values exactly, without rounding', () => {
	assert.equal(cssColour(azure), 'hsl(210 70% 50%)');
	const darkGrey = { hue: 0, saturation: 0, lightness: 100 / 12 };
	assert.equal(cssColour(darkGrey), 'hsl(0 0% 8.333333333333334%)');
});
