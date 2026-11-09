// Draws the logo and renders every app icon and iPhone launch image from it.
// Run from frontend/ with: node scripts/generate-icons.ts
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const FELT = '#0e5b49';
const FELT_SHADE = '#0a4638';
const PAPER = '#fafaf7';
const INK = '#15171a';
const RED = '#c4122f';

const SPADE =
  'M256 96c34 56 132 104 132 186 0 46-36 76-74 76-20 0-37-7-48-20 3 32 16 58 44 78H202c28-20 41-46 44-78-11 13-28 20-48 20-38 0-74-30-74-76 0-82 98-130 132-186z';

/** Every iPhone screen in CSS points and pixel ratio. Add new models here. */
export const IPHONE_SCREENS = [
  { width: 320, height: 568, scale: 2 },
  { width: 375, height: 667, scale: 2 },
  { width: 414, height: 736, scale: 3 },
  { width: 375, height: 812, scale: 3 },
  { width: 414, height: 896, scale: 2 },
  { width: 414, height: 896, scale: 3 },
  { width: 390, height: 844, scale: 3 },
  { width: 428, height: 926, scale: 3 },
  { width: 393, height: 852, scale: 3 },
  { width: 430, height: 932, scale: 3 },
  { width: 402, height: 874, scale: 3 },
  { width: 420, height: 912, scale: 3 },
  { width: 440, height: 956, scale: 3 },
];

/**
 * Two fanned cards on a 512 canvas: a red card behind, and a paper card in front carrying a spade
 * with P and L as its corner indices. `indices: false` drops the letters for very small sizes.
 */
function cards({ indices = true } = {}) {
  const letters = indices
    ? `<text x="-82" y="-82" font-family="Zilla Slab" font-weight="700" font-size="68" text-anchor="middle" fill="${INK}">P</text>
       <text transform="rotate(180)" x="-82" y="-82" font-family="Zilla Slab" font-weight="700" font-size="68" text-anchor="middle" fill="${RED}">L</text>`
    : '';
  return `
    <g transform="translate(296 256) rotate(13)">
      <rect x="-118" y="-164" width="236" height="328" rx="24" fill="${FELT_SHADE}" transform="translate(5 9)"/>
      <rect x="-118" y="-164" width="236" height="328" rx="24" fill="${RED}"/>
      <rect x="-98" y="-144" width="196" height="288" rx="12" fill="none" stroke="${PAPER}" stroke-opacity=".55" stroke-width="5"/>
    </g>
    <g transform="translate(222 256) rotate(-8)">
      <rect x="-118" y="-164" width="236" height="328" rx="24" fill="${FELT_SHADE}" fill-opacity=".55" transform="translate(5 9)"/>
      <rect x="-118" y="-164" width="236" height="328" rx="24" fill="${PAPER}"/>
      <path fill="${INK}" d="${SPADE}" transform="translate(-118 -117) scale(.46)"/>
      ${letters}
    </g>`;
}

function iconSvg(shape: 'square' | 'rounded' | 'maskable', options?: { indices?: boolean }) {
  const tile =
    shape === 'rounded'
      ? `<rect width="512" height="512" rx="112" fill="${FELT}"/>`
      : `<rect width="512" height="512" fill="${FELT}"/>`;
  // Launchers crop a maskable icon to any shape inside the central 80%.
  const scale = shape === 'maskable' ? 0.8 : 0.96;
  const offset = (512 - 512 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><title>Poker Loker</title>${tile}<g transform="translate(${offset} ${offset}) scale(${scale})">${cards(options)}</g></svg>`;
}

function launchMarkup(logoWidth: string) {
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:calc(${logoWidth} * .1)">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="60 60 400 400" style="display:block;width:${logoWidth};height:${logoWidth}">${cards()}</svg>
    <div style="font:700 calc(${logoWidth} * .2)/1 'Zilla Slab';color:${PAPER};white-space:nowrap">Poker Loker</div>
  </div>`;
}

const fontData = await readFile(
  'node_modules/@fontsource/zilla-slab/files/zilla-slab-latin-700-normal.woff2',
);
const fontCss = `@font-face{font-family:'Zilla Slab';font-weight:700;src:url(data:font/woff2;base64,${fontData.toString('base64')})}`;

const browser = await chromium.launch();

async function render(
  path: string,
  body: string,
  viewport: { width: number; height: number; scale?: number },
  css = '',
  transparent = false,
) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.scale ?? 1,
  });
  await page.setContent(
    `<!doctype html><style>${fontCss}*{margin:0}html,body{height:100%}svg{display:block}${css}</style>${body}`,
  );
  await page.evaluate(() => document.fonts.load('700 40px "Zilla Slab"'));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path, omitBackground: transparent });
  await page.close();
}

const icon = (svg: string, size: number) =>
  [svg, { width: size, height: size }, `svg{width:${size}px;height:${size}px}`, true] as const;

// The favicon has no text, so the SVG file needs no font.
await writeFile('public/icon.svg', `${iconSvg('rounded', { indices: false })}\n`);

await render('public/icon-192.png', ...icon(iconSvg('rounded'), 192));
await render('public/icon-512.png', ...icon(iconSvg('rounded'), 512));
await render('public/icon-maskable-192.png', ...icon(iconSvg('maskable'), 192));
await render('public/icon-maskable-512.png', ...icon(iconSvg('maskable'), 512));
// iOS rounds the corners itself and turns transparency black, so this one is a full square.
await render('public/apple-touch-icon.png', ...icon(iconSvg('square'), 180));

// Shown by the page itself while the app loads, at the same size and place as the launch images.
await render(
  'public/logo.png',
  launchMarkup('240px'),
  { width: 320, height: 320, scale: 2 },
  'body{display:flex;align-items:center;justify-content:center}',
  true,
);

await rm('public/splash', { recursive: true, force: true });
await mkdir('public/splash');
for (const screen of IPHONE_SCREENS) {
  const name = `iphone-${screen.width * screen.scale}x${screen.height * screen.scale}.png`;
  await render(
    `public/splash/${name}`,
    launchMarkup('min(56vw, 240px)'),
    screen,
    `body{background:${FELT};display:flex;align-items:center;justify-content:center}`,
  );
}

await browser.close();

// The tags index.html needs, so the two lists cannot drift apart.
for (const { width, height, scale } of IPHONE_SCREENS) {
  const name = `iphone-${width * scale}x${height * scale}.png`;
  console.log(
    `    <link rel="apple-touch-startup-image" href="/splash/${name}" media="(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${scale}) and (orientation: portrait)" />`,
  );
}
