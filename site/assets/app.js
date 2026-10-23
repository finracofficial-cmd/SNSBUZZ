import { SITE } from './config.js';
import { AXES, TYPES, QUESTIONS, HIDDEN_INDEX, typeNo } from './data.js';
import { judge, titleOf, purityOf, rarityOf, priorDistribution } from './logic.js';
import { charaSVG, shade, tint } from './chara.js';
import { drawStoryCard, canvasToBlob } from './card.js';

const app = document.getElementById('app');
const modal = document.getElementById('modal');
const toastEl = document.getElementById('toast');

// 本番ドメインが未設定のあいだは、いま開いているサイトのURLでシェアする
const ORIGIN = SITE.origin.includes('example.com') ? location.origin : SITE.origin;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------- 保存・計測（どちらも失敗しても画面は動く） ----------
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(`pz:${key}`);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`pz:${key}`, JSON.stringify(value));
    } catch {
      // プライベートモードなど
    }
  },
};

function track(k, v = '') {
  try {
    const body = new Blob([JSON.stringify({ k, v: String(v) })], { type: 'application/json' });
    navigator.sendBeacon?.('/api/event', body);
  } catch {
    // 計測はベストエフォート
  }
}

let statsPromise;
function loadStats() {
  statsPromise ??= (async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1500);
      const res = await fetch('/api/stats', { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  })();
  return statsPromise;
}

// ---------- 共通パーツ ----------
function setTheme(index) {
  const root = document.documentElement.style;
  if (index == null) {
    ['--type', '--type-deep', '--type-soft'].forEach((k) => root.removeProperty(k));
    return;
  }
  const c = TYPES[index].color;
  root.setProperty('--type', c);
  root.setProperty('--type-deep', shade(c, 0.32));
  root.setProperty('--type-soft', tint(c, 0.75));
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (toastEl.hidden = true), 2200);
}

const foot = () => `
  <p class="foot">${esc(SITE.disclaimer)}<br>
    <a href="#/">トップ</a><a href="#/zukan">図鑑</a><a href="#/about">このサイトについて</a>
  </p>`;

const brand = () => `<div class="brand"><a href="#/">${esc(SITE.name)}</a><a href="#/zukan">図鑑をみる →</a></div>`;

function render(html, index = null) {
  setTheme(index);
  app.innerHTML = `<div class="view">${html}</div>`;
  window.scrollTo(0, 0);
}

// ---------- ホーム ----------
function viewHome() {
  const parade = [3, 6, 8, 12, 10, 14, 7, 1].map((i) => charaSVG(i, { size: 100 })).join('');
  render(`
    <section class="hero">
      <h1><small>${esc(SITE.name)}</small>${esc(SITE.quizName)}</h1>
      <p class="catch">${esc(SITE.catchCopy)}</p>
      <div class="parade" aria-hidden="true">${parade}</div>
      <button class="btn" data-go="#/q">診断する（12問・1分）</button>
      <div class="meta-row"><span class="pill">16タイプ</span><span class="pill">隠しタイプあり</span><span class="pill">登録なし・無料</span></div>
    </section>
    ${foot()}`);
}

// ---------- 質問 ----------
// 選択肢の並びが「弱い→強い」の順に見えないよう、質問ごとに固定の順でシャッフルする
const ORDER = QUESTIONS.map((q, i) => {
  const idx = q.options.map((_, j) => j);
  let seed = (i + 3) * 2654435761;
  for (let j = idx.length - 1; j > 0; j--) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const k = seed % (j + 1);
    [idx[j], idx[k]] = [idx[k], idx[j]];
  }
  return idx;
});

let answers = [];

function viewQuestion() {
  const i = answers.length;
  const q = QUESTIONS[i];
  const opts = ORDER[i]
    .map((j) => `<button class="opt" data-choice="${j}">${esc(q.options[j].text)}</button>`)
    .join('');
  render(`
    <div class="progress" aria-hidden="true"><i style="width:${(i / QUESTIONS.length) * 100}%"></i></div>
    <div class="qhead"><span>Q${i + 1} / ${QUESTIONS.length}</span>${i > 0 ? '<button data-back>← もどる</button>' : '<a href="#/">やめる</a>'}</div>
    <h2 class="qtext">${esc(q.text)}</h2>
    <div class="opts">${opts}</div>`);
}

function choose(choice, button) {
  button.classList.add('on');
  app.querySelectorAll('.opt').forEach((b) => (b.disabled = true));
  setTimeout(() => {
    answers.push(choice);
    if (answers.length < QUESTIONS.length) {
      viewQuestion();
    } else {
      finish();
    }
  }, 170);
}

function finish() {
  const r = judge(answers);
  answers = [];
  const shareId = Math.random().toString(36).slice(2, 8);
  track('done', r.index);
  store.set('mine', { index: r.index, sums: r.sums, shareId });
  if (r.hidden) store.set('hidden', true);
  render(`<div class="loading">鑑定中…<div class="dots"><i></i><i></i><i></i></div></div>`);
  loadStats();
  setTimeout(() => {
    location.hash = `#/r/${r.index}/${r.sums.join(',')}/${shareId}`;
  }, 1300);
}

// ---------- 結果 ----------
const ICONS = {
  x: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M17.8 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L2 3h6.4l4.4 5.9L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z"/></svg>',
  line: '<svg viewBox="0 0 24 24"><path fill="#06C755" d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.6 1.1-.5 6-3.6 8.2-6.1C21.6 14.1 22 12.6 22 11c0-4.4-4.5-8-10-8Z"/></svg>',
  link: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  more: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
};

function shareUrl(index, shareId) {
  return `${ORIGIN}/t/${typeNo(index)}/?s=${shareId}`;
}

function shareText(index, purity) {
  const t = TYPES[index];
  return `私は【${t.label}（${titleOf(purity)}）】でした。ポンコツ純度${purity}%\n${t.roast}\n#${SITE.hashtag} あなたは何タイプ？`;
}

// 軸ごとの勝ち側はタイプ番号のビットから取る（合計0で引き分けた軸もタイプと表示がずれないように）
function axisBars(index, sums, pct) {
  return AXES.map((a, k) => {
    const pos = index === HIDDEN_INDEX ? sums[k] > 0 : ((index >> (3 - k)) & 1) === 1;
    const negPct = pos ? 100 - pct[k] : pct[k];
    return `<div class="axis">
      <div class="names"><span class="${pos ? '' : 'win'}">${esc(a.neg)} ${negPct}%</span><span class="${pos ? 'win' : ''}">${100 - negPct}% ${esc(a.pos)}</span></div>
      <div class="bar"><i style="${pos ? 'right' : 'left'}:0;width:${pos ? 100 - negPct : negPct}%"></i></div>
    </div>`;
  }).join('');
}

function typeBody(index) {
  const t = TYPES[index];
  const best = TYPES[t.best];
  return `
    <div class="card"><h2>あるある</h2><ul class="aru">${t.aru.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>
    <div class="card"><h2>図鑑データ</h2><dl class="facts">
      <dt>キャラ</dt><dd>${esc(t.chara)}</dd>
      <dt>生息地</dt><dd>${esc(t.habitat)}</dd>
      <dt>口ぐせ</dt><dd>「${esc(t.kuchiguse)}」</dd>
    </dl></div>
    <div class="card"><h2>相性◎　${esc(best.label)}</h2>
      <p style="margin:0">${esc(t.bestWhy)}</p>
      <p style="margin:8px 0 0"><a href="#/t/${typeNo(t.best)}">${esc(best.chara)}を見る →</a></p>
    </div>`;
}

async function viewResult(index, sums, shareId) {
  const t = TYPES[index];
  const purity = purityOf(sums);
  const title = titleOf(purity);
  const pct = sums.map((s) => Math.round(50 + (Math.abs(s) / 6) * 50));
  const stats = await loadStats();
  const rarity = rarityOf(index, stats);
  render(`
    ${brand()}
    <section class="result">
      ${index === HIDDEN_INDEX ? `<div class="secret">隠しタイプを引き当てた！（出現率 理論値 ${(priorDistribution()[HIDDEN_INDEX] * 100).toFixed(1)}%）</div>` : ''}
      <p class="lead">あなたは…</p>
      <span class="no">${index === HIDDEN_INDEX ? '隠しタイプ' : `No.${typeNo(index)}`}</span>
      <div class="chara-wrap">${charaSVG(index, { size: 240 })}</div>
      <h1 class="label">${esc(t.label)}</h1>
      <span class="chip">${esc(title)}・ポンコツ純度${purity}%</span>
      <p class="praise">${esc(t.praise)}</p>
      <p class="roast"><span>${esc(t.roast)}</span></p>

      <div class="share">
        <button class="btn type" data-share="image">画像を保存してストーリーズへ</button>
        <div class="share-row">
          <button data-share="x">${ICONS.x}ポスト</button>
          <button data-share="line">${ICONS.line}LINE</button>
          <button data-share="link">${ICONS.link}コピー</button>
          <button data-share="native">${ICONS.more}送る</button>
        </div>
      </div>

      <div class="tiles">
        <div class="tile"><b>ポンコツ純度</b><strong>${purity}%</strong><small>${esc(title)}</small></div>
        <div class="tile"><b>レア度</b><strong>${rarity.pct.toFixed(1)}%</strong><small>${rarity.source === 'actual' ? '診断した人の中で' : '理論値'}</small></div>
        <a class="tile" href="#/t/${typeNo(t.best)}"><b>相性◎</b><strong class="small">${esc(TYPES[t.best].label)}</strong><small>${esc(TYPES[t.best].chara)}</small></a>
      </div>
    </section>
    <div class="card"><h2>4つの軸</h2>${axisBars(index, sums, pct)}</div>
    ${typeBody(index)}
    <div class="card"><h2>あそびかた</h2>
      <p style="margin:0">友達や推しを当てはめるなら何タイプ？ 図鑑から選んで「#${esc(SITE.hashtag)}」で送りつけよう。</p>
    </div>
    <button class="btn" data-go="#/q">もう一回診断する</button>
    <button class="btn sub" data-go="#/zukan">図鑑をみる（全${HIDDEN_INDEX}タイプ＋隠し）</button>
    ${foot()}`, index);

  app.querySelectorAll('[data-share]').forEach((b) =>
    b.addEventListener('click', () => share(b.dataset.share, { index, purity, title, rarity, shareId })),
  );
}

async function share(channel, ctx) {
  const url = shareUrl(ctx.index, ctx.shareId);
  const text = shareText(ctx.index, ctx.purity);
  track('share', channel);
  if (channel === 'x') {
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener');
  } else if (channel === 'line') {
    window.open(`https://line.me/R/share?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener');
  } else if (channel === 'link') {
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast('コピーしました');
    } catch {
      prompt('コピーしてね', url);
    }
  } else if (channel === 'native') {
    if (navigator.share) {
      navigator.share({ text, url }).catch(() => {});
    } else {
      share('link', ctx);
    }
  } else if (channel === 'image') {
    await shareImage(ctx, text, url);
  }
}

async function shareImage(ctx, text, url) {
  toast('画像をつくっています…');
  const canvas = await drawStoryCard(ctx);
  const blob = await canvasToBlob(canvas);
  const file = new File([blob], `ponkotsu-${typeNo(ctx.index)}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: `${text}\n${url}` });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const objectUrl = URL.createObjectURL(blob);
  modal.innerHTML = `<div class="sheet">
      <img src="${objectUrl}" alt="${esc(TYPES[ctx.index].label)}のシェア画像">
      <p class="hint">スマホは画像を長押しして保存 → ストーリーズやTikTokに投稿してね</p>
      <a class="btn" href="${objectUrl}" download="${file.name}">画像をダウンロード</a>
      <button class="btn sub" data-close>とじる</button>
    </div>`;
  modal.hidden = false;
  modal.onclick = (e) => {
    if (e.target === modal || e.target.closest('[data-close]')) {
      modal.hidden = true;
      URL.revokeObjectURL(objectUrl);
    }
  };
}

// ---------- タイプ詳細（シェアURLの着地点） ----------
function viewType(index) {
  const t = TYPES[index];
  const mine = store.get('mine', null);
  // 隠しタイプは自分で引き当てるか、シェアされた /t/00/ から来たときだけ見せる
  const locked = index === HIDDEN_INDEX && !store.get('hidden', false) && document.body.dataset.type !== '00';
  if (locked) {
    viewZukan();
    toast('隠しタイプは診断で引き当てると見られます');
    return;
  }
  render(`
    ${brand()}
    <section class="result">
      <span class="no">${index === HIDDEN_INDEX ? '隠しタイプ' : `No.${typeNo(index)}`}</span>
      <div class="chara-wrap">${charaSVG(index, { size: 240 })}</div>
      <h1 class="label">${esc(t.label)}</h1>
      <p class="praise">${esc(t.praise)}</p>
      <p class="roast"><span>${esc(t.roast)}</span></p>
      <button class="btn" data-go="#/q">${mine ? 'もう一回診断する' : 'あなたは何タイプ？診断する'}</button>
    </section>
    ${typeBody(index)}
    <button class="btn sub" data-go="#/zukan">図鑑をみる</button>
    ${foot()}`, index);
}

// ---------- 図鑑 ----------
function viewZukan() {
  const mine = store.get('mine', null);
  const gotHidden = store.get('hidden', false);
  const cards = TYPES.map((t, i) => {
    const locked = i === HIDDEN_INDEX && !gotHidden;
    const isMine = mine && mine.index === i;
    return `<a class="zcard ${isMine ? 'mine' : ''} ${locked ? 'locked' : ''}" href="${locked ? '#/zukan' : `#/t/${typeNo(i)}`}">
      ${isMine ? '<span class="me">あなた</span>' : ''}
      ${charaSVG(i, { size: 150 })}
      <div class="n">${i === HIDDEN_INDEX ? '隠しタイプ' : `No.${typeNo(i)}`}</div>
      <div class="l">${locked ? '？？？' : esc(t.label)}</div>
    </a>`;
  }).join('');
  render(`
    ${brand()}
    <section class="zukan">
      <h1>ポンコツ図鑑</h1>
      <p class="hint" style="margin:0">全${HIDDEN_INDEX}タイプ＋隠しタイプ1つ。友達や推しは何タイプ？</p>
      <div class="grid">${cards}</div>
    </section>
    <button class="btn" data-go="#/q" style="margin-top:20px">診断する</button>
    ${foot()}`);
}

function viewAbout() {
  render(`
    ${brand()}
    <div class="card"><h2>このサイトについて</h2>
      <p>${esc(SITE.quizName)}は、12問の答えから“愛すべきポンコツ”タイプを16種類（＋隠しタイプ）に分けるエンタメ診断です。心理学的な検査ではありません。</p>
      <p>回答や個人を特定する情報は保存しません。診断結果のタイプとシェアの回数だけを、個人と結びつかない形で集計しています（レア度の表示に使います）。</p>
      <p>結果画像のスクリーンショット・動画での紹介・配信での利用は自由です。</p>
    </div>
    ${foot()}`);
}

// ---------- ルーティング ----------
function route() {
  modal.hidden = true;
  const hash = location.hash || (document.body.dataset.type ? `#/t/${document.body.dataset.type}` : '#/');
  const [, view, a, b, c] = hash.split('/');
  if (view === 'q') {
    answers = [];
    track('start');
    viewQuestion();
  } else if (view === 'r' && TYPES[Number(a)]) {
    const sums = (b || '').split(',').map(Number);
    if (sums.length === AXES.length && sums.every(Number.isFinite)) {
      viewResult(Number(a), sums, c || 'x');
    } else {
      viewType(Number(a));
    }
  } else if (view === 't') {
    const index = a === '00' ? HIDDEN_INDEX : Number(a) - 1;
    if (TYPES[index]) viewType(index);
    else viewHome();
  } else if (view === 'zukan') {
    viewZukan();
  } else if (view === 'about') {
    viewAbout();
  } else {
    viewHome();
  }
}

app.addEventListener('click', (e) => {
  const opt = e.target.closest('[data-choice]');
  if (opt) {
    choose(Number(opt.dataset.choice), opt);
    return;
  }
  if (e.target.closest('[data-back]')) {
    answers.pop();
    viewQuestion();
    return;
  }
  const go = e.target.closest('[data-go]');
  if (go) {
    if (location.hash === go.dataset.go) route();
    else location.hash = go.dataset.go;
  }
});

window.addEventListener('hashchange', route);
if (new URLSearchParams(location.search).has('s')) track('ref', '1');
route();
