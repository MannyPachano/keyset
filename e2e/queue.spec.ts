import { expect, test } from '@playwright/test';

/* One journey, end to end, against the built app: narrow the list, act on a
   few rows, and prove the state survives a reload. Everything below the
   surface is covered by the unit and component suites; this is the part that
   only a real browser can answer. */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });
});

test('filter, select a range, assign in bulk, and survive a reload', async ({ page }) => {
  await page.getByRole('button', { name: /^New/ }).click();
  await expect(page).toHaveURL(/status=new/);

  const rowCount = await page.locator('tbody tr').count();
  expect(rowCount).toBeGreaterThan(3);

  const boxes = page.locator('tbody .col-check input');
  await boxes.nth(0).click();
  await boxes.nth(2).click({ modifiers: ['Shift'] });
  await expect(page.getByText('3 requests selected')).toBeVisible();

  await page.getByLabel('Assign a contractor to the selected requests').selectOption({ label: 'Halvorsen Plumbing' });
  await expect(page.getByRole('status').filter({ hasText: '3 requests updated' })).toBeAttached({ timeout: 10_000 });

  const assigned = page.locator('tbody tr').first().locator('td').nth(6);
  await expect(assigned).toHaveText('Halvorsen Plumbing');

  // The filter is in the address, so a reload has to land on the same list.
  await page.reload();
  await expect(page.getByRole('button', { name: /^New/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('tbody tr').first().locator('td').nth(6)).toHaveText('Halvorsen Plumbing');
});

test('a failed save puts the rows back and says why', async ({ page }) => {
  await page.getByRole('button', { name: 'Force failures' }).click();

  const first = page.locator('tbody tr').first();
  const before = await first.locator('td').nth(5).innerText();

  await page.locator('tbody .col-check input').first().click();
  await page.getByLabel('Set the priority of the selected requests').selectOption({ label: 'Emergency' });

  await expect(page.getByRole('alert')).toContainText('The server rejected that change', { timeout: 10_000 });
  await expect(first.locator('td').nth(5)).toHaveText(before);
});

test('the detail panel is reachable by link and returns focus on close', async ({ page }) => {
  const ref = await page.locator('tbody .ref-link').first().innerText();
  await page.locator('tbody .ref-link').first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/request=/);

  const url = page.url();
  await page.goto(url);
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator(':focus')).toHaveText(ref);
});

test('the week board moves a visit with the keyboard alone', async ({ page }) => {
  await page.getByRole('button', { name: 'This week' }).click();
  await expect(page).toHaveURL(/view=week/);

  const card = page.locator('.board-card').first();
  await card.focus();
  const ref = await card.locator('.ref-link').innerText();

  await page.keyboard.press('Enter');
  await expect(card).toHaveAttribute('aria-grabbed', 'true');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');

  await expect(page.locator('[aria-live="assertive"]')).toContainText('Moved to');
  await expect(page.locator('.board-card').filter({ hasText: ref })).toHaveCount(1);
});
