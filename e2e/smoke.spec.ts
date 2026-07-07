import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/FormCheck/);
});

test('can navigate to tracker', async ({ page }) => {
  await page.goto('/tracker');
  await expect(page.locator('text=Initializing Neural Net')).toBeVisible({ timeout: 10000 });
});
