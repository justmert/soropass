import { test, expect, type CDPSession, type Page } from '@playwright/test';

/** Attach an auto-consenting CTAP2 platform virtual authenticator via CDP. */
async function addVirtualAuthenticator(page: Page): Promise<CDPSession> {
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');
  await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return client;
}

test.describe('S20 styled screens — brutal integration', () => {
  test('static gallery renders all 16 states', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.demo-grid .pk-card')).toHaveCount(16);
    // "OS sheet open" look: create/sign prompting + recover discovering
    await expect(page.locator('.demo-grid .pk-card.is-waiting')).toHaveCount(3);
    await expect(page.locator('.demo-grid [data-pk-state="deploying"] .pk-spinner')).toBeVisible();
    await expect(page.locator('.demo-grid [data-pk-state="submitting"] .pk-spinner')).toBeVisible();
  });

  test('create: virtual authenticator drives idle → success with a C-address', async ({ page }) => {
    await addVirtualAuthenticator(page);
    await page.goto('/?mode=webauthn');
    const create = page.getByTestId('live-create');
    await create.getByRole('button', { name: 'Create passkey' }).click();
    await expect(create.locator('[data-pk-state="success"]')).toBeVisible({ timeout: 15_000 });
    await expect(create.locator('.pk-address__text')).toContainText('…');
    // copy-to-clipboard affordance flips to "copied"
    await create.locator('.pk-copy').click();
    await expect(create.locator('.pk-copy.is-copied')).toBeVisible();
  });

  test('recover: listbox is fully keyboard-navigable (↑/↓/Home/End/Enter)', async ({ page }) => {
    await page.goto('/'); // mock mode, default 3 synthetic accounts
    const recover = page.getByTestId('live-recover');
    await recover.getByRole('button', { name: 'Recover' }).click();
    const options = recover.getByRole('option');
    await expect(options).toHaveCount(3);
    await expect(options.nth(0)).toBeFocused(); // roving focus lands on first option

    await page.keyboard.press('ArrowDown');
    await expect(options.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp'); // wraps to last
    await expect(options.nth(2)).toBeFocused();
    await page.keyboard.press('Home');
    await expect(options.nth(0)).toBeFocused();
    await page.keyboard.press('End');
    await expect(options.nth(2)).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(recover.locator('[data-pk-state="selected"]')).toBeVisible();
    await expect(recover.getByRole('option', { selected: true })).toHaveCount(1);
    await expect(recover.locator('.pk-actions .pk-btn--primary')).toBeEnabled();
  });

  test('recover: real discoverable recovery after a create (virtual authenticator)', async ({
    page,
  }) => {
    await addVirtualAuthenticator(page);
    await page.goto('/?mode=webauthn');
    const create = page.getByTestId('live-create');
    await create.getByRole('button', { name: 'Create passkey' }).click();
    await expect(create.locator('[data-pk-state="success"]')).toBeVisible({ timeout: 15_000 });

    // switch off the synthetic list → use the real indexer over the resident key
    await page.evaluate(() => window.__demo.control.setRecoverCount(null));
    const recover = page.getByTestId('live-recover');
    await recover.getByRole('button', { name: 'Recover' }).click();
    await expect(recover.locator('[data-pk-state="resolved"]')).toBeVisible({ timeout: 15_000 });
    await expect(recover.getByRole('option')).toHaveCount(1);
  });

  test('sign: idle → done shows the transaction hash', async ({ page }) => {
    await page.goto('/'); // mock authenticator signs deterministically
    const sign = page.getByTestId('live-sign');
    await expect(sign.locator('.pk-summary__amount-value')).toHaveText('250.00 USDC');
    await sign.getByRole('button', { name: 'Sign' }).click();
    await expect(sign.locator('[data-pk-state="done"]')).toBeVisible({ timeout: 15_000 });
    await expect(sign.locator('.pk-address__text')).toContainText('…');
  });

  test('GATE: a single token override restyles every card — no component code change', async ({
    page,
  }) => {
    await page.goto('/');
    const primary = page.getByTestId('live-create').locator('.pk-btn--primary').first();
    const card = page.getByTestId('live-create').locator('.pk-card');

    const brandBefore = await primary.evaluate((el) => getComputedStyle(el).backgroundColor);
    await page.getByTestId('tweak-brand').click(); // override --pk-color-brand only
    const brandAfter = await primary.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(brandAfter).not.toBe(brandBefore);

    const surfaceBefore = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
    await page.getByTestId('tweak-dark').click(); // [data-theme="dark"] token set
    const surfaceAfter = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(surfaceAfter).not.toBe(surfaceBefore);
  });

  test('reduced-motion override collapses animation durations', async ({ page }) => {
    await page.goto('/');
    const glyph = page.locator('.pk-wait__glyph').first(); // gallery prompting tile
    const bar = page.locator('.pk-progress__bar').first(); // gallery deploying/submitting tile
    const glyphBefore = await glyph.evaluate((el) => getComputedStyle(el).animationDuration);
    const barBefore = await bar.evaluate((el) => getComputedStyle(el).animationDuration);
    await page.getByTestId('tweak-motion').click();
    const glyphAfter = await glyph.evaluate((el) => getComputedStyle(el).animationDuration);
    const barAfter = await bar.evaluate((el) => getComputedStyle(el).animationDuration);
    expect(glyphBefore).toBe('2s');
    expect(glyphAfter).toBe('0.001s');
    // the indeterminate progress bar must collapse too (was a hardcoded 1.4s)
    expect(barBefore).toBe('1.4s');
    expect(barAfter).toBe('0.001s');
  });

  test('injected error renders ONE error layout with the connector-mapped copy', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() => window.__demo.control.failNext('create', 'ES256_NOT_SUPPORTED'));
    const create = page.getByTestId('live-create');
    await create.getByRole('button', { name: 'Create passkey' }).click();

    const result = create.locator('.pk-result[data-kit-code]');
    await expect(result).toBeVisible();
    await expect(result).toHaveAttribute('data-error-key', 'create:onchain');
    await expect(result).toHaveAttribute('data-kit-code', 'ES256_NOT_SUPPORTED');
    await expect(create.getByRole('alert')).toBeVisible();
    await expect(create.locator('.pk-errcode')).toHaveText('error code: onchain');

    // "Try again" returns to a usable state (re-runs the flow)
    await create.getByRole('button', { name: 'Try again' }).click();
    await expect(create.locator('[data-pk-state="success"]')).toBeVisible({ timeout: 15_000 });
  });
});

declare global {
  interface Window {
    __demo: {
      control: {
        failNext(screen: 'create' | 'sign' | 'recover', code: string): void;
        failSubmit(on: boolean): void;
        setRecoverCount(count: number | null): void;
      };
    };
  }
}
