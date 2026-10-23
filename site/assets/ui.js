// 画面まわりの共通部品（描画・保存・計測・API・トースト・モーダル）
import { SITE } from './config.js';
import { TYPES } from './data.js';
import { shade, tint } from './chara.js';

export const app = document.getElementById('app');
const modalEl = document.getElementById('modal');
const toastEl = document.getElementById('toast');

// 本番ドメインが未設定のあいだは、いま開いているサイトのURLでシェアする
export const ORIGIN = SITE.origin.includes('example.com') ? location.origin : SITE.origin.replace(/\/$/, '');

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ニックネームなど人が入力する短い文字列。制御文字を落として長さをそろえる
export const cleanName = (s, max = 10) =>
  Array.from(String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim())
    .slice(0, max)
    .join('');

export const store = {
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
      if (value === null) localStorage.removeItem(`pz:${key}`);
      else localStorage.setItem(`pz:${key}`, JSON.stringify(value));
    } catch {
      // プライベートモードなど。保存できなくても画面は動く
    }
  },
};

export function track(k, v = '') {
  try {
    const body = new Blob([JSON.stringify({ k, v: String(v) })], { type: 'application/json' });
    navigator.sendBeacon?.('/api/event', body);
  } catch {
    // 計測はベストエフォート
  }
}

// APIが無い環境（静的プレビューなど）では null を返す
export async function api(path, { method = 'GET', body, token, timeout = 4000 } = {}) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    const res = await fetch(`/api/${path}`, {
      method,
      signal: ctrl.signal,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    clearTimeout(timer);
    const type = res.headers.get('content-type') || '';
    if (!type.includes('application/json')) return null;
    const data = await res.json();
    return res.ok ? data : { error: data.error || 'error', status: res.status };
  } catch {
    return null;
  }
}

// 失敗したときは30秒だけ覚えておき、そのあと呼ばれたら取り直す
let statsPromise;
export const loadStats = () =>
  (statsPromise ??= api('stats', { timeout: 1500 }).then((s) => {
    if (!s || s.error) setTimeout(() => (statsPromise = null), 30000);
    return s;
  }));

// 画面の世代。route() のたびに進めて、読みこみを待っているあいだに別の画面へ移ったら、古い画面は描かない
let navGen = 0;
export const navBegin = () => ++navGen;
export const navNow = () => navGen;

// URLの一部を読む。壊れた %xx が入っていても止まらない
export const safeDecode = (s) => {
  try {
    return decodeURIComponent(s || '');
  } catch {
    return '';
  }
};

// 画像づくりなど時間のかかるボタン：連打を防ぎ、失敗したら知らせる
export async function busy(button, fn) {
  if (button?.disabled) return;
  if (button) button.disabled = true;
  try {
    await fn();
  } catch {
    toast('うまくいきませんでした。もう一度ためしてね');
  } finally {
    if (button) button.disabled = false;
  }
}

export function setTheme(index) {
  const root = document.documentElement.style;
  if (index == null) {
    ['--type', '--type-deep', '--type-btn', '--type-text', '--type-soft'].forEach((k) => root.removeProperty(k));
    return;
  }
  const c = TYPES[index].color;
  root.setProperty('--type', c);
  root.setProperty('--type-deep', shade(c, 0.32));
  // ボタンの白文字が読めるよう、ボタンだけは少し濃くする（コントラスト3:1以上）
  root.setProperty('--type-btn', shade(c, 0.42));
  // 白い背景の上の色文字・チップ（コントラスト4.5:1以上）
  root.setProperty('--type-text', shade(c, 0.5));
  root.setProperty('--type-soft', tint(c, 0.75));
}

export function render(html, index = null) {
  setTheme(index);
  closeModal();
  document.body.classList.remove('has-paybar');
  app.innerHTML = `<div class="view">${html}</div>`;
  window.scrollTo(0, 0);
}

export function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (toastEl.hidden = true), 2400);
}

export function openModal(html, onClose) {
  modalEl.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  modalEl.hidden = false;
  modalEl.onclick = (e) => {
    if (e.target === modalEl || e.target.closest('[data-close]')) closeModal();
  };
  closeModal.cb = onClose;
  return modalEl.querySelector('.sheet');
}

export function closeModal() {
  if (modalEl.hidden) return;
  modalEl.hidden = true;
  modalEl.innerHTML = '';
  closeModal.cb?.();
  closeModal.cb = null;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('コピーしました');
  } catch {
    openModal(`<p class="hint">長押ししてコピーしてね</p><textarea class="copybox" readonly>${esc(text)}</textarea>
      <button class="btn sub" data-close>とじる</button>`).querySelector('textarea').select();
  }
}

export const foot = () => `
  <p class="foot">${esc(SITE.disclaimer)}<br>
    <a href="#/">トップ</a><a href="#/zukan">図鑑</a><a href="#/about">このサイトについて</a><a href="#/legal">特定商取引法に基づく表記</a>
  </p>`;

export const brand = () => `<div class="brand"><a href="#/">${esc(SITE.name)}</a><a href="#/zukan">図鑑をみる →</a></div>`;

export const ICONS = {
  lock: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 10V7a5 5 0 0 1 10 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1Zm2 0h6V7a3 3 0 0 0-6 0v3Z"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.8 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L2 3h6.4l4.4 5.9L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z"/></svg>',
  line: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#06C755" d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.6 1.1-.5 6-3.6 8.2-6.1C21.6 14.1 22 12.6 22 11c0-4.4-4.5-8-10-8Z"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
};

// X・LINE・コピー・OSの共有。どれも text と url を渡すだけ
export function shareLinks({ text, url, channelPrefix = '' }) {
  return {
    html: `<div class="share-row">
      <a class="share-btn" data-ch="${channelPrefix}x" href="https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}" target="_blank" rel="noopener">${ICONS.x}ポスト</a>
      <a class="share-btn" data-ch="${channelPrefix}line" href="https://line.me/R/share?text=${encodeURIComponent(`${text}\n${url}`)}" target="_blank" rel="noopener">${ICONS.line}LINE</a>
      <button class="share-btn" data-ch="${channelPrefix}link" data-copy="${esc(`${text}\n${url}`)}">${ICONS.link}コピー</button>
      <button class="share-btn" data-ch="${channelPrefix}native" data-native-text="${esc(text)}" data-native-url="${esc(url)}">${ICONS.more}送る</button>
    </div>`,
  };
}

// shareLinks で作ったボタンの共通ハンドラ（app.js から委譲で呼ぶ）
export function handleShareClick(el) {
  const ch = el.dataset.ch;
  if (ch) track('share', ch.replace(/^.*:/, ''));
  if (el.dataset.copy) {
    copyText(el.dataset.copy);
    return true;
  }
  if (el.dataset.nativeUrl) {
    const data = { text: el.dataset.nativeText, url: el.dataset.nativeUrl };
    if (navigator.share) navigator.share(data).catch(() => {});
    else copyText(`${data.text}\n${data.url}`);
    return true;
  }
  return false;
}

// Instagram・TikTok・LINEなどのアプリ内ブラウザ（画像の保存や共有シートが使えないことが多い）
export const inAppBrowser = () => /Instagram|FBAN|FBAV|Line\/|TikTok|BytedanceWebview|musical_ly/i.test(navigator.userAgent);
export const inAppHint = () =>
  inAppBrowser() ? '<p class="hint inapp">画像がうまく保存できないときは、右上の「…」から「ブラウザで開く」を選んでね</p>' : '';

// Instagram ストーリーの「Add Yours」でお題を作ると、見た人が同じお題で投稿をつなげてくれる
const ADD_YOURS = `<p class="hint">Instagram のストーリーなら「Add Yours」スタンプでお題「#わたしのポンコツ」を作ると、友達も結果をつなげて投稿できるよ</p>`;

// 複数の画像をまとめて共有シートへ（TikTok のフォトモード・Instagram のカルーセル用）。
// 共有できない端末では、1枚ずつ長押しで保存できるように並べて表示する
export async function shareImageSet(blobs, { name, text, alt }) {
  if (blobs.some((b) => !b)) {
    toast('画像を作れませんでした。もう一度ためしてね');
    return;
  }
  const files = blobs.map((b, i) => new File([b], `${name}-${i + 1}.png`, { type: 'image/png' }));
  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, text });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const urls = blobs.map((b) => URL.createObjectURL(b));
  openModal(
    `<h2 class="sheet-title">${blobs.length}枚の画像</h2>
     <p class="hint">1枚ずつ長押しして保存 → TikTok のフォトモードや Instagram の投稿で、順番どおりに選んでね</p>
     ${ADD_YOURS}
     <div class="image-set">${urls.map((u, i) => `<img src="${u}" alt="${esc(alt)}（${i + 1}/${blobs.length}）">`).join('')}</div>${inAppHint()}
     <button class="btn sub" data-close>とじる</button>`,
    () => urls.forEach((u) => URL.revokeObjectURL(u)),
  );
}

// 画像を共有シートへ。だめなら長押し保存用に表示する
// クリップボードに黙ってコピーする（トーストを出さない）。押した直後に呼ぶ（時間がたつと許可されない）
export async function copySilently(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ストーリーに貼る「リンク」スタンプの案内（結果のリンクは、画像をつくる前にコピーしておく）
const LINK_STICKER = '<p class="hint">結果のリンクはコピー済み。ストーリーで「スタンプ」→「リンク」→ 貼りつけ、で見た人が診断に来られるよ（鍵アカでもOK）</p>';

export async function shareImageBlob(blob, { name, text, alt, linkCopied = false }) {
  if (!blob) {
    toast('画像を作れませんでした。もう一度ためしてね');
    return;
  }
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      if (linkCopied) toast('リンクはコピー済み。ストーリーの「リンク」スタンプに貼りつけてね');
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const objectUrl = URL.createObjectURL(blob);
  openModal(
    `<img src="${objectUrl}" alt="${esc(alt)}">
     <p class="hint">画像を長押しして保存 → ストーリーや動画で投稿してね</p>${linkCopied ? LINK_STICKER : ''}${ADD_YOURS}${inAppHint()}
     <button class="btn sub" data-close>とじる</button>`,
    () => URL.revokeObjectURL(objectUrl),
  );
}
