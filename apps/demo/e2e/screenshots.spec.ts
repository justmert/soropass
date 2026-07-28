import { copyFileSync, mkdirSync } from 'node:fs';
import { test } from '@playwright/test';

/**
 * Generates before/after token-swap evidence for the re-theme gate. Captures the
 * full states gallery (create · sign · recover · connect · add-device) under three
 * skins produced ONLY by overriding tokens (no component code changes): default
 * light, dark theme, and a teal brand hue.
 *
 * Output: docs/ui/screenshots/ (canonical). The light + dark shots are also mirrored
 * into the docs site (apps/docs-fuma/public/screenshots/) so they publish and stay
 * in sync on re-run. Run on demand: `pnpm exec playwright test screenshots`.
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

  // Mirror the light + dark evidence into the docs site so it publishes.
  const pub = '../docs-fuma/public/screenshots';
  mkdirSync(pub, { recursive: true });
  for (const name of ['states-light.png', 'states-dark.png']) {
    copyFileSync(`../../docs/ui/screenshots/${name}`, `${pub}/${name}`);
  }
});
