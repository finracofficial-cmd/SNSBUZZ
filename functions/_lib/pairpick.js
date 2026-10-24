// ふたりの相性・完全版の組み立て。タイプ番号（0〜15。隠しタイプは、ふだんの軸の番号）から、4つの軸のそれぞれで
// 「ふたりとも1側（both1）」「ふたりとも0側（both0）」「ちがう（diff）」を決めて、その状態の文を選ぶ。
// P に本文（premium.js の PAIR）を渡すと文を、文字数（types.js の PAIR_LEN）を渡すと文字数を返す。
// site/assets/pairpick.js と同じ内容にする（テストで確かめている）
export const PAIR_RANKS = ['分身', '最強の相方', '名コンビ', 'いい感じ', '刺激しあう仲'];
const bits = (i) => [3, 2, 1, 0].map((s) => (i >> s) & 1);

export function pickPair(P, a, b, rank) {
  const A = bits(a);
  const B = bits(b);
  const states = A.map((x, k) => (x === B[k] ? (x ? 'both1' : 'both0') : 'diff'));
  // diff のとき、1側（全力・人たらし・ノリ派・秒で忘れる）が a か b か
  const posOf = (k) => (states[k] === 'diff' ? (A[k] ? 'a' : 'b') : null);
  return {
    axes: states.map((st, k) => ({ k, state: st, pos: posOf(k), text: P.axes[k][st] })),
    clash: states.flatMap((st, k) => (st === 'diff' ? [{ k, pos: posOf(k), scene: P.clash[k].scene, fix: P.clash[k].fix }] : [])),
    traps: states.flatMap((st, k) => (st === 'diff' ? [] : [{ k, text: P.clash[k][st === 'both1' ? 'trap1' : 'trap0'] }])),
    play: states.map((st, k) => ({ k, pos: posOf(k), text: P.play[k][st] })),
    message: P.message[PAIR_RANKS.includes(rank) ? rank : 'いい感じ'],
  };
}
