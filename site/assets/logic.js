// 判定ロジック。DOMに依存しないので Node のテストからもそのまま読み込める。
import { AXES, QUESTIONS, HIDDEN_INDEX } from './data.js';

const AXIS_MAX = 6; // 1軸3問 × 最大2点

// answers[i] = QUESTIONS[i] で選んだ選択肢の番号
export function judge(answers) {
  if (answers.length !== QUESTIONS.length) throw new Error('answers length mismatch');
  const sums = AXES.map(() => 0);
  const strongest = AXES.map(() => 0);
  let hiddenHits = 0;
  answers.forEach((choice, i) => {
    const q = QUESTIONS[i];
    const opt = q.options[choice];
    if (!opt) throw new Error(`invalid choice ${choice} for question ${i}`);
    sums[q.axis] += opt.v;
    if (Math.abs(opt.v) === 2) strongest[q.axis] = opt.v;
    if (opt.h) hiddenHits++;
  });
  // 合計0のときは、その軸でいちばん強く答えた側に倒す（0になるのは±2が1つ＋∓1が2つの組だけ）
  const bits = sums.map((s, a) => (s > 0 || (s === 0 && strongest[a] > 0) ? 1 : 0));
  const base = bits[0] * 8 + bits[1] * 4 + bits[2] * 2 + bits[3];
  const hidden = hiddenHits === HIDDEN_OPTION_COUNT;
  return {
    index: hidden ? HIDDEN_INDEX : base,
    baseIndex: base,
    hidden,
    sums,
    purity: purityOf(sums),
    axisPct: sums.map((s) => Math.round(50 + (Math.abs(s) / AXIS_MAX) * 50)),
  };
}

export const HIDDEN_OPTION_COUNT = QUESTIONS.reduce(
  (n, q) => n + q.options.filter((o) => o.h).length,
  0,
);

// 「ポンコツ純度」：4軸の振れ幅の平均を 50〜99% にのせる
export function purityOf(sums) {
  const mean = sums.reduce((a, s) => a + Math.abs(s) / AXIS_MAX, 0) / sums.length;
  return Math.round(50 + 49 * mean);
}

export function titleOf(purity) {
  if (purity >= 90) return '殿堂入り';
  if (purity >= 80) return 'ガチ勢';
  if (purity >= 65) return '正統派';
  return 'ゆるめ';
}

// 全員がランダムに答えた場合の各タイプの出現率（理論値）。
// 実データが少ないうちのレア度表示と、データとの比較に使う。
// 軸ごとに「向き × 隠し選択肢を何個選んだか」の分布を出し、4軸を畳み込む。
export function priorDistribution() {
  let states = new Map([['0|0', 1]]); // `${タイプ番号の途中値}|${隠しヒット数}` → 確率
  AXES.forEach((_, axis) => {
    const qs = QUESTIONS.filter((q) => q.axis === axis);
    const local = new Map(); // `${bit}|${hits}` → 確率
    const walk = (k, sum, strongest, hits, p) => {
      if (k === qs.length) {
        const bit = sum > 0 || (sum === 0 && strongest > 0) ? 1 : 0;
        const key = `${bit}|${hits}`;
        local.set(key, (local.get(key) || 0) + p);
        return;
      }
      const opts = qs[k].options;
      opts.forEach((o) => {
        walk(k + 1, sum + o.v, Math.abs(o.v) === 2 ? o.v : strongest, hits + (o.h ? 1 : 0), p / opts.length);
      });
    };
    walk(0, 0, 0, 0, 1);
    const next = new Map();
    states.forEach((p, sKey) => {
      const [code, hits] = sKey.split('|').map(Number);
      local.forEach((lp, lKey) => {
        const [bit, lh] = lKey.split('|').map(Number);
        const key = `${code * 2 + bit}|${hits + lh}`;
        next.set(key, (next.get(key) || 0) + p * lp);
      });
    });
    states = next;
  });
  const dist = new Array(HIDDEN_INDEX + 1).fill(0);
  states.forEach((p, key) => {
    const [code, hits] = key.split('|').map(Number);
    dist[hits === HIDDEN_OPTION_COUNT ? HIDDEN_INDEX : code] += p;
  });
  return dist;
}

// 表示用のレア度（%）。集計が十分あれば実データ、なければ理論値。
export const MIN_SAMPLES = 200;
export function rarityOf(index, stats) {
  if (stats && stats.total >= MIN_SAMPLES) {
    const n = stats.counts[index] || 0;
    return { pct: (n / stats.total) * 100, source: 'actual' };
  }
  return { pct: priorDistribution()[index] * 100, source: 'prior' };
}
