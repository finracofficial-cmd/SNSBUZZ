// くわしい診断のレポート（全8章）。
//   第1章は全部無料（ステータス・二つ名の理由の見本）。
//   第2〜8章は、ふんわりした部分（見出し・段階・冒頭の一言）だけ見せて、くわしい部分はモザイク。
//   モザイクの下には本物の文章を置かない（同じくらいの長さのダミー文字をぼかしている）。
import { SITE } from './config.js';
import { TYPES, AXES, PARAMS, PARAM_TEXT, LOVE_TYPES, isHidden, typeNo } from './data.js';
import { titleOf, rarityOf, paramLevel, rankOf, LEVEL_NAMES, fullName, skillsOf } from './logic.js';
import { charaSVG, shade } from './chara.js';
import { radarSVG, statValues, statLabels } from './radar.js';
import { drawStoryCard, drawStatusCard, drawWallpaper, canvasToBlob } from './card.js';
import { app, ORIGIN, esc, track, loadStats, render, toast, foot, brand, shareLinks, shareImageBlob, inAppHint, ICONS, navNow, busy, copySilently, copyText, shareVideo } from './ui.js';
import { openPaywall, fetchPremium, hasPremium, previewUnlocked, watchClaim, premiumStatus, maybeShowAfterPurchase, restorePurchase, hasGift, openGift, priceOf } from './premium.js';
import { openInviteModal, openGroupCreate, invitePairBox, openQuizCreate } from './social.js';
import { openProfileCard } from './profile.js';
import { shareCarousel, shareUrl, bindSticker, ponkotsuBlock } from './result.js';
import { textResult } from './textshare.js';
import { canRecordVideo, recordReveal } from './video.js';
import { nowCard, bindNowCard, keepNowFresh } from './now.js';
import { variant, abTrack } from './ab.js';
import { mosaic, approx } from './mosaic.js';
import { referCard, bindReferCard } from './referral.js';

const typePath = (index) => `#/t/${typeNo(index).toLowerCase()}`;

// ---------- 章 ----------
function chapter(no, title, body, { free = false, locked = false } = {}) {
  return `<section class="card chapter-card ${locked ? 'locked' : ''}" id="ch${no}">
    <div class="ch-head"><span class="ch-no">第${no}章</span><h2>${esc(title)}</h2>${free ? '<span class="chip soft">無料</span>' : locked ? '<span class="chip lockchip">完全版</span>' : ''}</div>
    ${body}
  </section>`;
}

function skillsBox(r) {
  const s = skillsOf(r);
  if (!s) return '';
  return `<div class="skills">
    <div><span class="chip">必殺技</span><b>「${esc(s.skill.skill)}」</b><small>${esc(s.skill.name)} ${s.hiRank}</small></div>
    <div><span class="chip soft">弱点</span><b>「${esc(s.weak.weak)}」</b><small>${esc(s.weak.name)} ${s.loRank}</small></div>
  </div>`;
}

function statusChapter(r, prem) {
  const sampleText = PARAM_TEXT[r.nickname.param][paramLevel(r.params[r.nickname.param])];
  const values = statValues(r);
  const labels = statLabels(r);
  const t = TYPES[r.index];
  const masked = !prem;
  const rows = labels.map((label, k) => {
    const isParam = k >= AXES.length;
    const v = values[k];
    const shown = !isParam || !masked;
    return `<li><span class="sl">${esc(label)}</span>
      <span class="sbar"><i style="width:${shown ? v : 0}%" class="${shown ? '' : 'hide'}"></i></span>
      <b class="srank r${rankOf(v)}">${rankOf(v)}</b>
      <span class="sv ${shown ? '' : 'masked'}" ${shown ? '' : 'data-paywall'}>${shown ? `${v}%` : '??%'}</span></li>`;
  }).join('');
  return `
    <div class="radar-wrap">${radarSVG(values, { labels, masked, color: shade(t.color, 0.32) })}</div>
    <ul class="stats">${rows}</ul>
    ${skillsBox(r)}
    <p class="hint">S〜D は高さの目安で、よい・わるいではありません。${masked ? 'ランクは無料、6つのパラメータの数値と解説は完全版で読めます。' : ''}</p>
    <div class="nick-why">
      <h3>二つ名「${esc(r.nickname.text)}」の理由</h3>
      <p class="lead-line">${esc(PARAMS[r.nickname.param].name)}が${esc(LEVEL_NAMES[paramLevel(r.params[r.nickname.param])])}（ランク${rankOf(r.params[r.nickname.param])}）。いちばん振り切れていたのがここでした。</p>
      ${prem?.params
        ? `<p class="sample">${esc(prem.params[r.nickname.param])}</p>`
        : `<p class="sample">${esc(sampleText.sample)}</p>${mosaic(r.index, 7, sampleText.rest)}
           <p class="hint">↑ 完全版の解説の見本（書き出し）です。続きと、ほかの5項目の解説も完全版で読めます。</p>`}
    </div>
    <p class="hint">上の4つ（${AXES.map((a) => `${a.neg}⇔${a.pos}`).join('・')}）は、かんたん診断と同じ結果です。</p>`;
}

function paramChapter(r, prem) {
  return PARAMS.map((p, k) => {
    const lv = paramLevel(r.params[k]);
    const lead = PARAM_TEXT[k][lv].lead;
    return `<div class="param-item">
      <div class="pi-head"><b>${esc(p.name)}</b><span class="chip soft">${LEVEL_NAMES[lv]}</span><span class="srank r${rankOf(r.params[k])}">${rankOf(r.params[k])}</span></div>
      <p class="lead-line">${esc(lead)}</p>
      ${prem?.params
        ? `<p>${esc(prem.params[k])}</p>`
        : k === r.nickname.param
          ? `<p class="hint">（書き出しは第1章の見本で読めます）</p>${mosaic(r.index, 10 + k, PARAM_TEXT[k][lv].rest)}`
          : mosaic(r.index, 10 + k, PARAM_TEXT[k][lv].len)}
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
      <h3>恋のアドバイス</h3><ol class="tips">${prem.love.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : `${mosaic(r.index, 30, l.len.detail)}<h3>恋のアドバイス</h3>${mosaic(r.index, 40, 0, l.len.tips)}`}
    <div class="best"><span class="chip">相性のいい恋愛タイプ</span> <b>${esc(best.name)}</b>
      ${prem?.love ? `<p>${esc(prem.love.bestWhy)}</p>` : `<p class="hint">理由は完全版で読めます</p>`}</div>`;
}

function premiumChapters(r, prem) {
  const t = TYPES[r.index];
  const p = prem?.type;
  const n = t.premiumLen;
  return [
    chapter(4, '本当のあなた', p ? `<p>${esc(p.deep)}</p>` : `<p class="lead-line">${esc(t.teaser)}</p>${mosaic(r.index, 50, n.deep)}`, { locked: !p }),
    chapter(5, 'ポンコツを武器にする3つの方法', p ? `<ol class="tips growth">${p.growth.map((g) => `<li><b>${esc(g.title)}</b><span>${esc(g.body)}</span></li>`).join('')}</ol>` : mosaic(r.index, 60, 0, n.growth), { locked: !p }),
    chapter(6, '恋愛の落とし穴と攻略法', p ? `<p>${esc(p.loveDeep)}</p>` : mosaic(r.index, 70, n.loveDeep), { locked: !p }),
    chapter(7, '2027年の過ごし方ヒント', p ? `<p>${esc(p.next)}</p>` : mosaic(r.index, 80, n.next), { locked: !p }),
    chapter(8, 'ひとことエール', p ? `<div class="letter"><p>${esc(p.letter)}</p></div>` : mosaic(r.index, 90, n.letter), { locked: !p }),
  ].join('');
}

// モザイクの下にある文章の合計（購入すると読める量）
function lockedLength(r) {
  const n = TYPES[r.index].premiumLen;
  const l = LOVE_TYPES[r.love].len;
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const params = PARAMS.reduce((acc, _, k) => {
    const t = PARAM_TEXT[k][paramLevel(r.params[k])];
    return acc + (k === r.nickname.param ? t.rest : t.len);
  }, 0);
  return params + l.detail + sum(l.tips) + l.bestWhy + n.deep + sum(n.growth) + n.loveDeep + n.next + n.letter;
}

// 画面下の固定バー（A/Bテスト paybar：量で見せるか、中身で見せるか）
function paybar(locked, price) {
  return variant('paybar') === 'specific'
    ? `<div class="paybar" role="region" aria-label="完全版"><span><b>「本当のあなた」</b>と恋愛の攻略法を読む</span><button class="btn gold small" data-paywall>${price}円で読む</button></div>`
    : `<div class="paybar" role="region" aria-label="完全版"><span>のこり<b>7章・約${locked}字</b>がモザイク中</span><button class="btn gold small" data-paywall>${price}円で全部読む</button></div>`;
}

// ---------- ページ ----------
export async function viewReport(r, shareId) {
  const gen = navNow();
  const t = TYPES[r.index];
  const title = titleOf(r.purity);
  const love = LOVE_TYPES[r.love];
  const name = fullName(r);
  const url = shareUrl(r, shareId);
  const sk = skillsOf(r);
  const text = `【${name}】だった！ 恋愛は「${love.name}」${sk ? `\n必殺技「${sk.skill.skill}」／弱点「${sk.weak.weak}」` : ''}\n#${SITE.hashtag} あなたの二つ名は？`;
  await restorePurchase();
  const [stats, fetched, s] = await Promise.all([
    loadStats(),
    hasPremium() || previewUnlocked() ? fetchPremium(r) : null,
    premiumStatus(),
  ]);
  // 読みこみを待っているあいだに別の画面へ移っていたら、描かない
  if (gen !== navNow()) return;
  const rarity = rarityOf(r.index, stats);
  // 購入済みなのに読みこめなかったときは、モザイクも購入案内も出さずに「再試行」を出す
  const failed = !!fetched?.error;
  const prem = failed ? null : fetched;
  const price = priceOf(s);
  const locked = prem ? 0 : approx(lockedLength(r)).toLocaleString('ja-JP');

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
    </section>
    ${ponkotsuBlock(t, { charm: false })}
    ${invitePairBox(r)}
    <section class="share">
      <button class="btn type" data-card="nick">二つ名カードを保存</button>
      <button class="btn sub" data-carousel>6枚まとめて保存（TikTok・インスタの投稿用）</button>
      ${canRecordVideo() ? '<button class="btn sub" data-video>結果発表の動画を保存（6秒・TikTok・リール用）</button>' : ''}
      ${shareLinks({ text, url, channelPrefix: '' }).html}
      <button class="btn sub small wide" data-text>テキストでコピー（LINE・X用）</button>
      ${inAppHint()}
      <div class="btn-row">
        <button class="btn sub small" data-card="status">${prem ? '' : ICONS.lock}ステータスカード</button>
        <button class="btn sub small" data-prof>プロフ帳カード</button>
      </div>
      <button class="btn sub small wide" data-sticker>シール帳用のシール（コンビニで印刷・L判）</button>
      <button class="btn sub small wide" data-card="wallpaper">${prem ? '' : ICONS.lock}ロック画面の壁紙（完全版の特典）</button>
    </section>
    ${failed
      ? `<div class="paynote">完全版の読みこみに失敗しました（購入情報はこの端末に残っています）。<button class="btn sub small" data-reload>もう一度読みこむ</button></div>`
      : prem ? '' : `<div class="paynote">無料で読めるのは、第1章（ランク・二つ名の理由と見本）と、各章の見出し・冒頭の一言です。パラメータの数値と、第2〜8章の本文（約${locked}字）は、完全版 <b>${price}円</b>（税込・買い切り）で読めます。</div>`}
    <nav class="secnav" aria-label="もくじ">${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<button data-scroll="ch${n}">第${n}章</button>`).join('')}</nav>
    ${chapter(1, 'あなたのステータス', statusChapter(r, prem), { free: true })}
    ${prem || failed ? '' : `<div class="cta-inline"><p>第2〜8章とステータスの数値は完全版で</p><button class="btn gold small" data-paywall>完全版を見る（${price}円）</button></div>`}
    ${chapter(2, 'パラメータ解説', paramChapter(r, prem), { locked: !prem })}
    ${chapter(3, `恋愛タイプ「${love.name}」`, loveChapter(r, prem), { locked: !prem })}
    ${premiumChapters(r, prem)}
    ${prem ? '' : `<p class="hint center">※モザイクはイメージです。購入すると、モザイクの部分の文章が読めるようになります（「約○字」はおおよその文字数です）。</p>`}
    ${nowCard(r.index)}
    ${referCard()}
    <section class="card"><h2>もっと遊ぶ</h2>
      <div class="btn-col">
        <a class="btn sub" href="${typePath(r.index)}">${esc(t.label)}の解説（性格・恋愛・友達・学校・トリセツ）</a>
        <button class="btn sub" data-invite>友達と相性をくらべる</button>
        <button class="btn sub" data-quiz-create>わたしクイズを出す</button>
        <button class="btn sub" data-group>グループ診断をつくる</button>
        ${prem && hasGift() ? '<button class="btn sub" data-gift>友達へのプレゼントのリンク</button>' : ''}
      </div>
    </section>
    <button class="btn sub" data-go="#/zukan">図鑑をみる</button>
    ${foot()}
    ${prem || failed ? '' : paybar(locked, price)}`, r.index);

  document.body.classList.toggle('has-paybar', !prem && !failed);
  bindReferCard({ ...r, title, rarity, nickname: r.nickname.text, loveName: love.name }, { url, text, gen, navNow });
  app.querySelector('[data-reload]')?.addEventListener('click', () => viewReport(r, shareId));
  app.querySelector('[data-gift]')?.addEventListener('click', openGift);
  app.querySelectorAll('[data-scroll]').forEach((b) =>
    b.addEventListener('click', () => app.querySelector(`#${b.dataset.scroll}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })),
  );
  app.querySelectorAll('[data-paywall]').forEach((el) => {
    el.addEventListener('click', () => openPaywall(r));
    if (el.classList.contains('mosaic')) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPaywall(r);
        }
      });
    }
  });
  const videoButton = app.querySelector('[data-video]');
  videoButton?.addEventListener('click', () =>
    busy(videoButton, async () => {
      toast('動画をつくっています（6秒）…');
      const card = await drawStoryCard({ ...r, title, rarity, nickname: r.nickname.text, loveName: love.name, gold: !!prem });
      const blob = await recordReveal(card);
      track('share', 'video');
      await shareVideo(blob, { name: `ponkotsu-${typeNo(r.index)}`, text: `${text}\n${url}` });
    }),
  );
  const carouselButton = app.querySelector('[data-carousel]');
  carouselButton.addEventListener('click', () => shareCarousel(carouselButton, r, `${text}\n${url}`));
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
  bindSticker(r, url);
  app.querySelectorAll('[data-card]').forEach((b) =>
    b.addEventListener('click', () => {
      const card = b.dataset.card;
      if ((card === 'status' || card === 'wallpaper') && !prem) {
        openPaywall(r);
        return;
      }
      const linkCopied = card === 'wallpaper' ? Promise.resolve(false) : copySilently(url);
      busy(b, async () => {
        toast('画像をつくっています…');
        const canvas = card === 'status'
          ? await drawStatusCard({ ...r, title, rarity, gold: true })
          : card === 'wallpaper'
            ? await drawWallpaper(r)
            : await drawStoryCard({ ...r, title, rarity, nickname: r.nickname.text, loveName: love.name, gold: !!prem });
        track('share', { status: 'status-image', wallpaper: 'wallpaper' }[card] || 'nick-image');
        await shareImageBlob(await canvasToBlob(canvas), { name: `ponkotsu-${typeNo(r.index)}-${b.dataset.card}.png`, text: `${text}\n${url}`, alt: `${name}のシェア画像`, linkCopied: await linkCopied });
      });
    }),
  );

  if (!prem && !failed) {
    // 価格のテストの今週の案が分かってから数える（販売状況は、このページの上で読みこみ済み）
    premiumStatus().then(() => abTrack('exposure'));
    // 第1章を読み終えたあたりで、一度だけ購入の案内を出す（自動で出すのは1回まで。A/Bテスト autopay で出さない案もある）
    const ch2 = app.querySelector('#ch2');
    if (ch2 && 'IntersectionObserver' in window && variant('autopay') === 'on') {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          openPaywall(r, { auto: true });
        }
      }, { rootMargin: '0px 0px -40% 0px' });
      io.observe(ch2);
    }
    watchClaim(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
  }
  maybeShowAfterPurchase();
}
