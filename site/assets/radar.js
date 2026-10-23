// ステータスのレーダーチャート（SVG）。くわしい診断の10項目を1枚で見せる。
// masked のときは形だけ見せて、数値は出さない（課金前の「ふんわり」表示）。
import { AXES, PARAMS, AXIS_MAX } from './data.js';

const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// パラメータの短い名前
export const PARAM_LABELS = ['恋愛積極', 'ヤキモチ', 'さみしがり', '妄想', '推し活', 'ツッコミ'];

// 4軸は、その人が寄っている側の名前（省エネ寄りの人に「全力 D」と出さないため）
export const statLabels = (r) => [...AXES.map((a, k) => (r.sums[k] >= 0 ? a.pos : a.neg)), ...PARAM_LABELS];

// 4軸は「寄っている側に何%か」（50〜100）、パラメータはそのままの%
export function statValues(r) {
  const axis = r.sums.map((s) => Math.round(50 + (Math.abs(s) / AXIS_MAX) * 50));
  return [...axis, ...(r.params || PARAMS.map(() => 50))];
}

export function radarSVG(values, { labels, masked = false, size = 300, color = '#6C7FD8' } = {}) {
  const n = values.length;
  const c = size / 2;
  const R = size * 0.3;
  const pt = (k, v) => {
    const a = -Math.PI / 2 + (k / n) * Math.PI * 2;
    return [c + Math.cos(a) * R * v, c + Math.sin(a) * R * v];
  };
  const ring = (f) => Array.from({ length: n }, (_, k) => pt(k, f).map((x) => x.toFixed(1)).join(',')).join(' ');
  const poly = values.map((v, k) => pt(k, Math.max(v, 4) / 100).map((x) => x.toFixed(1)).join(',')).join(' ');
  const texts = labels.map((l, k) => {
    const [x, y] = pt(k, 1.22);
    const anchor = Math.abs(x - c) < 4 ? 'middle' : x > c ? 'start' : 'end';
    const shown = k < AXES.length || !masked ? `${values[k]}` : '??';
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" class="rl">${esc(l)}</text>
      <text x="${x.toFixed(1)}" y="${(y + 13).toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" class="rv ${k >= AXES.length && masked ? 'masked' : ''}">${shown}</text>`;
  }).join('');
  return `<svg class="radar" viewBox="0 0 ${size} ${size}" role="img" aria-label="ステータスのレーダーチャート">
    ${[0.25, 0.5, 0.75, 1].map((f) => `<polygon points="${ring(f)}" class="grid"/>`).join('')}
    ${Array.from({ length: n }, (_, k) => `<line x1="${c}" y1="${c}" x2="${pt(k, 1)[0].toFixed(1)}" y2="${pt(k, 1)[1].toFixed(1)}" class="spoke"/>`).join('')}
    <polygon points="${poly}" fill="${color}" fill-opacity=".28" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>
    ${texts}
  </svg>`;
}
