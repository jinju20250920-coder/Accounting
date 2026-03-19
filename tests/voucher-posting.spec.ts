import { test, expect } from '@playwright/test';

test('Voucher list loads correctly', async ({ page }) => {
  // Navigate to voucher list
  await page.goto('http://localhost:3000/voucher-list');
  await page.waitForLoadState('networkidle');

  // Verify page content - this confirms the app is working
  await expect(page.getByText('凭证管理')).toBeVisible();
  await expect(page.getByRole('button', { name: '新增凭证' })).toBeVisible(); // Only button
  await expect(page.getByRole('paragraph').filter({ hasText: '已记账' })).toBeVisible(); // In stats card
});

test('Can navigate to voucher entry page', async ({ page }) => {
  // Navigate to voucher list
  await page.goto('http://localhost:3000/voucher-list');
  await page.waitForLoadState('networkidle');

  // Navigate to voucher entry page
  await page.click('button:has-text("新增凭证")');
  await page.waitForLoadState('networkidle');

  // Wait for page to fully initialize
  await page.waitForTimeout(2000);

  // Verify basic elements exist
  await expect(page.getByText('分录明细')).toBeVisible(); // Verify on entry page
  await expect(page.locator('input[type="date"]').first()).toBeVisible(); // Date picker
  await expect(page.getByRole('button', { name: '入账' })).toBeVisible(); // Post button
});

test('Voucher list displays status information', async ({ page }) => {
  // Navigate to voucher list
  await page.goto('http://localhost:3000/voucher-list');
  await page.waitForLoadState('networkidle');

  // Wait for page to load
  await page.waitForTimeout(1000);

  // Verify the stats cards show status information
  await expect(page.getByText('全部凭证')).toBeVisible();
  await expect(page.getByRole('paragraph').filter({ hasText: '草稿' })).toBeVisible();
  await expect(page.getByRole('paragraph').filter({ hasText: '审核中' })).toBeVisible();
  await expect(page.getByRole('paragraph').filter({ hasText: '已记账' })).toBeVisible();
});
