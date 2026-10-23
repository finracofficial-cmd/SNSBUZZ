// 判定・相性・レア度のロジック。DOMに依存しないので Node のテストからもそのまま読み込める。
import { AXES, QUESTIONS, HIDDEN, BASE_COUNT, BALANCED_MAX_TOTAL, AXIS_MAX, TYPES } from './data.js';

const TAGS = [...new Set(QUESTIONS.flatMap((q) => q.options.map((o) => o.tag).filter(Boolean)))];
export const TAG_COUNTS = Object.fromEntries(
  TAGS.map((tag) => [tag, QUESTIONS.filter((q) => q.options.some((o) => o.tag === tag)).length]),
);

const bitsOf = (sums) => sums.map((s) => (s > 0 ? 1 : 0));
export const baseIndexOf = (sums) => bitsOf(sums).reduce((n, b) => n * 2 + b, 0);
export const bitsOfIndex = (index) => [3, 2, 1, 0].map((s) => (index >> s) & 1);

function hiddenOf(sums, hits) {
  for (const h of HIDDEN) {
    if (h.kind === 'balanced' && sums.reduce((a, s) => a + Math.abs(s), 0) <= BALANCED_MAX_TOTAL) return h.index;
    if (h.kind === 'tag' && hits[h.tag] === TAG_COUNTS[h.tag]) return h.index;
  }
  return null;
}

// answers[i] = QUESTIONS[i] で選んだ選択肢の番号
export function judge(answers) {
  if (answers.length !== QUESTIONS.length) throw new Error('answers length mismatch');
  const sums = AXES.map(() => 0);
  const hits = Object.fromEntries(TAGS.map((t) => [t, 0]));
  answers.forEach((choice, i) => {
    const opt = QUESTIONS[i].options[choice];
    if (!opt) throw new Error(`invalid choice ${choice} for question ${i}`);
    sums[QUESTIONS[i].axis] += opt.v;
    if (opt.tag) hits[opt.tag]++;
  });
  return resultFromSums(sums, hiddenOf(sums, hits));
}

// URLなどに保存した sums から結果を組み立て直す（隠しタイプは index で渡す）
export function resultFromSums(sums, hiddenIndex = null) {
  const baseIndex = baseIndexOf(sums);
  return {
    index: hiddenIndex ?? baseIndex,
    baseIndex,
    hidden: hiddenIndex != null,
    sums,
    purity: purityOf(sums),
    axisPct: sums.map(axisPctOf),
    ura: uraOf(sums),
  };
}

export const axisPctOf = (s) => Math.round(50 + (Math.abs(s) / AXIS_MAX) * 50);

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

// 裏タイプ：いちばん振れ幅の小さい軸をひっくり返したタイプ（同点なら後ろの軸）
export function uraOf(sums) {
  let weakest = 0;
  sums.forEach((s, k) => {
    if (Math.abs(s) <= Math.abs(sums[weakest])) weakest = k;
  });
  return { index: baseIndexOf(sums) ^ (1 << (3 - weakest)), axis: weakest };
}

// ---------- 軸ごとの一言（振れ幅で3段階） ----------
const AXIS_LINES = [
  {
    neg: ['気分しだいで省エネに切りかわる', 'エネルギーは大事な場面のためにためておく', '動かないことにかけてはプロ級'],
    pos: ['やる気が出ると止まらない', '気づけば誰より動いている', '全力以外のスイッチがない'],
  },
  {
    neg: ['ひとりの時間も、人といる時間もほどほどに', 'ひとりの時間で充電するタイプ', '自分の世界がいちばん落ち着く'],
    pos: ['人といると少し元気になる', '人の輪の中で輝くタイプ', '人見知りという機能がついていない'],
  },
  {
    neg: ['ゆるく予定を立てておく派', '段取りを組むと安心する', '人生をしおり化している'],
    pos: ['だいたいでなんとかする派', 'その場のノリで道を決める', '計画という言葉を知らない'],
  },
  {
    neg: ['ときどき考えごとをする', '頭の中で反省会がよく開かれる', '脳内会議が24時間営業'],
    pos: ['わりと切りかえが早い', '寝たらだいたいリセット', '嫌なことの記憶が3秒で消える'],
  },
];

export function axisLine(axis, sum) {
  const level = Math.abs(sum) >= 11 ? 2 : Math.abs(sum) >= 5 ? 1 : 0;
  return AXIS_LINES[axis][sum > 0 ? 'pos' : 'neg'][level];
}

// ---------- 相性 ----------
// 軸ごとの組み合わせで点を足す。「省エネ/全力」「ひとり/人たらし」はちがうほど補い合い、
// 「計画/ノリ」はそろうほどペースが合う。最高点はタイプ番号の上2ビットを反転した相手になる。
const COMPAT = [
  { diff: [14, '省エネと全力で、ちょうどいい役割分担ができる'], both0: [10, 'だらだら過ごす時間が最高に心地いい'], both1: [6, 'ノリは合うけど、ふたりそろって燃え尽きがち'] },
  { diff: [12, 'ひとり好きを人たらしが外の世界に連れ出してくれる'], both0: [10, '沈黙が気まずくない、静かな安心感'], both1: [8, 'ふたりで場を回せる最強の盛り上げ役'] },
  { diff: [2, '計画派とノリ派で、予定の立て方がぶつかりがち'], both0: [14, '予定の立て方がそっくりで、段取りがスムーズ'], both1: [14, '思いつきで動けるフットワークの軽さが同じ'] },
  { diff: [8, '考えすぎる方を、秒で忘れる方が笑い飛ばしてくれる'], both0: [9, '気持ちをわかり合えるけど、ふたりで沼りがち'], both1: [12, 'ケンカしても次の日にはふたりとも忘れてる'] },
];
const RAW_MIN = 30 + 6 + 8 + 2 + 8;
const RAW_MAX = 30 + 14 + 12 + 14 + 12;

export function compat(aIndex, bIndex) {
  const a = bitsOfIndex(aIndex);
  const b = bitsOfIndex(bIndex);
  const parts = COMPAT.map((c, k) => (a[k] !== b[k] ? c.diff : a[k] ? c.both1 : c.both0));
  const raw = 30 + parts.reduce((s, [p]) => s + p, 0);
  const score = Math.round(52 + ((raw - RAW_MIN) / (RAW_MAX - RAW_MIN)) * 47);
  const sorted = [...parts].sort((x, y) => y[0] - x[0]);
  return {
    score,
    rank: aIndex === bIndex ? '分身' : score >= 90 ? '運命の相方' : score >= 80 ? '名コンビ' : score >= 68 ? 'いい感じ' : '刺激しあう仲',
    good: sorted[0][1],
    care: sorted[sorted.length - 1][0] <= 6 ? sorted[sorted.length - 1][1] : null,
  };
}

// 隠しタイプ同士の相性は、ふだんの軸（baseIndex）で計算する
export const compatOf = (a, b) => compat(a.baseIndex ?? a.index, b.baseIndex ?? b.index);

export function compatRanking(baseIndex) {
  return Array.from({ length: BASE_COUNT }, (_, i) => ({ index: i, ...compat(baseIndex, i) })).sort(
    (x, y) => y.score - x.score || x.index - y.index,
  );
}

// ---------- レア度 ----------
// 全員がランダムに答えた場合の各タイプの出現率（理論値）。軸ごとに
// 「向き・振れ幅・タグの選択数」の分布を出し、4軸を畳み込んでから隠しタイプを判定する。
let priorCache;
export function priorDistribution() {
  if (priorCache) return priorCache;
  const tagKey = (h) => TAGS.map((t) => h[t]).join(',');
  let states = new Map([[`0|0|${TAGS.map(() => 0).join(',')}`, 1]]); // code|Σ|s||tagHits
  AXES.forEach((_, axis) => {
    const qs = QUESTIONS.filter((q) => q.axis === axis);
    const local = new Map();
    const walk = (k, sum, hits, p) => {
      if (k === qs.length) {
        const key = `${sum}|${tagKey(hits)}`;
        local.set(key, (local.get(key) || 0) + p);
        return;
      }
      qs[k].options.forEach((o) => {
        const h = o.tag ? { ...hits, [o.tag]: hits[o.tag] + 1 } : hits;
        walk(k + 1, sum + o.v, h, p / qs[k].options.length);
      });
    };
    walk(0, 0, Object.fromEntries(TAGS.map((t) => [t, 0])), 1);
    const next = new Map();
    states.forEach((p, sKey) => {
      const [code, abs, h] = sKey.split('|');
      const hs = h.split(',').map(Number);
      local.forEach((lp, lKey) => {
        const [sum, lh] = lKey.split('|');
        const merged = lh.split(',').map((x, i) => Number(x) + hs[i]).join(',');
        const key = `${Number(code) * 2 + (Number(sum) > 0 ? 1 : 0)}|${Number(abs) + Math.abs(Number(sum))}|${merged}`;
        next.set(key, (next.get(key) || 0) + p * lp);
      });
    });
    states = next;
  });
  const dist = new Array(TYPES.length).fill(0);
  states.forEach((p, key) => {
    const [code, abs, h] = key.split('|');
    const hits = Object.fromEntries(h.split(',').map((x, i) => [TAGS[i], Number(x)]));
    let index = Number(code);
    for (const hd of HIDDEN) {
      if (hd.kind === 'balanced' && Number(abs) <= BALANCED_MAX_TOTAL) {
        index = hd.index;
        break;
      }
      if (hd.kind === 'tag' && hits[hd.tag] === TAG_COUNTS[hd.tag]) {
        index = hd.index;
        break;
      }
    }
    dist[index] += p;
  });
  priorCache = dist;
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

// ---------- URLに載せる結果の短い表現 ----------
// 「タイプ番号.4軸の合計」を base36 で詰める。例: 6.-3_5_-7_1 → "6~-3_5_-7_1"
export function encodeResult({ index, sums }) {
  return `${index.toString(36)}~${sums.join('_')}`;
}

export function decodeResult(code) {
  const m = /^([0-9a-j])~(-?\d{1,2})_(-?\d{1,2})_(-?\d{1,2})_(-?\d{1,2})$/.exec(String(code || ''));
  if (!m) return null;
  const index = parseInt(m[1], 36);
  const sums = m.slice(2).map(Number);
  if (index >= TYPES.length || sums.some((s) => Math.abs(s) > AXIS_MAX || s % 2 === 0)) return null;
  const r = resultFromSums(sums, index >= BASE_COUNT ? index : null);
  return r.index === index ? r : null;
}
