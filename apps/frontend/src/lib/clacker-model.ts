export type ClackerConfig = {
	flapCount: number;
};

export type Face = {
	id: string;
	label: string;
	background: string;
};

export type Flap = {
	id: string;
	position: number;
	restAngleDegrees: number;
	frontFace: Face;
	backFace: Face;
};

export function createClackerConfig(config: ClackerConfig): ClackerConfig {
	if (!Number.isInteger(config.flapCount) || config.flapCount <= 0) {
		throw new RangeError('Clacker flap count must be a positive integer.');
	}
	return { flapCount: config.flapCount };
}

export function createFlaps(
	config: ClackerConfig,
	faceFor: (position: number, side: 'front' | 'back') => Face
): readonly Flap[] {
	const validatedConfig = createClackerConfig(config);
	return Array.from({ length: validatedConfig.flapCount }, (_, position) => ({
		id: `flap-${position + 1}`,
		position,
		restAngleDegrees: 0,
		frontFace: faceFor(position, 'front'),
		backFace: faceFor(position, 'back')
	}));
}
