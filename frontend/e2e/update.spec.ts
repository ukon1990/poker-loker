import { readFile } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { expect, type Page, test } from '@playwright/test';

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

/** Serves the build, and can pretend a new version was deployed. */
async function startServer() {
  let version = 1;
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    const extension = path.extname(pathname);
    const file = path.join('dist', extension ? pathname : 'index.html');
    try {
      let body: Buffer | string = await readFile(file);
      if (pathname === '/sw.js') body = `${body}\n// version ${version}`;
      response.writeHead(200, {
        'content-type': TYPES[extension || '.html'] ?? 'application/octet-stream',
        'cache-control': 'no-cache',
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://localhost:${port}`,
    deployNewVersion: () => {
      version += 1;
    },
    close: () => server.close(),
  };
}

const snackbar = (page: Page) => page.getByText('A new version is ready.');

function waitForWaitingWorker(page: Page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    for (let i = 0; i < 100 && !registration.waiting; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return registration.waiting !== null;
  });
}

async function installFirstVersion(page: Page, url: string) {
  await page.goto(`${url}/`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Learn' })).toBeVisible();
}

test.describe('new version snackbar', () => {
  let server: Awaited<ReturnType<typeof startServer>>;

  test.beforeEach(async () => {
    server = await startServer();
  });

  test.afterEach(() => server.close());

  test('offers Reload on a tab screen, which activates the new version', async ({ page }) => {
    await installFirstVersion(page, server.url);
    await expect(snackbar(page)).toHaveCount(0);

    server.deployNewVersion();
    await page.reload();
    expect(await waitForWaitingWorker(page)).toBe(true);
    await expect(snackbar(page)).toBeVisible();

    // Wait for the reload itself. The old page also has this heading, and it can vanish mid-check.
    const reloaded = page.waitForEvent('load');
    await page.getByRole('button', { name: 'Reload' }).click();
    await reloaded;
    await expect(page.getByRole('heading', { level: 1, name: 'Learn' })).toBeVisible();
    await expect
      .poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).waiting === null))
      .toBe(true);
    await expect(snackbar(page)).toHaveCount(0);
  });

  test('Later dismisses it and it stays away while using the app', async ({ page }) => {
    await installFirstVersion(page, server.url);
    server.deployNewVersion();
    await page.reload();
    await expect(snackbar(page)).toBeVisible();

    await page.getByRole('button', { name: 'Later' }).click();
    await expect(snackbar(page)).toHaveCount(0);

    await page.getByRole('link', { name: 'Practice' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Practice' })).toBeVisible();
    await expect(snackbar(page)).toHaveCount(0);
  });

  test('stays hidden through a lesson and its finish screen', async ({ page }) => {
    await installFirstVersion(page, server.url);
    server.deployNewVersion();
    await page.goto(`${server.url}/lesson/holdem-1-1`);
    expect(await waitForWaitingWorker(page)).toBe(true);
    await expect(snackbar(page)).toHaveCount(0);

    const complete = page.getByRole('heading', { name: 'Lesson complete' });
    for (let step = 0; step < 400 && !(await complete.isVisible()); step++) {
      const action = page.getByRole('button', { name: /^(Got it|Continue)$/ });
      const confirm = page.getByRole('button', { name: 'Confirm' });
      if ((await action.isVisible()) && (await action.isEnabled())) {
        await action.click();
      } else if (await page.getByText('Match each word').isVisible()) {
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
      } else if (await confirm.isVisible()) {
        const options = page.locator('main button:not(.term-link):not([disabled])');
        await options.nth(Math.floor(Math.random() * (await options.count()))).click();
        await confirm.click();
      }
      await expect(snackbar(page)).toHaveCount(0);
    }

    await expect(complete).toBeVisible();
    await expect(snackbar(page)).toHaveCount(0);

    await page.getByRole('link', { name: 'Continue' }).click();
    await expect(snackbar(page)).toBeVisible();
  });

  test('stays hidden through a hand and its result screen', async ({ page }) => {
    await installFirstVersion(page, server.url);
    await page.goto(`${server.url}/play`);
    await page.getByLabel('Players').selectOption('2');
    await page.getByRole('button', { name: 'Sit down' }).click();
    await expect(page.getByText(/Hand 1/)).toBeVisible();

    server.deployNewVersion();
    await page.reload();
    expect(await waitForWaitingWorker(page)).toBe(true);
    await expect(snackbar(page)).toHaveCount(0);

    const nextHand = page.getByRole('button', { name: /Next hand|Rebuy/ });
    for (let i = 0; i < 300 && !(await nextHand.isVisible()); i++) {
      const fold = page.getByRole('button', { name: /^Fold/ });
      const check = page.getByRole('button', { name: /^Check/ });
      if (await fold.isVisible()) await fold.click();
      else if (await check.isVisible()) await check.click();
      else await page.waitForTimeout(100);
      await expect(snackbar(page)).toHaveCount(0);
    }

    await expect(nextHand).toBeVisible();
    await expect(snackbar(page)).toHaveCount(0);

    await page.getByRole('link', { name: 'Leave table' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Play' })).toBeVisible();
    await expect(snackbar(page)).toBeVisible();
  });
});
