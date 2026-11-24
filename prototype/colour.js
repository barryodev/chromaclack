// The mixed colour and its components (see Colour in GLOSSARY.md). Hue is in degrees, and saturation and
// lightness are percentages.

import { clamp } from './maths.js';
import { SPIN_DETENT_DEGREES } from './spin.js';

/*
	Components

	A component is { range, steps, circular }:
	- `range` is how far its value runs from 0: 360 for hue, and 100 for saturation and lightness.
	- `steps` is how many equal steps the range is cut into. Each step is one page or detent.
	- `circular` is true if the value wraps round, as hue does, and false if it stops at 0 and range.
*/

// The spin turns this far to take lightness from 0% to 100%, so each detent is one step.
export const LIGHTNESS_TURN_DEGREES = 1080;

export const COMPONENTS = {
	hue: { range: 360, steps: 24, circular: true },
	saturation: { range: 100, steps: 10, circular: false },
	lightness: { range: 100, steps: LIGHTNESS_TURN_DEGREES / SPIN_DETENT_DEGREES, circular: false }
};

export const STARTING_COLOUR = { hue: 210, saturation: 70, lightness: 50 };

/*
	The page sequence a component's tab loads.

	`component` is a component (see Components above).

	Returns { pageCount, circular }. A circular component has a page per step, because its last step wraps
	round to the first page. A finite one has one more, so both 0 and range are pages.
*/
export function componentSequence(component) {
	const pageCount = component.circular ? component.steps : component.steps + 1;
	return { pageCount, circular: component.circular };
}

/*
	The value a page or detent stands for.

	`page` is a page index in the component's sequence. `component` is a component (see Components above).

	Returns the value, `page` steps up from 0. On a finite component it's clamped to 0 to range, because
	until DAI-59 and DAI-60 add limits, its pages run on past both ends.
*/
export function valueAt(page, component) {
	// Multiplied before dividing, so a value such as 25% comes out exact.
	const value = (page * component.range) / component.steps;
	return component.circular ? value : clamp(value, 0, component.range);
}

/*
	The page a component's tab opens on.

	`value` is the component's value, from 0 to range. `component` is a component (see Components above).

	Returns the index of the page nearest `value`.
*/
export function openingPage(value, component) {
	return Math.round((value * component.steps) / component.range);
}

/*
	A colour's red, green and blue.

	`colour` is { hue, saturation, lightness }, with hue in degrees and the others as percentages. It isn't
	changed.

	Returns { red, green, blue }, each from 0 to 1. This is the formula from the CSS Color spec.
*/
export function hslToRgb({ hue, saturation, lightness }) {
	const lightnessFraction = lightness / 100;
	const spread = (saturation / 100) * Math.min(lightnessFraction, 1 - lightnessFraction);
	const channel = (offset) => {
		const position = (offset + hue / 30) % 12;
		return lightnessFraction - spread * Math.max(-1, Math.min(position - 3, 9 - position, 1));
	};
	return { red: channel(0), green: channel(8), blue: channel(4) };
}

/*
	The text colour that reads best on `colour`.

	`colour` is { hue, saturation, lightness } as in hslToRgb. It isn't changed.

	Returns 'black' or 'white', whichever has the higher contrast against `colour`, as the WCAG guidelines
	measure it.
*/
export function readableTextOn(colour) {
	const luminance = relativeLuminance(hslToRgb(colour));
	const blackContrast = (luminance + 0.05) / 0.05;
	const whiteContrast = 1.05 / (luminance + 0.05);
	return blackContrast >= whiteContrast ? 'black' : 'white';
}

// How bright `rgb` looks, from 0 for black to 1 for white, as WCAG defines it.
function relativeLuminance({ red, green, blue }) {
	const linear = (channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
	return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}
