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
// おうちの人が開くページ（子どもの結果は出さない）。支払い済みのお願いを開き直すと「もう支払い済み」と出て、二重に払わない
await c.goto(`${base}/#/buy/${rid}`);
await c.waitForSelector('.sheet-title');
check((await c.textContent('.sheet-title')).includes('支払い済み'), '支払い済みのお願いを開き直しても、購入画面が出る');
check(!(await c.$('[data-buy-for]')), '支払い済みなのに購入ボタンが出る');
check(!(await c.$('.nickname')), 'おうちの人のページに結果が出ている');
await c.screenshot({ path: path.join(outDir, 'guardian-page.png'), fullPage: true });

// 4. ふたり用のプレゼント：1人目は受け取れて、2人目は受け取れない
sql(`INSERT OR REPLACE INTO purchases (id, plan, payment_intent, created_at) VALUES ('cs_test_e2eduo000000', 'duo', 'pi_e2e', ${Date.now()})`);
const gift = await issueToken(SECRET, 'gift-cs_test_e2eduo000000');
// 買った本人がリンクを開いても、受け取りのボタンは出ない（プレゼントが消えない）
const owner = await issueToken(SECRET, 'cs_test_e2eduo000000');
const o = await phone();
await o.goto(`${base}/`);
await o.evaluate((t) => localStorage.setItem('pz:premiumToken', JSON.stringify(t)), owner);
await o.goto(`${base}/#/gift/${encodeURIComponent(gift)}`);
await o.waitForSelector('.gift-page');
check(!(await o.$('[data-accept-gift]')), '完全版を持っている人にも、プレゼントの受け取りボタンが出る');
const d = await phone();
await detailResult(d, 9);
await d.goto(`${base}/#/gift/${encodeURIComponent(gift)}`);
await d.waitForSelector('[data-accept-gift]');
check(await d.evaluate(() => !localStorage.getItem('pz:premiumToken')), '開いただけでプレゼントを受け取ってしまう');
await d.click('[data-accept-gift]');
check((await toastText(d)).includes('受け取りました'), 'プレゼントを受け取れない');
await d.waitForFunction(() => document.querySelector('.nickname') && !document.querySelector('.mosaic'), null, { timeout: 8000 });
const e = await phone();
await e.goto(`${base}/#/gift/${encodeURIComponent(gift)}`);
await e.click('[data-accept-gift]');
check((await toastText(e)).includes('もう受け取られています'), '2人目もプレゼントを受け取れてしまう');
// 買った人は、プレゼントのリンクを何度でも出し直せる（受け取り済みと表示）
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
check(await f.evaluate(() => !localStorage.getItem('pz:pendingSid')), 'やめたのに、決済の確認を続けている');
// おうちの人がやめたときは、おうちの人のページへ戻る（「完了しました」とは出さない）
await f.evaluate((r) => localStorage.setItem('pz:returnHash', JSON.stringify(`#/buy/${r}`)), rid);
await f.goto(`${base}/thanks/?canceled=1`);
await f.waitForFunction((r) => location.hash === `#/buy/${r}`, rid, { timeout: 8000 });
await f.goto(`${base}/#/buy/done`);
await f.waitForSelector('.sheet-title');
check(!(await f.textContent('.sheet-title')).includes('完了しました'), '払っていないのに「完了しました」と出る');
// 作ってから7日を過ぎたお願いのリンクでは、販売しない
// （支払い済みのお願いは「支払い済み」が先に出るので、まだ払われていない受け取りIDで確かめる）
await f.goto(`${base}/#/buy/bcdefghijklmnopq/${(Math.floor(Date.now() / 36e5) - 7 * 24 - 2).toString(36)}/000`);
await f.waitForSelector('.sheet-title');
check((await f.textContent('.sheet-title')).includes('期限'), '期限切れのお願いリンクで販売画面が出る');
// まだ払われていない、期限内のお願いなら、中身の案内が出る
await f.goto(`${base}/#/buy/abcdefghijklmnop/${Math.floor(Date.now() / 36e5).toString(36)}/000`);
await f.waitForSelector('.includes', { timeout: 8000 });

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
const fetched = await a.evaluate(async (id) => (await fetch(`/api/groups/${id}`)).text(), groupId);
const stored = JSON.parse(fetched).members[0].code;
check(!stored.includes('~', stored.indexOf('~') + 1), `グループにくわしい診断のパラメータが保存されている: ${stored}`);
check(!/secret|member_id/.test(fetched), 'グループの一覧に、本人だけの秘密が入っている');
check(!!(await a.$('[data-admin-link]')), '作った人に管理用リンクのボタンがない');
await a.click('[data-leave]');
await a.click('.modal [data-yes]');
await a.waitForSelector('#join', { timeout: 8000 });
check((await a.locator('.member').count()) === 0, 'グループから抜けられない');
await a.screenshot({ path: path.join(outDir, 'group.png'), fullPage: true });

// 8. ふたりの相性・完全版：コードで開いた端末では、だれとの相性でも本文がサーバーから届く（名前が入る）
await a.goto(`${base}/#/pair/3~-5_-1_3_5/f~9_9_9_9/${encodeURIComponent('ゆう')}/${encodeURIComponent('あお')}`);
await a.waitForFunction(() => document.querySelectorAll('#pair-premium .pp-item').length >= 4 && !document.querySelector('#pair-premium .mosaic'), null, { timeout: 8000 });
const pairText = await a.textContent('#pair-premium');
check(pairText.includes('ゆう') && pairText.includes('あお') && !/\{(pos|neg)\}/.test(pairText), 'ふたりの相性・完全版に名前が入っていない');
await a.screenshot({ path: path.join(outDir, 'pair-premium.png'), fullPage: true });

// 9. 紹介：シェアURLから来た人が初めて診断を終えると、シェアした人の人数が1つ増える（本物の D1 で）
{
  const s = await phone();
  await s.goto(`${base}/#/q`);
  await answer(s, 12, () => 1);
  await s.waitForSelector('.share-row [data-copy]', { timeout: 8000 });
  const shared = new URL((await s.getAttribute('.share-row [data-copy]', 'data-copy')).split('\n').pop());
  const r = shared.searchParams.get('r');
  const before = (await (await fetch(`${base}/api/ref?r=${r}`)).json()).n;
  const f = await phone();
  await f.goto(`${base}${shared.pathname}${shared.search}`);
  await f.waitForSelector('.invite', { timeout: 8000 });
  await f.click('.invite [data-go="#/q"]');
  await answer(f, 12, () => 2);
  await f.waitForSelector('.pairbox', { timeout: 8000 });
  await f.waitForTimeout(500);
  const after = (await (await fetch(`${base}/api/ref?r=${r}`)).json()).n;
  check(after === before + 1, `紹介が数えられていない: ${before} → ${after}`);
  await s.reload();
  await s.waitForFunction((n) => document.querySelector('[data-ref-count]')?.textContent.includes(`${n}人`), after, { timeout: 8000 });
  await s.context().close();
  await f.context().close();
}

// 7. 運営用のKPI画面（A/Bテストの表示数も入っている）
await a.goto(`${base}/#/admin`);
await a.fill('#kpi-token', 'dev');
await a.click('#kpi-form button');
await a.waitForSelector('table.kpi', { timeout: 8000 });
check((await a.locator('table.kpi').count()) >= 5, 'KPI画面の表が足りない');
const abExposure = await a.evaluate(() => [...document.querySelectorAll('table.kpi td')].some((td) => td.textContent === 'amount' || td.textContent === 'specific'));
check(abExposure, 'A/Bテストの表が出ていない');
check((await a.textContent('main, body')).includes('紹介で初めて診断した友達'), 'KPI画面に紹介の数が出ていない');
await a.screenshot({ path: path.join(outDir, 'admin.png'), fullPage: true });

await browser.close();
console.log(JSON.stringify({ sampleLength: sample?.length, errors, failures }, null, 2));
if (errors.length || failures.length) process.exit(1);
