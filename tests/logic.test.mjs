import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPES, QUESTIONS, AXES, HIDDEN, BASE_COUNT, AXIS_MAX, typeNo, indexFromNo } from '../site/assets/data.js';
import {
  judge,
  priorDistribution,
  purityOf,
  rarityOf,
  compat,
  compatRanking,
  uraOf,
  encodeResult,
  decodeResult,
  axisLine,
  TAG_COUNTS,
} from '../site/assets/logic.js';

// 軸ごとに「この値の選択肢を選ぶ」を指定して回答を作る
const answersFor = (pickByAxis, override = {}) =>
  QUESTIONS.map((q, i) => {
    if (override[i] !== undefined) return override[i];
    return q.options.findIndex((o) => o.v === pickByAxis[q.axis] && !o.tag) === -1
      ? q.options.findIndex((o) => o.v === pickByAxis[q.axis])
      : q.options.findIndex((o) => o.v === pickByAxis[q.axis] && !o.tag);
  });

test('データの形がそろっている', () => {
  assert.equal(TYPES.length, 20);
  assert.equal(QUESTIONS.length, 20);
  AXES.forEach((_, a) => assert.equal(QUESTIONS.filter((q) => q.axis === a).length, 5));
  QUESTIONS.forEach((q) => {
    assert.equal(q.options.length, 4);
    assert.deepEqual(q.options.map((o) => o.v).sort((x, y) => x - y), [-3, -1, 1, 3]);
  });
  assert.deepEqual(TAG_COUNTS, { phone: 3, food: 3, money: 3 });
  TYPES.forEach((t, i) => assert.ok(TYPES[t.best], `相性先が存在しない: ${i}`));
});

test('図鑑No.と番号の変換', () => {
  assert.equal(typeNo(0), '01');
  assert.equal(typeNo(15), '16');
  HIDDEN.forEach((h) => {
    assert.equal(typeNo(h.index), h.no);
    assert.equal(indexFromNo(h.no.toLowerCase()), h.index);
  });
  assert.equal(indexFromNo('07'), 6);
  assert.equal(indexFromNo('17'), -1);
  assert.equal(indexFromNo('x'), -1);
});

test('16タイプすべてに到達でき、軸の合計に引き分けがない', () => {
  for (let i = 0; i < BASE_COUNT; i++) {
    const bits = [3, 2, 1, 0].map((s) => (i >> s) & 1);
    const r = judge(answersFor(bits.map((b) => (b ? 3 : -3))));
    assert.equal(r.index, i, TYPES[i].label);
    r.sums.forEach((s) => assert.ok(s % 2 !== 0));
  }
});

test('隠しタイプの条件と優先順位', () => {
  const tagAnswers = (tag) => {
    const o = {};
    QUESTIONS.forEach((q, i) => {
      const k = q.options.findIndex((x) => x.tag === tag);
      if (k >= 0) o[i] = k;
    });
    return o;
  };
  // 振り切った回答に、タグの選択肢だけを混ぜる
  const strong = [3, 3, -3, -3];
  assert.equal(judge(answersFor(strong, tagAnswers('phone'))).index, 16);
  assert.equal(judge(answersFor(strong, tagAnswers('money'))).index, 17);
  assert.equal(judge(answersFor(strong, tagAnswers('food'))).index, 18);
  // 1つ欠けたら隠しタイプにならない
  const two = tagAnswers('phone');
  delete two[Object.keys(two)[0]];
  assert.ok(judge(answersFor(strong, two)).index < BASE_COUNT);
  // 全軸の合計が±1 → 幻のしっかり者（タグより優先）
  const pick = (q, v) => {
    const plain = q.options.findIndex((o) => o.v === v && !o.tag);
    return plain >= 0 ? plain : q.options.findIndex((o) => o.v === v);
  };
  const seen = AXES.map(() => 0);
  const balanced = QUESTIONS.map((q) => pick(q, [1, -1, 1, -1, 1][seen[q.axis]++]));
  const r = judge(balanced);
  assert.equal(r.index, 19);
  assert.equal(r.sums.reduce((a, s) => a + Math.abs(s), 0) <= 4, true);
});

test('理論分布は合計1で、無作為な回答のシミュレーションと一致する', () => {
  const prior = priorDistribution();
  assert.ok(Math.abs(prior.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  prior.forEach((p, i) => assert.ok(p > 0, `到達できない: ${TYPES[i].label}`));
  // mulberry32（再現できる乱数）
  let seed = 12345;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const n = 200000;
  const counts = new Array(TYPES.length).fill(0);
  for (let k = 0; k < n; k++) counts[judge(QUESTIONS.map(() => Math.floor(rand() * 4))).index]++;
  counts.forEach((c, i) => assert.ok(Math.abs(c / n - prior[i]) < 0.004, `${TYPES[i].label}: ${c / n} vs ${prior[i]}`));
  // 隠しタイプはどれも基本タイプよりレア
  HIDDEN.forEach((h) => assert.ok(prior[h.index] < Math.min(...prior.slice(0, BASE_COUNT))));
});

test('相性：対称で、いちばん高い相手はデータの相性◎と一致する', () => {
  for (let a = 0; a < BASE_COUNT; a++) {
    for (let b = 0; b < BASE_COUNT; b++) assert.equal(compat(a, b).score, compat(b, a).score);
    const top = compatRanking(a)[0];
    assert.equal(top.index, a ^ 12);
    assert.equal(TYPES[a].best, a ^ 12, `${TYPES[a].label} の相性◎がずれている`);
    assert.ok(top.score >= 90);
  }
  const scores = [];
  for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) scores.push(compat(a, b).score);
  assert.ok(Math.min(...scores) >= 40 && Math.max(...scores) <= 99);
  assert.equal(compat(3, 3).rank, '分身');
});

test('裏タイプは最も弱い軸をひっくり返したタイプ', () => {
  const u = uraOf([7, -1, 9, -15]);
  assert.equal(u.axis, 1);
  assert.equal(u.index, 0b1010 ^ 0b0100);
});

test('結果のURL表現は往復できて、不正な値は弾く', () => {
  const r = judge(answersFor([3, -1, 1, -3]));
  const back = decodeResult(encodeResult(r));
  assert.deepEqual(back.sums, r.sums);
  assert.equal(back.index, r.index);
  assert.equal(decodeResult('5~2_1_1_1'), null); // 偶数はありえない
  assert.equal(decodeResult('5~99_1_1_1'), null);
  assert.equal(decodeResult('<script>'), null);
  assert.equal(decodeResult('0~15_15_15_15'), null); // 0番なのに全部pos側
});

test('純度は50〜99%、軸の一言は全段階にある', () => {
  assert.equal(purityOf([AXIS_MAX, -AXIS_MAX, AXIS_MAX, -AXIS_MAX]), 99);
  assert.ok(purityOf([1, -1, 1, -1]) >= 50);
  [1, 5, 11, 15].forEach((s) => AXES.forEach((_, a) => {
    assert.ok(axisLine(a, s));
    assert.ok(axisLine(a, -s));
  }));
});

test('集計が少ないうちは理論値、十分あれば実データでレア度を出す', () => {
  assert.equal(rarityOf(3, { total: 10, counts: { 3: 5 } }).source, 'prior');
  const r = rarityOf(3, { total: 1000, counts: { 3: 31 } });
  assert.equal(r.source, 'actual');
  assert.ok(Math.abs(r.pct - 3.1) < 1e-9);
});
