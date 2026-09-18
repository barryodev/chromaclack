export type SwipeDirection = 'positive' | 'negative';

export type LogicalFace = {
	id: string;
	label: string;
};

export type HalfSlotRole = 'first' | 'second';

export type PhysicalHalfSlot = {
	id: string;
	role: HalfSlotRole;
	face: LogicalFace;
};

export function createHalfSlotRing(faces: readonly LogicalFace[]): PhysicalHalfSlot[] {
	return faces.map((face, index) => ({
		id: `half-slot-${index + 1}`,
		role: index % 2 === 0 ? 'first' : 'second',
		face
	}));
}

export function rotateHalfSlotRing<T>(ring: readonly T[], direction: SwipeDirection, steps = 1): T[] {
	if (ring.length === 0) return [];

	const offset = modulo(steps, ring.length);
	if (offset === 0) return [...ring];

	if (direction === 'positive') {
		return [...ring.slice(offset), ...ring.slice(0, offset)];
	}

	return [...ring.slice(-offset), ...ring.slice(0, -offset)];
}

export function visibleHalfSlotWindow<T>(
	ring: readonly T[],
	startIndex: number,
	visibleCount: number
): T[] {
	if (visibleCount <= 0 || ring.length === 0) return [];
	if (visibleCount > ring.length) {
		throw new RangeError('Visible window cannot be larger than the half-slot ring.');
	}

	return Array.from({ length: visibleCount }, (_, offset) =>
		itemAtWrappedIndex(ring, startIndex + offset)
	);
}

export function bufferedHalfSlots<T>(
	ring: readonly T[],
	startIndex: number,
	visibleCount: number
): T[] {
	if (ring.length === 0) return [];
	if (visibleCount < 0 || visibleCount > ring.length) {
		throw new RangeError('Visible window size must fit inside the half-slot ring.');
	}

	const visibleIndexes = new Set(
		Array.from({ length: visibleCount }, (_, offset) => modulo(startIndex + offset, ring.length))
	);

	return ring.filter((_, index) => !visibleIndexes.has(index));
}

function itemAtWrappedIndex<T>(items: readonly T[], index: number): T {
	const item = items[modulo(index, items.length)];
	if (item === undefined) {
		throw new RangeError('Cannot read from an empty ring.');
	}
	return item;
}

function modulo(value: number, length: number) {
	return ((value % length) + length) % length;
}