import { expect, test, type Page, type TestInfo } from '@playwright/test';

test('renders the configured six-flap pool with adjacent matching faces', async ({ page }) => {
	await page.goto('/?debug');

	const deck = page.locator('.flip-deck');
	const flaps = page.locator('[data-flap-id]');
	await expect(flaps).toHaveCount(6);
	await expect(deck).toHaveAttribute('data-flap-count', '6');

	const currentFirst = page.locator('[data-flap-role="current-first"]');
	const currentSecond = page.locator('[data-flap-role="current-second"]');
	const previousFirst = page.locator('[data-flap-role="previous-first"]');
	const followingSecond = page.locator('[data-flap-role="following-second"]');

	expect(await currentFirst.locator('.flip-face--front').textContent()).toBe(
		await currentSecond.locator('.flip-face--front').textContent()
	);
	expect(await currentFirst.locator('.flip-face--back').textContent()).toBe(
		await previousFirst.locator('.flip-face--front').textContent()
	);
	expect(await currentSecond.locator('.flip-face--back').textContent()).toBe(
		await followingSecond.locator('.flip-face--front').textContent()
	);

	const idsBefore = await flaps.evaluateAll((nodes) =>
		nodes.map((node) => node.getAttribute('data-flap-id'))
	);
	const box = await deck.boundingBox();
	expect(box).not.toBeNull();
	if (!box) return;

	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.7, { steps: 12 });
	await page.mouse.up();
	await expect(deck).toHaveAttribute('data-motion-state', 'idle', { timeout: 10000 });

	expect(
		await flaps.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-flap-id')))
	).toEqual(idsBefore);
});

test('applies the six-flap rest tiers and moves all visible roles in either direction', async ({ page }) => {
	const sampleDrag = async (delta: number) => {
		await page.goto('/?debug');
		const deck = page.locator('.flip-deck');
		const roles = ['previous-first', 'current-first', 'current-second', 'following-second'];

		await expect(deck).toHaveAttribute('data-flap-count', '6');
		await expect(page.locator('[data-flap-role="previous-first"]')).toHaveAttribute(
			'data-rest-angle',
			'-36'
		);
		await expect(page.locator('[data-flap-role="current-first"]')).toHaveAttribute(
			'data-rest-angle',
			'-42'
		);
		await expect(page.locator('[data-flap-role="current-second"]')).toHaveAttribute(
			'data-rest-angle',
			'42'
		);
		await expect(page.locator('[data-flap-role="following-second"]')).toHaveAttribute(
			'data-rest-angle',
			'36'
		);
		await expect(page.locator('[data-flap-role="previous-first"]')).toHaveAttribute(
			'style',
			expect.stringContaining('transform: rotateX(-36deg)')
		);
		await expect(page.locator('[data-flap-role="current-first"]')).toHaveAttribute(
			'style',
			expect.stringContaining('transform: rotateX(-42deg)')
		);
		await expect(page.locator('[data-flap-role="current-second"]')).toHaveAttribute(
			'style',
			expect.stringContaining('transform: rotateX(42deg)')
		);
		await expect(page.locator('[data-flap-role="following-second"]')).toHaveAttribute(
			'style',
			expect.stringContaining('transform: rotateX(36deg)')
		);

		const before = await Promise.all(
			roles.map(async (role) => page.locator(`[data-flap-role="${role}"]`).getAttribute('style'))
		);
		const box = await deck.boundingBox();
		expect(box).not.toBeNull();
		if (!box) return;

		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + delta, {
			steps: 8
		});
		const during = await Promise.all(
			roles.map(async (role) => page.locator(`[data-flap-role="${role}"]`).getAttribute('style'))
		);
		await page.mouse.up();

		for (const [index, role] of roles.entries()) {
			expect(during[index], `${role} must move during the swipe`).not.toBe(before[index]);
		}
		await expect(deck).toHaveAttribute('data-motion-state', 'idle', { timeout: 10000 });
		await expect(page.locator('[data-flap-role="current-first"]')).toHaveAttribute(
			'style',
			expect.stringContaining('transform: rotateX(-42deg)')
		);
		await expect(page.locator('[data-flap-role="current-second"]')).toHaveAttribute(
			'style',
			expect.stringContaining('transform: rotateX(42deg)')
		);
	};

	await sampleDrag(140);
	await sampleDrag(-140);
});

test('captures vertical flap swipe diagnostics', async ({ page }, testInfo) => {
	await page.goto('/?debug');

	const deck = page.locator('.flip-deck');
	const diagnostics = page.getByLabel('Flap diagnostics');

	await expect(deck).toBeVisible();
	await expect(diagnostics).toBeVisible();
	await attachScreenshot(testInfo, page, 'flap-initial');

	const box = await deck.boundingBox();
	expect(box).not.toBeNull();
	if (!box) return;

	const centerX = box.x + box.width / 2;
	const centerY = box.y + box.height / 2;

	await page.mouse.move(centerX, centerY);
	await page.mouse.down();
	await page.mouse.move(centerX, centerY + box.height * 0.7, { steps: 12 });
	await attachScreenshot(testInfo, page, 'flap-swipe-down-dragging');
	await page.mouse.up();
	await page.waitForTimeout(350);
	await attachScreenshot(testInfo, page, 'flap-swipe-down-after-release');
});

test('captures horizontal flap swipe diagnostics', async ({ page }, testInfo) => {
	await page.goto('/?debug');
	await page.getByRole('tab', { name: 'Left / Right' }).click();

	const deck = page.locator('.flip-deck');
	const diagnostics = page.getByLabel('Flap diagnostics');

	await expect(deck).toBeVisible();
	await expect(diagnostics).toBeVisible();
	await attachScreenshot(testInfo, page, 'flap-horizontal-initial');

	const box = await deck.boundingBox();
	expect(box).not.toBeNull();
	if (!box) return;

	const centerX = box.x + box.width / 2;
	const centerY = box.y + box.height / 2;

	await page.mouse.move(centerX, centerY);
	await page.mouse.down();
	await page.mouse.move(centerX + box.width * 0.7, centerY, { steps: 12 });
	await attachScreenshot(testInfo, page, 'flap-swipe-right-dragging');
	await page.mouse.up();
	await page.waitForTimeout(350);
	await attachScreenshot(testInfo, page, 'flap-swipe-right-after-release');
});

test('carries a hard swipe through multiple turns before settling', async ({ page }) => {
	await page.goto('/?debug');

	const deck = page.locator('.flip-deck');
	const box = await deck.boundingBox();
	expect(box).not.toBeNull();
	if (!box) return;

	const centerX = box.x + box.width / 2;
	const centerY = box.y + box.height / 2;

	await page.mouse.move(centerX, centerY);
	await page.mouse.down();
	await page.mouse.move(centerX, centerY + box.height * 4.5, { steps: 12 });
	await page.mouse.up();

	await expect(deck).toHaveAttribute('data-motion-state', 'inertia');
	await expect
		.poll(async () => Number(await deck.getAttribute('data-committed-turns')), {
			timeout: 5000
		})
		.toBeGreaterThanOrEqual(2);
	await expect(deck).toHaveAttribute('data-motion-state', 'idle', { timeout: 10000 });
	await expect
		.poll(async () => Number(await deck.getAttribute('data-committed-turns')))
		.toBeGreaterThanOrEqual(2);
});

test('exposes the planned outcome and intermediate page progress', async ({ page }) => {
	await page.goto('/?debug');

	const deck = page.locator('.flip-deck');
	const box = await deck.boundingBox();
	expect(box).not.toBeNull();
	if (!box) return;

	const centerX = box.x + box.width / 2;
	const centerY = box.y + box.height / 2;
	await page.mouse.move(centerX, centerY);
	await page.mouse.down();
	await page.mouse.move(centerX, centerY + box.height * 4.5, { steps: 12 });
	await page.mouse.up();

	await expect(deck).toHaveAttribute('data-release-outcome', 'turn');
	await expect
		.poll(async () => Number(await deck.getAttribute('data-planned-turns')))
		.toBeGreaterThanOrEqual(2);
	await expect
		.poll(async () => Number(await deck.getAttribute('data-completed-turns')))
		.toBeGreaterThan(0);
	await expect
		.poll(async () => Number(await deck.getAttribute('data-remaining-turns')))
		.toBeGreaterThan(0);

	const committedPage = await deck.getAttribute('data-committed-page-label');
	const visualPage = await deck.getAttribute('data-visual-page-label');
	expect(visualPage).not.toBe(committedPage);
});

test('accepts a new gesture while previous inertia is active', async ({ page }) => {
	await page.goto('/?debug');

	const deck = page.locator('.flip-deck');
	const box = await deck.boundingBox();
	expect(box).not.toBeNull();
	if (!box) return;

	const centerX = box.x + box.width / 2;
	const centerY = box.y + box.height / 2;
	await page.mouse.move(centerX, centerY);
	await page.mouse.down();
	await page.mouse.move(centerX, centerY + box.height * 2, { steps: 12 });
	await page.mouse.up();
	await expect(deck).toHaveAttribute('data-motion-state', 'inertia');

	await page.mouse.move(centerX, centerY);
	await page.mouse.down();
	await expect(deck).toHaveAttribute('data-motion-state', 'pointer-down');
	await page.mouse.move(centerX, centerY - box.height * 0.7, { steps: 12 });
	await expect(deck).toHaveAttribute('data-motion-state', 'dragging');
	await page.mouse.up();

	await expect(deck).toHaveAttribute('data-motion-state', 'idle', { timeout: 10000 });
	await expect
		.poll(async () => Number(await deck.getAttribute('data-committed-turns')))
		.toBeGreaterThanOrEqual(1);
});

async function attachScreenshot(testInfo: TestInfo, page: Page, name: string) {
	const path = testInfo.outputPath(`${name}.png`);
	await page.screenshot({ path, fullPage: true });
	await testInfo.attach(name, {
		path,
		contentType: 'image/png'
	});
}
