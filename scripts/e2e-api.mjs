// API込みの通し確認。先に別のターミナルで次を起動しておく：
//   npx wrangler d1 execute ponkotsu-zukan --local --file=schema.sql
//   npm run build && npx wrangler pages dev --port 8799 --binding PREMIUM_SECRET=dev-secret --binding PROMO_CODES=TEST2027 --binding KPI_TOKEN=dev
// 使い方: node scripts/e2e-api.mjs [スクショの出力先]
// 確かめること：
//   第1章の見本（前半は無料・後半はモザイク）／コードで完全版が開く（モザイクが消え、本文と数値が出る）
//   ／引き継ぎリンクで別の端末でも開く／ブラウザのデータが消えても Cookie から戻る
//   ／おうちの人の支払い（子どもの端末の秘密で受け取る）で子どもの端末が自動で開く
//   ／ふたり用のプレゼントは1人だけ受け取れる／決済から戻ったあと受け取れなければ再試行の画面／グループ参加・抜ける
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { issueToken } from '../functions/_lib/token.js';
import { claimIdOf } from '../functions/_lib/purchase.js';

const base = process.env.BASE || 'http://localhost:8799';
const SECRET = { PREMIUM_SECRET: process.env.PREMIUM_SECRET || 'dev-secret' };
const outDir = path.resolve(process.argv[2] || 'smoke-shots/api');
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
const failures = [];
const check = (ok, msg) => ok || failures.push(msg);
const sql = (command) =>
  execFileSync('npx', ['wrangler@4', 'd1', 'execute', 'ponkotsu-zukan', '--local', '--command', command], {
    stdio: 'ignore',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
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
    await page.waitForTimeout(190);
  }
}
async function detailResult(page, seed) {
  await page.goto(`${base}/#/d`);
  await answer(page, 36, (i) => (i * seed + 1) % 4);
  await page.click('[data-quiz-next]');
  await page.waitForSelector('.nickname', { timeout: 8000 });
  await page.waitForTimeout(1200);
}
const toastText = (page) => page.waitForSelector('#toast:not([hidden])', { timeout: 6000 }).then((el) => el.textContent()).catch(() => '');

// 1. 見本（前半）・コードで開く・Cookie で戻る
const a = await phone();
await detailResult(a, 3);
const sample = await a.textContent('#ch1 .sample');
check(sample && sample.length > 20, `第1章の見本がない: ${sample}`);
check((await a.locator('#ch1 .mosaic').count()) === 1, '見本の後半がモザイクになっていない');
await a.evaluate(() => document.querySelector('.paybar [data-paywall]').click());
await a.waitForSelector('.modal [data-redeem]');
await a.click('.modal [data-redeem]');
await a.fill('#code', 'test2027');
await a.click('#redeem-go');
await a.waitForFunction(() => !document.querySelector('.mosaic') && document.querySelectorAll('.chapter-card').length === 8, null, { timeout: 8000 });
check(!(await a.$('.paybar')), '開いたあとも購入バーが出ている');
check((await a.locator('.sv.masked').count()) === 0, 'ステータスの数値が隠れたまま');
check((await a.locator('ol.tips.growth li b').count()) === 3, '「武器にする3つの方法」に見出しが出ていない');
check((await a.textContent('#ch8 h2')) === 'ひとことエール', '第8章の名前が古い');
await a.screenshot({ path: path.join(outDir, 'unlocked-report.png'), fullPage: true });
await a.click('[data-card="status"]');
await a.waitForSelector('.modal .sheet img', { timeout: 10000 });
const statusPng = await a.evaluate(async () => Array.from(new Uint8Array(await (await fetch(document.querySelector('.modal .sheet img').src)).arrayBuffer())));
fs.writeFileSync(path.join(outDir, 'status-card.png'), Buffer.from(statusPng));
await a.click('.modal [data-close]');
const token = await a.evaluate(() => JSON.parse(localStorage.getItem('pz:premiumToken')));
// ブラウザの保存データが消えても、Cookie から戻る
await a.evaluate(() => localStorage.removeItem('pz:premiumToken'));
await a.reload();
await a.waitForFunction(() => document.querySelector('.nickname') && !document.querySelector('.mosaic'), null, { timeout: 8000 });
check(await a.evaluate(() => !!localStorage.getItem('pz:premiumToken')), 'Cookie から購入情報が戻っていない');

// 2. 引き継ぎリンクで別の端末
const b = await phone();
await detailResult(b, 5);
check(!!(await b.$('.mosaic')), '別の端末で最初からモザイクがない');
await b.goto(`${base}/#/unlock/${encodeURIComponent(token)}`);
await b.waitForFunction(() => document.querySelector('.nickname') && !document.querySelector('.mosaic'), null, { timeout: 8000 });

// 3. おうちの人の支払い → 子どもの端末が自動で開く（リンクの受け取りIDだけでは受け取れない）
const c = await phone();
await detailResult(c, 7);
const secret = 'abcdefghijklmnopqrstuvwxyz';
const rid = await claimIdOf(secret);
await c.evaluate(([s, r]) => localStorage.setItem('pz:claim', JSON.stringify({ s, rid: r, at: Date.now() })), [secret, rid]);
const byLink = await c.evaluate(async (r) => (await fetch(`/api/claim?s=${r}`)).status, rid);
check(byLink === 400, `受け取りIDだけで問い合わせできてしまう: ${byLink}`);
await c.reload();
await c.waitForSelector('.nickname');
sql(`INSERT OR REPLACE INTO claims (rid, token, created_at) VALUES ('${rid}', '${token}', ${Date.now()})`);
await c.waitForFunction(() => !document.querySelector('.mosaic'), null, { timeout: 20000 });
check(await c.evaluate(() => !localStorage.getItem('pz:claim')), '受け取りの秘密が残っている');
// おうちの人が開くページ（子どもの結果は出さない）
await c.goto(`${base}/#/buy/${rid}`);
await c.waitForSelector('.includes');
check(!(await c.$('.nickname')), 'おうちの人のページに結果が出ている');
await c.screenshot({ path: path.join(outDir, 'guardian-page.png'), fullPage: true });

// 4. ふたり用のプレゼント：1人目は受け取れて、2人目は受け取れない
sql(`INSERT OR REPLACE INTO purchases (id, plan, payment_intent, created_at) VALUES ('cs_test_e2eduo000000', 'duo', 'pi_e2e', ${Date.now()})`);
const gift = await issueToken(SECRET, 'gift-cs_test_e2eduo000000');
const d = await phone();
await detailResult(d, 9);
await d.goto(`${base}/#/gift/${encodeURIComponent(gift)}`);
check((await toastText(d)).includes('受け取りました'), 'プレゼントを受け取れない');
await d.waitForFunction(() => document.querySelector('.nickname') && !document.querySelector('.mosaic'), null, { timeout: 8000 });
const e = await phone();
await e.goto(`${base}/#/gift/${encodeURIComponent(gift)}`);
check((await toastText(e)).includes('もう受け取られています'), '2人目もプレゼントを受け取れてしまう');
// 買った人は、プレゼントのリンクを何度でも出し直せる（受け取り済みと表示）
const owner = await issueToken(SECRET, 'cs_test_e2eduo000000');
const giftInfo = await e.evaluate(async (t) => (await fetch('/api/gift', { headers: { authorization: `Bearer ${t}` } })).json(), owner);
check(giftInfo.used === true, 'プレゼントの受け取り済みが記録されていない');

// 5. 決済から戻ってきたのに受け取れない → 再試行の画面。やめたら元の画面へ
const f = await phone();
await f.goto(`${base}/`);
await f.evaluate(() => localStorage.setItem('pz:returnHash', JSON.stringify('#/zukan')));
await f.goto(`${base}/thanks/?sid=cs_test_notfound0000`);
await f.waitForSelector('[data-retry]', { timeout: 15000 });
check(await f.evaluate(() => !!localStorage.getItem('pz:pendingSid')), '受け取れなかった決済を覚えていない');
await f.screenshot({ path: path.join(outDir, 'thanks-retry.png'), fullPage: true });
await f.goto(`${base}/thanks/?canceled=1`);
await f.waitForFunction(() => location.pathname === '/' && location.hash === '#/zukan', null, { timeout: 8000 });

// 6. グループ（くわしい診断の結果でも、保存するのはかんたん診断の部分だけ）・抜ける
await a.goto(`${base}/`);
await a.evaluate(() => document.querySelector('[data-group-create]').click());
await a.fill('#group-name', 'テスト部');
await a.click('#group-make');
await a.waitForSelector('#join');
await a.fill('#join-name', 'ゆう');
await a.click('#join');
await a.waitForSelector('.members');
check((await a.locator('.member').count()) === 1, 'グループに参加できていない');
const groupId = await a.evaluate(() => location.hash.split('/')[2]);
const stored = await a.evaluate(async (id) => (await (await fetch(`/api/groups/${id}`)).json()).members[0].code, groupId);
check(!stored.includes('~', stored.indexOf('~') + 1), `グループにくわしい診断のパラメータが保存されている: ${stored}`);
a.once('dialog', (dlg) => dlg.accept());
await a.click('[data-leave]');
await a.waitForSelector('#join', { timeout: 8000 });
check((await a.locator('.member').count()) === 0, 'グループから抜けられない');
await a.screenshot({ path: path.join(outDir, 'group.png'), fullPage: true });

// 7. 運営用のKPI画面（A/Bテストの表示数も入っている）
await a.goto(`${base}/#/admin`);
await a.fill('#kpi-token', 'dev');
await a.click('#kpi-form button');
await a.waitForSelector('table.kpi', { timeout: 8000 });
check((await a.locator('table.kpi').count()) >= 5, 'KPI画面の表が足りない');
const abExposure = await a.evaluate(() => [...document.querySelectorAll('table.kpi td')].some((td) => td.textContent === 'amount' || td.textContent === 'specific'));
check(abExposure, 'A/Bテストの表が出ていない');
await a.screenshot({ path: path.join(outDir, 'admin.png'), fullPage: true });

await browser.close();
console.log(JSON.stringify({ sampleLength: sample?.length, errors, failures }, null, 2));
if (errors.length || failures.length) process.exit(1);
