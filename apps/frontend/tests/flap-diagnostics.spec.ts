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

async function attachScreenshot(testInfo: TestInfo, page: Page, name: string) {
	const path = testInfo.outputPath(`${name}.png`);
	await page.screenshot({ path, fullPage: true });
	await testInfo.attach(name, {
		path,
		contentType: 'image/png'
	});
}