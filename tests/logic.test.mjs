import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPES, QUESTIONS, AXES, HIDDEN_INDEX } from '../site/assets/data.js';
import { judge, priorDistribution, purityOf, rarityOf, HIDDEN_OPTION_COUNT } from '../site/assets/logic.js';

const pick = (pred) =>
  QUESTIONS.map((q) => q.options.findIndex((o) => pred(o, q)));

test('データの形がそろっている', () => {
  assert.equal(TYPES.length, 17);
  assert.equal(QUESTIONS.length, 12);
  AXES.forEach((_, a) => assert.equal(QUESTIONS.filter((q) => q.axis === a).length, 3));
  QUESTIONS.forEach((q) => {
    assert.equal(q.options.length, 4);
    assert.deepEqual(q.options.map((o) => o.v).sort(), [-1, -2, 1, 2].sort());
  });
  TYPES.forEach((t, i) => {
    assert.ok(t.label.length <= 11, `ラベルが長すぎる: ${t.label}`);
    assert.equal(t.aru.length, 3);
    assert.ok(TYPES[t.best], `相性先が存在しない: ${i}`);
    assert.notEqual(t.best, i);
  });
  assert.equal(HIDDEN_OPTION_COUNT, 3);
});

test('相性は双方向にそろっている（隠しタイプ以外）', () => {
  TYPES.slice(0, 16).forEach((t, i) => assert.equal(TYPES[t.best].best, i, t.label));
});

test('全部いちばん強い側を選ぶと両端のタイプになる', () => {
  assert.equal(judge(pick((o) => o.v === -2)).index, 0);
  assert.equal(judge(pick((o) => o.v === 2)).index, 15);
  assert.equal(judge(pick((o) => o.v === 2)).purity, 99);
});

test('合計0の軸は、強く答えた側に倒れる', () => {
  // E軸: +2, -1, -1 → 合計0 → 全力側
  const answers = pick((o, q) => (q.axis === 0 ? false : o.v === -2));
  const eQs = QUESTIONS.map((q, i) => [q, i]).filter(([q]) => q.axis === 0);
  answers[eQs[0][1]] = eQs[0][0].options.findIndex((o) => o.v === 2);
  answers[eQs[1][1]] = eQs[1][0].options.findIndex((o) => o.v === -1);
  answers[eQs[2][1]] = eQs[2][0].options.findIndex((o) => o.v === -1);
  const r = judge(answers);
  assert.equal(r.sums[0], 0);
  assert.equal(r.index, 8);
});

test('隠しタイプは隠し選択肢を全部選んだときだけ出る', () => {
  const all = pick((o) => !!o.h || false);
  QUESTIONS.forEach((q, i) => {
    if (all[i] === -1) all[i] = 0;
  });
  assert.equal(judge(all).index, HIDDEN_INDEX);
  const missOne = [...all];
  const firstHidden = QUESTIONS.findIndex((q) => q.options.some((o) => o.h));
  missOne[firstHidden] = QUESTIONS[firstHidden].options.findIndex((o) => !o.h);
  assert.notEqual(judge(missOne).index, HIDDEN_INDEX);
});

test('理論分布は総当たり（4^12通り）と一致し、全タイプに到達できる', () => {
  const counts = new Array(17).fill(0);
  const answers = new Array(12).fill(0);
  const total = 4 ** 12;
  for (let n = 0; n < total; n++) {
    let x = n;
    for (let i = 0; i < 12; i++) {
      answers[i] = x & 3;
      x >>= 2;
    }
    counts[judge(answers).index]++;
  }
  const prior = priorDistribution();
  counts.forEach((c, i) => {
    assert.ok(c > 0, `到達できないタイプ: ${TYPES[i].label}`);
    assert.ok(Math.abs(c / total - prior[i]) < 1e-12, `理論値がずれている: ${TYPES[i].label}`);
  });
  assert.ok(Math.abs(prior.reduce((a, b) => a + b, 0) - 1) < 1e-12);
});

test('純度は50〜99%に収まる', () => {
  assert.equal(purityOf([0, 0, 0, 0]), 50);
  assert.equal(purityOf([6, -6, 6, -6]), 99);
});

test('集計が少ないうちは理論値、十分あれば実データでレア度を出す', () => {
  assert.equal(rarityOf(3, { total: 10, counts: { 3: 5 } }).source, 'prior');
  const r = rarityOf(3, { total: 1000, counts: { 3: 31 } });
  assert.equal(r.source, 'actual');
  assert.ok(Math.abs(r.pct - 3.1) < 1e-9);
});
