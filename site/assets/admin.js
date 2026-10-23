// 運営用のKPI画面（#/admin）。どこからもリンクしない。KPI_TOKEN を入れると /api/stats?all=1 を読んで表にする。
//   ・ファネル：開始 → 完了 → くわしい診断 → 購入案内 → 決済 → 支払い完了
//   ・シェア：ボタンごとの回数と、完了あたりの割合
//   ・日別：直近14日の開始・完了・支払い完了
//   ・A/Bテスト：案ごとの表示・購入案内・決済・支払い完了と、差があるかの目安（2つの割合の z 検定）
//   ・タイプ別の完了数
import { TYPES } from './data.js';
import { EXPERIMENTS, twoProportion } from './experiments.js';
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
    <p class="hint">くわしい診断の完了あたりの支払い完了：<b>${pct(c['premium:paid'] || 0, c['detail:done'] || 0)}</b>（目標 1.5%）／おうちの人へのお願い：${c['paywall:ask'] || 0}／コード利用：${Object.keys(c).filter((k) => k.startsWith('premium:code:')).reduce((s, k) => s + c[k], 0)}</p>`;
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
    <p class="hint">流入（シェアURL・おさそい）：${c.ref || 0}／わたしクイズの出題：${c['quiz:create'] || 0}・回答完了：${c['quiz:done'] || 0}／グループ：作成 ${c['group:create'] || 0}・参加 ${c['group:join'] || 0}</p>
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

function abTable(c) {
  return Object.entries(EXPERIMENTS)
    .map(([name, variants]) => {
      const row = (v) => {
        const g = (s) => c[`ab:${name}:${v}:${s}`] || 0;
        return { v, exposure: g('exposure'), cta: g('cta'), checkout: g('checkout'), paid: g('paid') };
      };
      const rows = variants.map(row);
      const [a, b] = rows;
      const pPaid = a && b ? twoProportion(a.paid, a.exposure, b.paid, b.exposure) : null;
      const pCheckout = a && b ? twoProportion(a.checkout, a.exposure, b.checkout, b.exposure) : null;
      const verdict = (p) => (p == null ? 'まだ判断できない（各案30人未満）' : p < 0.05 ? `差がありそう（p=${p.toFixed(3)}）` : `差はまだ見えない（p=${p.toFixed(3)}）`);
      return `<h3>${esc(name)}</h3><table class="kpi"><tr><th>案</th><th>表示</th><th>購入案内</th><th>決済へ</th><th>支払い</th><th>支払い率</th></tr>${rows
        .map((r) => `<tr><td>${esc(r.v)}</td><td>${r.exposure}</td><td>${r.cta}</td><td>${r.checkout}</td><td>${r.paid}</td><td>${pct(r.paid, r.exposure)}</td></tr>`)
        .join('')}</table><p class="hint">決済へ進んだ率：${verdict(pCheckout)}／支払い率：${verdict(pPaid)}。購入率1〜2%の差を見分けるには、各案で数千人の表示が必要です。</p>`;
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
    <section class="card"><h2>ファネル</h2>${funnel(c)}</section>
    <section class="card"><h2>日別（直近14日）</h2>${daily(c)}</section>
    <section class="card"><h2>A/Bテスト</h2>${abTable(c)}</section>
    <section class="card"><h2>シェア</h2>${shares(c)}</section>
    <section class="card"><h2>タイプ別の完了</h2>${types(c)}</section>
    ${form}`);
  bindForm();
}

function bindForm() {
  document.getElementById('kpi-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveToken(document.getElementById('kpi-token').value.trim());
    viewAdmin();
  });
}
