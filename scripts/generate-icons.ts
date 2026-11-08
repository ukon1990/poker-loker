// Renders public/icon.svg to the PNG sizes the web manifest needs.
// Run with: node scripts/generate-icons.ts
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const svg = await readFile('public/icon.svg', 'utf8');
const browser = await chromium.launch();

for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<!doctype html><style>*{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({ path: `public/icon-${size}.png` });
  await page.close();
}

await browser.close();
