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
  // 今週のお題だけ、決まった集計を返す（ほかのAPIは無い扱い）
  if (url.pathname === '/api/poll') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(req.method === 'POST' ? { ok: true } : { week: url.searchParams.get('week'), total: 120, all: [50, 40, 20, 10], types: { 3: [12, 20, 5, 3], 6: [30, 4, 2, 1] } }));
    return;
  }
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
let videoInfo = null;
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
// A/Bテストの案を固定する（自動の購入案内が出る案・量で見せるバー）
await a.evaluate(() => {
  localStorage.setItem('pz:ab:autopay', JSON.stringify('on'));
  localStorage.setItem('pz:ab:paybar', JSON.stringify('amount'));
  localStorage.setItem('pz:ab:calc', JSON.stringify('on'));
});
await a.waitForTimeout(500);
await shot(a, '01-home', false);
// トップのカードで1問目に答えると、2問目から始まる
await a.locator('[data-q1]').first().click();
await a.waitForSelector('.qhead');
check((await a.textContent('.qhead span')).includes('2 / 12'), `トップで1問目に答えても2問目から始まらない: ${await a.textContent('.qhead span')}`);
await shot(a, '02-question', false);
await answer(a, 11, (i) => ((i + 1) * 3) % 4);
// 結果の直前の「計算中」（A/Bテスト calc の on。初めての1回だけ）
check((await a.waitForSelector('.calc li', { timeout: 2000 }).catch(() => null)) && (await a.locator('.calc li').count()) === 3, '「計算中」の3行が出ない');
await a.waitForSelector('.result .label', { timeout: 6000 });
await a.waitForTimeout(500);
const quickLabel = await a.textContent('.result .label');
await shot(a, '03-quick-result');
check(await a.$('.teaser-card'), 'かんたん診断の結果に、くわしい診断の入口がない');
await a.click('[data-agree="yes"]');
check((await a.textContent('[data-agree-card]')).includes('ありがとう'), '「わかる〜！」が押せない');
await a.click('[data-card="story"]');
await saveModalImage(a, '04-story-card');
// 6枚まとめて保存（共有シートが使えない環境では、6枚が並んだ画面になる）
await a.click('[data-carousel]');
await a.waitForSelector('.modal .image-set img', { timeout: 15000 });
check((await a.locator('.modal .image-set img').count()) === 6, 'まとめて保存の画像が6枚ない');
await shot(a, '04-carousel', false);
await a.click('.modal [data-close]');
// 結果発表の動画（録画できる環境だけ）。6秒録画して、再生できる動画ができるか
if (await a.$('[data-video]')) {
  await a.click('[data-video]');
  await a.waitForSelector('.modal video.share-video', { timeout: 20000 });
  const video = await a.evaluate(async () => {
    const v = document.querySelector('.modal video.share-video');
    const blob = await (await fetch(v.src)).blob();
    await new Promise((r) => (v.readyState >= 1 ? r() : v.addEventListener('loadedmetadata', r, { once: true })));
    return { size: blob.size, type: blob.type, w: v.videoWidth, h: v.videoHeight };
  });
  check(video.size > 50000 && video.w === 720 && video.h === 1280, `結果発表の動画がおかしい: ${JSON.stringify(video)}`);
  videoInfo = video;
  await a.click('.modal [data-close]');
}
await a.click('[data-card="label"]');
await saveModalImage(a, '04-label-card');
await a.click('[data-prof]');
await a.fill('#pf-nick', 'ゆい');
await a.fill('#pf-like', 'いちごミルク');
await a.fill('#pf-word', 'なかよくしてね');
await a.click('#pf-go');
await saveModalImage(a, '04-profile-card');
// いまの二つ名（時間帯で前半が変わる）
check((await a.textContent('.now-name .now-word')).endsWith(quickLabel), 'いまの二つ名にタイプ名がない');
await a.click('[data-now-card]');
await saveModalImage(a, '04-now-card');
// 今週のお題：1タップで投票すると、全体の割合が出る
await a.click('[data-vote="1"]');
await a.waitForSelector('.poll-bars li.mine', { timeout: 5000 });
check((await a.locator('.poll-bars li').count()) === 4, '今週のお題の結果が4行ない');
await a.reload();
await a.waitForSelector('.poll-bars li.mine', { timeout: 5000 });
check(!(await a.$('[data-vote]')), '投票したのに、もう一度投票できる');
await shot(a, '04-poll');

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

// ---------- 3人目：ふつうのシェアURL（結果入り）から来ると、診断後にシェアした人との相性が出る ----------
await a.goto(`${base}/#/r/${mineQuick.code}/${mineQuick.shareId}`);
await a.waitForSelector('.share-row [data-copy]');
const quickShare = await a.getAttribute('.share-row [data-copy]', 'data-copy');
const shareUrl = new URL(quickShare.split('\n').pop());
check(shareUrl.searchParams.get('f') === mineQuick.code.split('~').slice(0, 2).join('~'), `シェアURLに結果が入っていない: ${shareUrl}`);
check(!shareUrl.searchParams.has('n'), 'シェアURLに名前が入っている');
const c = await phone();
await c.goto(`${base}${shareUrl.pathname}${shareUrl.search}`);
await c.waitForSelector('.invite', { timeout: 5000 });
await shot(c, '15b-share-landing', false);
await c.click('.invite [data-go="#/q"]');
await answer(c, 12, (i) => (i * 3 + 1) % 4);
await c.waitForSelector('.pairbox', { timeout: 8000 });
check((await c.textContent('.pairbox h2')).includes('シェアしてくれた友達'), 'シェアURLから来た人に相性が出ない');
await shot(c, '15c-share-pair');

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

// 続きリンク：別のブラウザで開くと、結果とシール帳が引き継がれる
await a.goto(`${base}/#/zukan`);
await a.waitForSelector('.carry a');
const carryHref = await a.getAttribute('.carry a', 'href');
const carryUrl = new URL(decodeURIComponent(new URL(carryHref).searchParams.get('text')).split('\n').pop());
const fresh = await phone();
await fresh.goto(`${base}/${carryUrl.hash}`);
await fresh.waitForSelector('.stickerbook');
check(await fresh.evaluate(() => !!JSON.parse(localStorage.getItem('pz:mineQuick'))), '続きリンクで結果が引き継がれない');
const metCount = await fresh.textContent('.complete b');
check(!metCount.startsWith('0 '), `続きリンクでシールが引き継がれない: ${metCount}`);
await fresh.context().close();

// LINE のアプリ内ブラウザ：画像保存の案内と、購入情報の保存場所の注意が出る
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.0.0',
  });
  const line = await ctx.newPage();
  line.on('pageerror', (e) => errors.push(e.message));
  await line.goto(`${base}/#/r/${mineQuick.code}/${mineQuick.shareId}`);
  await line.waitForSelector('.result .label');
  check(!!(await line.$('.hint.inapp')), 'LINE のブラウザで、ブラウザで開く案内が出ない');
  await ctx.close();
}

// ---------- 先週のお題の結果（日付を11月にずらして、10/19の週を見る） ----------
{
  const p = await phone();
  await p.clock.setFixedTime(new Date('2026-11-04T20:30:00+09:00'));
  await p.goto(`${base}/#/w/2026-10-19`);
  await p.waitForSelector('.poll-bars', { timeout: 5000 });
  check((await p.locator('.poll-types li').count()) === 2, '先週のお題のタイプ別が出ない');
  await shot(p, '17-poll-week');
  // まだ来ていない週・今週は、トップへ
  await p.goto(`${base}/#/w/2026-11-02`);
  await p.waitForSelector('.hero', { timeout: 5000 });
  await p.context().close();
}

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
console.log(JSON.stringify({ quickLabel, nickname, autoPaywall, hiddenLabel, videoInfo, errors, failures }, null, 2));
if (errors.length || failures.length) process.exit(1);
