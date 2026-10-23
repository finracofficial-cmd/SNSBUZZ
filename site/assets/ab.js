// A/Bテストの割り当てと計測。端末ごとに一度だけ決めて、ずっと同じものを見せる。
// 計測は端末ごとに各段階1回まで（同じ人が何度レポートを開いても、表示は1回と数える）。
import { EXPERIMENTS } from './experiments.js';
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

export function abTrack(step) {
  if (store.get(`ab:sent:${step}`, false)) return;
  store.set(`ab:sent:${step}`, true);
  Object.keys(EXPERIMENTS).forEach((name) => track('ab', `${name}:${variant(name)}:${step}`));
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
