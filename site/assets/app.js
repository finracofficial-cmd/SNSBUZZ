// 入口：ホーム・ルーティング。質問・結果・レポート・ふたり/グループ・完全版は別モジュール。
import { SITE } from './config.js';
import { TYPES, HIDDEN, QUESTIONS, PARAM_QUESTIONS, indexFromNo } from './data.js';
import { decodeResult } from './logic.js';
import { charaSVG } from './chara.js';
import { app, esc, store, track, render, foot, brand, toast, handleShareClick, closeModal } from './ui.js';
import { startQuiz, handleQuizClick, cancelQuiz, savedQuickAnswers } from './quiz.js';
import { viewResult, viewType, viewZukan } from './result.js';
import { viewReport } from './report.js';
import {
  receiveInvite,
  inviteBanner,
  viewPair,
  viewGroup,
  openGroupCreate,
  addFriend,
  receiveQuiz,
  viewFriendQuiz,
  receiveQuizScore,
  viewQuizBoard,
} from './social.js';
import { completePurchase, viewBuyFor, acceptToken, maybeShowAfterPurchase, watchClaim, premiumStatus } from './premium.js';

// ---------- ホーム ----------
function viewHome() {
  const parade = [3, 6, 8, 12, 10, 14, 7, 1].map((i) => charaSVG(i, { size: 100 })).join('');
  const mine = store.get('mine', null);
  const pendingGroup = store.get('pendingGroup', null);
  const canContinue = !!savedQuickAnswers() && !store.get('mineDetail', null);
  render(`
    ${inviteBanner()}
    ${pendingGroup ? '<div class="invite"><div>グループ診断に参加するには、まず診断してね</div></div>' : ''}
    <section class="hero">
      <h1><small>${esc(SITE.name)}</small>${esc(SITE.quizName)}</h1>
      <p class="catch">${esc(SITE.catchCopy)}</p>
      <div class="parade" aria-hidden="true">${parade}</div>
      <button class="btn" data-go="#/q">かんたん診断（${QUESTIONS.length}問・約1分）</button>
      <button class="btn type" data-go="#/d">${canContinue
        ? `くわしい診断の続き（あと${PARAM_QUESTIONS.length}問）`
        : `くわしい診断（${QUESTIONS.length + PARAM_QUESTIONS.length}問・約4分）`}</button>
      <p class="hint center">くわしい診断では、二つ名・恋愛タイプ・10項目のステータスまでわかります</p>
      <div class="meta-row"><span class="pill">16タイプ＋隠し${HIDDEN.length}タイプ</span><span class="pill">二つ名240通り</span><span class="pill">登録なし・無料</span></div>
    </section>
    ${mine && TYPES[mine.index] && mine.code ? `<a class="card mini-result" href="#/r/${esc(mine.code)}/${esc(mine.shareId)}">
      ${charaSVG(mine.index, { size: 64 })}<div><small>前回のあなた</small><b>${esc(TYPES[mine.index].label)}</b></div><span>結果を見る →</span></a>` : ''}
    <section class="card features">
      <h2>できること</h2>
      <ul>
        <li><b>16タイプ＋隠し${HIDDEN.length}タイプ</b>　性格・恋愛・友達・学校・トリセツまで解説</li>
        <li><b>二つ名とステータス</b>　「ヤキモチ焼きの既読スルー職人」みたいな、あなただけの肩書き</li>
        <li><b>ふたりの相性・わたしクイズ</b>　友達や好きな人と遊べる</li>
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
  watchClaim(() => location.reload());
  maybeShowAfterPurchase();
}

// ---------- 説明・法定表記 ----------
function viewAbout() {
  render(`
    ${brand()}
    <div class="card"><h2>このサイトについて</h2>
      <p>${esc(SITE.quizName)}は、かんたん診断（${QUESTIONS.length}問）で“愛すべきポンコツ”タイプを16種類（＋隠しタイプ${HIDDEN.length}種類）に分け、くわしい診断（＋${PARAM_QUESTIONS.length}問）で二つ名・恋愛タイプ・ステータスを出すエンタメの心理テストです。心理学的な検査や占いではありません。</p>
      <p>回答や個人を特定する情報は集めていません。集計しているのは、診断結果のタイプとボタンが押された回数だけです（レア度の表示に使います）。</p>
      <p>相性のおさそいリンクやわたしクイズのリンクには、あなたが入れたニックネームと診断結果（クイズは答えの番号）だけが入ります。グループ診断では、ニックネームとタイプをグループのページに表示します。グループは作成から90日で見られなくなります。</p>
      <p>結果画像のスクリーンショット、動画での紹介、配信での利用は自由です。</p>
    </div>
    ${foot()}`);
}

async function viewLegal() {
  const s = SITE.seller;
  const plans = (await premiumStatus()).plans || [];
  const priceOf = (id) => plans.find((p) => p.id === id)?.price;
  render(`
    ${brand()}
    <div class="card"><h2>特定商取引法に基づく表記</h2>
      <dl class="facts confirm">
        <dt>販売事業者</dt><dd>${esc(s.name)}</dd>
        <dt>所在地・電話番号</dt><dd>${esc(s.address)}</dd>
        <dt>お問い合わせ</dt><dd>${esc(s.contact)}</dd>
        <dt>販売価格</dt><dd>完全版（じぶん用）${priceOf('solo') ?? SITE.premiumPrice}円（税込）${priceOf('duo') ? `、完全版（ふたり用）${priceOf('duo')}円（税込）` : ''}</dd>
        <dt>商品代金以外の費用</dt><dd>インターネット接続にかかる通信料</dd>
        <dt>支払方法</dt><dd>クレジットカード、Apple Pay、Google Pay、PayPayなど（決済サービス Stripe で表示されるもの）</dd>
        <dt>支払時期</dt><dd>ご注文時に決済されます</dd>
        <dt>提供時期</dt><dd>決済完了後、すぐにご利用いただけます</dd>
        <dt>返品・キャンセル</dt><dd>デジタルコンテンツの性質上、購入後の返品・キャンセルはできません。18歳未満の方の購入で保護者からお申し出があった場合は、全額返金します</dd>
        <dt>動作環境</dt><dd>最新版の Safari・Chrome。購入情報はご利用の端末のブラウザに保存されます（引き継ぎリンクでほかの端末でも読めます）</dd>
      </dl>
      <p class="hint">18歳未満の方は、保護者の同意を得てからご購入ください。おうちの人のスマホから支払ってもらうこともできます。</p>
    </div>
    ${foot()}`);
}

function viewBuyDone() {
  render(`${brand()}<section class="card"><h1 class="sheet-title">お支払いが完了しました</h1>
    <p>お子さまのスマホで、完全版が自動的に開きます。開かないときは、下の案内の「引き継ぎリンク」を送ってください。</p></section>${foot()}`);
  maybeShowAfterPurchase();
}

// ---------- ルーティング ----------
async function route() {
  closeModal();
  cancelQuiz();
  const page = document.body.dataset.page;
  const hash = location.hash || (document.body.dataset.type ? `#/t/${document.body.dataset.type}` : '#/');
  const [, view, a, b, c, d] = hash.split('/');
  if (view === 'q') startQuiz('quick');
  else if (view === 'd') startQuiz('detail');
  else if (view === 'r') {
    const r = decodeResult(a);
    if (!r) viewHome();
    else if (r.mode === 'detail') viewReport(r, b || 'x');
    else viewResult(r, b || 'x');
  } else if (view === 't') {
    const index = indexFromNo(a);
    if (index < 0 || !viewType(index)) viewZukan();
  } else if (view === 'zukan') viewZukan();
  else if (view === 'pair') viewPair(a, b, decodeURIComponent(c || ''), decodeURIComponent(d || ''));
  else if (view === 'g') viewGroup(a);
  else if (view === 'fq') viewFriendQuiz();
  else if (view === 'qs') {
    if (receiveQuizScore(a, b)) toast('クイズの結果が届きました');
    history.replaceState(null, '', `${location.pathname}#/qboard`);
    viewQuizBoard();
  } else if (view === 'qboard') viewQuizBoard();
  else if (view === 'buy' && a === 'done') viewBuyDone();
  else if (view === 'buy' && /^[a-z0-9]{16}$/.test(a || '')) viewBuyFor(a, render);
  else if (view === 'unlock') {
    const ok = await acceptToken(decodeURIComponent(a || ''));
    toast(ok ? '完全版が開きました' : 'リンクを確認できませんでした');
    const mine = store.get('mine', null);
    history.replaceState(null, '', `${location.pathname}${mine?.code ? `#/r/${mine.code}/${mine.shareId}` : '#/'}`);
    route();
  } else if (view === 'about') viewAbout();
  else if (view === 'legal') viewLegal();
  else if (!location.hash && page === 'thanks') location.replace(await completePurchase(new URLSearchParams(location.search).get('sid') || ''));
  else viewHome();
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
  if (handleQuizClick(e)) return;
  delegate(e);
});
// モーダルの中のボタン（共有・画面遷移）も同じ扱いにする
document.getElementById('modal').addEventListener('click', delegate);

// 静的な着地ページ（/i/ /k/ /p/ /g/）から来たときの初期化
(function boot() {
  const params = new URLSearchParams(location.search);
  const page = document.body.dataset.page;
  if (params.has('s')) track('ref', '1');
  if (page === 'invite' && !location.hash && receiveInvite(params)) {
    history.replaceState(null, '', `${location.pathname}#/`);
  }
  if (page === 'quiz' && !location.hash && receiveQuiz(params)) {
    history.replaceState(null, '', `${location.pathname}#/fq`);
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
