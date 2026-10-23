// スマホ幅で一通り操作して、画面のスクリーンショットとJSエラーを確認するスモークテスト。
//   ホーム → 20問 → 結果 → シェア画像（結果・成分表） → 友達をさそう
//   → 別の端末でおさそいリンクを開く → 診断 → ふたりの相性 → 相性カード → 図鑑 → タイプページ
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
const errors = [];
async function phone() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text());
  });
  return page;
}
const shot = (page, name, fullPage = true) => page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage });

async function answerAll(page, pick) {
  await page.click('text=診断する（20問・約2分）');
  for (let i = 0; i < 20; i++) {
    await page.waitForSelector('.opt:not([disabled])');
    await page.locator('.opt').nth(pick(i)).click();
    await page.waitForTimeout(200);
  }
  await page.waitForSelector('.result .label', { timeout: 6000 });
  await page.waitForTimeout(600);
  return page.textContent('.result .label');
}

async function saveModalImage(page, name) {
  await page.waitForSelector('.modal .sheet img', { timeout: 10000 });
  const src = await page.getAttribute('.modal .sheet img', 'src');
  const png = await page.evaluate(async (u) => Array.from(new Uint8Array(await (await fetch(u)).arrayBuffer())), src);
  fs.writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(png));
  await page.click('.modal [data-close]');
}

// 1人目
const a = await phone();
await a.goto(`${base}/`);
await a.waitForTimeout(600);
await shot(a, '1-home', false);
await a.click('text=診断する（20問・約2分）');
await a.waitForSelector('.opt');
await shot(a, '2-question', false);
await a.goto(`${base}/`);
const labelA = await answerAll(a, (i) => (i * 3) % 4);
await shot(a, '3-result');
await a.click('[data-card="story"]');
await saveModalImage(a, '4-story-card');
await a.click('[data-card="label"]');
await saveModalImage(a, '4-label-card');

await a.locator('.share [data-invite]').click();
await a.fill('#invite-name', 'ゆい');
await a.click('#invite-make');
const inviteText = await a.getAttribute('#invite-links [data-copy]', 'data-copy');
const inviteUrl = new URL(inviteText.split('\n').pop());
await a.click('.modal [data-close]');

// 2人目：おさそいリンクから
const b = await phone();
await b.goto(`${base}${inviteUrl.pathname}${inviteUrl.search}`);
await b.waitForTimeout(500);
await shot(b, '5-invite-home', false);
const labelB = await answerAll(b, (i) => (i * 5 + 1) % 4);
const pairBox = await b.textContent('.pairbox h2');
await b.click('.pairbox a');
await b.waitForSelector('.pair-score');
await b.waitForTimeout(400);
await shot(b, '6-pair');
await b.click('[data-pair-card]');
await saveModalImage(b, '7-pair-card');
await b.goto(`${base}/#/zukan`);
await b.waitForTimeout(400);
await shot(b, '8-zukan');

await b.goto(`${base}/t/07/?s=abc123`);
await b.waitForTimeout(500);
await shot(b, '9-type-landing');
const ogImage = await b.getAttribute('meta[property="og:image"]', 'content');
await b.goto(`${base}/t/s4/`);
await b.waitForTimeout(400);
const hiddenLabel = await b.textContent('.result .label');

await browser.close();
server.close();
console.log(JSON.stringify({ labelA, labelB, pairBox, ogImage, hiddenLabel, errors }, null, 2));
if (errors.length) process.exit(1);
