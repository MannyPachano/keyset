import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/* Accessibility is checked against the built app in a real browser, because
   most of what matters here cannot be seen in the source: computed contrast,
   what a name resolves to once aria and text content are combined, and whether
   anything overflows at the width most people will actually open this on.
   axe is the floor, not the ceiling: the keyboard behaviour it cannot judge is
   covered by the component and journey suites. */

const PHONE = { width: 390, height: 844 };
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function ready(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('table').or(page.locator('.board'))).toBeVisible({ timeout: 15_000 });
}

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => localStorage.setItem('keyset.theme', t), theme);
  await page.reload();
}

/** axe returns a shape that prints as [Object]; this turns it into something
 *  a person can act on without opening the JSON. */
function describe(results: { violations: any[] }): string {
  if (!results.violations.length) return '';
  return results.violations
    .map((v) => {
      const where = v.nodes.slice(0, 12).map((n: any) => `      ${n.target.join(' ')}`).join('\n');
      const more = v.nodes.length > 12 ? `\n      ...and ${v.nodes.length - 12} more` : '';
      return `  ${v.id} [${v.impact}] ${v.help}  (${v.nodes.length} element${v.nodes.length === 1 ? '' : 's'})\n${where}${more}`;
    })
    .join('\n\n');
}

async function audit(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return describe(results);
}

test('the queue view has no accessibility violations, in either theme', async ({ page }) => {
  await ready(page);
  expect(await audit(page), 'light theme').toBe('');
  await setTheme(page, 'dark');
  expect(await audit(page), 'dark theme').toBe('');
});

test('the week board has no accessibility violations', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'This week' }).first().click();
  await expect(page.locator('.board')).toBeVisible();
  expect(await audit(page)).toBe('');
});

test('the detail panel has no accessibility violations while it is open', async ({ page }) => {
  await ready(page);
  await page.locator('tbody .ref-link').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await audit(page)).toBe('');
});

test('the queue is usable at phone width', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await ready(page);
  expect(await audit(page)).toBe('');

  /* A page the reader has to drag sideways to finish a sentence is broken even
     when every axe rule passes, and a table is the usual way it happens. */
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(overflow.scroll, 'the page scrolls sideways at 390px').toBeLessThanOrEqual(overflow.client + 1);
});

test('every control is big enough to hit with a thumb', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await ready(page);

  /* WCAG 2.2 sets the floor at 24 by 24. Anything under 44 is still awkward on
     a phone, so those are printed without failing the run. */
  const sizes = await page.$$eval('button, a[href], input[type="checkbox"]', (els) =>
    els
      // Visually hidden text is clipped to a 1px box on purpose. It is not a
      // control anyone taps, so it is not a target-size problem.
      .filter((el) => !el.closest('.visually-hidden') && getComputedStyle(el).visibility !== 'hidden')
      .map((el) => {
        const r = el.getBoundingClientRect();
        const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40);
        return { label: label || el.className, w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((s) => s.w >= 4 && s.h >= 4),
  );

  const tight = sizes.filter((s) => s.w < 44 || s.h < 44);
  if (tight.length) {
    console.log('Under 44px on a phone:\n' + tight.map((s) => `  ${s.w}x${s.h}  ${s.label}`).join('\n'));
  }

  const tooSmall = sizes.filter((s) => s.w < 24 || s.h < 24);
  expect(tooSmall.map((s) => `${s.w}x${s.h} ${s.label}`), 'controls below the WCAG 2.2 minimum').toEqual([]);
});

test('the page says what it is, once, at the top', async ({ page }) => {
  await ready(page);
  /* Landmarks alone leave a screen reader with no title for the page. */
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});
