// Renders the PWA icons (EDRAM van on black) from SVG with the pre-installed Playwright Chromium.
// Run: node scripts/make-icons.mjs   (only needed when the logo changes; the PNGs are committed)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

// Playwright is pre-installed globally in the dev container; it isn't a project dependency.
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const font = readFileSync('node_modules/@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2').toString('base64');

const VAN = `<path fill="#5cb848" d="M4 6a4 4 0 0 1 4-4h34c1.5 0 2.8.8 3.5 2l8 12 6 3a4 4 0 0 1 2.5 3.7V30a3 3 0 0 1-3 3h-3a7 7 0 0 0-14 0H22a7 7 0 0 0-14 0H7a3 3 0 0 1-3-3V6zm6 2v9h12V8H10zm16 0v9h12V8H26zm16 0v9h9l-6-9h-3z"/><circle fill="#5cb848" cx="15" cy="33" r="5"/><circle fill="#5cb848" cx="47" cy="33" r="5"/>`;

// scale = share of the icon width the van takes up. Maskable icons keep it inside the 80% safe zone.
function svg(size, { scale, radius = 0, wordmark = false }) {
  const vanW = size * scale;
  const vanH = (vanW * 40) / 64;
  const x = (size - vanW) / 2;
  const y = (size - vanH) / 2 - (wordmark ? size * 0.08 : 0);
  const text = wordmark
    ? `<text x="${size / 2}" y="${y + vanH + size * 0.17}" text-anchor="middle" font-family="Montserrat, Arial Black, sans-serif" font-weight="800" font-size="${size * 0.15}" fill="#ffffff" letter-spacing="${size * 0.006}">EDRAM</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${radius}" fill="#0b0b0b"/>
    <g transform="translate(${x} ${y}) scale(${vanW / 64})">${VAN}</g>${text}</svg>`;
}

const icons = [
  ['public/icons/icon-192.png', 192, { scale: 0.62, wordmark: true }],
  ['public/icons/icon-512.png', 512, { scale: 0.62, wordmark: true }],
  ['public/icons/icon-maskable-512.png', 512, { scale: 0.5, wordmark: true }],
  ['public/icons/apple-touch-icon.png', 180, { scale: 0.62, wordmark: true }],
];

mkdirSync('public/icons', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, opts] of icons) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><head><style>html,body{margin:0;background:#0b0b0b}</style>
    <style>@font-face{font-family:Montserrat;font-weight:100 900;src:url(data:font/woff2;base64,${font}) format('woff2')}</style></head>
    <body>${svg(size, opts)}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file, omitBackground: false });
  console.log('wrote', file);
}
await browser.close();
