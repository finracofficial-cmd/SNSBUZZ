// スマホ幅で一通り操作して、画面・JSエラー・横はみ出し・有料文の漏れを確認するスモークテスト。
//   かんたん診断 → 結果 → シェア画像3種 → くわしい診断（3章）→ レポート（モザイク・購入案内）
//   → 二つ名カード → 友達をさそう → 別端末で診断 → ふたりの相性 → わたしクイズ（出題→回答→成績表）
//   → 図鑑（シール帳）→ タイプページ → 隠しタイプ → 4つの画面幅ではみ出しがないか
// 使い方: npm run build && node scripts/smoke.mjs [スクショの出力先]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { PREMIUM, PARAM_DETAIL, LOVE_DETAIL } from '../functions/_lib/premium.js';

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
const failures = [];
const check = (ok, msg) => {
  if (!ok) failures.push(msg);
};
async function phone(width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text());
  });
  return page;
}
const shot = (page, name, fullPage = true) => page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage });

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

async function saveModalImage(page, name) {
  await page.waitForSelector('.modal .sheet img', { timeout: 10000 });
  const src = await page.getAttribute('.modal .sheet img', 'src');
  const png = await page.evaluate(async (u) => Array.from(new Uint8Array(await (await fetch(u)).arrayBuffer())), src);
  fs.writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(png));
  await page.click('.modal [data-close]');
}

// 有料の本文がDOMに入っていないか（モザイクの下にも置かない）
// （「本当のあなた」の1文目は予告として無料で見せているので、2文目で確かめる）
const premiumSnippets = [
  ...Object.values(PREMIUM).map((p) => p.deep.slice(p.deep.indexOf('。') + 1).slice(0, 25)),
  ...Object.values(PREMIUM).flatMap((p) => [p.loveDeep, p.next, p.letter, ...p.growth.map((g) => g.body ?? g)].map((s) => s.slice(8, 30))),
  // パラメータの解説は、二つ名の1項目だけ前半が見本として無料。後半で確かめる
  ...PARAM_DETAIL.flat().map((s) => s.slice(-24, -4)),
  ...LOVE_DETAIL.map((l) => l.detail.slice(8, 30)),
];

// ---------- 1人目 ----------
const a = await phone();
await a.goto(`${base}/`);
await a.waitForTimeout(500);
await shot(a, '01-home', false);
await a.click('[data-go="#/q"]');
await a.waitForSelector('.opt');
await shot(a, '02-question', false);
await answer(a, 12, (i) => (i * 3) % 4);
await a.waitForSelector('.result .label', { timeout: 6000 });
await a.waitForTimeout(500);
const quickLabel = await a.textContent('.result .label');
await shot(a, '03-quick-result');
check(await a.$('.teaser-card'), 'かんたん診断の結果に、くわしい診断の入口がない');
await a.click('[data-card="story"]');
await saveModalImage(a, '04-story-card');
await a.click('[data-card="label"]');
await saveModalImage(a, '04-label-card');
await a.click('[data-prof]');
await a.fill('#pf-nick', 'ゆい');
await a.fill('#pf-like', 'いちごミルク');
await a.fill('#pf-word', 'なかよくしてね');
await a.click('#pf-go');
await saveModalImage(a, '04-profile-card');

// くわしい診断（続きから24問・3章）
await a.click('.teaser-card [data-go="#/d"]');
await a.waitForSelector('.chapter');
await shot(a, '05-chapter-intro', false);
await answer(a, 24, (i) => (i * 5 + 1) % 4);
await a.waitForSelector('.chapter.done [data-quiz-next]');
await shot(a, '06-chapter-done', false);
await a.click('[data-quiz-next]');
await a.waitForSelector('.nickname', { timeout: 8000 });
await a.waitForTimeout(800);
const nickname = await a.textContent('.nickname');
const detailLabel = await a.textContent('.result .label');
check(detailLabel === quickLabel, `くわしい診断でタイプが変わった: ${quickLabel} → ${detailLabel}`);
check((await a.locator('.chapter-card').count()) === 8, 'レポートが8章になっていない');
check((await a.locator('.mosaic').count()) >= 8, 'モザイクが少なすぎる');
check(await a.$('.paybar'), '購入バーが出ていない');
// 自動の購入案内（1回まで）
await a.evaluate(() => document.querySelector('#ch2').scrollIntoView());
await a.waitForTimeout(700);
const autoPaywall = !!(await a.$('.modal:not([hidden]) .includes'));
if (autoPaywall) await a.click('.modal .linkish[data-close]');
await a.evaluate(() => document.querySelector('#ch1').scrollIntoView());
await a.evaluate(() => document.querySelector('#ch2').scrollIntoView());
await a.waitForTimeout(700);
check(!(await a.$('.modal:not([hidden]) .includes')), '購入案内が2回以上自動で出た');
const html = await a.content();
const leaked = premiumSnippets.filter((s) => s && html.includes(s));
check(leaked.length === 0, `有料の本文がページに入っている: ${leaked.slice(0, 2).join(' / ')}`);
await shot(a, '07-report');
await a.click('.paybar [data-paywall]');
await a.waitForSelector('.modal:not([hidden]) .includes');
await shot(a, '08-paywall', false);
await a.click('.modal .linkish[data-close]');
await a.click('[data-card="nick"]');
await saveModalImage(a, '09-nick-card');
await a.click('[data-card="status"]');
check(!!(await a.waitForSelector('.modal:not([hidden]) .includes', { timeout: 3000 }).catch(() => null)), 'ロック中のステータスカードで購入案内が出ない');
await a.click('.modal .linkish[data-close]');

// 友達をさそう
await a.locator('[data-invite]').first().click();
await a.fill('#invite-name', 'ゆい');
await a.click('#invite-make');
const inviteText = await a.getAttribute('#invite-links [data-copy]', 'data-copy');
const inviteUrl = new URL(inviteText.split('\n').pop());
await a.click('.modal .btn[data-close]');
// わたしクイズを出す（かんたん診断の結果ページから）
await a.goto(`${base}/`);
await a.click('.mini-result');
await a.waitForSelector('.result .label');
const mineQuick = await a.evaluate(() => JSON.parse(localStorage.getItem('pz:mineQuick')));
await a.goto(`${base}/#/r/${mineQuick.code}/${mineQuick.shareId}`);
await a.waitForSelector('[data-quiz-create]');
await a.click('[data-quiz-create]');
await a.fill('#quiz-name', 'ゆい');
await a.click('#quiz-make');
const quizText = await a.getAttribute('#quiz-links [data-copy]', 'data-copy');
const quizUrl = new URL(quizText.split('\n').pop());
await a.click('.modal .btn[data-close]');

// ---------- 2人目：おさそいリンクから ----------
const b = await phone();
await b.goto(`${base}${inviteUrl.pathname}${inviteUrl.search}`);
await b.waitForTimeout(400);
check(await b.$('.invite'), 'おさそいのバナーが出ない');
await shot(b, '10-invite-home', false);
await b.click('[data-go="#/q"]');
await answer(b, 12, (i) => (i * 7 + 2) % 4);
await b.waitForSelector('.pairbox');
await b.click('.pairbox a');
await b.waitForSelector('.pair-score');
await shot(b, '11-pair');
await b.click('[data-pair-card]');
await saveModalImage(b, '12-pair-card');

// わたしクイズに答える
await b.goto(`${base}${quizUrl.pathname}${quizUrl.search}`);
await b.waitForSelector('[data-fq-start]');
await b.fill('#fq-name', 'みお');
await b.click('[data-fq-start]');
for (let i = 0; i < 5; i++) {
  await b.waitForSelector('[data-fq]:not([disabled])');
  await b.locator('[data-fq]').nth(i % 4).click();
  await b.waitForTimeout(1000);
}
await b.waitForSelector('[data-ft]');
await shot(b, '13-quiz-type', false);
await b.locator('[data-ft]').first().click();
await b.waitForSelector('.quiz-score', { timeout: 5000 });
await shot(b, '14-quiz-result');
const backText = await b.getAttribute('.share-row [data-copy]', 'data-copy');
const backUrl = new URL(backText.split('\n').pop());
// 1人目が成績を受けとる
await a.goto(`${base}/${backUrl.hash}`);
await a.waitForSelector('ol.board li');
await shot(a, '15-quiz-board');

// 図鑑・タイプページ・隠しタイプ
await b.goto(`${base}/#/zukan`);
await b.waitForTimeout(300);
await shot(b, '16-zukan');
await b.goto(`${base}/t/07/?s=abc123`);
await b.waitForTimeout(400);
await shot(b, '17-type-landing');
await b.goto(`${base}/t/s4/`);
await b.waitForTimeout(300);
const hiddenLabel = await b.textContent('.result .label');

// ---------- 画面幅ごとの横はみ出し ----------
const reportHash = await a.evaluate(() => {
  const m = JSON.parse(localStorage.getItem('pz:mineDetail'));
  return `#/r/${m.code}/${m.shareId}`;
});
const quickHash = `#/r/${mineQuick.code}/${mineQuick.shareId}`;
for (const width of [320, 375, 390, 430]) {
  const p = await phone(width);
  await p.goto(`${base}/`);
  await p.evaluate(([q, d]) => {
    localStorage.setItem('pz:mineQuick', JSON.stringify(q));
    localStorage.setItem('pz:mineDetail', JSON.stringify(d));
  }, [mineQuick, await a.evaluate(() => JSON.parse(localStorage.getItem('pz:mineDetail')))]);
  for (const h of ['#/', quickHash, reportHash, '#/t/03', '#/zukan', '#/qboard', '#/legal', '#/buy/abcdefgh12345678']) {
    await p.goto(`${base}/${h}`);
    await p.waitForTimeout(350);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(over <= 0, `${width}px で横にはみ出し（${over}px）: ${h}`);
  }
  await p.context().close();
}

await browser.close();
server.close();
console.log(JSON.stringify({ quickLabel, nickname, autoPaywall, hiddenLabel, errors, failures }, null, 2));
if (errors.length || failures.length) process.exit(1);
