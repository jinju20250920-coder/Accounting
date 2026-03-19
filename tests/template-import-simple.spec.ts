import { test, expect } from '@playwright/test';

test('template import button exists', async ({ page }) => {
  // Go to voucher entry page
  await page.goto('http://localhost:3000/voucher-entry-page');

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Check if import template button is visible
  const importButton = page.locator('button', { hasText: '导入模板' });
  await expect(importButton).toBeVisible();

  // Click the button
  await importButton.click();

  // Wait a bit
  await page.waitForTimeout(2000);

  // Take a screenshot
  await page.screenshot({ path: 'test-results/template-dialog.png', fullPage: true });
});
