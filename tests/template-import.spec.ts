import { test, expect } from '@playwright/test';

test('template import functionality', async ({ page }) => {
  // Go to voucher entry page
  await page.goto('http://localhost:3000/voucher-entry-page');

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Try to find the button with a different approach
  const importButton = page.locator('button', { hasText: '导入模板' });
  await expect(importButton).toBeVisible({ timeout: 10000 });

  // Click the button
  await importButton.click();

  // Wait for dialog to appear
  await page.waitForSelector('text=选择凭证模板', { timeout: 10000 });

  // Check if dialog is open
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();

  // Check if loading options are present
  await expect(page.locator('text=加载选项')).toBeVisible();
  await expect(page.locator('text=不加载金额')).toBeVisible();
  await expect(page.locator('text=完全加载')).toBeVisible();

  // Close the dialog
  const cancelButton = page.locator('button', { hasText: '取消' });
  await expect(cancelButton).toBeVisible();
  await cancelButton.click();

  // Wait for dialog to close
  await expect(dialog).not.toBeVisible({ timeout: 5000 });
});
