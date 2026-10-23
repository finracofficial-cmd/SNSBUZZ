// 入口：ホーム・質問・ルーティング。結果やペア・グループの画面は別モジュール。
import { SITE } from './config.js';
import { TYPES, QUESTIONS, HIDDEN, indexFromNo, isHidden } from './data.js';
import { judge, encodeResult, decodeResult } from './logic.js';
import { charaSVG } from './chara.js';
import { app, esc, store, track, loadStats, render, toast, foot, brand, handleShareClick, closeModal } from './ui.js';
import { viewResult, viewType, viewZukan } from './result.js';
import { receiveInvite, inviteBanner, viewPair, viewGroup, openGroupCreate, addFriend } from './social.js';
import { completePurchase } from './premium.js';

// ---------- ホーム ----------
function viewHome() {
  const parade = [3, 6, 8, 12, 10, 14, 7, 1].map((i) => charaSVG(i, { size: 100 })).join('');
  const mine = store.get('mine', null);
  const pendingGroup = store.get('pendingGroup', null);
  render(`
    ${inviteBanner()}
    ${pendingGroup ? '<div class="invite"><div>グループ診断に参加するには、まず診断してね</div></div>' : ''}
    <section class="hero">
      <h1><small>${esc(SITE.name)}</small>${esc(SITE.quizName)}</h1>
      <p class="catch">${esc(SITE.catchCopy)}</p>
      <div class="parade" aria-hidden="true">${parade}</div>
      <button class="btn" data-go="#/q">診断する（20問・約2分）</button>
      <div class="meta-row"><span class="pill">16タイプ＋隠し${HIDDEN.length}タイプ</span><span class="pill">相性診断つき</span><span class="pill">登録なし・無料</span></div>
    </section>
    ${mine && TYPES[mine.index] && mine.code ? `<a class="card mini-result" href="#/r/${esc(mine.code)}/${esc(mine.shareId)}">
      ${charaSVG(mine.index, { size: 64 })}<div><small>前回のあなた</small><b>${esc(TYPES[mine.index].label)}</b></div><span>結果を見る →</span></a>` : ''}
    <section class="card features">
      <h2>できること</h2>
      <ul>
        <li><b>16タイプ＋隠し${HIDDEN.length}タイプ</b>　性格・恋愛・友達・学校・トリセツまでまるごと解説</li>
        <li><b>成分表とポンコツ純度</b>　同じタイプでも、人によって数字がちがう</li>
        <li><b>ふたりの相性</b>　リンクを送って、友達や好きな人と相性チェック</li>
        <li><b>グループ診断</b>　クラスや部活の役割分担（幹事役・癒し担当…）がわかる</li>
      </ul>
    </section>
    <section class="card secret-teaser"><h2>隠しタイプは${HIDDEN.length}種類</h2>
      <div class="silhouettes">${HIDDEN.map((h) => charaSVG(h.index, { size: 72 })).join('')}</div>
      <p class="hint">特定の答え方をした人だけが出会えるレアタイプ。いちばんレアなのは出現率1%以下。</p>
    </section>
    <button class="btn sub" data-group-create>グループ診断をつくる</button>
    ${foot()}`);
  app.querySelector('[data-group-create]').addEventListener('click', openGroupCreate);
}

// ---------- 質問 ----------
// 選択肢の並びが「弱い→強い」の順に見えないよう、質問ごとに固定の順でシャッフルする
const ORDER = QUESTIONS.map((q, i) => {
  const idx = q.options.map((_, j) => j);
  let seed = i * 7919 + 17;
  for (let j = idx.length - 1; j > 0; j--) {
    seed = (seed * 48271) % 2147483647;
    const k = seed % (j + 1);
    [idx[j], idx[k]] = [idx[k], idx[j]];
  }
  return idx;
});

const CHEERS = { 5: 'いい調子！', 10: 'あと半分！', 15: 'あと5問！', 19: 'ラスト1問！' };
let answers = [];

function viewQuestion() {
  const i = answers.length;
  const q = QUESTIONS[i];
  const opts = ORDER[i].map((j) => `<button class="opt" data-choice="${j}">${esc(q.options[j].text)}</button>`).join('');
  render(`
    <div class="progress" aria-hidden="true"><i style="width:${(i / QUESTIONS.length) * 100}%"></i></div>
    <div class="qhead"><span>Q${i + 1} / ${QUESTIONS.length}</span>${i > 0 ? '<button data-back>← もどる</button>' : '<a href="#/">やめる</a>'}</div>
    <h2 class="qtext">${esc(q.text)}</h2>
    <div class="opts">${opts}</div>`);
  if (CHEERS[i]) toast(CHEERS[i]);
}

function choose(choice, button) {
  button.classList.add('on');
  app.querySelectorAll('.opt').forEach((b) => (b.disabled = true));
  setTimeout(() => {
    answers.push(choice);
    if (answers.length < QUESTIONS.length) viewQuestion();
    else finish();
  }, 160);
}

function finish() {
  const r = judge(answers);
  answers = [];
  const code = encodeResult(r);
  const shareId = Math.random().toString(36).slice(2, 8);
  track('done', r.index);
  store.set('mine', { index: r.index, code, shareId });
  if (isHidden(r.index)) store.set('gotHidden', [...new Set([...store.get('gotHidden', []), r.index])]);
  loadStats();
  // 成分を分析しているふうの演出（4本のバーが伸びる）
  render(`<div class="loading">ポンコツ成分を分析中…
    <div class="analyzing">${r.axisPct.map((p, k) => `<div><i style="--w:${p}%;animation-delay:${k * 0.18}s"></i></div>`).join('')}</div></div>`);
  const pendingGroup = store.get('pendingGroup', null);
  setTimeout(() => {
    if (pendingGroup) {
      store.set('pendingGroup', null);
      location.hash = `#/g/${pendingGroup.id}`;
    } else {
      location.hash = `#/r/${code}/${shareId}`;
    }
  }, 1500);
}

// ---------- 説明・法定表記 ----------
function viewAbout() {
  render(`
    ${brand()}
    <div class="card"><h2>このサイトについて</h2>
      <p>${esc(SITE.quizName)}は、20問の答えから“愛すべきポンコツ”タイプを16種類（＋隠しタイプ${HIDDEN.length}種類）に分けるエンタメ診断です。心理学的な検査ではありません。</p>
      <p>回答や個人を特定する情報は集めていません。集計しているのは、診断結果のタイプとシェアの回数だけです（レア度の表示に使います）。</p>
      <p>相性のおさそいリンクには、あなたが入れたニックネームと診断結果だけが入ります。グループ診断では、ニックネームとタイプをグループのページに表示します。グループは作成から90日で見られなくなります。</p>
      <p>結果画像のスクリーンショット、動画での紹介、配信での利用は自由です。</p>
    </div>
    ${foot()}`);
}

function viewLegal() {
  const s = SITE.seller;
  render(`
    ${brand()}
    <div class="card"><h2>特定商取引法に基づく表記</h2>
      <dl class="facts confirm">
        <dt>販売事業者</dt><dd>${esc(s.name)}</dd>
        <dt>所在地・電話番号</dt><dd>${esc(s.address)}</dd>
        <dt>お問い合わせ</dt><dd>${esc(s.contact)}</dd>
        <dt>販売価格</dt><dd>完全版トリセツ ${SITE.premiumPrice}円（税込）</dd>
        <dt>商品代金以外の費用</dt><dd>インターネット接続にかかる通信料</dd>
        <dt>支払方法</dt><dd>クレジットカード、Apple Pay、Google Pay（決済サービス Stripe）</dd>
        <dt>支払時期</dt><dd>ご注文時に決済されます</dd>
        <dt>提供時期</dt><dd>決済完了後、すぐにご利用いただけます</dd>
        <dt>返品・キャンセル</dt><dd>デジタルコンテンツの性質上、購入後の返品・キャンセルはできません</dd>
        <dt>動作環境</dt><dd>最新版の Safari・Chrome。購入情報はご利用の端末のブラウザに保存されます</dd>
      </dl>
      <p class="hint">18歳未満の方は、保護者の同意を得てからご購入ください。</p>
    </div>
    ${foot()}`);
}

// ---------- ルーティング ----------
async function route() {
  closeModal();
  const page = document.body.dataset.page;
  const hash = location.hash || (document.body.dataset.type ? `#/t/${document.body.dataset.type}` : '#/');
  const [, view, a, b, c, d] = hash.split('/');
  if (view === 'q') {
    answers = [];
    track('start');
    viewQuestion();
  } else if (view === 'r') {
    const r = decodeResult(a);
    if (r) viewResult(r, b || 'x');
    else viewHome();
  } else if (view === 't') {
    const index = indexFromNo(a);
    if (index < 0 || !viewType(index)) viewZukan();
  } else if (view === 'zukan') {
    viewZukan();
  } else if (view === 'pair') {
    viewPair(a, b, decodeURIComponent(c || ''), decodeURIComponent(d || ''));
  } else if (view === 'g') {
    viewGroup(a);
  } else if (view === 'about') {
    viewAbout();
  } else if (view === 'legal') {
    viewLegal();
  } else if (!location.hash && page === 'thanks') {
    location.replace(await completePurchase(new URLSearchParams(location.search).get('sid') || ''));
  } else {
    viewHome();
  }
}

function delegate(e) {
  const shareEl = e.target.closest('[data-ch]');
  if (shareEl && handleShareClick(shareEl)) {
    e.preventDefault();
    return true;
  }
  const go = e.target.closest('[data-go]');
  if (go) {
    if (location.hash === go.dataset.go) route();
    else location.hash = go.dataset.go;
    return true;
  }
  return false;
}

app.addEventListener('click', (e) => {
  const opt = e.target.closest('[data-choice]');
  if (opt) {
    choose(Number(opt.dataset.choice), opt);
    return;
  }
  if (e.target.closest('[data-back]')) {
    answers.pop();
    viewQuestion();
    return;
  }
  delegate(e);
});
// モーダルの中のボタン（共有・画面遷移）も同じ扱いにする
document.getElementById('modal').addEventListener('click', delegate);

// 静的な着地ページ（/i/ /p/ /g/）から来たときの初期化
(function boot() {
  const params = new URLSearchParams(location.search);
  const page = document.body.dataset.page;
  if (params.has('s')) track('ref', '1');
  if (page === 'invite' && !location.hash && receiveInvite(params)) {
    history.replaceState(null, '', `${location.pathname}#/`);
  }
  if (page === 'pair' && !location.hash && params.get('a') && params.get('b')) {
    addFriend(params.get('na') || '友達', params.get('a'));
    const p = ['a', 'b', 'na', 'nb'].map((k) => encodeURIComponent(params.get(k) || ''));
    history.replaceState(null, '', `${location.pathname}#/pair/${p.join('/')}`);
  }
  if (page === 'group' && !location.hash && /^[a-z0-9]{8}$/.test(params.get('id') || '')) {
    const id = params.get('id');
    if (!store.get('mine', null)?.code) store.set('pendingGroup', { id });
    history.replaceState(null, '', `${location.pathname}#/g/${id}`);
  }
})();

window.addEventListener('hashchange', route);
route();
