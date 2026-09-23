import { describe, expect, it } from 'vitest';

import { createClackerConfig, createFlaps, type Face } from './clacker-model';

const faceFor = (position: number, side: 'front' | 'back'): Face => ({
	id: `face-${position}-${side}`,
	label: `${position}-${side}`,
	background: side === 'front' ? '#123456' : '#654321'
});

describe('clacker model', () => {
	it('creates exactly the configured number of flaps with explicit faces', () => {
		const config = createClackerConfig({ flapCount: 3 });
		const flaps = createFlaps(config, faceFor);

		expect(flaps).toEqual([
			{
				id: 'flap-1',
				position: 0,
				restAngleDegrees: 0,
				frontFace: { id: 'face-0-front', label: '0-front', background: '#123456' },
				backFace: { id: 'face-0-back', label: '0-back', background: '#654321' }
			},
			{
				id: 'flap-2',
				position: 1,
				restAngleDegrees: 0,
				frontFace: { id: 'face-1-front', label: '1-front', background: '#123456' },
				backFace: { id: 'face-1-back', label: '1-back', background: '#654321' }
			},
			{
				id: 'flap-3',
				position: 2,
				restAngleDegrees: 0,
				frontFace: { id: 'face-2-front', label: '2-front', background: '#123456' },
				backFace: { id: 'face-2-back', label: '2-back', background: '#654321' }
			}
		]);
	});

	it('rejects a non-positive or fractional flap count', () => {
		for (const flapCount of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(() => createClackerConfig({ flapCount })).toThrow(RangeError);
		}
	});
});
