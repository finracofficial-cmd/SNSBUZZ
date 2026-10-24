// 今週のお題：毎週月曜0時（日本時間）に1問だけ変わる、1タップの投票。
// 答えたあとに、全体とタイプ別の割合が見られる（タイプ別は、そのタイプの回答が30人をこえてから）。
// 他人を選ぶ質問（「クラスで一番◯◯なのは誰？」）や、体型・成績・家庭・恋愛の圧力になる質問は作らない。自由記述もなし。
import { TYPES } from './data.js';
import { weekIdOf, shiftWeek, weeksBetween } from './clock.js';
import { POLL_START, pollOf } from './polldata.js';
import { app, esc, jp, store, api, toast } from './ui.js';

export { pollOf };

export const thisWeek = () => weekIdOf();
export const lastWeek = () => shiftWeek(weekIdOf(), -1);
export const pollStarted = (week) => weeksBetween(POLL_START, week) >= 0;
const MIN = 30;

const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);
function bars(poll, counts, mineChoice = null) {
  const total = counts.reduce((a, b) => a + b, 0);
  return `<ol class="poll-bars">${poll.choices
    .map((c, k) => `<li class="${k === mineChoice ? 'mine' : ''}"><span>${esc(c)}${k === mineChoice ? '<small>（あなた）</small>' : ''}</span><b>${pct(counts[k], total)}%</b><i style="width:${pct(counts[k], total)}%"></i></li>`)
    .join('')}</ol>`;
}
const top = (counts) => counts.indexOf(Math.max(...counts));

// 結果のまとめ（全体・自分のタイプ）。人数が少ないうちは「集計中」
export function pollResultHtml(poll, data, { choice = null, type = null } = {}) {
  if (!data || data.error) return '<p class="hint">結果を読みこめませんでした。時間をおいて見てね</p>';
  if (!data.all) return `<p class="hint">いま集計中です（${MIN}人をこえると割合が出ます）</p>`;
  const mine = type != null && data.types?.[type];
  return `${bars(poll, data.all, choice)}
    <p class="hint">全体 ${data.total.toLocaleString('ja-JP')}人の回答</p>
    ${type == null
      ? ''
      : mine
        ? `<p class="poll-type"><b>${esc(TYPES[type].label)}</b>の${pct(mine[top(mine)], mine.reduce((a, b) => a + b, 0))}%が「${esc(poll.choices[top(mine)])}」</p>`
        : `<p class="hint">${esc(TYPES[type].label)}の割合は、${MIN}人をこえると出ます</p>`}`;
}

export const fetchPoll = (week) => api(`poll?week=${week}`).then((d) => d || { error: true });

// トップ・結果ページのカード
export function pollCard() {
  const week = thisWeek();
  const poll = pollOf(week);
  if (!poll) return '';
  const voted = store.get(`poll:${week}`, null);
  return `<section class="card poll" data-poll="${week}">
    <p class="lead">今週のお題 <small>毎週月曜に新しい1問</small></p>
    <h2 class="poll-q jp">${jp(poll.q)}</h2>
    <div class="poll-body">${Number.isInteger(voted)
      ? '<p class="hint">集計を読みこみ中…</p>'
      : `<div class="poll-opts">${poll.choices.map((c, k) => `<button class="poll-opt jp" data-vote="${k}">${jp(c)}</button>`).join('')}</div>`}</div>
    ${pollStarted(lastWeek()) ? `<a class="linkish" href="#/w/${lastWeek()}">先週のお題の結果を見る</a>` : ''}
  </section>`;
}

export function bindPoll(gen, navNow) {
  const card = app.querySelector('[data-poll]');
  if (!card) return;
  const week = card.dataset.poll;
  const poll = pollOf(week);
  const mine = store.get('mine', null);
  const type = mine && TYPES[mine.index] ? mine.index : null;
  const body = card.querySelector('.poll-body');
  const show = async (choice) => {
    const data = await fetchPoll(week);
    if (gen !== navNow()) return;
    body.innerHTML = pollResultHtml(poll, data, { choice, type });
  };
  const voted = store.get(`poll:${week}`, null);
  if (Number.isInteger(voted)) {
    show(voted);
    return;
  }
  card.querySelectorAll('[data-vote]').forEach((b) =>
    b.addEventListener('click', async () => {
      const choice = Number(b.dataset.vote);
      b.classList.add('on');
      card.querySelectorAll('[data-vote]').forEach((x) => (x.disabled = true));
      const res = await api('poll', { method: 'POST', body: { week, choice, type } });
      // 受けつけられなかったら（週が変わった・回数制限・通信できない）、票を覚えずに知らせる
      if (!res || res.error) {
        toast(res?.error === 'week' ? '今週のお題が新しくなりました。ページを読みなおしてね' : 'いま投票できませんでした。時間をおいてためしてね');
        card.querySelectorAll('[data-vote]').forEach((x) => (x.disabled = false));
        b.classList.remove('on');
        return;
      }
      store.set(`poll:${week}`, choice);
      show(choice);
    }),
  );
}

// 先週（それより前）のお題の結果ページ #/w/YYYY-MM-DD
export async function viewPollWeek(week, { render, brand, foot, navNow }) {
  const gen = navNow();
  const poll = pollOf(week);
  if (!poll || week >= thisWeek()) return false;
  const data = await fetchPoll(week);
  if (gen !== navNow()) return true;
  const choice = store.get(`poll:${week}`, null);
  const mine = store.get('mine', null);
  const byType = data?.types ? Object.entries(data.types).map(([i, c]) => [Number(i), c]).filter(([i]) => TYPES[i]) : [];
  render(`
    ${brand()}
    <section class="card poll">
      <p class="lead">${week.replace(/-/g, '/')}の週のお題</p>
      <h1 class="poll-q">${esc(poll.q)}</h1>
      ${pollResultHtml(poll, data, { choice: Number.isInteger(choice) ? choice : null, type: mine && TYPES[mine.index] ? mine.index : null })}
    </section>
    ${byType.length ? `<section class="card"><h2>タイプ別のいちばん人気</h2><ul class="poll-types">${byType
      .map(([i, c]) => `<li><b>${esc(TYPES[i].label)}</b><span>${esc(poll.choices[top(c)])}（${pct(c[top(c)], c.reduce((a, b) => a + b, 0))}%）</span></li>`)
      .join('')}</ul><p class="hint">回答が${MIN}人をこえたタイプだけ出しています</p></section>` : ''}
    <a class="btn" href="#/">今週のお題に答える</a>
    ${foot()}`);
  return true;
}
