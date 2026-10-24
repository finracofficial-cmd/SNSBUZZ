// かんたん診断の結果・タイプ詳細・図鑑（シール帳）のページ。
// かんたん診断の結果は「シェアしやすさ」と「くわしい診断への入口」を優先した軽い作りにし、
// タイプの読みもの（性格・恋愛・友達・学校・トリセツ）はタイプページにまとめる。
import { SITE } from './config.js';
import { AXES, TYPES, HIDDEN, BASE_COUNT, PARAMS, isHidden, typeNo } from './data.js';
import { titleOf, rarityOf, priorDistribution, compatRanking, compatOf, axisLine, decodeResult, encodeResult, quickCodeOf } from './logic.js';
import { charaSVG } from './chara.js';
import { radarSVG } from './radar.js';
import { drawStoryCard, drawLabelCard, canvasToBlob } from './card.js';
import { drawCarousel, toFeed } from './carousel.js';
import { textResult } from './textshare.js';
import { canRecordVideo, recordReveal } from './video.js';
import { nowCard, bindNowCard, keepNowFresh } from './now.js';
import { adSlot, fillAds } from './ads.js';
import { picksCard } from './picks.js';
import { myRef, referCard, bindReferCard } from './referral.js';
import { pollCard, bindPoll } from './polls.js';
import { exportPayload, importPayload } from './carryover.js';
import { app, ORIGIN, esc, jp, store, track, loadStats, render, toast, foot, brand, shareLinks, shareImageBlob, shareImageSet, openModal, closeModal, inAppHint, navNow, busy, copySilently, copyText, shareVideo } from './ui.js';
import { invitePairBox, inviteBanner, openInviteModal, openGroupCreate, openQuizCreate, friends } from './social.js';
import { openProfileCard } from './profile.js';

const noLabel = (index) => (isHidden(index) ? `隠しタイプ ${typeNo(index)}` : `No.${typeNo(index)}`);
export const typePath = (index) => `#/t/${typeNo(index).toLowerCase()}`;

// シェアURLには、かんたん診断の結果（タイプと4軸の合計だけ）を入れる。
// 開いた人が診断すると、シェアした人との相性が自動で出る（名前は入れない）
// r は紹介の番号（このリンクから友達が診断すると、虹色カードまでの1人に数える。referral.js）
export const shareUrl = (r, shareId) =>
  `${ORIGIN}/t/${typeNo(r.index).toLowerCase()}/?${new URLSearchParams({ s: shareId, f: quickCodeOf(encodeResult(r)), r: myRef() })}`;
// 「でも…」で始まる痛い一行は、それだけだと前の文が欠けて見えるので、頭の「でも」を外して使う
export const roastAlone = (t) => t.roast.replace(/^でも、?/, '');

// 結果のいちばん上に出す「ポンコツなところ」と「だから愛される」。
// ポンコツ診断なので、まずポンコツ（痛い一行＋ポンコツポイント3つ）を見せ、そのあとに良いところを出す
// （良いところが先だと「何がポンコツなのか分からない」「ほめられているだけ？」になる、という声があった）
export function ponkotsuBlock(t, { who = 'あなた', charm = true } = {}) {
  return `<section class="ponkotsu-card">
      <p class="pk-head"><span aria-hidden="true">🙈</span> ${esc(who)}のポンコツなところ</p>
      <p class="pk-main jp"><span>${jp(roastAlone(t))}</span></p>
      <ul class="pk-list">${t.ponkotsu.map((x) => `<li class="jp">${jp(x)}</li>`).join('')}</ul>
    </section>
    <section class="charm-card">
      <p class="pk-head love"><span aria-hidden="true">💗</span> でも、だから愛される</p>
      <p class="praise jp">${jp(t.praise)}</p>
      ${charm ? `<ul class="charm-list">${t.charm.map((x) => `<li class="jp">${jp(x)}</li>`).join('')}</ul>` : ''}
    </section>`;
}
function shareText(r) {
  const t = TYPES[r.index];
  return `【${t.label}】だった！（${titleOf(r.purity)}・ポンコツ純度${r.purity}%）\n${roastAlone(t)}\n#${SITE.hashtag} あなたは何タイプ？`;
}

// ---------- 成分表（食品表示のパロディ） ----------
export function labelPanel(index, r) {
  const t = TYPES[index];
  return `<div class="foodlabel">
    <dl>
      <dt>名称</dt><dd>${esc(t.label)}</dd>
      <dt>原材料名</dt><dd>${t.ingredients.map(esc).join('、')}</dd>
      <dt>内容量</dt><dd>${r ? `ポンコツ純度 ${r.purity}%` : 'ポンコツ 1人分'}</dd>
      <dt>保存方法</dt><dd>${esc(t.habitat)}</dd>
      <dt>製造者</dt><dd>${esc(SITE.name)}</dd>
    </dl>
    ${r ? `<div class="nutrition"><b>栄養成分表示（1人あたり）</b>${AXES.map((a, k) => `<div><span>${esc(r.sums[k] > 0 ? a.pos : a.neg)}</span><span>${r.axisPct[k]}%</span></div>`).join('')}</div>` : ''}
    <p class="caution">${esc(t.caution)}</p>
  </div>`;
}

function axisBars(r) {
  return AXES.map((a, k) => {
    const pos = r.sums[k] > 0;
    const pct = r.axisPct[k];
    return `<div class="axis">
      <div class="names"><span class="${pos ? '' : 'win'}">${esc(a.neg)} ${pos ? 100 - pct : pct}%</span><span class="${pos ? 'win' : ''}">${pos ? pct : 100 - pct}% ${esc(a.pos)}</span></div>
      <div class="bar"><i style="${pos ? 'right' : 'left'}:0;width:${pct}%"></i></div>
      <p class="axis-line">${esc(axisLine(k, r.sums[k]))}</p>
    </div>`;
  }).join('');
}

// 相性（相性◎・刺激しあう相手・友達・全タイプ）
function compatSection(index, r) {
  const t = TYPES[index];
  const base = r ? r.baseIndex : isHidden(index) ? null : index;
  const ranking = base == null ? [] : compatRanking(base).filter((x) => x.index !== base);
  const myCode = r ? quickCodeOf(encodeResult(r)) : '';
  const fr = r
    ? friends()
        .slice(0, 12)
        .map((f) => ({ ...f, c: compatOf(r, f.result) }))
        .sort((x, y) => y.c.score - x.c.score)
    : [];
  const low = ranking[ranking.length - 1];
  const row = (i, name, score, href) => `<li><a href="${href}">${charaSVG(i, { size: 36 })}<span class="rl">${name}</span>
    <span class="rs"><i style="width:${score}%"></i></span><b>${score}%</b></a></li>`;
  return `<section class="card" id="sec-compat"><h2>相性</h2>
    <div class="best"><span class="chip">相性◎</span> <a href="${typePath(t.best)}"><b>${esc(TYPES[t.best].label)}</b></a><p>${esc(t.bestWhy)}</p></div>
    ${low ? `<div class="best caution"><span class="chip">刺激しあう</span> <a href="${typePath(low.index)}"><b>${esc(TYPES[low.index].label)}</b></a><p>${esc(low.care ? `${low.care}。でも、${low.good}。` : `${low.good}。`)}</p></div>` : ''}
    ${fr.length ? `<h3>友達との相性</h3><ol class="ranking">${fr.map((f) => row(f.result.index, `${esc(f.name)}さん<small class="met">${esc(TYPES[f.result.index].label)}</small>`, f.c.score, `#/pair/${f.code}/${myCode}/${encodeURIComponent(f.name)}/${encodeURIComponent('わたし')}`)).join('')}</ol>` : ''}
    ${ranking.length ? `<details class="more"><summary>全タイプとの相性を見る</summary><ol class="ranking">${ranking.map((x) => row(x.index, esc(TYPES[x.index].label), x.score, typePath(x.index))).join('')}</ol></details>` : ''}
    ${r ? '<button class="btn type" data-invite>友達と相性をくらべる</button>' : ''}
  </section>`;
}

// くわしい診断への入口（ふんわり見せる）
function detailTeaser(r) {
  const t = TYPES[r.index];
  const done = store.get('mineDetail', null);
  const doneHere = done && done.code.startsWith(`${encodeResult(r)}~`);
  const fake = [62, 48, 70, 35, 80, 30, 66, 52, 74, 40];
  return `<section class="card teaser-card">
    <p class="lead">くわしい診断（診断は無料・あと24問・約3分）</p>
    <h2 class="teaser-title"><span class="blurred">？？？な</span>${esc(t.label)}</h2>
    <p><b>二つ名</b>（240通り）・<b>恋愛タイプ</b>（8種類）・<b>10項目のステータスのランク</b>が無料でわかります。数値とくわしい解説は完全版（有料）で読めます。</p>
    <div class="teaser-radar">${radarSVG(fake, { labels: [...AXES.map((a, k) => (r.sums[k] >= 0 ? a.pos : a.neg)), ...PARAMS.map((p) => p.name.replace(/度$|力$|熱量$/, ''))], masked: true, size: 240 })}</div>
    <ul class="includes small">${PARAMS.map((p) => `<li>${esc(p.name)}</li>`).join('')}</ul>
    ${doneHere
      ? `<a class="btn type" href="#/r/${esc(done.code)}/${esc(done.shareId)}">くわしい診断の結果を見る</a>`
      : '<button class="btn type" data-go="#/d">くわしい診断に進む</button>'}
    <p class="hint center">かんたん診断の答えを引きつぐので、続きの24問だけでOK</p>
  </section>`;
}

// 6枚まとめて保存（かんたん診断・くわしい診断の両方から使う）。
// TikTok・ストーリー用（9:16）か、Instagram のフィード用（3:4）かを選んでもらう
export function shareCarousel(button, r, text) {
  const sheet = openModal(`<h2 class="sheet-title">どこに投稿する？</h2>
    <button class="btn" data-ratio="story">TikTok のフォトモード・リール（縦長 9:16）</button>
    <button class="btn sub" data-ratio="feed">Instagram の投稿（3:4）</button>
    <button class="btn sub" data-close>とじる</button>`);
  sheet.querySelectorAll('[data-ratio]').forEach((b) =>
    b.addEventListener('click', () => {
      const feed = b.dataset.ratio === 'feed';
      closeModal();
      busy(button, async () => {
        toast('6枚の画像をつくっています…');
        const slides = await drawCarousel(r);
        const canvases = feed ? slides.map((c) => toFeed(c, r)) : slides;
        const blobs = await Promise.all(canvases.map(canvasToBlob));
        track('share', feed ? 'carousel-feed' : 'carousel');
        await shareImageSet(blobs, { name: `ponkotsu-${typeNo(r.index)}${feed ? '-feed' : ''}`, text, alt: `${TYPES[r.index].label}の結果` });
      });
    }),
  );
}

// 「この結果、どう？」1端末1回だけ数える（トップの「わかる〜！」の割合に使う）
function agreeCard(code) {
  if (store.get('agreed', []).includes(code)) return '';
  return `<section class="card agree" data-agree-card><p>この結果、どう？</p>
    <div class="btn-row"><button class="btn sub small" data-agree="yes">わかる〜！</button><button class="btn sub small" data-agree="no">ちょっとちがう</button></div></section>`;
}
function bindAgree(code) {
  app.querySelectorAll('[data-agree]').forEach((b) =>
    b.addEventListener('click', () => {
      const yes = b.dataset.agree === 'yes';
      track('agree', yes ? 'yes' : 'no');
      store.set('agreed', [...store.get('agreed', []), code].slice(-20));
      const card = app.querySelector('[data-agree-card]');
      if (card) {
        card.innerHTML = yes
          ? '<p>ありがとう！ 友達にも当ててもらおう → 下の「わたしクイズ」へ</p>'
          : '<p>ありがとう！ 答えを少し変えると、ちがうタイプになることも。<a href="#/d">くわしい診断</a>で二つ名も見てみてね</p>';
      }
    }),
  );
}

const rarityTile = (rarity) =>
  `<b>レア度</b><strong>${rarity.pct.toFixed(1)}%</strong><small>${rarity.source === 'actual' ? '診断した人の中で' : '計算上の値'}</small>`;

// ---------- かんたん診断の結果 ----------
export async function viewResult(r, shareId) {
  const gen = navNow();
  const t = TYPES[r.index];
  const title = titleOf(r.purity);
  // レア度は集計を待たずに計算上の値で描き、集計が届いたら差しかえる（結果をすぐ見せるため）
  let rarity = rarityOf(r.index, null);
  const ura = TYPES[r.ura.index];
  const text = shareText(r);
  const url = shareUrl(r, shareId);
  const boardCount = store.get('quizScores', []).length;
  render(`
    ${brand()}
    <section class="result">
      ${isHidden(r.index) ? `<div class="secret">隠しタイプを引き当てた！（計算上の出現率 約${(priorDistribution()[r.index] * 100).toFixed(1)}%）</div>` : ''}
      <p class="lead">あなたは…</p>
      <span class="no">${noLabel(r.index)}</span>
      <div class="chara-wrap">${charaSVG(r.index, { size: 240 })}</div>
      <h1 class="label">${esc(t.label)}</h1>
      <p class="catch-line jp">${jp(t.catch)}</p>
      <span class="chip">${esc(title)}・ポンコツ純度${r.purity}%</span>
    </section>
    ${ponkotsuBlock(t)}
    ${invitePairBox(r)}
    ${agreeCard(encodeResult(r))}
    <section class="share">
      <button class="btn type" data-card="story">画像を保存してストーリーに投稿</button>
      <button class="btn sub" data-carousel>6枚まとめて保存（TikTok・インスタの投稿用）</button>
      ${canRecordVideo() ? '<button class="btn sub" data-video>結果発表の動画を保存（6秒・TikTok・リール用）</button>' : ''}
      ${shareLinks({ text, url, channelPrefix: '' }).html}
      <button class="btn sub small wide" data-text>テキストでコピー（LINE・X用）</button>
      ${inAppHint()}
      <div class="btn-row">
        <button class="btn sub small" data-card="label">成分表カード</button>
        <button class="btn sub small" data-prof>プロフ帳カード</button>
      </div>
      <button class="btn sub small wide" data-sticker>シール帳用のシール（コンビニで印刷・L判）</button>
    </section>
    ${referCard()}
    <div class="tiles">
      <div class="tile"><b>ポンコツ純度</b><strong>${r.purity}%</strong><small>${esc(title)}</small></div>
      <div class="tile" data-rarity>${rarityTile(rarity)}</div>
      <a class="tile" href="${typePath(r.ura.index)}"><b>裏タイプ</b><strong class="small">${esc(ura.label)}</strong><small>もうひとつの顔</small></a>
    </div>
    ${detailTeaser(r)}
    <section class="card"><h2>あなたの4つの軸</h2>${axisBars(r)}</section>
    <section class="card"><h2>成分表</h2>${labelPanel(r.index, r)}</section>
    <section class="card"><h2>あるある</h2><ul class="aru">${t.aru.map((a) => `<li class="jp">${jp(a)}</li>`).join('')}</ul></section>
    ${picksCard(r.index)}
    ${adSlot('result')}
    ${compatSection(r.index, r)}
    <section class="card"><h2>${esc(t.label)}をもっと知る</h2>
      <p>性格・恋愛・友達・学校・バイト・推し活・トリセツまで、タイプの解説を全部読めます。</p>
      <a class="btn sub" href="${typePath(r.index)}">${esc(t.label)}の解説を読む</a>
    </section>
    <section class="card"><h2>友達と遊ぶ</h2>
      <div class="btn-col">
        <button class="btn sub" data-quiz-create>わたしクイズを出す（友達が答えを当てる）</button>
        <button class="btn sub" data-group>グループ診断をつくる（仲良しグループ・部活・推し仲間）</button>
        ${boardCount ? `<a class="btn sub" href="#/qboard">わたしクイズの成績表（${boardCount}人）</a>` : ''}
      </div>
    </section>
    ${nowCard(r.index)}
    ${pollCard()}
    ${moreFun()}
    <button class="btn" data-go="#/q">もう一回診断する</button>
    <button class="btn sub" data-go="#/zukan">図鑑をみる（全${TYPES.length}タイプ）</button>
    ${foot()}`, r.index);

  const ctx = { ...r, title, rarity };
  loadStats().then((stats) => {
    if (gen !== navNow() || !stats) return;
    rarity = rarityOf(r.index, stats);
    ctx.rarity = rarity;
    const tile = app.querySelector('[data-rarity]');
    if (tile) tile.innerHTML = rarityTile(rarity);
  });
  app.querySelectorAll('[data-card]').forEach((b) =>
    b.addEventListener('click', () => {
      // ストーリーのリンクスタンプ用に、押した直後に結果のリンクをコピーしておく
      const linkCopied = copySilently(url);
      busy(b, async () => {
        toast('画像をつくっています…');
        const canvas = b.dataset.card === 'label' ? await drawLabelCard(ctx) : await drawStoryCard(ctx);
        track('share', b.dataset.card === 'label' ? 'label-image' : 'image');
        await shareImageBlob(await canvasToBlob(canvas), { name: `ponkotsu-${typeNo(r.index)}-${b.dataset.card}.png`, text: `${text}\n${url}`, alt: `${t.label}のシェア画像`, linkCopied: await linkCopied });
      });
    }),
  );
  const videoButton = app.querySelector('[data-video]');
  videoButton?.addEventListener('click', () =>
    busy(videoButton, async () => {
      toast('動画をつくっています（6秒）…');
      const card = await drawStoryCard(ctx);
      const blob = await recordReveal(card);
      track('share', 'video');
      await shareVideo(blob, { name: `ponkotsu-${typeNo(r.index)}`, text: `${text}\n${url}` });
    }),
  );
  const carouselButton = app.querySelector('[data-carousel]');
  carouselButton.addEventListener('click', () => shareCarousel(carouselButton, r, `${text}\n${url}`));
  bindAgree(encodeResult(r));
  app.querySelector('[data-text]').addEventListener('click', () => {
    track('share', 'text');
    copyText(textResult(r, url));
  });
  app.querySelectorAll('[data-invite]').forEach((b) => b.addEventListener('click', () => openInviteModal(r)));
  app.querySelector('[data-quiz-create]').addEventListener('click', () => openQuizCreate(r));
  app.querySelector('[data-group]').addEventListener('click', openGroupCreate);
  app.querySelector('[data-prof]').addEventListener('click', () => openProfileCard(r));
  bindNowCard(r.index, url);
  keepNowFresh(r.index, gen, navNow);
  bindPoll(gen, navNow);
  bindSticker(r, url);
  bindReferCard(ctx, { url, text, gen, navNow });
  fillAds(app);
}

// 「もっと楽しむ」：LINEスタンプ・グッズ・LINE公式アカウント（設定に URL があるものだけ）
export function moreFun() {
  const l = SITE.links || {};
  const items = [
    [l.stamps, 'stamps', 'ポンコツ図鑑のLINEスタンプ'],
    [l.goods, 'goods', 'タイプ別のグッズ（ステッカー・アクスタ）'],
    [l.lineOfficial, 'line', 'LINEで毎週のお題を受け取る'],
  ].filter(([url]) => url);
  if (!items.length) return '';
  return `<section class="card"><h2>もっと楽しむ</h2><div class="btn-col">${items
    .map(([url, key, label]) => `<a class="btn sub" href="${esc(url)}" target="_blank" rel="noopener" data-out="${key}">${esc(label)}</a>`)
    .join('')}</div></section>`;
}

// シール帳用のシール。QR のリンクは相性のおさそいつき（ch=print で、シールから来た人を数える）
export const STICKER_HINT = '保存した画像を、コンビニのマルチコピー機やネットプリントで「シール紙（L判）」を選んで印刷してね（料金や対応は、お店やアプリで確かめてね）';
export function bindSticker(r, url) {
  const b = app.querySelector('[data-sticker]');
  b?.addEventListener('click', () =>
    busy(b, async () => {
      toast('シールをつくっています…');
      const { drawStickerSheet } = await import('./sticker.js');
      const canvas = await drawStickerSheet(r, `${url}&ch=print`);
      track('share', 'sticker');
      await shareImageBlob(await canvasToBlob(canvas), { name: `ponkotsu-sticker-${typeNo(r.index)}.png`, text: '', alt: `${TYPES[r.index].label}のシール`, hint: STICKER_HINT });
    }),
  );
}

// ---------- タイプ詳細（シェアURLの着地点・図鑑から） ----------
const NAV = [
  ['sec-self', '性格'],
  ['sec-love', '恋愛'],
  ['sec-friend', '友達'],
  ['sec-school', '学校・バイト'],
  ['sec-toriset', 'トリセツ'],
  ['sec-compat', '相性'],
];

// まだ出会っていない隠しタイプ（図鑑の上に重ねて出す）
export function showLockedType(index) {
  openModal(`<div class="locked-chara">${charaSVG(index, { size: 140 })}</div>
    <h2 class="sheet-title">${noLabel(index)}は、まだ秘密</h2>
    <p class="hint">診断で引き当てるか、このタイプの友達から相性のおさそいをもらうと図鑑にのります。</p>
    <button class="btn" data-close data-go="#/q">診断する</button>`);
}

// タイプの解説ページ。まだ出会っていない隠しタイプなら描かずに false を返す
export function viewType(index) {
  const t = TYPES[index];
  const mine = store.get('mine', null);
  const unlocked = !isHidden(index) || unlockedHidden().has(index) || document.body.dataset.type === typeNo(index).toLowerCase();
  if (!unlocked) return false;
  render(`
    ${inviteBanner({ cta: true })}
    ${brand()}
    <section class="result">
      <span class="no">${noLabel(index)}</span>
      <div class="chara-wrap">${charaSVG(index, { size: 240 })}</div>
      <h1 class="label">${esc(t.label)}</h1>
      <p class="catch-line jp">${jp(t.catch)}</p>
    </section>
    ${ponkotsuBlock(t, { who: 'このタイプ', charm: false })}
    <button class="btn" data-go="#/q">${mine ? 'もう一回診断する' : 'あなたも診断する（無料・1分）'}</button>
    <nav class="secnav" aria-label="もくじ">${NAV.map(([id, l]) => `<button data-scroll="${id}">${l}</button>`).join('')}</nav>
    <section class="card" id="sec-self"><h2>基本の性格</h2>
      <p>${esc(t.summary)}</p>
      <div class="two">
        <div><h3>ポンコツポイント</h3><ul class="points bad">${t.ponkotsu.map((x) => `<li class="jp">${jp(x)}</li>`).join('')}</ul></div>
        <div><h3>愛されポイント</h3><ul class="points good">${t.charm.map((x) => `<li class="jp">${jp(x)}</li>`).join('')}</ul></div>
      </div>
    </section>
    <section class="card"><h2>成分表</h2>${labelPanel(index, null)}</section>
    <section class="card"><h2>あるある</h2><ul class="aru">${t.aru.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></section>
    <section class="card" id="sec-love"><h2>恋愛</h2><p>${esc(t.love)}</p>
      <ul class="aru">${t.loveAru.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
      <p class="hint">あなたの恋愛タイプ（8種類）は、くわしい診断でわかります。</p></section>
    <section class="card" id="sec-friend"><h2>友達・グループでは</h2>
      <p><span class="chip">${esc(t.role)}</span></p><p>${esc(t.friend)}</p>
      <h3>推し活</h3><p>${esc(t.oshi)}</p>
      <h3>トーク・SNS</h3><p>${esc(t.sns)}</p>
      <h3>休日</h3><p>${esc(t.holiday)}</p>
      <h3>落ちこんだときの復活法</h3><p>${esc(t.recover)}</p>
    </section>
    <section class="card" id="sec-school"><h2>学校・バイト・仕事</h2><p>${esc(t.school)}</p>
      <h3>向いてるかもしれないバイト・仕事</h3><div class="chips">${t.jobs.map((j) => `<span class="chip soft">${esc(j)}</span>`).join('')}</div></section>
    ${picksCard(index)}
    ${adSlot('type')}
    <section class="card" id="sec-toriset"><h2>${esc(t.chara)}のトリセツ</h2>
      <div class="two">
        <div><h3>こうしてくれるとうれしい</h3><ul class="points good">${t.toriset.do.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div><h3>これはやめてね</h3><ul class="points bad">${t.toriset.dont.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
      </div>
      <dl class="facts"><dt>生息地</dt><dd>${esc(t.habitat)}</dd><dt>口ぐせ</dt><dd>「${esc(t.kuchiguse)}」</dd></dl>
    </section>
    ${compatSection(index, null)}
    <section class="card"><h2>このタイプの人へ</h2>
      <p>くわしい診断（無料）で、二つ名・恋愛タイプ・ステータスのランクがわかります。数値や「本当のあなた」などのくわしい解説は、完全版（有料）で読めます。</p>
      <button class="btn type" data-go="#/d">くわしい診断をする</button>
    </section>
    <button class="btn sub" data-go="#/zukan">図鑑をみる</button>
    ${foot()}`, index);
  app.querySelectorAll('[data-scroll]').forEach((b) =>
    b.addEventListener('click', () => app.querySelector(`#${b.dataset.scroll}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })),
  );
  fillAds(app);
  return true;
}

// 自分で引き当てた／友達経由で出会った隠しタイプ
export function unlockedHidden() {
  const set = new Set(store.get('gotHidden', []));
  friends().forEach((f) => isHidden(f.result.index) && set.add(f.result.index));
  return set;
}

// ---------- 図鑑（シール帳） ----------
export function viewZukan() {
  const mine = store.get('mine', null);
  const fr = friends();
  const byType = new Map();
  fr.forEach((f) => {
    if (!byType.has(f.result.index)) byType.set(f.result.index, []);
    byType.get(f.result.index).push(f.name);
  });
  const got = unlockedHidden();
  const met = new Set([...byType.keys(), ...(mine && TYPES[mine.index] ? [mine.index] : []), ...store.get('metExtra', [])]);
  const cards = TYPES.map((t, i) => {
    const locked = isHidden(i) && !got.has(i);
    const isMine = mine && mine.index === i;
    const names = byType.get(i) || [];
    const tilt = ((i * 37) % 9) - 4;
    return `<a class="sticker ${isMine ? 'mine' : ''} ${locked ? 'locked' : ''} ${met.has(i) ? 'met' : ''}" href="${typePath(i)}" style="--tilt:${tilt}deg">
      ${isMine ? '<span class="me">あなた</span>' : ''}
      <span class="seal">${charaSVG(i, { size: 120 })}</span>
      <span class="n">${noLabel(i)}</span>
      <span class="l">${locked ? '？？？' : esc(t.label)}</span>
      ${names.length ? `<span class="friends-on">${names.slice(0, 2).map(esc).join('・')}${names.length > 2 ? ` ほか${names.length - 2}人` : ''}</span>` : ''}
    </a>`;
  }).join('');
  render(`
    ${brand()}
    <section class="zukan">
      <h1>ポンコツ図鑑</h1>
      <p class="hint" style="margin:0">全${BASE_COUNT}タイプ＋隠しタイプ${HIDDEN.length}つのシール帳。友達と相性をくらべたり、クイズに答えたりすると、そのタイプのシールが集まります。</p>
      <div class="complete"><span>集めたシール</span><b>${met.size} / ${TYPES.length}</b><i style="width:${(met.size / TYPES.length) * 100}%"></i></div>
      <div class="stickerbook">${cards}</div>
    </section>
    ${mine ? '<button class="btn type" data-invite-mine style="margin-top:20px">友達を誘ってシールを集める</button>' : '<button class="btn" data-go="#/q" style="margin-top:20px">診断する</button>'}
    ${adSlot('zukan')}
    ${moreFun()}
    ${mine ? `<section class="card carry"><h2>ほかのブラウザでも続きから</h2>
      <p class="hint">LINEの中のブラウザと Safari・Chrome では、保存場所が別です。このリンクを LINE の Keep メモに送っておくと、どちらでも結果とシール帳の続きから遊べます。ほかの人には送らないでね。</p>
      <a class="btn sub small" data-ch="carry:line" href="https://line.me/R/share?text=${encodeURIComponent(`ポンコツ図鑑の続きリンク（自分用）\n${ORIGIN}/?openExternalBrowser=1#/me/${exportPayload({ mineQuick: store.get('mineQuick', null), mineDetail: store.get('mineDetail', null), met, gotHidden: store.get('gotHidden', []) })}`)}" target="_blank" rel="noopener">LINE の Keep メモに送る</a>
    </section>` : ''}
    ${foot()}`);
  app.querySelector('[data-invite-mine]')?.addEventListener('click', () => {
    const r = decodeResult(mine.code);
    if (r) openInviteModal(r);
  });
  fillAds(app);
}

// 続きリンク（#/me/...）を開いたとき：この端末にない分だけ足す
export function receiveCarryover(payload) {
  const data = importPayload(payload);
  if (!data) return false;
  const shareId = Math.random().toString(36).slice(2, 8);
  if (data.quick && !store.get('mineQuick', null)) store.set('mineQuick', { ...data.quick, shareId });
  if (data.detail && !store.get('mineDetail', null)) store.set('mineDetail', { ...data.detail, shareId });
  if (!store.get('mine', null)) {
    const m = data.detail || data.quick;
    if (m) store.set('mine', { ...m, shareId, mode: data.detail ? 'detail' : 'quick' });
  }
  store.set('metExtra', [...new Set([...store.get('metExtra', []), ...data.met])]);
  store.set('gotHidden', [...new Set([...store.get('gotHidden', []), ...data.hidden])]);
  return true;
}
