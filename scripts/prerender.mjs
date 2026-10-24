// 検索エンジンやJSが動かない環境向けに、タイプページ（/t/NN/）・全タイプ一覧（/types/）・トップの中身を
// 静的なHTMLとして書き出す。JSが動くと、いつもの画面に置きかわる（同じCSSのクラスを使うので見た目はほぼ同じ）。
// 隠しタイプは「引き当てる楽しみ」を残すため、中身を書き出さない。
import { SITE } from '../site/assets/config.js';
import { TYPES, BASE_COUNT, AXES, QUESTIONS, PARAM_QUESTIONS, HIDDEN, typeNo } from '../site/assets/data.js';
import { bitsOfIndex } from '../site/assets/logic.js';
import { charaSVG, shade, tint } from '../site/assets/chara.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const typeUrl = (i) => `/t/${typeNo(i).toLowerCase()}/`;
const theme = (i) => {
  const c = TYPES[i].color;
  return `--type:${c};--type-deep:${shade(c, 0.32)};--type-btn:${shade(c, 0.42)};--type-text:${shade(c, 0.5)};--type-soft:${tint(c, 0.75)}`;
};
const list = (items, cls = 'aru') => `<ul class="${cls}">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
const brand = () => `<div class="brand"><a href="/">${esc(SITE.name)}</a><a href="/types/">全タイプ一覧 →</a></div>`;
const foot = () => `<p class="foot">${esc(SITE.disclaimer)}<br><a href="/">トップ</a><a href="/types/">全タイプ一覧</a><a href="/#/about">このサイトについて</a><a href="/#/legal">特定商取引法に基づく表記</a></p>`;
const axesOf = (i) => bitsOfIndex(i).map((b, k) => (b ? AXES[k].pos : AXES[k].neg)).join('・');

// タイプページの中身（result.js の viewType と同じ並び）
export function typeBody(i) {
  const t = TYPES[i];
  const best = TYPES[t.best];
  const others = TYPES.slice(0, BASE_COUNT)
    .map((o, k) => (k === i ? '' : `<li><a href="${typeUrl(k)}">${esc(o.label)}</a></li>`))
    .join('');
  return `<div class="view prerendered" style="${theme(i)}">
    ${brand()}
    <section class="result">
      <span class="no">No.${typeNo(i)}</span>
      <div class="chara-wrap">${charaSVG(i, { size: 240 })}</div>
      <h1 class="label">${esc(t.label)}</h1>
      <p class="catch-line">${esc(t.catch)}</p>
    </section>
    <section class="ponkotsu-card">
      <p class="pk-head">このタイプのポンコツなところ</p>
      <p class="pk-main"><span>${esc(t.roast.replace(/^でも、?/, ''))}</span></p>
      ${list(t.ponkotsu, 'pk-list')}
    </section>
    <section class="charm-card">
      <p class="pk-head love">でも、だから愛される</p>
      <p class="praise">${esc(t.praise)}</p>
    </section>
    <a class="btn" href="/#/q">あなたも診断する（無料・1分）</a>
    <section class="card"><h2>基本の性格</h2>
      <p>${esc(t.summary)}</p>
      <p class="hint">4つの軸：${esc(axesOf(i))}</p>
      <div class="two">
        <div><h3>ポンコツポイント</h3>${list(t.ponkotsu, 'points bad')}</div>
        <div><h3>愛されポイント</h3>${list(t.charm, 'points good')}</div>
      </div>
    </section>
    <section class="card"><h2>${esc(t.label)}のあるある</h2>${list(t.aru)}</section>
    <section class="card"><h2>恋愛</h2><p>${esc(t.love)}</p>${list(t.loveAru)}</section>
    <section class="card"><h2>友達・グループでは</h2>
      <p><span class="chip">${esc(t.role)}</span></p><p>${esc(t.friend)}</p>
      <h3>推し活</h3><p>${esc(t.oshi)}</p>
      <h3>トーク・SNS</h3><p>${esc(t.sns)}</p>
      <h3>休日</h3><p>${esc(t.holiday)}</p>
      <h3>落ちこんだときの復活法</h3><p>${esc(t.recover)}</p>
    </section>
    <section class="card"><h2>学校・バイト・仕事</h2><p>${esc(t.school)}</p>
      <h3>向いてるかもしれないバイト・仕事</h3><div class="chips">${t.jobs.map((j) => `<span class="chip soft">${esc(j)}</span>`).join('')}</div></section>
    <section class="card"><h2>${esc(t.chara)}のトリセツ</h2>
      <div class="two">
        <div><h3>こうしてくれるとうれしい</h3>${list(t.toriset.do, 'points good')}</div>
        <div><h3>これはやめてね</h3>${list(t.toriset.dont, 'points bad')}</div>
      </div>
      <dl class="facts"><dt>生息地</dt><dd>${esc(t.habitat)}</dd><dt>口ぐせ</dt><dd>「${esc(t.kuchiguse)}」</dd></dl>
    </section>
    <section class="card"><h2>相性</h2>
      <div class="best"><span class="chip">相性◎</span> <a href="${typeUrl(t.best)}"><b>${esc(best.label)}</b></a><p>${esc(t.bestWhy)}</p></div>
    </section>
    <section class="card"><h2>ほかのタイプ</h2><ul class="type-links">${others}</ul>
      <p class="hint">ほかに、特定の答え方をした人だけが出会える隠しタイプが${HIDDEN.length}つあります。</p></section>
    <a class="btn" href="/#/q">自分のタイプを診断する</a>
    ${foot()}
  </div>`;
}

// 全タイプ一覧（/types/）
export function typesBody() {
  const cards = TYPES.slice(0, BASE_COUNT)
    .map(
      (t, i) => `<a class="card type-card" href="${typeUrl(i)}" style="${theme(i)}">${charaSVG(i, { size: 88 })}
        <div><small>No.${typeNo(i)}・${esc(axesOf(i))}</small><b>${esc(t.label)}</b><span>${esc(t.catch)}</span></div></a>`,
    )
    .join('');
  return `<div class="view prerendered">
    ${brand()}
    <section class="result"><h1 class="label">全${BASE_COUNT}タイプ一覧</h1>
      <p class="praise">${esc(SITE.quizName)}の${BASE_COUNT}タイプ。性格・恋愛・友達・学校・トリセツまで、タイプごとに解説しています。</p>
      <a class="btn" href="/#/q">あなたも診断する（無料・1分）</a></section>
    <div class="type-list">${cards}</div>
    <p class="hint center">ほかに、特定の答え方をした人だけが出会える隠しタイプが${HIDDEN.length}つあります。</p>
    ${foot()}
  </div>`;
}

// トップ（JSが動くまでのあいだと、検索エンジン向け）
export function homeBody() {
  return `<div class="view prerendered">
    <section class="hero">
      <h1><small>${esc(SITE.name)}</small>${esc(SITE.quizName)}</h1>
      <p class="catch">${esc(SITE.catchCopy).replace(/\n/g, '<br>')}</p>
      <a class="btn" href="/#/q">かんたん診断（${QUESTIONS.length}問・約1分）</a>
      <a class="btn type" href="/#/d">くわしい診断（${QUESTIONS.length + PARAM_QUESTIONS.length}問・約4分）</a>
    </section>
    <section class="card"><h2>全${BASE_COUNT}タイプ</h2><ul class="type-links">${TYPES.slice(0, BASE_COUNT)
      .map((t, i) => `<li><a href="${typeUrl(i)}">${esc(t.label)}</a></li>`)
      .join('')}</ul></section>
    ${foot()}
  </div>`;
}

// 友達から届いたリンク（わたしクイズ・相性・グループ）と決済から戻るページ。JSが動くまでの仮の画面
export function loadingBody(text) {
  return `<div class="view prerendered">
    ${brand()}
    <div class="loading small">${esc(text)}<div class="dots"><i></i><i></i><i></i></div></div>
    <a class="btn sub" href="/">トップへ</a>
  </div>`;
}

// 構造化データ（パンくず）
export function breadcrumbLd(origin, items) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, url], k) => ({ '@type': 'ListItem', position: k + 1, name, item: `${origin}${url}` })),
  }).replace(/</g, '\\u003c');
}
