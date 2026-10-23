// 入口：ホーム・ルーティング。質問・結果・レポート・ふたり/グループ・完全版は別モジュール。
import './fonts.js';
import { SITE } from './config.js';
import { TYPES, HIDDEN, QUESTIONS, PARAM_QUESTIONS, indexFromNo } from './data.js';
import { decodeResult } from './logic.js';
import { charaSVG } from './chara.js';
import { app, esc, store, track, render, foot, brand, toast, handleShareClick, closeModal, navBegin, navNow, safeDecode } from './ui.js';
import { startQuiz, handleQuizClick, cancelQuiz, savedQuickAnswers } from './quiz.js';
import { viewResult, viewType, viewZukan, showLockedType } from './result.js';
import { viewReport } from './report.js';
import { viewAdmin } from './admin.js';
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
import {
  completePurchase,
  cancelPurchase,
  retryPendingPurchase,
  viewBuyFor,
  acceptToken,
  acceptGift,
  maybeShowAfterPurchase,
  watchClaim,
  premiumStatus,
  priceOf,
  methodsText,
} from './premium.js';

// ---------- ホーム ----------
async function viewHome() {
  const gen = navNow();
  const parade = [3, 6, 8, 12, 10, 14, 7, 1].map((i) => charaSVG(i, { size: 100 })).join('');
  const mine = store.get('mine', null);
  const pendingGroup = store.get('pendingGroup', null);
  const canContinue = !!savedQuickAnswers() && !store.get('mineDetail', null);
  const price = priceOf(await premiumStatus());
  if (gen !== navNow()) return;
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
      <p class="hint center">くわしい診断では、二つ名・恋愛タイプ・10項目のステータスのランクまで無料でわかります（数値とくわしい解説は完全版・${price}円）</p>
      <div class="meta-row"><span class="pill">16タイプ＋隠し${HIDDEN.length}タイプ</span><span class="pill">二つ名240通り</span><span class="pill">診断は無料・登録なし</span></div>
    </section>
    ${mine && TYPES[mine.index] && mine.code ? `<a class="card mini-result" href="#/r/${esc(mine.code)}/${esc(mine.shareId)}">
      ${charaSVG(mine.index, { size: 64 })}<div><small>前回のあなた</small><b>${esc(TYPES[mine.index].label)}</b></div><span>結果を見る →</span></a>` : ''}
    <section class="card features">
      <h2>できること</h2>
      <ul>
        <li><b>16タイプ＋隠し${HIDDEN.length}タイプ</b>　性格・恋愛・友達・学校・トリセツまで解説</li>
        <li><b>二つ名とステータス</b>　「ヤキモチ焼きの既読スルー職人」みたいな、240通りから決まる肩書き</li>
        <li><b>ふたりの相性・わたしクイズ</b>　友達や好きな人と遊べる</li>
        <li><b>グループ診断</b>　仲良しグループや部活の役割分担（幹事役・癒やし担当…）がわかる</li>
      </ul>
    </section>
    <section class="card secret-teaser"><h2>隠しタイプは${HIDDEN.length}種類</h2>
      <div class="silhouettes">${HIDDEN.map((h) => charaSVG(h.index, { size: 72 })).join('')}</div>
      <p class="hint">特定の答え方をした人だけが出会えるレアタイプ。いちばんレアなタイプは、計算上の出現率が1%以下。</p>
    </section>
    <button class="btn sub" data-group-create>グループ診断をつくる</button>
    ${foot()}`);
  app.querySelector('[data-group-create]').addEventListener('click', openGroupCreate);
  watchClaim(() => route());
  maybeShowAfterPurchase();
}

// ---------- 説明・法定表記 ----------
function viewAbout() {
  render(`
    ${brand()}
    <div class="card"><h2>このサイトについて</h2>
      <p>${esc(SITE.quizName)}は、かんたん診断（${QUESTIONS.length}問）で“愛すべきポンコツ”タイプを16種類（＋隠しタイプ${HIDDEN.length}種類）に分け、くわしい診断（＋${PARAM_QUESTIONS.length}問）で二つ名・恋愛タイプ・ステータスを出すエンタメ診断です。心理学にもとづく検査や、占いではありません。</p>
      <p>回答や個人を特定する情報は集めていません。集計しているのは、診断結果のタイプとボタンが押された回数だけです（レア度の表示に使います）。</p>
      <p>完全版を表示するときは、くわしい診断のパラメータの点数（6つの数字）をサーバーに送ります。保存はしません。お支払いの情報は決済サービスの Stripe が扱い、このサイトはカード番号を受け取りません。</p>
      <p>相性のおさそいリンクやわたしクイズのリンクには、あなたが入れたニックネームと診断結果（クイズは答えの番号）だけが入ります。グループ診断では、ニックネームとかんたん診断のタイプをグループのページに表示します。グループは作成から90日で消えます。グループを作った人はメンバーを外したりグループを消したりでき、メンバーは自分で抜けられます。</p>
      <p>結果画像のスクリーンショット、動画での紹介、配信での利用は自由です。</p>
    </div>
    ${foot()}`);
}

async function viewLegal() {
  const gen = navNow();
  const s = SITE.seller;
  const status = await premiumStatus();
  if (gen !== navNow()) return;
  const duo = status.plans?.find((p) => p.id === 'duo' && p.available);
  render(`
    ${brand()}
    <div class="card"><h2>特定商取引法に基づく表記</h2>
      <dl class="facts confirm">
        <dt>販売事業者</dt><dd>${esc(s.name)}</dd>
        <dt>所在地・電話番号</dt><dd>${esc(s.address)}</dd>
        <dt>お問い合わせ</dt><dd>${esc(s.contact)}</dd>
        <dt>販売価格</dt><dd>完全版（じぶん用）${priceOf(status)}円（税込）${duo ? `、完全版（ふたり用）${duo.price}円（税込）` : ''}</dd>
        <dt>商品代金以外の費用</dt><dd>インターネット接続にかかる通信料</dd>
        <dt>支払方法</dt><dd>${esc(methodsText(status))}（決済サービス Stripe を使います）</dd>
        <dt>支払時期</dt><dd>ご注文時（決済画面でお支払いを確定した時点）に決済されます</dd>
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
    <p>お子さまのスマホで、完全版が読めるようになりました。表示が変わらないときは、お子さまにページを開き直してもらってください。</p></section>${foot()}`);
  maybeShowAfterPurchase();
}

// 決済から戻ってきたページ（/thanks/）。受け取れなかったら、ここで再試行できるようにする
const THANKS_ERRORS = {
  unpaid: 'お支払いがまだ完了していません。決済の画面でお支払いを終えてから、もう一度確かめてください。',
  revoked: 'この購入は返金済みのため、完全版は読めません。',
  expired: '購入から24時間を過ぎたため、このページからは受け取れません。購入した端末の引き継ぎリンクを使うか、お問い合わせください。',
  bad_session: 'お支払いの情報が見つかりませんでした。',
};
async function viewThanks(sid) {
  render(`${brand()}<section class="card center"><h1 class="sheet-title">お支払いを確かめています…</h1></section>`);
  const res = await completePurchase(sid);
  if (res.ok) {
    location.replace(res.url);
    return;
  }
  render(`${brand()}<section class="card">
    <h1 class="sheet-title">完全版を受け取れませんでした</h1>
    <p>${esc(THANKS_ERRORS[res.error] || '通信がうまくいきませんでした。お支払いが終わっていれば、もう一度確かめると受け取れます。このページを閉じても、次にこのサイトを開いたときに自動で確かめます。')}</p>
    <button class="btn" data-retry>もう一度確かめる</button>
    <p class="hint">それでも受け取れないときは、お支払いのときのメールアドレスを添えて、${esc(SITE.seller.contact)} までご連絡ください。</p>
  </section>${foot()}`);
  app.querySelector('[data-retry]').addEventListener('click', () => viewThanks(sid));
}

// ---------- ルーティング ----------
async function route() {
  navBegin();
  closeModal();
  cancelQuiz();
  try {
    await routeInner();
  } catch {
    // 壊れたリンクなどで描けなかったときは、トップに戻す
    viewHome();
  }
}

async function routeInner() {
  const page = document.body.dataset.page;
  const hash = location.hash || (document.body.dataset.type ? `#/t/${document.body.dataset.type}` : '#/');
  const [, view, a, b, c, d] = hash.split('/');
  if (view === 'q') startQuiz('quick');
  else if (view === 'd') startQuiz('detail');
  else if (view === 'r') {
    const r = decodeResult(a);
    if (!r) await viewHome();
    else if (r.mode === 'detail') await viewReport(r, b || 'x');
    else await viewResult(r, b || 'x');
  } else if (view === 't') {
    const index = indexFromNo(a);
    if (index < 0) viewZukan();
    else if (!viewType(index)) {
      // まだ出会っていない隠しタイプ：図鑑を描いてから「まだ秘密」を重ねる
      viewZukan();
      showLockedType(index);
      history.replaceState(null, '', `${location.pathname}${location.search}#/zukan`);
    }
  } else if (view === 'zukan') viewZukan();
  else if (view === 'pair') viewPair(a, b, safeDecode(c), safeDecode(d));
  else if (view === 'g') await viewGroup(a);
  else if (view === 'fq') viewFriendQuiz();
  else if (view === 'qs') {
    if (receiveQuizScore(a, b)) toast('クイズの結果が届きました');
    history.replaceState(null, '', `${location.pathname}#/qboard`);
    viewQuizBoard();
  } else if (view === 'qboard') viewQuizBoard();
  else if (view === 'buy' && a === 'done') viewBuyDone();
  else if (view === 'buy' && /^[a-z2-7]{16}$/.test(a || '')) await viewBuyFor(a, render);
  else if (view === 'unlock' || view === 'gift') {
    const t = safeDecode(a);
    let msg;
    if (view === 'gift') {
      const r = await acceptGift(t);
      msg = { ok: 'プレゼントを受け取りました。完全版が開きます', used: 'このプレゼントは、もう受け取られています' }[r] || 'リンクを確認できませんでした';
    } else msg = (await acceptToken(t)) ? '完全版が開きました' : 'リンクを確認できませんでした';
    toast(msg);
    const mine = store.get('mine', null);
    history.replaceState(null, '', `${location.pathname}${mine?.code ? `#/r/${mine.code}/${mine.shareId}` : '#/'}`);
    route();
  } else if (view === 'admin') await viewAdmin();
  else if (view === 'about') viewAbout();
  else if (view === 'legal') await viewLegal();
  else if (!location.hash && page === 'types') {
    // 全タイプ一覧は、書き出した静的なページをそのまま使う
  } else if (!location.hash && page === 'thanks') {
    const params = new URLSearchParams(location.search);
    if (params.has('canceled')) location.replace(cancelPurchase());
    else await viewThanks(params.get('sid') || '');
  } else await viewHome();
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
  // 決済のあと受け取れていない購入があれば、もう一度確かめる
  if (page !== 'thanks') {
    retryPendingPurchase().then((ok) => {
      if (!ok) return;
      toast('完全版を受け取りました');
      route();
    });
  }
})();

window.addEventListener('hashchange', route);
route();
