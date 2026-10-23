// 質問の画面。かんたん診断（12問）と、くわしい診断（かんたんの続き＋24問・3章）。
// かんたん診断の答えは保存しておき、くわしい診断はその続きから始められる。
// 進捗は36問の通し番号で出す（くわしい診断を続きから始めると、最初から33%進んだ状態になる）。
import { TYPES, QUESTIONS, PARAM_QUESTIONS, CHAPTERS, PARAMS, PARAM_MAX, LOVE_TYPES, loveIndexOf, isHidden } from './data.js';
import { judge, encodeResult, rankOf, paramLevel, LEVEL_NAMES } from './logic.js';
import { charaSVG } from './chara.js';
import { app, esc, store, track, loadStats, render, toast, navNow } from './ui.js';

// 選択肢の並びが「弱い→強い」の順に見えないよう、質問ごとに固定の順でシャッフルする
function shuffled(n, seedBase) {
  const idx = Array.from({ length: n }, (_, j) => j);
  let seed = seedBase * 7919 + 17;
  for (let j = idx.length - 1; j > 0; j--) {
    seed = (seed * 48271) % 2147483647;
    const k = seed % (j + 1);
    [idx[j], idx[k]] = [idx[k], idx[j]];
  }
  return idx;
}
export const optionOrder = (kind, i) => shuffled(4, kind === 'axis' ? i : 100 + i);

const TOTAL = QUESTIONS.length + PARAM_QUESTIONS.length;
const QUICK_CHEERS = { 6: 'あと半分！', 11: 'ラスト1問！' };

let session = null;

// 保存されているかんたん診断の答え（12問ぶんそろっていれば）
export function savedQuickAnswers() {
  const a = store.get('quickAnswers', null);
  return Array.isArray(a) && a.length === QUESTIONS.length && a.every((x) => Number.isInteger(x) && x >= 0 && x < 4) ? a : null;
}

export function startQuiz(mode) {
  const saved = mode === 'detail' ? savedQuickAnswers() : null;
  const steps = [];
  if (!saved) QUESTIONS.forEach((_, i) => steps.push(['axis', i]));
  if (mode === 'detail') PARAM_QUESTIONS.forEach((_, i) => steps.push(['param', i]));
  session = {
    mode,
    steps,
    axis: saved ? [...saved] : [],
    param: [],
    pos: 0,
    offset: saved ? QUESTIONS.length : 0, // 通し番号のずれ
    continued: !!saved,
  };
  // かんたん診断の開始（くわしい診断を最初から始めた人も含める）と、くわしい診断の開始を数える
  if (mode === 'quick' || !saved) track('start', '');
  if (mode === 'detail') track('detail', 'start');
  if (mode === 'detail') viewChapterIntro(saved ? 0 : -1);
  else viewStep();
}

// 章のはじめ（-1 はかんたん診断の部分）
function viewChapterIntro(c) {
  const s = session;
  const total = s.mode === 'detail' ? TOTAL : QUESTIONS.length;
  render(`
    <div class="progress detail" aria-hidden="true"><i style="width:${((s.offset + s.pos) / total) * 100}%"></i></div>
    <section class="chapter">
      <p class="lead">くわしい診断</p>
      <h1>${c < 0 ? 'まずは、あなたのタイプから' : esc(CHAPTERS[c].title)}</h1>
      <p>${c < 0
        ? 'かんたん診断の12問のあと、3つのパートで24問。あわせて約4分です。'
        : `${PARAMS[c * 2].name}と${PARAMS[c * 2 + 1].name}を測ります（8問）。`}</p>
      ${s.continued && c === 0 ? '<p class="hint">かんたん診断の答えを引きつぐので、ここから24問です。</p>' : ''}
      <button class="btn" data-quiz-next>はじめる</button>
    </section>`);
}

// ここまでの答えから、パラメータ1つの値（0〜100）を出す
function paramPct(k) {
  let raw = 0;
  PARAM_QUESTIONS.forEach((q, i) => {
    if (q.param === k && session.param[i] != null) raw += q.options[session.param[i]].v;
  });
  return Math.round((raw / PARAM_MAX) * 100);
}

// 章のおわりのごほうび：その章で測った2つのパラメータのランクをシールで貼る。
// パート2のあとは恋愛タイプ（恋愛積極度・ヤキモチ度・さみしがり度で決まる）も先に見せる。
function viewChapterDone(c) {
  const s = session;
  const stickers = [c * 2, c * 2 + 1].map((k) => {
    const v = paramPct(k);
    return `<span class="sticker"><b class="srank r${rankOf(v)}">${rankOf(v)}</b>${esc(PARAMS[k].name)}<small>${LEVEL_NAMES[paramLevel(v)]}</small></span>`;
  }).join('');
  const love = c === 1 ? LOVE_TYPES[loveIndexOf([0, 1, 2].map(paramPct))] : null;
  const type = s.axis.length ? judge({ axis: s.axis }).index : null;
  render(`
    <div class="progress detail" aria-hidden="true"><i style="width:${((s.offset + s.pos) / TOTAL) * 100}%"></i></div>
    <section class="chapter done">
      <div class="stamp">${charaSVG(type ?? 3, { size: 120 })}</div>
      <p class="lead">${esc(CHAPTERS[c].title)}　クリア</p>
      <h1>${esc(CHAPTERS[c].done)}</h1>
      <div class="got">${stickers}</div>
      ${love ? `<p class="reveal">恋愛タイプが決まりました<b>${esc(love.name)}</b></p>` : ''}
      ${c === CHAPTERS.length - 1 && type != null ? `<p class="reveal">二つ名が決まりました<b>？？？の${esc(TYPES[type].label)}</b></p>` : ''}
      <p class="hint">${c < CHAPTERS.length - 1 ? `のこり${CHAPTERS.length - 1 - c}パート（${(CHAPTERS.length - 1 - c) * 8}問）` : 'レポートを作成します'}</p>
      <button class="btn" data-quiz-next>${c < CHAPTERS.length - 1 ? 'つぎのパートへ' : '結果を見る'}</button>
    </section>`);
}

function viewStep() {
  const s = session;
  const [kind, i] = s.steps[s.pos];
  const q = kind === 'axis' ? QUESTIONS[i] : PARAM_QUESTIONS[i];
  const opts = optionOrder(kind, i)
    .map((j) => `<button class="opt" data-choice="${j}">${esc(q.options[j].text)}</button>`)
    .join('');
  const total = s.mode === 'detail' ? TOTAL : QUESTIONS.length;
  const n = s.offset + s.pos + 1;
  const where = kind === 'param' ? CHAPTERS[q.chapter].title : s.mode === 'detail' ? 'かんたん診断パート' : 'かんたん診断';
  render(`
    <div class="progress ${s.mode}" aria-hidden="true"><i style="width:${((n - 1) / total) * 100}%"></i></div>
    <div class="qhead"><span>${esc(where)}　${n} / ${total}</span>${s.pos > 0 ? '<button data-back>← もどる</button>' : '<a href="#/">やめる</a>'}</div>
    <h2 class="qtext">${esc(q.text)}</h2>
    <div class="opts">${opts}</div>`);
  if (s.mode === 'quick' && QUICK_CHEERS[s.pos]) toast(QUICK_CHEERS[s.pos]);
}

export function handleQuizClick(e) {
  if (!session) return false;
  const opt = e.target.closest('[data-choice]');
  if (opt) {
    choose(Number(opt.dataset.choice), opt);
    return true;
  }
  if (e.target.closest('[data-back]')) {
    session.pos = Math.max(0, session.pos - 1);
    viewStep();
    return true;
  }
  if (e.target.closest('[data-quiz-next]')) {
    if (session.pos >= session.steps.length) finish();
    else viewStep();
    return true;
  }
  return false;
}

function choose(choice, button) {
  const s = session;
  const at = s.pos;
  button.classList.add('on');
  app.querySelectorAll('.opt, [data-back]').forEach((b) => (b.disabled = true));
  setTimeout(() => {
    // そのあいだに「もどる」や別の画面へ移っていたら、何もしない
    if (session !== s || s.pos !== at) return;
    const [kind, i] = s.steps[s.pos];
    (kind === 'axis' ? s.axis : s.param)[i] = choice;
    s.pos++;
    if (s.pos >= s.steps.length) {
      if (s.mode === 'detail') viewChapterDone(CHAPTERS.length - 1);
      else finish();
      return;
    }
    const [nextKind, nextI] = s.steps[s.pos];
    if (s.mode === 'detail' && nextKind === 'param') {
      const prevChapter = kind === 'param' ? PARAM_QUESTIONS[i].chapter : -1;
      const nextChapter = PARAM_QUESTIONS[nextI].chapter;
      if (nextChapter !== prevChapter) {
        if (prevChapter >= 0) viewChapterDone(prevChapter);
        else viewChapterIntro(nextChapter);
        return;
      }
    }
    viewStep();
  }, 160);
}

function finish() {
  const s = session;
  session = null;
  store.set('quickAnswers', s.axis);
  const r = judge(s.mode === 'quick' ? { axis: s.axis } : { axis: s.axis, param: s.param });
  const code = encodeResult(r);
  const shareId = Math.random().toString(36).slice(2, 8);
  if (s.mode === 'quick') {
    track('done', r.index);
    store.set('mineQuick', { index: r.index, code, shareId });
  } else {
    track('detail', 'done');
    if (!s.continued) track('done', r.index);
    store.set('mineQuick', { index: r.index, code: code.split('~').slice(0, 2).join('~'), shareId });
    store.set('mineDetail', { index: r.index, code, shareId });
  }
  store.set('mine', { index: r.index, code, shareId, mode: r.mode });
  if (isHidden(r.index)) store.set('gotHidden', [...new Set([...store.get('gotHidden', []), r.index])]);
  loadStats();
  const gen = navNow();
  render(`<div class="loading">${s.mode === 'quick' ? 'ポンコツ成分を分析中…' : 'あなたのレポートを作成中…'}
    <div class="analyzing">${r.axisPct.map((p, k) => `<div><i style="--w:${p}%;animation-delay:${k * 0.18}s"></i></div>`).join('')}
    ${r.params ? r.params.map((p, k) => `<div><i style="--w:${Math.max(p, 6)}%;animation-delay:${0.72 + k * 0.12}s"></i></div>`).join('') : ''}</div></div>`);
  const pendingGroup = store.get('pendingGroup', null);
  setTimeout(() => {
    if (gen !== navNow()) return;
    // 結果へは履歴を置きかえて移る（ブラウザの「戻る」で診断が最初から始まらないように）
    if (pendingGroup) {
      store.set('pendingGroup', null);
      location.replace(`#/g/${pendingGroup.id}`);
    } else {
      location.replace(`#/r/${code}/${shareId}`);
    }
  }, s.mode === 'quick' ? 1500 : 2100);
}

export const quizActive = () => !!session;
export const cancelQuiz = () => {
  session = null;
};
