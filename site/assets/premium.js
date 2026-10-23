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
  return true;
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
  'シェア画像（ステータスカード・金色の枠の結果カード）',
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
function confirmPurchase(r, plan, s, rid = '') {
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
    const res = await api('checkout', { method: 'POST', body: { plan: plan.id, index: r?.index ?? null, rid }, timeout: 8000 });
    if (!res?.url) {
      msg.textContent = res?.error === 'rate' ? '少し待ってから、もう一度ためしてください' : 'いまは購入できません。時間をおいて試してください';
      button.disabled = false;
      return;
    }
    track('premium', 'checkout');
    store.set('returnHash', rid ? '#/buy/done' : location.hash || '#/');
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

// 受け取りIDは7日で無効（サーバー側の claims と同じ期限）
const CLAIM_TTL = 7 * 24 * 3600 * 1000;
function currentClaim() {
  const c = store.get('claim', null);
  if (!c || !/^[a-z2-7]{26}$/.test(c.s || '') || !/^[a-z2-7]{16}$/.test(c.rid || '') || Date.now() - c.at > CLAIM_TTL) return null;
  return c;
}

async function askGuardian(s) {
  let c = currentClaim();
  if (!c) {
    const secret = randomSecret();
    c = { s: secret, rid: await claimIdOf(secret), at: Date.now() };
    store.set('claim', c);
  }
  const url = `${ORIGIN}/#/buy/${c.rid}`;
  const text = `「${SITE.quizName}」の完全版（${priceOf(s)}円）を買ってもらえませんか？ このリンクから支払うと、このスマホで読めるようになります`;
  track('paywall', 'ask');
  openModal(`
    <h2 class="sheet-title">おうちの人に払ってもらう</h2>
    <p>このリンクをおうちの人に送ってね。おうちの人のスマホで支払いが終わると、<b>このスマホで自動的に完全版が開きます</b>（このページを開いたままでも、あとで開いても大丈夫）。</p>
    <p class="hint">おうちの人には、あなたの診断結果や回答は見えません。リンクは7日間有効です。このスマホでしか受け取れないので、ほかの人に転送されても大丈夫です。</p>
    <div class="share-row">
      <button class="share-btn" data-ch="ask:link" data-copy="${esc(`${text}\n${url}`)}">コピー</button>
      <button class="share-btn" data-ch="ask:native" data-native-text="${esc(text)}" data-native-url="${esc(url)}">送る</button>
    </div>
    <button class="btn sub" data-close>とじる</button>`);
  watchClaim(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
}

// おうちの人が開くページ（子どもの回答は見せない）
export async function viewBuyFor(rid, render) {
  const gen = navNow();
  const s = await premiumStatus();
  if (gen !== navNow()) return;
  const plans = s.plans.filter((p) => p.available);
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
  document.querySelector('[data-buy-for]')?.addEventListener('click', () => confirmPurchase(null, plans[0], s, rid));
}

// 子どもの端末：おうちの人の支払いが終わったか確かめる（開いている間だけ、ときどき）。
// コールバックは最後に登録したものを使う（画面を移っていても、いまの画面を描き直す）
let claimTimer = null;
let claimDone = null;
export function watchClaim(onUnlocked) {
  claimDone = onUnlocked;
  const c = currentClaim();
  if (!c || hasPremium() || claimTimer) return;
  const started = Date.now();
  const stop = () => {
    clearInterval(claimTimer);
    claimTimer = null;
  };
  const tick = async () => {
    if (document.visibilityState === 'visible') {
      const res = await api(`claim?s=${c.s}`, { timeout: 4000 });
      if (res?.token) {
        store.set('premiumToken', res.token);
        store.set('claim', null);
        stop();
        toast('おうちの人の支払いが終わりました。完全版が開きます');
        claimDone?.();
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

export async function acceptToken(t) {
  if (!/^v1\.[\w-]{4,100}\.[\w-]{20,}$/.test(t || '')) return false;
  const check = await api('premium?i=0', { token: t });
  if (!check || check.error) return false;
  store.set('premiumToken', t);
  return true;
}

// プレゼント券を、自分の購入トークンと交換する（最初の1人だけ）
export async function acceptGift(g) {
  if (!/^v1\.gift-[\w-]{4,100}\.[\w-]{20,}$/.test(g || '')) return 'invalid';
  const res = await api('gift', { method: 'POST', body: { gift: g } });
  if (res?.token) {
    store.set('premiumToken', res.token);
    return 'ok';
  }
  return res?.error === 'used' ? 'used' : 'invalid';
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
      if (r === 'used') msg = 'このプレゼントは、もう受け取られています';
    } else if (candidate.startsWith('v1.')) ok = await acceptToken(candidate);
    else {
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
export function showAfterPurchase({ forChild = false, plan = 'solo' } = {}) {
  const t = token();
  if (!t) return;
  const sheet = openModal(`
    <h2 class="sheet-title">ありがとうございます</h2>
    ${forChild
      ? '<p><b>お子さまのスマホで、完全版が読めるようになりました。</b>表示が変わらないときは、お子さまにページを開き直してもらってください。</p>'
      : '<p>この端末で完全版が読めるようになりました。</p>'}
    ${plan === 'duo' && !forChild ? '<button class="btn type" data-gift>友達へのプレゼントのリンクを出す</button>' : ''}
    ${transferBox(forChild)}
    <button class="btn" data-close>とじる</button>`);
  sheet.querySelector('[data-copy-transfer]').onclick = () => copyText(transferUrl(t));
  sheet.querySelector('[data-gift]')?.addEventListener('click', openGift);
}

export const hasGift = () => store.get('plan', null) === 'duo';

// 決済から戻ってきたとき（/thanks/?sid=...）。成功したら戻り先のURLを返す。
// 失敗しても sid を覚えておき、もう一度確かめられるようにする（次にサイトを開いたときも自動で確かめる）
export async function completePurchase(sid) {
  if (!/^cs_\w{10,200}$/.test(sid || '')) return { ok: false, error: 'bad_session' };
  store.set('pendingSid', { sid, at: Date.now() });
  const res = await api(`unlock?sid=${encodeURIComponent(sid)}`, { timeout: 10000 });
  if (!res?.token) return { ok: false, error: res?.error || 'network' };
  store.set('premiumToken', res.token);
  store.set('plan', res.plan || 'solo');
  store.set('pendingSid', null);
  store.set('afterPurchase', { forChild: !!res.forChild, plan: res.plan || 'solo' });
  const back = store.get('returnHash', '#/');
  store.set('returnHash', null);
  return { ok: true, url: `/${back}` };
}

// 受け取れていない購入があれば、もう一度確かめる（24時間まで）
export async function retryPendingPurchase() {
  const p = store.get('pendingSid', null);
  if (!p || hasPremium()) return false;
  if (Date.now() - p.at > 24 * 3600 * 1000) {
    store.set('pendingSid', null);
    return false;
  }
  return (await completePurchase(p.sid)).ok;
}

// 決済をやめて戻ってきたとき
export function cancelPurchase() {
  const back = store.get('returnHash', '#/');
  store.set('returnHash', null);
  return `/${back}`;
}

// ページを開いたときに、購入直後の案内を一度だけ出す
export function maybeShowAfterPurchase() {
  const a = store.get('afterPurchase', null);
  if (!a) return;
  store.set('afterPurchase', null);
  setTimeout(() => showAfterPurchase(a), 300);
}
