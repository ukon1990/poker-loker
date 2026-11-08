import { expect, type Page, test } from '@playwright/test';

const ROUTES = [
  { path: '/', heading: 'Learn' },
  { path: '/lesson/holdem-1-1', heading: 'Rank' },
  { path: '/practice', heading: 'Practice' },
  { path: '/play', heading: 'Play' },
  { path: '/progress', heading: 'Progress' },
  { path: '/glossary', heading: 'Glossary' },
  { path: '/history', heading: 'History' },
  { path: '/settings', heading: 'Settings' },
  // Locked lessons and missing tables send you somewhere useful.
  { path: '/lesson/holdem-2-1', heading: 'Learn' },
  { path: '/play/nope', heading: 'Play' },
];

for (const { path, heading } of ROUTES) {
  test(`${path} opens directly`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(path);

    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('navigating uses clean paths and the back button works', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('link', { name: 'Glossary' }).first().click();

  await expect(page.getByRole('heading', { level: 1, name: 'Glossary' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/glossary');
  expect(page.url()).not.toContain('#');

  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Learn' })).toBeVisible();
});

test('a saved setting survives a reload', async ({ page }) => {
  await page.goto('/settings');
  const goal = page.getByLabel('Daily goal (XP)');

  await goal.fill('55');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();

  await page.reload();
  await expect(goal).toHaveValue('55');
});

test('the manifest is linked and has installable icons', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();

  const manifest = await (await request.get(href as string)).json();
  expect(manifest.start_url).toBe('/');
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
});

test('the app loads offline after the first visit', async ({ page, context }) => {
  await page.goto('/practice');
  await page.evaluate(() => navigator.serviceWorker.ready);

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole('heading', { level: 1, name: 'Practice' })).toBeVisible();
});

async function solveMatch(page: Page) {
  const buttons = page.locator('main .grid button');
  const count = await buttons.count();
  for (let term = 0; term < count; term += 2) {
    for (let meaning = 1; meaning < count; meaning += 2) {
      if (await buttons.nth(term).isDisabled()) break;
      if (await buttons.nth(meaning).isDisabled()) continue;
      await buttons.nth(term).click();
      await buttons.nth(meaning).click();
    }
  }
}

/** Answers until finished. Wrong answers come back, so guessing always ends. */
async function finishLesson(page: Page) {
  const complete = page.getByRole('heading', { name: 'Lesson complete' });
  const gotIt = page.getByRole('button', { name: 'Got it' });
  const next = page.getByRole('button', { name: 'Continue' });
  const check = page.getByRole('button', { name: 'Confirm' });
  const matching = page.getByRole('heading', { name: 'Match each word to its meaning' });

  for (let step = 0; step < 400; step++) {
    if (await complete.isVisible()) return;
    if (await gotIt.isVisible()) {
      await gotIt.click();
    } else if ((await next.isVisible()) && (await next.isEnabled())) {
      await next.click();
    } else if (await matching.isVisible()) {
      await solveMatch(page);
    } else if (await check.isVisible()) {
      const options = page.locator('main button:not(.term-link):not([disabled])');
      await options.nth(Math.floor(Math.random() * (await options.count()))).click();
      await check.click();
    }
  }
  throw new Error('The lesson did not finish');
}

test('finishing a lesson saves progress and unlocks the next one', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/lesson/holdem-1-1');
  await finishLesson(page);
  await expect(page.getByText(/\+\d+ XP/)).toBeVisible();

  await page.getByRole('link', { name: 'Continue' }).click();
  await page.reload();

  await expect(page.getByText('Done').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start lesson' })).toBeVisible();
  await expect(page.getByText('High card, pair, two pair').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('a lesson deals new cards each time', async ({ page }) => {
  const firstCards = async () => {
    await page.goto('about:blank');
    await page.goto('/lesson/holdem-1-1');
    await page.getByRole('button', { name: 'Got it' }).click();
    return page
      .locator('main [role="img"]')
      .evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label')).join(' '));
  };

  const deals = new Set<string>();
  for (let i = 0; i < 6; i++) deals.add(await firstCards());
  expect(deals.size).toBeGreaterThan(1);
});

test('a spot plays a real hand up to one decision and explains the answer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/review?skill=playing-spots');

  await expect(page.getByRole('region', { name: 'Table' })).toBeVisible();
  await expect(page.getByText(/raises to 30 and you call/)).toBeVisible();
  await page.locator('main .grid button').first().click();
  await page.getByRole('button', { name: 'Confirm' }).click();

  await expect(page.locator('[aria-live]')).toContainText(/about \d+%/);
});

test('tapping a word opens its definition', async ({ page }) => {
  await page.goto('/glossary');
  await page.getByRole('searchbox', { name: 'Search terms' }).fill('flop');
  await page.getByRole('button', { name: /^Flop/ }).click();

  await expect(page.getByRole('dialog', { name: 'Flop, definition' })).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a table plays hands against bots and resumes after a reload', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/play');
  await page.getByLabel('Players').selectOption('3');
  await page.getByRole('button', { name: 'Sit down' }).click();
  await expect(page.getByText(/Hand 1/)).toBeVisible();

  const nextHand = page.getByRole('button', { name: /Next hand|Rebuy/ });
  const check = page.getByRole('button', { name: /^Check/ });
  const call = page.getByRole('button', { name: /^Call \d/ });
  const fold = page.getByRole('button', { name: /^Fold/ });

  let hands = 0;
  const deadline = Date.now() + 70_000;
  while (hands < 2 && Date.now() < deadline) {
    if (await nextHand.isVisible()) {
      await nextHand.click();
      hands += 1;
    } else if (await check.isVisible()) {
      await check.click();
    } else if (await call.isVisible()) {
      await call.click();
    } else if (await fold.isVisible()) {
      await fold.click();
    } else {
      await page.waitForTimeout(100);
    }
  }
  expect(hands).toBe(2);
  await expect(page.getByRole('heading', { name: 'Coach' })).toBeVisible();

  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByText(/Hand 3/)).toBeVisible();

  await page.goto('/history');
  await expect(page.getByRole('heading', { level: 1, name: 'History' })).toBeVisible();
  await expect(page.getByRole('button').filter({ hasText: /^1/ }).first()).toBeVisible();
  expect(errors).toEqual([]);
});
