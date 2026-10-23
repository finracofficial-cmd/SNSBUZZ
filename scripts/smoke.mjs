// スマホ幅で一通り操作して、画面のスクリーンショットとJSエラーを確認するスモークテスト。
// 使い方: npm run build && node scripts/smoke.mjs [スクショの出力先]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const dist = path.resolve('dist');
const outDir = path.resolve(process.argv[2] || 'smoke-shots');
const executablePath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
fs.mkdirSync(outDir, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(404).end();
    return;
  }
  let file = path.join(dist, decodeURIComponent(url.pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!file.startsWith(dist) || !fs.existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text());
});
const shot = (name, fullPage = true) => page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage });

await page.goto(`${base}/`);
await page.waitForTimeout(600);
await shot('1-home', false);

await page.click('text=診断する');
await page.waitForSelector('.opt');
await shot('2-question', false);
for (let i = 0; i < 12; i++) {
  await page.waitForSelector('.opt:not([disabled])');
  // 毎回2番目のボタンを押す（並びは質問ごとにシャッフルされている）
  await page.locator('.opt').nth(1).click();
  await page.waitForTimeout(250);
}
await page.waitForSelector('.result .label', { timeout: 5000 });
await page.waitForTimeout(700);
const label = await page.textContent('.result .label');
await shot('3-result');

await page.click('[data-share="image"]');
await page.waitForSelector('.modal .sheet img', { timeout: 10000 });
const src = await page.getAttribute('.modal .sheet img', 'src');
const png = await page.evaluate(async (u) => {
  const b = await (await fetch(u)).blob();
  return Array.from(new Uint8Array(await b.arrayBuffer()));
}, src);
fs.writeFileSync(path.join(outDir, '4-story-card.png'), Buffer.from(png));
await page.click('[data-close]');

await page.goto(`${base}/#/zukan`);
await page.waitForTimeout(500);
await shot('5-zukan');

await page.goto(`${base}/t/07/?s=abc123`);
await page.waitForTimeout(500);
await shot('6-type-landing', false);
const ogImage = await page.getAttribute('meta[property="og:image"]', 'content');

await browser.close();
server.close();
console.log(JSON.stringify({ label, ogImage, errors }, null, 2));
if (errors.length) process.exit(1);
