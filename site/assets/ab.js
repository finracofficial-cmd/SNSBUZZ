// A/Bテストの割り当てと計測。端末ごとに一度だけ決めて、ずっと同じものを見せる。
// 計測は端末ごとに各段階1回まで（同じ人が何度レポートを開いても、表示は1回と数える）。
import { EXPERIMENTS, metricsOf } from './experiments.js';
import { store, track } from './ui.js';

export function variant(name) {
  const list = EXPERIMENTS[name];
  let v = store.get(`ab:${name}`, null);
  if (!list.includes(v)) {
    v = list[Math.floor(Math.random() * list.length)];
    store.set(`ab:${name}`, v);
  }
  return v;
}

// 段階は、その段階を見る実験にだけ送る。送った印は実験ごと（あとから足した実験も、正しく1回目を数える）
export function abTrack(step) {
  Object.keys(EXPERIMENTS)
    .filter((name) => metricsOf(name).includes(step) && !store.get(`ab:sent:${name}:${step}`, false))
    .forEach((name) => {
      store.set(`ab:sent:${name}:${step}`, true);
      track('ab', `${name}:${variant(name)}:${step}`);
    });
}

// calc（結果の直前の「計算中」）の効き目：結果を見たあとのシェア・「わかる〜！」・くわしい診断の開始を数える
if (typeof window !== 'undefined') {
  window.addEventListener('pz:track', (e) => {
    const { k, v } = e.detail || {};
    if (!store.get('ab:sent:calc:result', false)) return;
    if (k === 'share') abTrack('share');
    else if (k === 'agree' && v === 'yes') abTrack('agree');
    else if (k === 'detail' && v === 'start') abTrack('detail');
  });
}

// 決済に渡す目印（支払い完了をサーバーで数えるときに使う）
export const abTag = () => Object.keys(EXPERIMENTS).map((name) => `${name}:${variant(name)}`).join(',');

// おうちの人へのお願いリンクに入れる短い形（実験の順に、案の番号を1文字ずつ。例 "010"）。
// おうちの人の端末で決済するときに、子どもの端末の案として数えるために使う
export const abCode = () => Object.keys(EXPERIMENTS).map((name) => EXPERIMENTS[name].indexOf(variant(name))).join('');
export function abTagOfCode(code) {
  const names = Object.keys(EXPERIMENTS);
  if (!/^\d+$/.test(code || '') || code.length !== names.length) return '';
  return names
    .map((name, k) => EXPERIMENTS[name][Number(code[k])])
    .every(Boolean)
    ? names.map((name, k) => `${name}:${EXPERIMENTS[name][Number(code[k])]}`).join(',')
    : '';
}
