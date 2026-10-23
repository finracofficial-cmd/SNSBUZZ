// 完全版（有料）まわり。本文はサーバー（/api/premium）だけが持ち、購入トークンを持つ人にだけ返す。
//   ・購入：自社の確認画面（特商法の最終確認画面の6項目）→ Stripe Checkout → /thanks/ で受け取る
//     （受け取りに失敗しても、Webhook が購入を記録しているので、もう一度確かめれば受け取れる）
//   ・おうちの人に払ってもらう：受け取りID付きのリンクを送る → 親が払う → 子どもの端末が自動で受け取る
//     （受け取りIDは子どもの端末だけが持つ秘密のハッシュ。リンクが転送されても、ほかの人は受け取れない）
//   ・別の端末へ：引き継ぎリンク（トークン入り）／コード入力。ブラウザのデータが消えても、Cookie から戻せる
//   ・ふたり用：プレゼント券のリンク。最初に開いた1人だけが受け取れる
// 決済が未設定の環境では「準備中」として、中身の一覧と見本だけを見せる。
import { SITE } from './config.js';
import { TYPES } from './data.js';
import { ORIGIN, esc, store, api, toast, openModal, closeModal, track, copyText, inAppBrowser, navNow } from './ui.js';
import { abTrack, abTag, abCode, abTagOfCode } from './ab.js';
import { quizActive } from './quiz.js';

const METHOD_NAMES = { card: 'クレジットカード（Apple Pay・Google Pay をふくむ）', paypay: 'PayPay' };
const FALLBACK = { enabled: false, plans: [{ id: 'solo', price: SITE.premiumPrice, name: 'じぶん用', available: false }], methods: ['card'] };

// 販売状況。取れなかったときは30秒だけ「準備中」として扱い、そのあと呼ばれたら取り直す
let statusPromise;
export const premiumStatus = () =>
  (statusPromise ??= api('premium/status').then((s) => {
    if (s && !s.error) return s;
    setTimeout(() => (statusPromise = null), 30000);
    return FALLBACK;
  }));
export const methodsText = (s) => (s.methods || ['card']).map((m) => METHOD_NAMES[m]).filter(Boolean).join('・');
export const priceOf = (s, id = 'solo') => s.plans?.find((p) => p.id === id)?.price ?? SITE.premiumPrice;

export const token = () => store.get('premiumToken', null);
export const hasPremium = () => !!token();
// キャンペーンのコード（期限つき）ではなく、購入・プレゼントで持っているトークン
const lastingToken = () => (/^v1\.(?!promo-)/.test(token() || '') ? token() : null);

// 静的プレビュー（APIなし）でだけ使う見本データ
const preview = () => globalThis.PZ_PREVIEW_PREMIUM || null;
let previewFlag = false;
export function previewUnlocked() {
  if (!preview()) return false;
  try {
    return previewFlag || sessionStorage.getItem('pz:previewUnlocked') === '1';
  } catch {
    return previewFlag;
  }
}
export function unlockPreview() {
  previewFlag = true;
  try {
    sessionStorage.setItem('pz:previewUnlocked', '1');
  } catch {
    // 保存できなくても、その場では表示できる
  }
}

const PARAM_MAX = 12;
const level = (raw) => {
  const p = Math.round((raw / PARAM_MAX) * 100);
  return p <= 33 ? 0 : p <= 66 ? 1 : 2;
};

// 完全版の中身を取ってくる（くわしい診断なら、その人のパラメータに合った文言も）。
// 返り値: 中身 ／ null（未購入）／ {error}（購入済みだが読みこめなかった。トークンは消さない）
export async function fetchPremium(r) {
  const p = r.paramRaw ? r.paramRaw.map((v) => v.toString(36)).join('') : '';
  if (previewUnlocked()) {
    const pv = preview();
    return {
      type: pv.types[r.index],
      params: r.paramRaw ? r.paramRaw.map((v, k) => pv.params[k][level(v)]) : null,
      love: r.paramRaw ? pv.love[r.love] : null,
    };
  }
  const t = token();
  if (!t) return null;
  const data = await api(`premium?i=${r.index}${p ? `&p=${p}` : ''}`, { token: t, timeout: 6000 });
  if (data?.status === 403) {
    // 返金済み・キャンペーンの終了
    store.set('premiumToken', null);
    toast('この購入では、完全版を読めなくなりました');
    return null;
  }
  return data && !data.error ? data : { error: data?.error || 'network' };
}

// ブラウザのデータが消えていたら、Cookie に残っている購入情報から戻す（1ページにつき1回だけ確かめる）
let restoreTried = false;
export async function restorePurchase() {
  if (hasPremium() || restoreTried || preview()) return false;
  restoreTried = true;
  const res = await api('restore', { timeout: 3000 });
  if (!res?.token) return false;
  store.set('premiumToken', res.token);
  if (res.plan) store.set('plan', res.plan);
  return true;
}

// いまのトークンを Cookie にも入れてもらい、プラン（ふたり用か）を受け取る。
// 引き継ぎリンク・コード・サポートのリンクで開いた端末も、データが消えたときに Cookie から戻せるように。1日1回まで
export async function adoptToken(t = token(), force = false) {
  if (!t || preview()) return;
  const day = new Date().toDateString();
  if (!force && store.get('adoptedOn', null) === day) return;
  const res = await api('adopt', { method: 'POST', token: t });
  if (!res?.ok) return;
  store.set('adoptedOn', day);
  if (res.plan) store.set('plan', res.plan);
}

// ---------- 購入への入口 ----------
const INCLUDES = [
  'パラメータ6項目の数値と、くわしい解説（第1章の見本の続きも）',
  '恋愛タイプの深掘り・恋のアドバイス3つ・相性のいい恋愛タイプの理由',
  '本当のあなた（ポンコツの裏にある本音と強み）',
  'ポンコツを武器にする3つの方法',
  '恋愛の落とし穴と攻略法',
  '2027年の過ごし方ヒント',
  'ひとことエール',
  'シェア画像（ステータスカード・金色の枠の結果カード）と、ロック画面の壁紙',
];
const STORAGE_NOTE =
  '購入した端末のブラウザで、全20タイプ分の完全版が読めます。診断をやり直しても追加料金はかかりません。購入後に出る「引き継ぎリンク」を保存しておくと、機種変更やデータが消えたときも読めます。';
const inAppNote = () =>
  inAppBrowser()
    ? '<p class="hint inapp">アプリの中のブラウザで購入すると、購入情報はそのアプリの中に保存されます。右上の「…」から Safari や Chrome で開いてから購入するのがおすすめです。</p>'
    : '';

let paywallShown = false;
// 説明と購入ボタンのシート。自動で出すのは1回まで（あとはボタンを押したときだけ）
export async function openPaywall(r, { auto = false } = {}) {
  if (auto && (paywallShown || store.get('paywallSeen', false))) return;
  paywallShown = true;
  store.set('paywallSeen', true);
  track('paywall', auto ? 'view' : 'cta');
  if (!auto) abTrack('cta');
  const gen = navNow();
  const s = await premiumStatus();
  if (gen !== navNow()) return;
  const pv = preview();
  const plans = s.plans.filter((p) => p.available);
  const sheet = openModal(`
    <h2 class="sheet-title">完全版で読めること</h2>
    <ul class="includes">${INCLUDES.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <p class="hint">${esc(STORAGE_NOTE)}</p>
    ${s.enabled && plans.length
      ? `<div class="plans">${plans.map((p, k) => `
          <label class="plan ${k === 0 ? 'on' : ''}"><input type="radio" name="plan" value="${p.id}" ${k === 0 ? 'checked' : ''}>
            <b>${esc(p.name)}${p.id === 'duo' ? '<em>友達1人にプレゼントできる</em>' : ''}</b><strong>${p.price}円</strong><small>税込・買い切り・自動更新なし</small></label>`).join('')}</div>
        ${inAppNote()}
        <button class="btn gold" data-buy>購入内容を確認する</button>
        <button class="btn sub" data-ask>おうちの人に払ってもらう</button>`
      : `<p class="price">完全版 <strong>${priceOf(s)}円</strong>（税込・買い切り・自動更新なし）</p>
         <p class="hint center">いまは準備中です。販売が始まったら、このページから購入できます。</p>`}
    ${pv ? '<button class="btn sub" data-preview>（プレビュー用）完全版の中身を見る</button>' : ''}
    <button class="linkish" data-redeem>コード・引き継ぎリンクをお持ちの方</button>
    <button class="linkish" data-close>とじる</button>`);
  sheet.querySelectorAll('.plan input').forEach((i) =>
    i.addEventListener('change', () => sheet.querySelectorAll('.plan').forEach((l) => l.classList.toggle('on', l.contains(i) && i.checked))),
  );
  sheet.querySelector('[data-buy]')?.addEventListener('click', () => {
    const id = sheet.querySelector('.plan input:checked')?.value || 'solo';
    confirmPurchase(r, plans.find((p) => p.id === id), s);
  });
  sheet.querySelector('[data-ask]')?.addEventListener('click', () => askGuardian(s));
  sheet.querySelector('[data-redeem]').addEventListener('click', openRedeem);
  sheet.querySelector('[data-preview]')?.addEventListener('click', () => {
    unlockPreview();
    closeModal();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

// 特定商取引法の「最終確認画面」に必要な6項目を、決済ページへ進む前にまとめて見せる
function confirmPurchase(r, plan, s, rid = '', guardianAb = '') {
  const gift = plan.id === 'duo';
  const sheet = openModal(`
    <h2 class="sheet-title">ご購入内容の確認</h2>
    <dl class="facts confirm">
      <dt>商品</dt><dd>${esc(SITE.quizName)} 完全版（${esc(plan.name)}）。デジタルコンテンツ（くわしい診断のレポート全8章・全${TYPES.length}タイプ分）${gift ? '。友達1人が受け取れるプレゼント用リンクつき' : ''}</dd>
      <dt>数量</dt><dd>1つ</dd>
      <dt>価格</dt><dd>${plan.price}円（税込）。お支払いは1回だけです。月額料金・自動更新・追加料金はありません</dd>
      <dt>支払い方法</dt><dd>${esc(methodsText(s))}（次の画面の決済サービス Stripe で選びます）</dd>
      <dt>支払い時期</dt><dd>次の画面（Stripe）でお支払いを確定した時点</dd>
      <dt>提供時期</dt><dd>お支払いの完了後すぐに、この端末${rid ? '（とお子さまの端末）' : ''}のブラウザで読めます。引き継ぎリンクで、ほかの端末にも移せます</dd>
      <dt>申込みの期限</dt><dd>ありません</dd>
      <dt>キャンセル</dt><dd>デジタルコンテンツのため、購入後の返品・キャンセルはできません。ただし18歳未満の方の購入で保護者から申し出があった場合は、全額返金します</dd>
    </dl>
    ${rid
      ? '<p class="hint">お子さまの診断結果や回答は、このページには表示されません。</p>'
      : `<fieldset class="age"><legend>年齢の確認（必須）</legend>
          <label class="check"><input type="radio" name="age" value="adult"> 18歳以上です</label>
          <label class="check"><input type="radio" name="age" value="minor"> 18歳未満で、保護者の同意を得ています</label>
        </fieldset>`}
    <label class="check"><input type="checkbox" id="agree"> 上の内容と<a href="#/legal" data-close>特定商取引法に基づく表記</a>を確認しました</label>
    <p class="hint">次の画面（Stripe）でお支払いを確定すると、購入が完了します。</p>
    <p class="hint err" id="buy-msg" role="alert"></p>
    <button class="btn gold" id="buy-go">お支払い画面へ進む（${plan.price}円・税込）</button>
    <button class="btn sub" data-close>やめる</button>`);
  sheet.querySelector('#buy-go').onclick = async () => {
    const msg = sheet.querySelector('#buy-msg');
    if ((!rid && !sheet.querySelector('input[name="age"]:checked')) || !sheet.querySelector('#agree').checked) {
      msg.textContent = rid ? '確認のチェックを入れてください' : '年齢の確認と、確認のチェックを入れてください';
      return;
    }
    const button = sheet.querySelector('#buy-go');
    button.disabled = true;
    // おうちの人の支払い（rid あり）は、子どもの端末のA/Bテストの案（リンクに入っている）で数える
    const res = await api('checkout', { method: 'POST', body: { plan: plan.id, index: r?.index ?? null, rid, ab: rid ? guardianAb : abTag() }, timeout: 8000 });
    if (!res?.url) {
      msg.textContent = res?.error === 'rate' ? '少し待ってから、もう一度ためしてください' : 'いまは購入できません。時間をおいて試してください';
      button.disabled = false;
      return;
    }
    track('premium', 'checkout');
    if (!rid) abTrack('checkout');
    // やめて戻ってきたときの戻り先。おうちの人は、おうちの人のページへ（完了の画面には、受け取れたときだけ移る）
    store.set('returnHash', location.hash || '#/');
    // 決済のあと /thanks/ が開かなかったとき（アプリの切りかえ・タブを閉じた）も、次に開いたとき受け取れるように覚えておく
    if (res.id) store.set('pendingSid', { sid: res.id, at: Date.now() });
    location.href = res.url;
  };
}

// ---------- おうちの人に払ってもらう ----------
// 子どもの端末が秘密 s を作り、そのハッシュ（受け取りID）だけをリンクに入れる
const B32 = 'abcdefghijklmnopqrstuvwxyz234567';
const randomSecret = () => Array.from(crypto.getRandomValues(new Uint8Array(26)), (b) => B32[b % 32]).join('');
// functions/_lib/purchase.js の claimIdOf と同じ計算
async function claimIdOf(secret) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`claim:${secret}`))).slice(0, 10);
  const bits = Array.from(bytes, (b) => b.toString(2).padStart(8, '0')).join('');
  return Array.from({ length: 16 }, (_, i) => B32[parseInt(bits.slice(i * 5, i * 5 + 5), 2)]).join('');
}

// おうちの人に送るリンクは作ってから7日で無効（おうちの人のページで販売しない）。
// サーバーは支払いから7日間トークンを預かるので、端末は作ってから14日間まで確かめる。
// 新しくお願いしても、前のお願い（期限内に払われたかもしれない）も確かめられるよう、2つまで残す
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const LINK_DAYS = 7;
const CLAIM_TTL = 14 * DAY;
// リンクに入れる作成時刻（時間単位・36進数）と、期限の表示（「10/30 8:00まで」）
const linkStamp = (at) => Math.floor(at / HOUR).toString(36);
const linkMadeAt = (stamp) => (/^[0-9a-z]{1,7}$/.test(stamp || '') ? parseInt(stamp, 36) * HOUR : null);
const untilText = (madeAt) => {
  const d = new Date(madeAt + LINK_DAYS * DAY);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};
function pendingClaims() {
  const raw = store.get('claims', null) ?? [store.get('claim', null)].filter(Boolean);
  return (Array.isArray(raw) ? raw : [])
    .filter((c) => c && /^[a-z2-7]{26}$/.test(c.s || '') && /^[a-z2-7]{16}$/.test(c.rid || '') && Date.now() - c.at <= CLAIM_TTL)
    .slice(0, 2);
}

async function askGuardian(s) {
  let claims = pendingClaims();
  // 出し直すのは、期限まで2日以上あるリンクだけ（残りわずかのリンクを送らないように）
  let c = claims.find((x) => Date.now() - Math.floor(x.at / HOUR) * HOUR <= (LINK_DAYS - 2) * DAY);
  if (!c) {
    const secret = randomSecret();
    c = { s: secret, rid: await claimIdOf(secret), at: Date.now() };
    claims = [c, ...claims].slice(0, 2);
    store.set('claims', claims);
    store.set('claim', null);
  }
  // リンクには、作った日（期限の確認用）と、この端末のA/Bテストの案を入れる。結果や回答は入れない
  const url = `${ORIGIN}/#/buy/${c.rid}/${linkStamp(c.at)}/${abCode()}`;
  const text = `「${SITE.quizName}」の完全版（${priceOf(s)}円）を買ってもらえませんか？ このリンクから支払うと、このスマホで読めるようになります`;
  track('paywall', 'ask');
  openModal(`
    <h2 class="sheet-title">おうちの人に払ってもらう</h2>
    <p>このリンクをおうちの人に送ってね。おうちの人のスマホで支払いが終わると、<b>このスマホで自動的に完全版が開きます</b>（このページを開いたままでも、あとで開いても大丈夫）。</p>
    <p class="hint">おうちの人には、あなたの診断結果や回答は見えません。リンクは${untilText(Math.floor(c.at / HOUR) * HOUR)}まで有効です。このスマホでしか受け取れないので、ほかの人に転送されても大丈夫です。</p>
    <div class="share-row">
      <button class="share-btn" data-ch="ask:link" data-copy="${esc(`${text}\n${url}`)}">コピー</button>
      <button class="share-btn" data-ch="ask:native" data-native-text="${esc(text)}" data-native-url="${esc(url)}">送る</button>
    </div>
    <button class="btn sub" data-close>とじる</button>`);
  watchClaim(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
}

// おうちの人が開くページ（子どもの回答は見せない）
export async function viewBuyFor(rid, render, created = '', ab = '') {
  const gen = navNow();
  const s = await premiumStatus();
  if (gen !== navNow()) return;
  const plans = s.plans.filter((p) => p.available);
  const madeAt = linkMadeAt(created);
  // 支払い済みのお願いなら、もう一度払わないように知らせる（支払い済みかどうかだけを聞く。トークンは返らない）
  const status = await api(`claim?rid=${rid}`, { timeout: 4000 });
  if (gen !== navNow()) return;
  if (status?.paid) {
    render(`<section class="card">
      <h1 class="sheet-title">このお願いは、もう支払い済みです</h1>
      <p>お子さまのスマホで、完全版が読めるようになっています。表示が変わらないときは、お子さまにページを開き直してもらってください。</p>
      <p class="hint"><a href="#/legal">特定商取引法に基づく表記</a></p>
    </section>`);
    return;
  }
  if (madeAt != null && Date.now() - madeAt > LINK_DAYS * DAY) {
    render(`<section class="card">
      <h1 class="sheet-title">このリンクの期限が切れています</h1>
      <p>お願いのリンクは、作ってから${LINK_DAYS}日間だけ使えます。お手数ですが、お子さまにもう一度リンクを送ってもらってください。</p>
      <p class="hint"><a href="#/legal">特定商取引法に基づく表記</a></p>
    </section>`);
    return;
  }
  render(`
    <section class="card">
      <h1 class="sheet-title">${esc(SITE.quizName)} 完全版のご案内</h1>
      <p>お子さまから、完全版の購入のお願いが届いています。支払いが終わると、お子さまのスマホで完全版が読めるようになります。</p>
      <ul class="includes">${INCLUDES.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <p class="hint">${esc(SITE.quizName)}は、20タイプの“ポンコツ”を笑って楽しむエンタメ診断です。心理学にもとづく検査や占いではなく、未来を言い当てる内容もふくみません。</p>
      ${s.enabled && plans.length
        ? `<p class="price"><strong>${plans[0].price}円</strong>（税込・買い切り・自動更新なし）</p>
           <button class="btn gold" data-buy-for>購入内容を確認する</button>`
        : '<p class="hint center">いまは販売の準備中です。</p>'}
      <p class="hint"><a href="#/legal">特定商取引法に基づく表記</a></p>
    </section>`);
  document.querySelector('[data-buy-for]')?.addEventListener('click', () => confirmPurchase(null, plans[0], s, rid, abTagOfCode(ab)));
}

// 子どもの端末：おうちの人の支払いが終わったか確かめる（開いている間だけ、ときどき）。
// コールバックは最後に登録したものを使う（画面を移っていても、いまの画面を描き直す）
let claimTimer = null;
let claimDone = null;
export function watchClaim(onUnlocked) {
  claimDone = onUnlocked;
  if (!pendingClaims().length || hasPremium() || claimTimer) return;
  const started = Date.now();
  const stop = () => {
    clearInterval(claimTimer);
    claimTimer = null;
  };
  const tick = async () => {
    if (document.visibilityState === 'visible') {
      for (const c of pendingClaims()) {
        const res = await api(`claim?s=${c.s}`, { timeout: 4000 });
        if (!res?.token) continue;
        store.set('premiumToken', res.token);
        store.set('claims', null);
        store.set('claim', null);
        stop();
        adoptToken(res.token, true);
        // 診断の途中なら、知らせるだけにして画面は描き直さない（答えが消えないように）
        toast(quizActive() ? 'おうちの人の支払いが終わりました。診断のあとで完全版が読めます' : 'おうちの人の支払いが終わりました。完全版が開きます');
        if (!quizActive()) claimDone?.();
        return;
      }
    }
    if (Date.now() - started > 15 * 60 * 1000) stop();
  };
  claimTimer = setInterval(tick, 5000);
  tick();
}

// ---------- 引き継ぎ・プレゼント・コード ----------
export const transferUrl = (t) => `${ORIGIN}/#/unlock/${encodeURIComponent(t)}`;
const giftUrl = (g) => `${ORIGIN}/#/gift/${encodeURIComponent(g)}`;

// 引き継ぎリンク・サポートのリンク。この端末にもう読める購入があれば、置きかえない
// 返り値: 'ok' / 'same'（同じもの）/ 'has'（ほかの有効な購入を持っている）/ 'invalid'
export async function acceptToken(t) {
  if (!/^v1\.[\w-]{4,100}\.[\w-]{20,}$/.test(t || '')) return 'invalid';
  const current = lastingToken();
  if (token() === t) return 'same';
  if (current) {
    const mine = await api('premium?i=0', { token: current });
    if (mine && !mine.error) return 'has';
  }
  const check = await api('premium?i=0', { token: t });
  if (!check || check.error) return 'invalid';
  store.set('premiumToken', t);
  await adoptToken(t, true);
  return 'ok';
}

// プレゼント券を、自分の購入トークンと交換する（最初の1人だけ）。開いただけでは交換せず、ボタンを押したときだけ呼ぶ
// 返り値: 'ok' / 'used'（もう受け取られた）/ 'own'（買った本人）/ 'has'（もう完全版を持っている）/ 'invalid'
export async function acceptGift(g) {
  if (!/^v1\.gift-[\w-]{4,100}\.[\w-]{20,}$/.test(g || '')) return 'invalid';
  const res = await api('gift', { method: 'POST', body: { gift: g }, token: token() || undefined });
  if (res?.token) {
    store.set('premiumToken', res.token);
    store.set('plan', 'solo');
    return 'ok';
  }
  return ['used', 'own', 'has'].includes(res?.error) ? res.error : 'invalid';
}
export const GIFT_MESSAGES = {
  ok: 'プレゼントを受け取りました。完全版が開きます',
  used: 'このプレゼントは、もう受け取られています',
  own: 'これは、あなたが友達に贈るプレゼントのリンクです。受け取ってほしい友達に送ってね',
  has: 'この端末では、もう完全版が読めます。このリンクは、まだ持っていない友達に送ってね',
  invalid: 'リンクを確認できませんでした',
};

// プレゼントのリンクを開いたページ。受け取りはボタンを押してから（買った本人が確かめに開いても、消えないように）
export async function viewGift(g, { render, brand, foot }) {
  const gen = navNow();
  // 持っているトークンが、返金などでもう読めないものなら「持っていない」扱いにする
  let mine = !!lastingToken();
  if (mine) {
    const check = await api('premium?i=0', { token: lastingToken() });
    if (gen !== navNow()) return;
    if (check?.status === 401 || check?.status === 403) mine = false;
  }
  render(`${brand()}<section class="card center gift-page">
    <h1 class="sheet-title">完全版のプレゼントが届いています</h1>
    <p>${esc(SITE.quizName)}の完全版（くわしい診断のレポート全8章）を、友達が贈ってくれました。<b>受け取れるのは1人だけ</b>です。</p>
    ${mine
      ? `<p class="hint">${esc(GIFT_MESSAGES.has)}</p><a class="btn sub" href="#/">トップへ</a>`
      : '<button class="btn gold" data-accept-gift>受け取る</button><p class="hint">受け取ると、このブラウザで完全版が読めるようになります。</p>'}
  </section>${foot()}`);
  const button = document.querySelector('[data-accept-gift]');
  button?.addEventListener('click', async () => {
    button.disabled = true;
    const r = await acceptGift(g);
    toast(GIFT_MESSAGES[r]);
    if (r !== 'ok') {
      button.disabled = false;
      return;
    }
    const m = store.get('mine', null);
    location.hash = m?.code ? `#/r/${m.code}/${m.shareId}` : '#/d';
  });
}

function openRedeem() {
  const sheet = openModal(`
    <h2 class="sheet-title">コード・引き継ぎリンクで開く</h2>
    <p class="hint">キャンペーンのコード、またはほかの端末で表示した引き継ぎリンク・プレゼントのリンクを貼りつけてください。</p>
    <label class="field">コード・リンク<input id="code" maxlength="300" autocomplete="off"></label>
    <p class="hint err" id="redeem-msg" role="alert"></p>
    <button class="btn" id="redeem-go">開く</button>
    <p class="hint">購入した端末で読めなくなったときは、お支払いのときのメールアドレスを添えて、${esc(SITE.seller.contact)} までご連絡ください。決済の記録を確かめて、引き継ぎリンクをお送りします。</p>
    <button class="btn sub" data-close>とじる</button>`);
  sheet.querySelector('#redeem-go').onclick = async () => {
    const raw = sheet.querySelector('#code').value.trim();
    const link = /#\/(unlock|gift)\/([^\s/]+)/.exec(raw);
    let candidate = raw;
    if (link) {
      try {
        candidate = decodeURIComponent(link[2]);
      } catch {
        candidate = '';
      }
    }
    let ok = false;
    let msg = 'コードを確認できませんでした';
    if (candidate.startsWith('v1.gift-')) {
      const r = await acceptGift(candidate);
      ok = r === 'ok';
      if (!ok) msg = GIFT_MESSAGES[r];
    } else if (candidate.startsWith('v1.')) {
      const r = await acceptToken(candidate);
      ok = r === 'ok' || r === 'same';
      if (r === 'has') msg = 'この端末では、もう完全版が読めます';
    } else {
      const res = await api('redeem', { method: 'POST', body: { code: candidate } });
      if (res?.token) {
        store.set('premiumToken', res.token);
        ok = true;
      } else if (res?.error === 'rate') msg = '少し待ってから、もう一度ためしてください';
    }
    if (!ok) {
      sheet.querySelector('#redeem-msg').textContent = msg;
      return;
    }
    closeModal();
    toast('完全版が開きました');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
}

// 自分用の引き継ぎリンク（ほかの端末・データが消えたとき用）
function transferBox(forChild) {
  return `<div class="card"><h2>${forChild ? 'お子さまの端末で開かないとき' : '引き継ぎリンク（保存しておいてね）'}</h2>
    <p class="hint">${forChild
      ? 'このリンクをお子さまに送ると、お子さまの端末でも読めます。お子さま以外には送らないでください。'
      : 'このリンクを開くと、ほかの端末でも読めます。機種変更やブラウザのデータが消えたときのために、スクリーンショットやメモに保存してね。ほかの人には送らないでください。'}</p>
    <button class="btn sub small" data-copy-transfer>引き継ぎリンクをコピー</button></div>`;
}

// ふたり用：友達へのプレゼントのリンク（何度でも出し直せる）
export async function openGift() {
  const t = token();
  if (!t) return;
  const res = await api('gift', { token: t });
  if (!res?.gift) {
    toast('プレゼントのリンクを読みこめませんでした');
    return;
  }
  const text = `${SITE.quizName}の完全版をプレゼント！ このリンクを開くと読めるよ（1人だけ受け取れます）`;
  openModal(`
    <h2 class="sheet-title">友達へのプレゼント</h2>
    ${res.used
      ? '<p><b>プレゼントは受け取られました。</b></p>'
      : '<p>このリンクを友達1人に送ると、その友達も完全版を読めます。<b>最初に開いた1人だけ</b>が受け取れるので、送る相手にだけ送ってね。</p>'}
    ${res.used ? '' : `<div class="share-row">
      <button class="share-btn" data-ch="gift:link" data-copy="${esc(`${text}\n${giftUrl(res.gift)}`)}">コピー</button>
      <button class="share-btn" data-ch="gift:native" data-native-text="${esc(text)}" data-native-url="${esc(giftUrl(res.gift))}">送る</button>
    </div>`}
    <button class="btn sub" data-close>とじる</button>`);
}

// 購入後に見せる：引き継ぎリンクと、ふたり用ならプレゼント
export function showAfterPurchase({ forChild = false, plan = 'solo', otherBrowser = false } = {}) {
  const t = token();
  if (!t) return;
  const sheet = openModal(`
    <h2 class="sheet-title">ありがとうございます</h2>
    ${forChild
      ? '<p><b>お子さまのスマホで、完全版が読めるようになりました。</b>表示が変わらないときは、お子さまにページを開き直してもらってください。</p>'
      : '<p>この端末で完全版が読めるようになりました。</p>'}
    ${otherBrowser && !forChild
      ? '<p class="hint inapp">購入を始めたのとは別のブラウザで開いています。LINE やインスタの中で購入した場合は、下の引き継ぎリンクをコピーして、そのアプリのトークやメモに貼って開くと、元の場所でも読めます。</p>'
      : ''}
    ${plan === 'duo' && !forChild ? '<button class="btn type" data-gift>友達へのプレゼントのリンクを出す</button>' : ''}
    ${transferBox(forChild)}
    <button class="btn" data-close>とじる</button>`);
  sheet.querySelector('[data-copy-transfer]').onclick = () => copyText(transferUrl(t));
  sheet.querySelector('[data-gift]')?.addEventListener('click', openGift);
}

export const hasGift = () => store.get('plan', null) === 'duo';

// 決済から戻ってきたとき（/thanks/?sid=...）。成功したら戻り先のURLを返す。
// 失敗しても sid を覚えておき、もう一度確かめられるようにする（次にサイトを開いたときも自動で確かめる）
export async function completePurchase(sid, { fromThanks = false } = {}) {
  if (!/^cs_\w{10,200}$/.test(sid || '')) return { ok: false, error: 'bad_session' };
  const pending = store.get('pendingSid', null);
  if (pending?.sid !== sid) store.set('pendingSid', { sid, at: Date.now() });
  const res = await api(`unlock?sid=${encodeURIComponent(sid)}`, { timeout: 10000 });
  if (!res?.token) {
    // 返金済み・期限切れ・ほかの商品なら、もう確かめない
    if (['revoked', 'expired', 'not_ours', 'bad_session'].includes(res?.error) || res?.session === 'expired') store.set('pendingSid', null);
    return { ok: false, error: res?.error || 'network' };
  }
  store.set('premiumToken', res.token);
  store.set('plan', res.plan || 'solo');
  store.set('pendingSid', null);
  const back = store.get('returnHash', null);
  store.set('returnHash', null);
  // おうちの人の端末に、支払いを受けつけた印を残す（時間では消さない。完了の画面をあとで開き直しても「完了」と出す）
  if (res.forChild) store.set('childPaid', { at: Date.now() });
  // returnHash がない＝購入を始めたのとは別のブラウザで /thanks/ が開いた
  store.set('afterPurchase', { forChild: !!res.forChild, plan: res.plan || 'solo', otherBrowser: fromThanks && !back });
  return { ok: true, url: res.forChild ? '/#/buy/done' : `/${back || '#/'}` };
}

// 受け取れていない購入があれば、もう一度確かめる（24時間まで）
// 決済の画面へ移ったまま /thanks/ に戻らなかった購入も、ここで受け取る（起動時と、アプリから戻ってきたとき。1分に1回まで）
let lastRetry = 0;
export async function retryPendingPurchase() {
  const p = store.get('pendingSid', null);
  if (!p || Date.now() - lastRetry < 60 * 1000) return false;
  if (Date.now() - p.at > 24 * 3600 * 1000) {
    store.set('pendingSid', null);
    return false;
  }
  lastRetry = Date.now();
  return (await completePurchase(p.sid)).ok;
}

// 決済をやめて戻ってきたとき
export function cancelPurchase() {
  const back = store.get('returnHash', '#/');
  store.set('returnHash', null);
  store.set('pendingSid', null);
  return `/${back}`;
}

// ページを開いたときに、購入直後の案内を一度だけ出す
export function maybeShowAfterPurchase() {
  const a = store.get('afterPurchase', null);
  if (!a) return;
  store.set('afterPurchase', null);
  setTimeout(() => showAfterPurchase(a), 300);
}
