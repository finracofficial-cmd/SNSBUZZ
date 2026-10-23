// 「続きリンク」：無料のデータ（自分の結果・図鑑のシール・引き当てた隠しタイプ）を、別のブラウザへ移す。
// LINE のアプリ内ブラウザと Safari では保存場所が別なので、LINE の Keep メモにリンクを送っておけば、どちらでも続きから遊べる。
// 名前や完全版の購入情報は入れない（完全版は引き継ぎリンクで移す）。
import { TYPES, HIDDEN } from './data.js';
import { decodeResult } from './logic.js';

const b64url = (text) => btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

// 書き出す：{ q: かんたん診断のコード, d: くわしい診断のコード, m: 出会ったタイプ（20ビット）, h: 引き当てた隠しタイプ }
export function exportPayload({ mineQuick, mineDetail, met, gotHidden }) {
  const mask = [...met].reduce((acc, i) => (Number.isInteger(i) && i >= 0 && i < TYPES.length ? acc | (1 << i) : acc), 0);
  const data = { q: mineQuick?.code || '', d: mineDetail?.code || '', m: mask, h: gotHidden.filter((i) => HIDDEN.some((x) => x.index === i)) };
  return b64url(JSON.stringify(data));
}

// 読みこむ：形がおかしいものは捨てる。返り値は使える値だけ
export function importPayload(payload) {
  let data;
  try {
    data = JSON.parse(unb64url(String(payload || '')));
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const quick = decodeResult(data.q);
  const detail = decodeResult(data.d);
  const met = [];
  for (let i = 0; i < TYPES.length; i++) if (Number(data.m) & (1 << i)) met.push(i);
  const hidden = Array.isArray(data.h) ? data.h.filter((i) => HIDDEN.some((x) => x.index === i)) : [];
  return {
    quick: quick && quick.mode === 'quick' ? { code: data.q, index: quick.index } : null,
    detail: detail && detail.mode === 'detail' ? { code: data.d, index: detail.index } : null,
    met,
    hidden,
  };
}
