// くわしい診断のレポート（全8章）。
//   第1章は全部無料（ステータス・二つ名の理由の見本）。
//   第2〜8章は、ふんわりした部分（見出し・段階・冒頭の一言）だけ見せて、くわしい部分はモザイク。
//   モザイクの下には本物の文章を置かない（同じくらいの長さのダミー文字をぼかしている）。
import { SITE } from './config.js';
import { TYPES, AXES, PARAMS, PARAM_TEXT, LOVE_TYPES, isHidden, typeNo } from './data.js';
import { titleOf, rarityOf, paramLevel, rankOf, LEVEL_NAMES, fullName } from './logic.js';
import { charaSVG, shade } from './chara.js';
import { radarSVG, statValues, STAT_LABELS } from './radar.js';
import { drawStoryCard, drawStatusCard, canvasToBlob } from './card.js';
import { app, ORIGIN, esc, track, loadStats, render, toast, foot, brand, shareLinks, shareImageBlob, inAppHint, ICONS } from './ui.js';
import { openPaywall, fetchPremium, fetchSample, hasPremium, previewUnlocked, watchClaim, premiumStatus, maybeShowAfterPurchase } from './premium.js';
import { openInviteModal, openGroupCreate, invitePairBox, openQuizCreate } from './social.js';
import { openProfileCard } from './profile.js';

const typePath = (index) => `#/t/${typeNo(index).toLowerCase()}`;

// ---------- モザイク ----------
// タイプの無料の文章を材料に、決まった並びでかき混ぜたダミー文字を作る（本物の有料文は使わない）
function dummy(index, seed, length) {
  const t = TYPES[index];
  const pool = Array.from(`${t.summary}${t.aru.join('')}${t.charm.join('')}`.replace(/[「」（）、。！？\s]/g, ''));
  let x = (seed * 2654435761 + index * 97) >>> 0;
  let out = '';
  for (let i = 0; i < length; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    out += pool[x % pool.length];
    if (i % 23 === 22) out += '。';
  }
  return out;
}

const mosaic = (index, seed, length, lines = null) => `
  <div class="mosaic" data-paywall aria-label="完全版で読めます">
    ${lines
      ? `<ul>${Array.from({ length: lines }, (_, k) => `<li>${dummy(index, seed + k, length)}</li>`).join('')}</ul>`
      : `<p>${dummy(index, seed, length)}</p>`}
    <span class="lock">完全版で読めます</span>
  </div>`;

// ---------- 章 ----------
function chapter(no, title, body, { free = false, locked = false } = {}) {
  return `<section class="card chapter-card ${locked ? 'locked' : ''}" id="ch${no}">
    <div class="ch-head"><span class="ch-no">第${no}章</span><h2>${esc(title)}</h2>${free ? '<span class="chip soft">無料</span>' : locked ? '<span class="chip lockchip">完全版</span>' : ''}</div>
    ${body}
  </section>`;
}

function statusChapter(r, prem) {
  const values = statValues(r);
  const t = TYPES[r.index];
  const masked = !prem;
  const rows = STAT_LABELS.map((label, k) => {
    const isParam = k >= AXES.length;
    const v = values[k];
    const shown = !isParam || !masked;
    return `<li><span class="sl">${esc(label)}</span>
      <span class="sbar"><i style="width:${shown ? v : 0}%" class="${shown ? '' : 'hide'}"></i></span>
      <b class="srank r${rankOf(v)}">${rankOf(v)}</b>
      <span class="sv ${shown ? '' : 'masked'}" ${shown ? '' : 'data-paywall'}>${shown ? `${v}%` : '??%'}</span></li>`;
  }).join('');
  return `
    <div class="radar-wrap">${radarSVG(values, { masked, color: shade(t.color, 0.32) })}</div>
    <ul class="stats">${rows}</ul>
    <p class="hint">${masked ? 'ランク（S〜D）は無料、パラメータの数値と解説は完全版で読めます。' : 'S〜D は、そのパラメータの高さのランクです。'}</p>
    <div class="nick-why">
      <h3>二つ名「${esc(r.nickname.text)}」の理由</h3>
      <p class="lead-line">${esc(PARAMS[r.nickname.param].name)}が${esc(LEVEL_NAMES[paramLevel(r.params[r.nickname.param])])}（ランク${rankOf(r.params[r.nickname.param])}）。いちばん振り切れていたのがここでした。</p>
      <p class="sample" id="sample">${prem?.params ? esc(prem.params[r.nickname.param]) : '<span class="hint">読みこみ中…</span>'}</p>
      ${prem ? '' : '<p class="hint">↑ 完全版の解説の見本です。ほかの5項目も、同じくらいくわしく読めます。</p>'}
    </div>
    <p class="hint">${esc(t.chara)}の4つの軸（全力・人たらし・ノリ・切りかえ）は、かんたん診断の結果と同じです。</p>`;
}

function paramChapter(r, prem) {
  return PARAMS.map((p, k) => {
    const lv = paramLevel(r.params[k]);
    const lead = PARAM_TEXT[k][lv].lead;
    return `<div class="param-item">
      <div class="pi-head"><b>${esc(p.name)}</b><span class="chip soft">${LEVEL_NAMES[lv]}</span><span class="srank r${rankOf(r.params[k])}">${rankOf(r.params[k])}</span></div>
      <p class="lead-line">${esc(lead)}</p>
      ${prem?.params ? `<p>${esc(prem.params[k])}</p>` : k === r.nickname.param ? '<p class="hint">（くわしい解説は第1章の見本で読めます）</p>' : mosaic(r.index, 10 + k, 150)}
    </div>`;
  }).join('');
}

function loveChapter(r, prem) {
  const l = LOVE_TYPES[r.love];
  const best = LOVE_TYPES[l.best];
  return `
    <div class="love-head"><span class="love-name">${esc(l.name)}</span><p class="catch-line">${esc(l.catch)}</p></div>
    <p class="lead-line">${esc(l.lead)}</p>
    ${prem?.love ? `<p>${esc(prem.love.detail)}</p>
      <h3>恋のアドバイス</h3><ol class="tips">${prem.love.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : `${mosaic(r.index, 30, 200)}<h3>恋のアドバイス</h3>${mosaic(r.index, 40, 18, 3)}`}
    <div class="best"><span class="chip">相性のいい恋愛タイプ</span> <b>${esc(best.name)}</b>
      ${prem?.love ? `<p>${esc(prem.love.bestWhy)}</p>` : `<p class="hint">理由は完全版で読めます</p>`}</div>`;
}

function premiumChapters(r, prem) {
  const t = TYPES[r.index];
  const p = prem?.type;
  return [
    chapter(4, '本当のあなた', p ? `<p>${esc(p.deep)}</p>` : `<p class="lead-line">${esc(t.teaser)}</p>${mosaic(r.index, 50, 180)}`, { locked: !p }),
    chapter(5, 'ポンコツを武器にする3つの方法', p ? `<ol class="tips">${p.growth.map((g) => `<li>${esc(g)}</li>`).join('')}</ol>` : mosaic(r.index, 60, 28, 3), { locked: !p }),
    chapter(6, '恋愛の落とし穴と攻略法', p ? `<p>${esc(p.loveDeep)}</p>` : mosaic(r.index, 70, 180), { locked: !p }),
    chapter(7, '2027年の過ごし方ヒント', p ? `<p>${esc(p.next)}</p>` : mosaic(r.index, 80, 160), { locked: !p }),
    chapter(8, 'お守りメッセージ', p ? `<div class="letter"><p>${esc(p.letter)}</p></div>` : mosaic(r.index, 90, 80), { locked: !p }),
  ].join('');
}

// ---------- ページ ----------
export async function viewReport(r, shareId) {
  const t = TYPES[r.index];
  const title = titleOf(r.purity);
  const stats = await loadStats();
  const rarity = rarityOf(r.index, stats);
  const love = LOVE_TYPES[r.love];
  const name = fullName(r);
  const url = `${ORIGIN}/t/${typeNo(r.index).toLowerCase()}/?s=${shareId}`;
  const text = `私は【${name}】でした。恋愛は「${love.name}」\n#${SITE.hashtag} あなたの二つ名は？`;
  const unlocked = hasPremium() || previewUnlocked();
  const prem = unlocked ? await fetchPremium(r) : null;
  const s = await premiumStatus();
  const price = s.plans?.[0]?.price ?? SITE.premiumPrice;

  render(`
    ${brand()}
    <section class="result">
      ${isHidden(r.index) ? '<div class="secret">隠しタイプのくわしい診断！</div>' : ''}
      <p class="lead">くわしい診断の結果</p>
      <span class="no">${isHidden(r.index) ? `隠しタイプ ${typeNo(r.index)}` : `No.${typeNo(r.index)}`}</span>
      <div class="chara-wrap">${charaSVG(r.index, { size: 220 })}</div>
      <p class="nickname">${esc(r.nickname.text)}</p>
      <h1 class="label">${esc(t.label)}</h1>
      <div class="chips center"><span class="chip">${esc(title)}・ポンコツ純度${r.purity}%</span><span class="chip love">${esc(love.name)}</span></div>
      <p class="praise">${esc(t.praise)}</p>
    </section>
    ${invitePairBox(r)}
    <section class="share">
      <button class="btn type" data-card="nick">二つ名カードを保存</button>
      ${shareLinks({ text, url, channelPrefix: '' }).html}
      ${inAppHint()}
      <div class="btn-row">
        <button class="btn sub small" data-card="status">${prem ? '' : ICONS.lock}ステータスカード</button>
        <button class="btn sub small" data-prof>プロフ帳カード</button>
      </div>
    </section>
    ${prem ? '' : `<div class="paynote">第1〜3章のふんわり部分と、第1章の見本は無料。くわしい部分（第2〜8章）は完全版 <b>${price}円</b>（税込・1回だけ・自動更新なし）で読めます。</div>`}
    <nav class="secnav" aria-label="もくじ">${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<button data-scroll="ch${n}">第${n}章</button>`).join('')}</nav>
    ${chapter(1, 'あなたのステータス', statusChapter(r, prem), { free: true })}
    ${prem ? '' : `<div class="cta-inline"><p>第2〜8章とステータスの数値は完全版で</p><button class="btn gold small" data-paywall>完全版を見る（${price}円）</button></div>`}
    ${chapter(2, 'パラメータ解説', paramChapter(r, prem), { locked: !prem })}
    ${chapter(3, `恋愛タイプ「${love.name}」`, loveChapter(r, prem), { locked: !prem })}
    ${premiumChapters(r, prem)}
    ${prem ? '' : `<p class="hint center">※モザイクはイメージです。購入後は、見出しの数と同じだけの文章が表示されます。</p>`}
    <section class="card"><h2>もっと遊ぶ</h2>
      <div class="btn-col">
        <a class="btn sub" href="${typePath(r.index)}">${esc(t.label)}の解説（性格・恋愛・友達・学校・トリセツ）</a>
        <button class="btn sub" data-invite>友達と相性をくらべる</button>
        <button class="btn sub" data-quiz-create>わたしクイズを出す</button>
        <button class="btn sub" data-group>グループ診断をつくる</button>
      </div>
    </section>
    <button class="btn sub" data-go="#/zukan">図鑑をみる</button>
    ${foot()}
    ${prem ? '' : `<div class="paybar" role="region" aria-label="完全版"><span>のこり<b>7章</b>がモザイク中</span><button class="btn gold small" data-paywall>${price}円で全部読む</button></div>`}`, r.index);

  document.body.classList.toggle('has-paybar', !prem);
  app.querySelectorAll('[data-scroll]').forEach((b) =>
    b.addEventListener('click', () => app.querySelector(`#${b.dataset.scroll}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })),
  );
  app.querySelectorAll('[data-paywall]').forEach((el) => el.addEventListener('click', () => openPaywall(r)));
  app.querySelectorAll('[data-invite]').forEach((b) => b.addEventListener('click', () => openInviteModal(r)));
  app.querySelector('[data-quiz-create]').addEventListener('click', () => openQuizCreate(r));
  app.querySelector('[data-group]').addEventListener('click', openGroupCreate);
  app.querySelector('[data-prof]').addEventListener('click', () => openProfileCard(r));
  app.querySelectorAll('[data-card]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (b.dataset.card === 'status' && !prem) {
        openPaywall(r);
        return;
      }
      toast('画像をつくっています…');
      const canvas = b.dataset.card === 'status'
        ? await drawStatusCard({ ...r, title, rarity, gold: true })
        : await drawStoryCard({ ...r, title, rarity, nickname: r.nickname.text, loveName: love.name, gold: !!prem });
      track('share', b.dataset.card === 'status' ? 'status-image' : 'nick-image');
      await shareImageBlob(await canvasToBlob(canvas), { name: `ponkotsu-${typeNo(r.index)}-${b.dataset.card}.png`, text: `${text}\n${url}`, alt: `${name}のシェア画像` });
    }),
  );

  // 第1章の見本（二つ名のもとになったパラメータの解説）
  if (!prem) {
    const sample = await fetchSample(r);
    const el = app.querySelector('#sample');
    if (el) el.textContent = sample?.detail || 'ネットワークにつながると、ここに見本が表示されます。';
    // 第1章を読み終えたあたりで、一度だけ購入の案内を出す（自動で出すのは1回まで）
    const ch2 = app.querySelector('#ch2');
    if (ch2 && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          openPaywall(r, { auto: true });
        }
      }, { rootMargin: '0px 0px -40% 0px' });
      io.observe(ch2);
    }
    watchClaim(() => viewReport(r, shareId));
  }
  maybeShowAfterPurchase();
}
