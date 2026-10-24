// 運営用のKPI画面（#/admin）。どこからもリンクしない。KPI_TOKEN を入れると /api/stats?all=1 を読んで表にする。
//   ・ファネル：開始 → 完了 → くわしい診断 → 購入案内 → 決済 → 支払い完了
//   ・シェア：ボタンごとの回数と、完了あたりの割合
//   ・日別：直近14日の開始・完了・支払い完了
//   ・A/Bテスト：案ごとの表示・購入案内・決済・支払い完了と、差があるかの目安（2つの割合の z 検定）
//   ・タイプ別の完了数
import { TYPES } from './data.js';
import { ALL_EXPERIMENTS, SERVER_EXPERIMENTS, twoProportion, revenueTest, metricsOf } from './experiments.js';
import { esc, render, api, brand } from './ui.js';

const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—');

function readToken() {
  try {
    return sessionStorage.getItem('pz:kpi') || '';
  } catch {
    return '';
  }
}
function saveToken(t) {
  try {
    sessionStorage.setItem('pz:kpi', t);
  } catch {
    // 保存できなくても、その場では使える
  }
}

// ---------- 売上（目標：月100万円） ----------
const TARGET = 1000000;
const FEE = 0.036; // Stripe のカード手数料の目安（PayPay はもっと高い）
const yen = (n) => `${Math.round(n).toLocaleString('ja-JP')}円`;
const jstNow = () => new Date(Date.now() + 9 * 3600 * 1000);
const monthKey = (d = jstNow()) => d.toISOString().slice(0, 7);
const sumDays = (c, month, key) => Object.keys(c).filter((k) => k.startsWith(`day:${month}`) && k.endsWith(`:${key}`)).reduce((s, k) => s + c[k], 0);

function revenue(c) {
  const now = jstNow();
  const month = monthKey(now);
  const gross = c[`rev:${month}`] || 0;
  const refund = c[`refund:${month}`] || 0;
  const net = (gross - refund) * (1 - FEE);
  const day = now.getUTCDate();
  const days = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const pace = (net / day) * days;
  const paidMonth = sumDays(c, month, 'paid');
  const doneMonth = sumDays(c, month, 'done');
  const arppu = paidMonth ? gross / paidMonth : 0;
  const left = Math.max(TARGET - net, 0);
  const perDay = left / Math.max(days - day + 1, 1);
  return `<table class="kpi money">
      <tr><td>今月の売上（税込）</td><td>${yen(gross)}</td></tr>
      <tr><td>返金</td><td>${yen(refund)}</td></tr>
      <tr><td>手取りの目安（手数料${(FEE * 100).toFixed(1)}%を引く）</td><td><b>${yen(net)}</b></td></tr>
      <tr><td>このペースだと今月は</td><td><b>${yen(pace)}</b>（目標の${pct(pace, TARGET)}）</td></tr>
      <tr><td>目標まで</td><td>${yen(left)}（残り${days - day + 1}日・1日あたり${yen(perDay)}${arppu ? `・約${Math.ceil(perDay / (arppu * (1 - FEE)))}件` : ''}）</td></tr>
      <tr><td>平均単価（1件あたり）</td><td>${arppu ? yen(arppu) : '—'}</td></tr>
      <tr><td>診断の完了1,000回あたりの売上</td><td>${doneMonth ? yen(((gross - refund) / doneMonth) * 1000) : '—'}</td></tr>
      <tr><td>プラン別（今月）</td><td>じぶん用 ${yen(c[`rev:${month}:solo`] || 0)}／ふたり用 ${yen(c[`rev:${month}:duo`] || 0)}</td></tr>
    </table>
    <p class="hint">広告・アフィリエイト・タイアップの売上はここに入らない（各サービスの管理画面で見る）。下の試算に手で入れる。</p>`;
}

// 月100万円までの試算。いまの数字（直近7日）を初期値にして、どこを伸ばせば届くかを見る
function simulator(c) {
  const days = [...new Set(Object.keys(c).filter((k) => k.startsWith('day:')).map((k) => k.split(':')[1]))].sort().slice(-7);
  const avg = (key) => (days.length ? days.reduce((s, d) => s + (c[`day:${d}:${key}`] || 0), 0) / days.length : 0);
  const done = Math.round(avg('done')) || 3000;
  const paid = avg('paid');
  const rev = avg('rev');
  const conv = done && paid ? ((paid / avg('done')) * 100).toFixed(2) : '0.60';
  const arppu = paid ? Math.round(rev / paid) : 430;
  const field = (id, label, value, step = 'any') => `<label class="field small">${label}<input id="sim-${id}" type="number" inputmode="decimal" step="${step}" value="${value}"></label>`;
  return `<div class="sim">
      ${field('done', '1日の診断の完了', done, 1)}
      ${field('conv', '完了あたりの購入率（%）', conv)}
      ${field('arppu', '平均単価（円）', arppu, 1)}
      ${field('pv', '1人あたりのページ数', 6)}
      ${field('rpm', '広告の収益（1,000ページあたり・円）', 150, 1)}
      ${field('aff', 'アフィリエイト（1,000人あたり・円）', 300, 1)}
      ${field('other', 'タイアップ・スタンプなど（月・円）', 0, 1000)}
    </div>
    <div class="sim-out" id="sim-out"></div>
    <p class="hint">初期値は直近7日の平均（データがなければ目安）。広告は購入者には出さないので、購入した人の分は引いている。</p>`;
}
function bindSimulator() {
  const out = document.getElementById('sim-out');
  if (!out) return;
  const v = (id) => Number(document.getElementById(`sim-${id}`).value) || 0;
  const update = () => {
    const users = v('done') * 30;
    const buyers = users * (v('conv') / 100);
    const sales = buyers * v('arppu') * (1 - FEE);
    const ads = (users - buyers) * v('pv') * (v('rpm') / 1000);
    const aff = users * (v('aff') / 1000);
    const total = sales + ads + aff + v('other');
    // 目標に届く1日の完了数（ほかの数字はそのまま）
    const perUser = (v('conv') / 100) * v('arppu') * (1 - FEE) + (1 - v('conv') / 100) * v('pv') * (v('rpm') / 1000) + v('aff') / 1000;
    const need = perUser > 0 ? Math.ceil(Math.max(TARGET - v('other'), 0) / 30 / perUser) : 0;
    out.innerHTML = `<table class="kpi money">
      <tr><td>完全版</td><td>${yen(sales)}（月${Math.round(buyers).toLocaleString('ja-JP')}件）</td></tr>
      <tr><td>広告</td><td>${yen(ads)}</td></tr>
      <tr><td>アフィリエイト</td><td>${yen(aff)}</td></tr>
      <tr><td>そのほか</td><td>${yen(v('other'))}</td></tr>
      <tr><td><b>月の合計（手取りの目安）</b></td><td><b>${yen(total)}</b>（目標の${pct(total, TARGET)}）</td></tr>
      <tr><td>月100万円に必要な1日の完了</td><td><b>${need.toLocaleString('ja-JP')}回</b></td></tr>
    </table>`;
  };
  document.querySelectorAll('.sim input').forEach((i) => i.addEventListener('input', update));
  update();
}

const LEFT_NAMES = [['price', '高い'], ['method', '払い方'], ['guardian', 'おうちの人'], ['content', '中身'], ['later', 'いまはいい']];
function funnel(c) {
  // [名前, 回数, くらべる段階の番号]（購入案内の2行は、どちらも「くわしい診断の完了」とくらべる）
  const steps = [
    ['かんたん診断の開始', c.start, null],
    ['かんたん診断の完了', sumDone(c), 0],
    ['くわしい診断の開始', c['detail:start'], 1],
    ['くわしい診断の完了', c['detail:done'], 2],
    ['購入案内（自動で表示）', c['paywall:view'], 3],
    ['購入案内（ボタンから）', c['paywall:cta'], 3],
    ['決済画面へ', c['premium:checkout'], 3],
    ['支払い完了', c['premium:paid'], 6],
  ];
  return `<table class="kpi"><tr><th>段階</th><th>回数</th><th>割合</th></tr>${steps
    .map(([name, n, base]) => `<tr><td>${name}</td><td>${n || 0}</td><td>${base == null ? '' : `${pct(n || 0, steps[base][1] || 0)}<small>／${steps[base][0].replace(/の(開始|完了)$/, '')}</small>`}</td></tr>`)
    .join('')}</table>
    <p class="hint">くわしい診断の完了あたりの支払い完了：<b>${pct(c['premium:paid'] || 0, c['detail:done'] || 0)}</b>（目標 1.5%）／おうちの人へのお願い：${c['paywall:ask'] || 0}／コード利用：${Object.keys(c).filter((k) => k.startsWith('premium:code:')).reduce((s, k) => s + c[k], 0)}</p>
    <p class="hint">決済の画面で「戻る」：${c['premium:cancel'] || 0}／迷った理由：${LEFT_NAMES.map(([k, n]) => `${n} ${c[`left:${k}`] || 0}`).join('・')}</p>`;
}

const sumDone = (c) => Object.keys(c).filter((k) => /^done:\d+$/.test(k)).reduce((s, k) => s + c[k], 0);

function shares(c) {
  const done = sumDone(c);
  const rows = Object.keys(c)
    .filter((k) => k.startsWith('share:'))
    .sort((a, b) => c[b] - c[a]);
  return `<table class="kpi"><tr><th>シェア</th><th>回数</th><th>完了あたり</th></tr>${rows
    .map((k) => `<tr><td>${esc(k.slice(6))}</td><td>${c[k]}</td><td>${pct(c[k], done)}</td></tr>`)
    .join('')}<tr><td><b>合計</b></td><td><b>${c.share || 0}</b></td><td><b>${pct(c.share || 0, done)}</b></td></tr></table>
    <p class="hint">流入（シェアURL・おさそい）：${c.ref || 0}／わたしクイズの出題：${c['quiz:create'] || 0}・回答完了：${c['quiz:done'] || 0}／グループ：作成 ${c['group:create'] || 0}・参加 ${c['group:join'] || 0}／紹介で初めて診断した友達：${c['ref:done'] || 0}（完了あたり ${pct(c['ref:done'] || 0, done)}）</p>
    <p class="hint">再訪（結果を持っている端末が別の日にまた開いた・1日1回）：${c['visit:return'] || 0}／今週のお題の投票：${c.poll || 0}／いまの二つ名の画像：${c['share:now-nick'] || 0}</p>`;
}

function daily(c) {
  const days = [...new Set(Object.keys(c).filter((k) => k.startsWith('day:')).map((k) => k.split(':')[1]))].sort().slice(-14);
  if (!days.length) return '<p class="hint">まだデータがありません</p>';
  const series = [
    ['開始', 'start', '#6C7FD8'],
    ['完了', 'done', '#FF7A59'],
    ['支払い完了', 'paid', '#C9973A'],
  ];
  // 開始・完了は同じ目盛り、支払い完了はけたがちがうので別の目盛り
  const max = Math.max(1, ...days.flatMap((d) => ['start', 'done'].map((k) => c[`day:${d}:${k}`] || 0)));
  const maxPaid = Math.max(1, ...days.map((d) => c[`day:${d}:paid`] || 0));
  const bars = days
    .map((d, i) => series.map(([, k, color], j) => {
      const v = c[`day:${d}:${k}`] || 0;
      const h = (v / (k === 'paid' ? maxPaid : max)) * 120;
      return `<rect x="${i * 22 + j * 6 + 2}" y="${130 - h}" width="5" height="${h}" fill="${color}"><title>${d} ${k}: ${v}</title></rect>`;
    }).join(''))
    .join('');
  // 日数が少なくても棒が太くならないよう、幅は14日ぶんで固定する
  return `<svg class="daily" viewBox="0 0 ${14 * 22 + 4} 150" role="img" aria-label="日別の推移">${bars}
    <text x="0" y="146" class="ax">${days[0].slice(5)}</text><text x="${Math.max(days.length * 22 - 30, 40)}" y="146" class="ax">${days.at(-1).slice(5)}</text></svg>
    <p class="hint">${series.map(([n, , color]) => `<span style="color:${color}">■</span> ${n}`).join('　')}（日本時間の日付。支払い完了は別の目盛りで、最大 ${maxPaid}件）</p>`;
}

// 判定は、各案の分母（最初の段階）が先に決めた人数に達してから1回だけ（途中で何度も見て、差が出たところで止めると、
// 本当は差がなくても「差あり」と出やすくなる）。購入率3%前後で1ポイントの差を見るには各案およそ5,000人、
// calc のシェア率10%前後で2ポイントの差を見るには各案およそ3,500人
const AB_TARGETS = { calc: 3500 };
const STEP_NAMES = { exposure: '表示', cta: '購入案内', checkout: '決済へ', paid: '支払い', result: '結果', share: 'シェア', agree: 'わかる〜！', detail: 'くわしい診断へ' };
function abTable(c) {
  return Object.entries(ALL_EXPERIMENTS)
    .map(([name, variants]) => {
      const steps = metricsOf(name);
      const [base, ...outs] = steps;
      const buying = steps.includes('paid');
      const rows = variants.map((v) => ({ v, n: Object.fromEntries(steps.map((st) => [st, c[`ab:${name}:${v}:${st}`] || 0])), rev: c[`ab:${name}:${v}:rev`] || 0 }));
      const target = AB_TARGETS[name] || 5000;
      const reached = rows.every((r) => r.n[base] >= target);
      const [a, b] = rows;
      const judge = (p) => (!reached ? 'まだ判定しない' : p == null ? '判断できない' : p < 0.05 ? `差がありそう（p=${p.toFixed(3)}）` : `差は見えない（p=${p.toFixed(3)}）`);
      const verdict = (st) => `${STEP_NAMES[st]}の率：${judge(a && b ? twoProportion(a.n[st], a.n[base], b.n[st], b.n[base]) : null)}`;
      // 価格のテストは、支払いの率ではなく、表示1回あたりの売上で決める
      const revVerdict = () => `表示1回あたりの売上：${judge(a && b ? revenueTest(a.rev, a.n.paid, a.n[base], b.rev, b.n.paid, b.n[base]) : null)}`;
      const verdicts = Object.hasOwn(SERVER_EXPERIMENTS, name) ? [revVerdict()] : outs.filter((st) => st !== 'cta').map(verdict);
      return `<h3>${esc(name)}${name === 'price' ? '（週ごとに交互）' : ''}</h3><table class="kpi"><tr><th>案</th>${steps.map((st) => `<th>${STEP_NAMES[st]}</th>`).join('')}${buying ? '<th>売上</th><th>表示あたり</th>' : ''}</tr>${rows
        .map((r) => `<tr><td>${esc(r.v)}</td>${steps.map((st, k) => `<td>${r.n[st]}${k ? `<small>（${pct(r.n[st], r.n[base])}）</small>` : ''}</td>`).join('')}${buying ? `<td>${yen(r.rev)}</td><td>${r.n[base] ? `${(r.rev / r.n[base]).toFixed(1)}円` : '—'}</td>` : ''}</tr>`)
        .join('')}</table><p class="hint">${verdicts.join('／')}。${reached ? '' : `判定は、各案の「${STEP_NAMES[base]}」が${target.toLocaleString('ja-JP')}人に達してから（いま ${rows.map((r) => r.n[base]).join('・')}人）。途中で止めて結論を出さないでください。`}${name === 'price' ? '週ごとの波（テスト期間・連休）をならすため、最低4週（各案2週）は続けてください。' : ''}</p>`;
    })
    .join('');
}

function types(c) {
  const total = sumDone(c);
  return `<table class="kpi"><tr><th>タイプ</th><th>完了</th><th>割合</th></tr>${TYPES.map((t, i) => [t.label, c[`done:${i}`] || 0])
    .sort((x, y) => y[1] - x[1])
    .map(([l, n]) => `<tr><td>${esc(l)}</td><td>${n}</td><td>${pct(n, total)}</td></tr>`)
    .join('')}</table>`;
}

export async function viewAdmin() {
  const token = readToken();
  const form = `<form class="card" id="kpi-form"><label class="field">KPI_TOKEN<input id="kpi-token" type="password" autocomplete="off" value="${esc(token)}"></label>
    <button class="btn small">読みこむ</button></form>`;
  if (!token) {
    render(`${brand()}<h1 class="sheet-title">KPI</h1>${form}`);
    bindForm();
    return;
  }
  render(`${brand()}<h1 class="sheet-title">KPI</h1><p class="hint">読みこみ中…</p>`);
  const c = await api('stats?all=1', { token, timeout: 8000 });
  if (!c || c.error) {
    render(`${brand()}<h1 class="sheet-title">KPI</h1><p class="hint err">読みこめませんでした（トークンをたしかめてください）</p>${form}`);
    bindForm();
    return;
  }
  render(`${brand()}<h1 class="sheet-title">KPI</h1>
    <section class="card"><h2>売上（目標：月100万円）</h2>${revenue(c)}</section>
    <section class="card"><h2>月100万円までの試算</h2>${simulator(c)}</section>
    <section class="card"><h2>ファネル</h2>${funnel(c)}</section>
    <section class="card"><h2>日別（直近14日）</h2>${daily(c)}</section>
    <section class="card"><h2>A/Bテスト</h2>${abTable(c)}</section>
    <section class="card"><h2>シェア</h2>${shares(c)}</section>
    <section class="card"><h2>タイプ別の完了</h2>${types(c)}</section>
    ${form}`);
  bindForm();
  bindSimulator();
}

function bindForm() {
  document.getElementById('kpi-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveToken(document.getElementById('kpi-token').value.trim());
    viewAdmin();
  });
}
