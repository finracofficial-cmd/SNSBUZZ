import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TYPES,
  QUESTIONS,
  AXES,
  HIDDEN,
  BASE_COUNT,
  AXIS_MAX,
  PARAMS,
  PARAM_QUESTIONS,
  PARAM_MAX,
  PARAM_TEXT,
  LOVE_TYPES,
  CHAPTERS,
  typeNo,
  indexFromNo,
  loveIndexOf,
} from '../site/assets/data.js';
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
  quickCodeOf,
  axisLine,
  nicknameOf,
  paramLevel,
  rankOf,
  fullName,
  TAG_COUNTS,
} from '../site/assets/logic.js';

// 軸ごとに「この値の選択肢を選ぶ」を指定して回答を作る（タグなしの選択肢を優先）
const pick = (q, v) => {
  const plain = q.options.findIndex((o) => o.v === v && !o.tag);
  return plain >= 0 ? plain : q.options.findIndex((o) => o.v === v);
};
const axisAnswers = (values, override = {}) => QUESTIONS.map((q, i) => override[i] ?? pick(q, values[q.axis]));
const paramAnswers = (choices) => PARAM_QUESTIONS.map((q) => choices[q.param]);
const tagOverride = (tag) => {
  const o = {};
  QUESTIONS.forEach((q, i) => {
    const k = q.options.findIndex((x) => x.tag === tag);
    if (k >= 0) o[i] = k;
  });
  return o;
};

test('質問セットの形：軸12問（各3問）、パラメータ24問（各4問・3章×8問）', () => {
  assert.equal(QUESTIONS.length, 12);
  AXES.forEach((_, a) => assert.equal(QUESTIONS.filter((q) => q.axis === a).length, 3));
  QUESTIONS.forEach((q) => assert.deepEqual(q.options.map((o) => o.v).sort((x, y) => x - y), [-3, -1, 1, 3]));
  assert.deepEqual(TAG_COUNTS, { phone: 3, food: 3, money: 3 });
  assert.equal(PARAM_QUESTIONS.length, 24);
  PARAMS.forEach((_, k) => assert.equal(PARAM_QUESTIONS.filter((q) => q.param === k).length, 4));
  CHAPTERS.forEach((_, c) => assert.equal(PARAM_QUESTIONS.filter((q) => q.chapter === c).length, 8));
  PARAM_QUESTIONS.forEach((q) => assert.deepEqual(q.options.map((o) => o.v), [0, 1, 2, 3]));
  // 章の中では同じ章のパラメータだけが出る
  PARAM_QUESTIONS.forEach((q) => assert.ok([q.chapter * 2, q.chapter * 2 + 1].includes(q.param)));
  assert.equal(PARAM_MAX, 12);
});

test('選びやすさ：選択肢は短く、絵文字つきで、重ならない。「いなければ」の質問には案内がある', () => {
  for (const q of [...QUESTIONS, ...PARAM_QUESTIONS]) {
    q.options.forEach((o) => {
      assert.ok(o.e && o.e.length <= 4, `絵文字がない: ${o.text}`);
      assert.ok(Array.from(o.text).length <= 16, `選択肢が長い: ${o.text}`);
    });
    assert.equal(new Set(q.options.map((o) => o.e)).size, 4, `絵文字が重なっている: ${q.text}`);
    assert.equal(new Set(q.options.map((o) => o.text)).size, 4, q.text);
    // 好きな人・推しがいない人も答えられるように
    const needsNote = /好きな人|告白|気になる人/.test(q.text) || (q.text.startsWith('推し') && q.text !== '推しはいる？' && !q.text.includes('好きなキャラ'));
    if (needsNote) assert.ok(q.note, `「いなければ」の案内がない: ${q.text}`);
  }
});

test('文言データがそろっている', () => {
  assert.equal(TYPES.length, 20);
  TYPES.forEach((t, i) => assert.ok(TYPES[t.best], `相性先が存在しない: ${i}`));
  assert.equal(PARAM_TEXT.length, PARAMS.length);
  PARAM_TEXT.forEach((levels) => {
    assert.equal(levels.length, 3);
    levels.forEach((l) => assert.ok(l.lead.length > 10));
  });
  assert.equal(LOVE_TYPES.length, 8);
  LOVE_TYPES.forEach((l, i) => {
    assert.equal(l.best, i ^ 6);
    assert.ok(l.name && l.catch && l.lead);
  });
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

test('16タイプすべてに到達でき、引き分けがない。くわしい診断でタイプは変わらない', () => {
  for (let i = 0; i < BASE_COUNT; i++) {
    const v = [3, 2, 1, 0].map((s) => ((i >> s) & 1 ? 3 : -3));
    const q = judge({ axis: axisAnswers(v) });
    assert.equal(q.mode, 'quick');
    assert.equal(q.index, i, TYPES[i].label);
    q.sums.forEach((s) => assert.ok(s % 2 !== 0));
    const d = judge({ axis: axisAnswers(v), param: paramAnswers([0, 1, 2, 3, 0, 1]) });
    assert.equal(d.mode, 'detail');
    assert.equal(d.index, q.index);
    assert.deepEqual(d.sums, q.sums);
  }
});

test('隠しタイプ：タグは3つそろったときだけ、幻のしっかり者は真ん中寄りの人だけ', () => {
  const strong = [3, 3, -3, -3];
  for (const [tag, index] of [['phone', 16], ['money', 17], ['food', 18]]) {
    assert.equal(judge({ axis: axisAnswers(strong, tagOverride(tag)) }).index, index, tag);
    const two = tagOverride(tag);
    delete two[Object.keys(two)[0]];
    assert.ok(judge({ axis: axisAnswers(strong, two) }).index < BASE_COUNT);
  }
  // 各軸の合計が±1で、±3 の回答が少ない → 幻のしっかり者
  const seen = AXES.map(() => 0);
  const moderate = QUESTIONS.map((q) => pick(q, [1, -1, 1][seen[q.axis]++]));
  assert.equal(judge({ axis: moderate }).index, 19);
  // 合計は±1でも、±3 の回答が多すぎると幻にならない
  const seen2 = AXES.map(() => 0);
  const extreme = QUESTIONS.map((q) => pick(q, [3, -3, 1][seen2[q.axis]++]));
  const r = judge({ axis: extreme });
  assert.ok(r.sums.every((s) => Math.abs(s) === 1));
  assert.notEqual(r.index, 19);
});

test('理論分布は全4^12通りの総当たりと一致し、隠しタイプは基本タイプよりレアで、幻がいちばんレア', () => {
  const counts = new Array(TYPES.length).fill(0);
  const axis = new Array(12).fill(0);
  const total = 4 ** 12;
  for (let n = 0; n < total; n++) {
    let x = n;
    for (let k = 0; k < 12; k++) {
      axis[k] = x & 3;
      x >>= 2;
    }
    counts[judge({ axis }).index]++;
  }
  const p = priorDistribution();
  counts.forEach((c, i) => assert.ok(Math.abs(c / total - p[i]) < 1e-12, `${TYPES[i].label}: ${c / total} vs ${p[i]}`));
  assert.ok(Math.abs(p.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  const minBase = Math.min(...p.slice(0, BASE_COUNT));
  HIDDEN.forEach((h) => assert.ok(p[h.index] < minBase, TYPES[h.index].label));
  assert.ok(p[19] < Math.min(p[16], p[17], p[18]));
});

test('パラメータ・段階・ランク・二つ名・恋愛タイプ', () => {
  const d = judge({ axis: axisAnswers([3, -3, 3, -3]), param: paramAnswers([3, 0, 2, 1, 3, 0]) });
  assert.deepEqual(d.paramRaw, [12, 0, 8, 4, 12, 0]);
  assert.deepEqual(d.params, [100, 0, 67, 33, 100, 0]);
  assert.equal(d.love, loveIndexOf(d.params));
  assert.equal(d.love, 4 + 0 + 1);
  assert.ok(fullName(d).startsWith(d.nickname.text) && fullName(d).endsWith(TYPES[d.index].label));
  // 二つ名は50%からいちばん遠いパラメータ。同点なら起点からの順
  assert.deepEqual(nicknameOf([50, 50, 92, 8, 50, 50], 0), { param: 2, side: 'high', text: PARAMS[2].high });
  assert.deepEqual(nicknameOf([50, 50, 92, 8, 50, 50], 3), { param: 3, side: 'low', text: PARAMS[3].low });
  // 恋愛タイプのしきい値（58%は高、50%は低）
  assert.equal(loveIndexOf([58, 50, 58]), 5);
  assert.equal(loveIndexOf([50, 58, 50]), 2);
  // 段階とランク
  assert.deepEqual([0, 33, 34, 66, 67, 100].map(paramLevel), [0, 0, 1, 1, 2, 2]);
  assert.deepEqual([0, 24, 25, 41, 42, 66, 67, 84, 85, 100].map(rankOf), ['D', 'D', 'C', 'C', 'B', 'B', 'A', 'A', 'S', 'S']);
  // 二つ名は全パラメータ×高低の12通り、恋愛タイプは8通りすべてに到達できる
  const nick = new Set();
  const love = new Set();
  for (let a = 0; a < 6; a++) for (const v of [0, 3]) {
    const c = [1, 2, 1, 2, 1, 2];
    c[a] = v;
    nick.add(judge({ axis: axisAnswers([3, 3, 3, 3]), param: paramAnswers(c) }).nickname.text);
  }
  for (let m = 0; m < 8; m++) {
    const c = [m & 4 ? 3 : 0, m & 2 ? 3 : 0, m & 1 ? 3 : 0, 1, 1, 1];
    love.add(judge({ axis: axisAnswers([3, 3, 3, 3]), param: paramAnswers(c) }).love);
  }
  assert.equal(nick.size, 12);
  assert.equal(love.size, 8);
});

test('相性：対称で、いちばん高い相手はデータの相性◎と一致する', () => {
  for (let a = 0; a < BASE_COUNT; a++) {
    for (let b = 0; b < BASE_COUNT; b++) assert.equal(compat(a, b).score, compat(b, a).score);
    const top = compatRanking(a)[0];
    assert.equal(top.index, a ^ 12);
    assert.equal(TYPES[a].best, a ^ 12, `${TYPES[a].label} の相性◎がずれている`);
    assert.ok(top.score >= 90);
    assert.equal(top.rank, '最強の相方');
  }
  const scores = [];
  for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) scores.push(compat(a, b).score);
  assert.ok(Math.min(...scores) >= 50 && Math.max(...scores) <= 99);
  assert.equal(compat(3, 3).rank, '分身');
});

test('裏タイプは最も弱い軸をひっくり返したタイプ', () => {
  const u = uraOf([7, -1, 9, -5]);
  assert.equal(u.axis, 1);
  assert.equal(u.index, 0b1010 ^ 0b0100);
});

test('結果のURL表現は往復できて、不正な値は弾く', () => {
  const q = judge({ axis: axisAnswers([3, -1, 1, -3]) });
  const qb = decodeResult(encodeResult(q));
  assert.deepEqual(qb.sums, q.sums);
  assert.equal(qb.mode, 'quick');
  const d = judge({ axis: axisAnswers([3, -1, 1, -3]), param: paramAnswers([3, 2, 3, 0, 1, 2]) });
  const code = encodeResult(d);
  assert.match(code, /~[0-9a-c]{6}$/);
  const db = decodeResult(code);
  assert.equal(db.mode, 'detail');
  assert.deepEqual(db.params, d.params);
  assert.equal(db.nickname.text, d.nickname.text);
  assert.equal(quickCodeOf(code), encodeResult(q));
  assert.equal(decodeResult('5~2_1_1_1'), null); // 偶数はありえない
  assert.equal(decodeResult('5~11_1_1_1'), null); // ±11 はありえない
  assert.equal(decodeResult('5~1_1_-1_-1~d00000'), null); // パラメータは0〜12（c）まで
  assert.equal(decodeResult('5~1_1_-1_-1~0000000'), null); // パラメータは6文字
  assert.equal(decodeResult('<script>'), null);
  assert.equal(decodeResult('0~9_9_9_9'), null); // 0番なのに全部pos側
});

test('純度は50〜99%、軸の一言は全段階にある', () => {
  assert.equal(purityOf([AXIS_MAX, -AXIS_MAX, AXIS_MAX, -AXIS_MAX]), 99);
  assert.ok(purityOf([1, -1, 1, -1]) >= 50);
  [1, 3, 7, 9].forEach((s) => AXES.forEach((_, a) => {
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

test('A/Bテスト：ブラウザとサーバーの定義が同じ。z検定の p 値が妥当', async () => {
  const site = await import('../site/assets/experiments.js');
  const server = await import('../functions/_lib/experiments.js');
  assert.deepEqual(site.EXPERIMENTS, server.EXPERIMENTS);
  assert.deepEqual(site.AB_STEPS, server.AB_STEPS);
  assert.equal(site.twoProportion(1, 10, 2, 10), null, '少なすぎるときは判断しない');
  assert.ok(Math.abs(site.twoProportion(50, 100, 50, 100) - 1) < 1e-6, '同じ割合なら p=1');
  // 30/1000 と 60/1000 は有意（p ≈ 0.0013）
  const p = site.twoProportion(30, 1000, 60, 1000);
  assert.ok(p > 0.0005 && p < 0.003, `p=${p}`);
  assert.ok(site.twoProportion(30, 1000, 36, 1000) > 0.05);
});

test('テキストの結果：軸は寄っている側と5マスのバー。くわしい診断でもパラメータの数値は入れない', async () => {
  const { textResult } = await import('../site/assets/textshare.js');
  const quick = judge({ axis: [0, 3, 1, 2, 0, 1, 3, 2, 1, 0, 2, 3] });
  const t1 = textResult(quick, 'https://example.com/t/04/?s=x');
  const lines = t1.split('\n');
  assert.equal(lines.filter((l) => /^[🟧⬜]{5} /u.test(l)).length, 4);
  assert.ok(t1.endsWith('https://example.com/t/04/?s=x'));
  const detail = judge({ axis: [3, 1, 2, 0, 2, 3, 1, 0, 3, 2, 0, 1], param: [3, 2, 3, 1, 2, 3, 3, 2, 0, 1, 1, 2, 0, 1, 2, 2, 3, 3, 2, 3, 3, 2, 3, 3] });
  const t2 = textResult(detail, 'u');
  assert.ok(t2.includes(detail.nickname.text));
  assert.ok(!/\d+%/.test(t2.split('\n').slice(3).join('\n')), 'パラメータの％は入れない');
  assert.match(t2, /恋愛積極[SABCD] /);
});

test('続きリンク：結果・図鑑・隠しタイプを往復でき、おかしな値は捨てる', async () => {
  const { exportPayload, importPayload } = await import('../site/assets/carryover.js');
  const quick = encodeResult(judge({ axis: [0, 3, 1, 2, 0, 1, 3, 2, 1, 0, 2, 3] }));
  const p = exportPayload({ mineQuick: { code: quick }, mineDetail: null, met: new Set([0, 5, 19, 99]), gotHidden: [19, 3] });
  const back = importPayload(p);
  assert.equal(back.quick.code, quick);
  assert.equal(back.detail, null);
  assert.deepEqual(back.met, [0, 5, 19]);
  assert.deepEqual(back.hidden, [19]);
  assert.equal(importPayload('!!!'), null);
  assert.equal(importPayload(btoa('{"q":"<script>","m":"x"}')).quick, null);
  // 配列などの形は捨てる（保存すると結果ページが開けなくなる）
  const arr = importPayload(btoa(JSON.stringify({ q: [quick], d: ['f~1_1_1_1~6a4c28'] })));
  assert.equal(arr.quick, null);
  assert.equal(arr.detail, null);
});

test('いまの二つ名：深夜はカウントダウンなし。「次に変わる」と出した時刻には、本当に言葉が変わる', async () => {
  const { nowWord } = await import('../site/assets/clock.js');
  const start = Date.parse('2026-01-01T00:00:00+09:00');
  const words = new Set();
  for (let t = start; t < start + 400 * 86400e3; t += 30 * 60e3) {
    const n = nowWord(t);
    words.add(n.word);
    assert.ok(n.word.length >= 4 && n.word.length <= 12, n.word);
    if (n.night) {
      assert.equal(n.next, null);
      continue;
    }
    assert.match(n.next, /^\d\d:00$/);
    const [h] = n.next.split(':').map(Number);
    const jst = new Date(t + 9 * 3600e3);
    const at = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate(), h) - 9 * 3600e3 + (h <= jst.getUTCHours() ? 86400e3 : 0);
    assert.notEqual(nowWord(at).word, n.word, `${new Date(t).toISOString()} → ${n.next}`);
    assert.equal(nowWord(at - 60e3).word, n.word, '変わる直前までは同じ言葉');
  }
  assert.ok(words.size >= 14, `言葉の種類 ${words.size}`);
  // 占いの言葉は使わない
  assert.ok(![...words].some((w) => /運勢|ラッキー|当たる|鑑定|占/.test(w)));
});

test('今週のお題：週の区切りはブラウザとサーバーで同じ（月曜0時・日本時間）。問題は4択で、他人を選ばせない', async () => {
  const site = await import('../site/assets/clock.js');
  const server = await import('../functions/_lib/week.js');
  for (let t = Date.parse('2026-10-01T00:00:00Z'); t < Date.parse('2027-03-01T00:00:00Z'); t += 3 * 3600e3 + 17 * 60e3) {
    assert.equal(site.weekIdOf(t), server.weekIdOf(t));
  }
  assert.equal(site.weekIdOf(Date.parse('2026-10-25T23:59:00+09:00')), '2026-10-19');
  assert.equal(site.weekIdOf(Date.parse('2026-10-26T00:00:00+09:00')), '2026-10-26');
  assert.equal(site.shiftWeek('2026-10-26', -1), '2026-10-19');
  const { POLLS, POLL_START, pollOf } = await import('../site/assets/polldata.js');
  assert.ok(POLLS.length >= 26, '半年分');
  assert.equal(pollOf(POLL_START), POLLS[0]);
  assert.equal(pollOf(site.shiftWeek(POLL_START, -1)), null);
  assert.equal(pollOf(site.shiftWeek(POLL_START, POLLS.length + 2)), POLLS[2]);
  assert.equal(new Set(POLLS.map((p) => p.q)).size, POLLS.length, 'お題が重複していない');
  for (const p of POLLS) {
    assert.equal(p.choices.length, 4, p.q);
    assert.equal(new Set(p.choices).size, 4, p.q);
    assert.ok(!/誰|だれ|一番.*人|いちばん.*人|体重|成績|点数|彼氏|彼女|好きな人|告白/.test(p.q + p.choices.join()), p.q);
  }
});

test('グループの役割：n人なら min(n, 7) 個の役を、同じ人に2つ付けずに割りふる', async () => {
  const { groupRoles } = await import('../site/assets/logic.js');
  const people = [[5, 3, -1, 1], [-7, -5, 3, 1], [1, 7, 5, -3], [-3, -1, -5, -7], [9, -3, 1, 5], [-1, 1, -1, 1], [3, 3, 3, 3], [-9, -9, -9, -9], [1, -1, 1, -1]];
  for (let n = 1; n <= people.length; n++) {
    const roles = groupRoles(people.slice(0, n));
    assert.equal(roles.length, Math.min(n, 7), `${n}人`);
    assert.equal(new Set(roles.map((r) => r.member)).size, roles.length, '同じ人に2つ付かない');
    assert.ok(roles.every((r) => r.member >= 0 && r.member < n && r.role && r.icon && r.event));
  }
  assert.deepEqual(groupRoles([]), []);
});
