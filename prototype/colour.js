// The mixed colour and its components (see Colour in GLOSSARY.md). Hue is in degrees, and saturation and
// lightness are percentages.

import { SPIN_DETENT_DEGREES } from './spin.js';

/*
	Components

	A component is { range, steps, circular }:
	- `range` is how far its value runs from 0: 360 for hue, and 100 for saturation and lightness.
	- `steps` is how many equal steps the range is cut into. Each step is one page or detent.
	- `circular` is true if the value wraps round, as hue does, and false if it stops at 0 and range.
*/

// The spin turns this far to take lightness from 0% to 100%, so each detent is one step.
export const LIGHTNESS_TURN_DEGREES = 1440;

export const COMPONENTS = {
	hue: { range: 360, steps: 36, circular: true },
	saturation: { range: 100, steps: 14, circular: false },
	lightness: { range: 100, steps: LIGHTNESS_TURN_DEGREES / SPIN_DETENT_DEGREES, circular: false }
};

// Saturation page 10 is about 71.4%.
export const STARTING_COLOUR = { hue: 210, saturation: valueAt(10, COMPONENTS.saturation), lightness: 50 };

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

	`page` is a page index in the component's sequence, from 0 to its last page. `component` is the colour
	component the page belongs to: `range`, how far its value runs from 0, and `steps`, how many equal
	steps that range is cut into, one per page or detent.

	Returns the value, `page` steps up from 0. The swipes and the spin both stop at their limits, so a page
	never runs past either end of the range.
*/
export function valueAt(page, component) {
	// Multiplied before dividing, so a value such as 25% comes out exact.
	return (page * component.range) / component.steps;
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
	The colour a page's face shows: the colour you'd get if you stopped there.

	`page` is a page index in the component's sequence, from 0 to its last page. `name` is the component
	the tab drives: 'hue', 'saturation' or 'lightness'. `colour` is the mixed colour, { hue, saturation,
	lightness }, and isn't changed.

	Returns a new { hue, saturation, lightness }: `colour` with component `name` set to the page's value,
	and the other two held where they are.
*/
export function pageColour(page, name, colour) {
	return { ...colour, [name]: valueAt(page, COMPONENTS[name]) };
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
	A colour's red, green and blue, as the readout shows them.

	`colour` is { hue, saturation, lightness } as in hslToRgb. It isn't changed.

	Returns { red, green, blue }, each a whole number from 0 to 255. A channel halfway between two whole
	numbers rounds up, as browsers round it when they paint, so the readout matches the background.
*/
export function roundedRgb(colour) {
	const { red, green, blue } = hslToRgb(colour);
	return { red: Math.round(red * 255), green: Math.round(green * 255), blue: Math.round(blue * 255) };
}

/*
	The hex code for a colour.

	`rgb` is { red, green, blue }, each a whole number from 0 to 255, as roundedRgb gives it. It isn't
	changed.

	Returns the code as '#RRGGBB', in capitals, with a channel under 16 padded with a leading zero.
*/
export function hexOf({ red, green, blue }) {
	const pair = (channel) => channel.toString(16).padStart(2, '0');
	return `#${pair(red)}${pair(green)}${pair(blue)}`.toUpperCase();
}

// Number formats for hslText. Both round a tie to the even neighbour (banker's rounding), so 0.25 shows
// as 0.2 and 0.35 as 0.4. They round the decimal as written, unlike toFixed, which rounds the binary value
// stored for it and so sends 1.005 to 1.00.
const DEGREES_FORMAT = new Intl.NumberFormat('en', {
	maximumFractionDigits: 0,
	roundingMode: 'halfEven',
	useGrouping: false
});
const PERCENT_FORMAT = new Intl.NumberFormat('en', {
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
	roundingMode: 'halfEven',
	useGrouping: false
});

/*
	A colour written as CSS hsl(), as the readout shows it and copies it.

	`colour` is { hue, saturation, lightness } as in hslToRgb. It isn't changed.

	Returns text such as 'hsl(210 70.0% 8.3%)'. Hue is rounded to a whole number of degrees. Saturation
	and lightness always keep one decimal place, so the text stays the same width as they change. All
	three round a tie to even.
*/
export function hslText({ hue, saturation, lightness }) {
	const percent = (value) => `${PERCENT_FORMAT.format(value)}%`;
	return `hsl(${DEGREES_FORMAT.format(hue)} ${percent(saturation)} ${percent(lightness)})`;
}

/*
	A colour written as CSS hsl(), for the browser to paint.

	`colour` is { hue, saturation, lightness } as in hslToRgb. It isn't changed.

	Returns text such as 'hsl(210 70% 8.333333333333334%)'. Unlike hslText, nothing is rounded, so the
	browser paints the same colour that roundedRgb works out for the readout.
*/
export function cssColour({ hue, saturation, lightness }) {
	return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

/*
	A colour written as CSS rgb(), as the readout shows it and copies it.

	`rgb` is { red, green, blue } as hexOf takes it. It isn't changed.

	Returns text such as 'rgb(38 128 217)'.
*/
export function rgbText({ red, green, blue }) {
	return `rgb(${red} ${green} ${blue})`;
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
	if (blackContrast >= whiteContrast) {
		return 'black';
	} else {
		return 'white';
	}
}

/*
	How bright a colour looks, as WCAG defines it.

	`rgb` is { red, green, blue }, each from 0 to 1, as hslToRgb gives it. It isn't changed.

	Returns the brightness, from 0 for black to 1 for white. Each channel is first undone from the
	screen's brightening curve, so a mid grey comes out darker than halfway. Green weighs most and
	blue least, the way the eye sees them.
*/
export function relativeLuminance({ red, green, blue }) {
	const linear = (channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
	return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}
