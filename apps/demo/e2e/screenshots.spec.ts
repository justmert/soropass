import { test } from '@playwright/test';

/**
 * Generates before/after token-swap evidence for the S20 gate. Captures the
 * 16-state gallery under three skins produced ONLY by overriding tokens (no
 * component code changes): default light, dark theme, and a teal brand hue.
 * Output: docs/ui/screenshots/. Run on demand: `pnpm exec playwright test screenshots`.
 */
test('capture token-swap gallery: light → dark → teal', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const gallery = page.locator('.demo-grid');
  await gallery.screenshot({ path: '../../docs/ui/screenshots/states-light.png' });

  await page.getByTestId('tweak-dark').click();
  await gallery.screenshot({ path: '../../docs/ui/screenshots/states-dark.png' });

  await page.getByTestId('tweak-dark').click(); // back to light
  await page.getByTestId('tweak-brand').click(); // teal brand via --pk-color-brand only
  await page.getByTestId('tweak-radius').click(); // + sharp radius
  await gallery.screenshot({ path: '../../docs/ui/screenshots/states-teal.png' });
});
