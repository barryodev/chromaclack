import { expect, test, type Page, type TestInfo } from '@playwright/test';

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
	expect(visualPage).toBe(committedPage);
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
