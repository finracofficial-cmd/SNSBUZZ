// API込みの通し確認。先に別のターミナルで次を起動しておく：
//   npx wrangler d1 execute ponkotsu-zukan --local --file=schema.sql
//   npm run build && npx wrangler pages dev --port 8799 --binding PREMIUM_SECRET=dev-secret --binding PROMO_CODES=TEST2027 --binding KPI_TOKEN=dev
// 使い方: node scripts/e2e-api.mjs [スクショの出力先]
// 確かめること：第1章の見本がAPIから届く／コードで完全版が開く（モザイクが消え、本文と数値が出る）
// ／引き継ぎリンクで別の端末でも開く／おうちの人の支払い（受け取りID）で子どもの端末が自動で開く／グループ参加
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const base = process.env.BASE || 'http://localhost:8799';
const outDir = path.resolve(process.argv[2] || 'smoke-shots/api');
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
const failures = [];
const check = (ok, msg) => ok || failures.push(msg);
async function phone() {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await c.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  return p;
}
async function answer(page, count, pick) {
  for (let i = 0; i < count; i++) {
    await page.waitForSelector('.opt:not([disabled]), [data-quiz-next]');
    if (await page.$('[data-quiz-next]')) {
      await page.click('[data-quiz-next]');
      i--;
      continue;
    }
    await page.locator('.opt').nth(pick(i)).click();
    await page.waitForTimeout(170);
  }
}
async function detailResult(page, seed) {
  await page.goto(`${base}/#/d`);
  await answer(page, 36, (i) => (i * seed + 1) % 4);
  await page.click('[data-quiz-next]');
  await page.waitForSelector('.nickname', { timeout: 8000 });
  await page.waitForTimeout(1200);
}

// 1. 見本が届く・コードで開く
const a = await phone();
await detailResult(a, 3);
const sample = await a.textContent('#sample');
check(sample && !sample.includes('ネットワーク') && sample.length > 100, `第1章の見本が届いていない: ${sample}`);
await a.evaluate(() => document.querySelector('.paybar [data-paywall]').click());
await a.waitForSelector('.modal [data-redeem]');
await a.click('.modal [data-redeem]');
await a.fill('#code', 'test2027');
await a.click('#redeem-go');
await a.waitForFunction(() => !document.querySelector('.mosaic') && document.querySelectorAll('.chapter-card').length === 8, null, { timeout: 8000 });
check(!(await a.$('.paybar')), '開いたあとも購入バーが出ている');
const masked = await a.locator('.sv.masked').count();
check(masked === 0, 'ステータスの数値が隠れたまま');
await a.screenshot({ path: path.join(outDir, 'unlocked-report.png'), fullPage: true });
await a.click('[data-card="status"]');
await a.waitForSelector('.modal .sheet img', { timeout: 10000 });
const statusPng = await a.evaluate(async () => Array.from(new Uint8Array(await (await fetch(document.querySelector('.modal .sheet img').src)).arrayBuffer())));
fs.writeFileSync(path.join(outDir, 'status-card.png'), Buffer.from(statusPng));
await a.click('.modal [data-close]');
const token = await a.evaluate(() => JSON.parse(localStorage.getItem('pz:premiumToken')));

// 2. 引き継ぎリンクで別の端末
const b = await phone();
await detailResult(b, 5);
check(!!(await b.$('.mosaic')), '別の端末で最初からモザイクがない');
await b.goto(`${base}/#/unlock/${encodeURIComponent(token)}`);
await b.waitForFunction(() => document.querySelector('.nickname') && !document.querySelector('.mosaic'), null, { timeout: 8000 });

// 3. おうちの人の支払い → 子どもの端末が自動で開く
const c = await phone();
await detailResult(c, 7);
const rid = 'kidrid2345678abc'.replace(/[^a-z0-9]/g, 'x').slice(0, 16);
await c.evaluate((r) => localStorage.setItem('pz:claimRid', JSON.stringify({ rid: r, at: Date.now() })), rid);
await c.reload();
await c.waitForSelector('.nickname');
execFileSync('npx', ['wrangler@4', 'd1', 'execute', 'ponkotsu-zukan', '--local', '--command', `INSERT OR REPLACE INTO claims (rid, token, created_at) VALUES ('${rid}', '${token}', ${Date.now()})`], {
  stdio: 'ignore',
  env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
});
await c.waitForFunction(() => !document.querySelector('.mosaic'), null, { timeout: 20000 });
check(!(await c.evaluate(() => localStorage.getItem('pz:claimRid'))) || (await c.evaluate(() => localStorage.getItem('pz:claimRid'))) === 'null', '受け取りIDが残っている');

// 4. グループ（くわしい診断のコードで参加）
await a.goto(`${base}/`);
await a.evaluate(() => document.querySelector('[data-group-create]').click());
await a.fill('#group-name', 'テスト部');
await a.click('#group-make');
await a.waitForSelector('#join');
await a.fill('#join-name', 'ゆい');
await a.click('#join');
await a.waitForSelector('.members');
check((await a.locator('.member').count()) === 1, 'グループに参加できていない');

await browser.close();
console.log(JSON.stringify({ sampleLength: sample?.length, errors, failures }, null, 2));
if (errors.length || failures.length) process.exit(1);
