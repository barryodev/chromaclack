import { describe, expect, it } from 'vitest';

import {
	bufferedHalfSlots,
	createHalfSlotRing,
	rotateHalfSlotRing,
	visibleHalfSlotWindow,
	type LogicalFace
} from './flap-model';

const faces = ['1', '2', '3', '4', '5'].map(
	(label): LogicalFace => ({ id: `face-${label}`, label })
);

describe('flap model', () => {
	it('assigns logical faces to physical half-slots', () => {
		const ring = createHalfSlotRing(faces.slice(0, 4));

		expect(ring).toEqual([
			{ id: 'half-slot-1', role: 'first', face: faces[0] },
			{ id: 'half-slot-2', role: 'second', face: faces[1] },
			{ id: 'half-slot-3', role: 'first', face: faces[2] },
			{ id: 'half-slot-4', role: 'second', face: faces[3] }
		]);
	});

	it('rotates the ordered half-slot ring positively', () => {
		const ring = createHalfSlotRing(faces.slice(0, 4));
		const rotated = rotateHalfSlotRing(ring, 'positive');

		expect(rotated.map((slot) => slot.id)).toEqual([
			'half-slot-2',
			'half-slot-3',
			'half-slot-4',
			'half-slot-1'
		]);
	});

	it('rotates the ordered half-slot ring negatively', () => {
		const ring = createHalfSlotRing(faces.slice(0, 4));
		const rotated = rotateHalfSlotRing(ring, 'negative');

		expect(rotated.map((slot) => slot.id)).toEqual([
			'half-slot-4',
			'half-slot-1',
			'half-slot-2',
			'half-slot-3'
		]);
	});

	it('does not duplicate or drop half-slots when rotating', () => {
		const ring = createHalfSlotRing(faces.slice(0, 4));
		const rotated = rotateHalfSlotRing(ring, 'positive', 3);

		expect(new Set(rotated.map((slot) => slot.id))).toEqual(new Set(ring.map((slot) => slot.id)));
		expect(rotated).toHaveLength(ring.length);
	});

	it('supports odd half-slot counts', () => {
		const ring = createHalfSlotRing(faces);
		const rotated = rotateHalfSlotRing(ring, 'negative', 2);

		expect(rotated.map((slot) => slot.face.label)).toEqual(['4', '5', '1', '2', '3']);
	});

	it('derives a wrapped visible window from the ring', () => {
		const ring = createHalfSlotRing(faces);
		const visible = visibleHalfSlotWindow(ring, 3, 4);

		expect(visible.map((slot) => slot.face.label)).toEqual(['4', '5', '1', '2']);
	});

	it('keeps buffer half-slots outside the visible window', () => {
		const ring = createHalfSlotRing(faces);
		const visible = visibleHalfSlotWindow(ring, 1, 3);
		const buffer = bufferedHalfSlots(ring, 1, 3);

		expect(visible.map((slot) => slot.face.label)).toEqual(['2', '3', '4']);
		expect(buffer.map((slot) => slot.face.label)).toEqual(['1', '5']);
	});
});