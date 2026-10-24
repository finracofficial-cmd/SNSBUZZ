// モザイク（完全版で読める文章の、ぼかした見本）。本物の有料文は使わず、タイプの無料の文章をかき混ぜたダミー文字を作る。
import { TYPES } from './data.js';

function dummy(index, seed, length) {
  const t = TYPES[index];
  const pool = Array.from(`${t.summary}${t.aru.join('')}${t.charm.join('')}`.replace(/[「」（）、。！？\s]/g, ''));
  let x = (seed * 2654435761 + index * 97) >>> 0;
  let out = '';
  for (let i = 0; i < length; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    out += i % 23 === 22 || i === length - 1 ? '。' : pool[x % pool.length];
  }
  return out;
}

// length は購入後に表示される文章の文字数（types.js の premiumLen など）。長さを本物とそろえ、「約〇字」と量を見せる。
// lines を渡すと箇条書き（各項目の文字数の配列）。
export const approx = (n) => (n >= 100 ? Math.round(n / 10) * 10 : n);
export const mosaic = (index, seed, length, lines = null) => {
  const total = lines ? lines.reduce((a, b) => a + b, 0) : length;
  return `
  <div class="mosaic" data-paywall role="button" tabindex="0">
    <div aria-hidden="true">${lines
      ? `<ul>${lines.map((n, k) => `<li>${dummy(index, seed + k, n)}</li>`).join('')}</ul>`
      : `<p>${dummy(index, seed, length)}</p>`}</div>
    <span class="lock">完全版で読めます<small>約${approx(total)}字</small></span>
  </div>`;
};

