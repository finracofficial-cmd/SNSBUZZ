// 完全版（有料）まわり。本文はサーバー（/api/premium）だけが持ち、購入トークンを持つ人にだけ返す。
//   ・購入：自社の確認画面（特商法の最終確認画面の6項目）→ Stripe Checkout
//   ・おうちの人に払ってもらう：受け取りID付きのリンクを送る → 親が払う → 子どもの端末が自動で受け取る
//   ・別の端末へ：引き継ぎリンク（トークン入り）／コード入力
//   ・ふたり用：購入するとプレゼント用のリンクがもう1つ届く
// 決済が未設定の環境では「準備中」として、中身の一覧と見本だけを見せる。
import { SITE } from './config.js';
import { TYPES } from './data.js';
import { ORIGIN, esc, store, api, toast, openModal, closeModal, track, shareLinks, copyText } from './ui.js';

let statusPromise;
export const premiumStatus = () =>
  (statusPromise ??= api('premium/status').then((s) =>
    s && !s.error ? s : { enabled: false, plans: [{ id: 'solo', price: SITE.premiumPrice, name: 'じぶん用', available: false }] },
  ));

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

// 完全版の中身を取ってくる（くわしい診断なら、その人のパラメータに合った文言も）
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
  const data = await api(`premium?i=${r.index}${p ? `&p=${p}` : ''}`, { token: t });
  if (data?.status === 401) store.set('premiumToken', null);
  return data && !data.error ? data : null;
}

// 二つ名のもとになったパラメータの解説（第1章の見本・無料）
export async function fetchSample(r) {
  if (!r.paramRaw) return null;
  const pv = preview();
  if (pv) return { param: r.nickname.param, detail: pv.params[r.nickname.param][level(r.paramRaw[r.nickname.param])] };
  const p = r.paramRaw.map((v) => v.toString(36)).join('');
  const data = await api(`sample?i=${r.baseIndex}&p=${p}`);
  return data && !data.error ? data : null;
}

// ---------- 購入への入口 ----------
const INCLUDES = [
  'パラメータ6項目の数値と、くわしい解説',
  '恋愛タイプの深掘り・恋のアドバイス・相性のいい恋愛タイプの理由',
  '本当のあなた（ポンコツの裏にある本音と強み）',
  'ポンコツを武器にする3つの方法',
  '恋愛の落とし穴と攻略法',
  '2027年の過ごし方ヒント',
  'お守りメッセージ',
  'ステータスカード・ゴールドカード（シェア画像）',
];

let paywallShown = false;
// 説明と購入ボタンのシート。自動で出すのは1回まで（あとはボタンを押したときだけ）
export async function openPaywall(r, { auto = false } = {}) {
  if (auto && (paywallShown || store.get('paywallSeen', false))) return;
  paywallShown = true;
  store.set('paywallSeen', true);
  track('paywall', auto ? 'view' : 'cta');
  const s = await premiumStatus();
  const pv = preview();
  const plans = s.plans.filter((p) => p.available);
  const sheet = openModal(`
    <h2 class="sheet-title">完全版で読めること</h2>
    <ul class="includes">${INCLUDES.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <p class="hint">全${TYPES.length}タイプ分が読めます。くわしい診断をやり直しても、そのまま読めます。</p>
    ${s.enabled && plans.length
      ? `<div class="plans">${plans.map((p, k) => `
          <label class="plan ${k === 0 ? 'on' : ''}"><input type="radio" name="plan" value="${p.id}" ${k === 0 ? 'checked' : ''}>
            <b>${esc(p.name)}</b><strong>${p.price}円</strong><small>税込・1回だけ・自動更新なし</small></label>`).join('')}</div>
        <button class="btn gold" data-buy>購入内容を確認する</button>
        <button class="btn sub" data-ask>おうちの人に払ってもらう</button>`
      : `<p class="price">完全版 <strong>${SITE.premiumPrice}円</strong>（税込・1回だけ・自動更新なし）</p>
         <p class="hint center">いまは準備中です。販売が始まったら、このページから購入できます。</p>`}
    ${pv ? '<button class="btn sub" data-preview>（プレビュー用）完全版の中身を見る</button>' : ''}
    <button class="linkish" data-redeem>コード・引き継ぎリンクをお持ちの方</button>
    <button class="linkish" data-close>とじる</button>`);
  sheet.querySelectorAll('.plan input').forEach((i) =>
    i.addEventListener('change', () => sheet.querySelectorAll('.plan').forEach((l) => l.classList.toggle('on', l.contains(i) && i.checked))),
  );
  sheet.querySelector('[data-buy]')?.addEventListener('click', () => {
    const id = sheet.querySelector('.plan input:checked')?.value || 'solo';
    confirmPurchase(r, plans.find((p) => p.id === id));
  });
  sheet.querySelector('[data-ask]')?.addEventListener('click', () => askGuardian(r));
  sheet.querySelector('[data-redeem]').addEventListener('click', openRedeem);
  sheet.querySelector('[data-preview]')?.addEventListener('click', () => {
    unlockPreview();
    closeModal();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

// 特定商取引法の「最終確認画面」に必要な6項目を、決済ページへ進む前にまとめて見せる
function confirmPurchase(r, plan, rid = '') {
  const gift = plan.id === 'duo';
  const sheet = openModal(`
    <h2 class="sheet-title">ご購入内容の確認</h2>
    <dl class="facts confirm">
      <dt>商品</dt><dd>${esc(SITE.quizName)} 完全版（${esc(plan.name)}）。デジタルコンテンツ・全${TYPES.length}タイプ分${gift ? '。友達1人に贈れるプレゼント用リンクつき' : ''}</dd>
      <dt>数量</dt><dd>1つ</dd>
      <dt>価格</dt><dd>${plan.price}円（税込）。1回だけのお支払いで、自動更新や追加料金はありません</dd>
      <dt>支払い方法</dt><dd>クレジットカード・Apple Pay・Google Pay・PayPayなど（次の画面の決済サービス Stripe で選べます）</dd>
      <dt>支払い時期</dt><dd>次の画面でお支払いを確定した時点</dd>
      <dt>提供時期</dt><dd>お支払いの完了後すぐに、この端末${rid ? '（とお子さまの端末）' : ''}で読めます</dd>
      <dt>申込みの期限</dt><dd>ありません</dd>
      <dt>キャンセル</dt><dd>デジタルコンテンツのため、購入後の返品・キャンセルはできません。ただし18歳未満の方の購入で保護者から申し出があった場合は、全額返金します</dd>
    </dl>
    ${rid ? '' : '<label class="check"><input type="checkbox" id="guardian"> 18歳未満の方は、保護者の同意を得ています</label>'}
    <label class="check"><input type="checkbox" id="agree"> 上の内容と<a href="#/legal" data-close>特定商取引法に基づく表記</a>を確認しました</label>
    <p class="hint" id="buy-msg"></p>
    <button class="btn gold" id="buy-go">${plan.price}円を支払って購入する</button>
    <button class="btn sub" data-close>やめる</button>`);
  sheet.querySelector('#buy-go').onclick = async () => {
    if (!sheet.querySelector('#agree').checked) {
      sheet.querySelector('#buy-msg').textContent = '確認のチェックを入れてください';
      return;
    }
    sheet.querySelector('#buy-go').disabled = true;
    const res = await api('checkout', { method: 'POST', body: { plan: plan.id, index: r?.index ?? null, rid } });
    if (!res?.url) {
      sheet.querySelector('#buy-msg').textContent = 'いまは購入できません。時間をおいて試してください';
      sheet.querySelector('#buy-go').disabled = false;
      return;
    }
    track('premium', 'checkout');
    store.set('returnHash', rid ? '#/buy/done' : location.hash);
    location.href = res.url;
  };
}

// ---------- おうちの人に払ってもらう ----------
const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');

// 受け取りIDは7日で無効（サーバー側の claims と同じ期限）
const CLAIM_TTL = 7 * 24 * 3600 * 1000;
function currentClaim() {
  const c = store.get('claimRid', null);
  if (!c || typeof c !== 'object' || !/^[a-z0-9]{16}$/.test(c.rid || '') || Date.now() - c.at > CLAIM_TTL) return null;
  return c.rid;
}

async function askGuardian(r) {
  const rid = currentClaim() || randomId();
  if (rid !== currentClaim()) store.set('claimRid', { rid, at: Date.now() });
  const url = `${ORIGIN}/#/buy/${rid}`;
  const price = (await premiumStatus()).plans?.[0]?.price ?? SITE.premiumPrice;
  const text = `「${SITE.quizName}」の完全版（${price}円）を買ってもらえませんか？ このリンクから支払うと、私のスマホで読めるようになります`;
  track('paywall', 'ask');
  openModal(`
    <h2 class="sheet-title">おうちの人に払ってもらう</h2>
    <p>このリンクをおうちの人に送ってね。おうちの人のスマホで支払いが終わると、<b>このスマホで自動的に完全版が開きます</b>（このページを開いたままでも、あとで開いても大丈夫）。</p>
    <p class="hint">おうちの人には、あなたの診断結果や回答は見えません。リンクは7日間有効です。</p>
    ${shareLinks({ text, url, channelPrefix: 'ask:' }).html}
    <button class="btn sub" data-close>とじる</button>`);
}

// おうちの人が開くページ（子どもの回答は見せない）
export async function viewBuyFor(rid, render) {
  const s = await premiumStatus();
  const plans = s.plans.filter((p) => p.available);
  render(`
    <section class="card">
      <h1 class="sheet-title">${esc(SITE.quizName)} 完全版のご案内</h1>
      <p>お子さまから、完全版の購入のお願いが届いています。支払いが終わると、お子さまのスマホで完全版が読めるようになります。</p>
      <ul class="includes">${INCLUDES.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <p class="hint">${esc(SITE.quizName)}は、20タイプの性格を楽しむエンタメの心理テストです。占いではありません。</p>
      ${s.enabled && plans.length
        ? `<p class="price"><strong>${plans[0].price}円</strong>（税込・1回だけ・自動更新なし）</p>
           <button class="btn gold" data-buy-for>購入内容を確認する</button>`
        : '<p class="hint center">いまは販売の準備中です。</p>'}
    </section>`);
  document.querySelector('[data-buy-for]')?.addEventListener('click', () => confirmPurchase(null, plans[0], rid));
}

// 子どもの端末：おうちの人の支払いが終わったか確かめる（開いている間だけ、ときどき）
let claimTimer = null;
export function watchClaim(onUnlocked) {
  const rid = currentClaim();
  if (!rid || hasPremium() || claimTimer) return;
  const started = Date.now();
  const tick = async () => {
    if (document.visibilityState === 'visible') {
      const res = await api(`claim?rid=${rid}`, { timeout: 4000 });
      if (res?.token) {
        store.set('premiumToken', res.token);
        store.set('claimRid', null);
        clearInterval(claimTimer);
        claimTimer = null;
        toast('おうちの人の支払いが終わりました。完全版が開きます');
        onUnlocked?.();
        return;
      }
    }
    if (Date.now() - started > 15 * 60 * 1000) {
      clearInterval(claimTimer);
      claimTimer = null;
    }
  };
  claimTimer = setInterval(tick, 5000);
  tick();
}

// ---------- 引き継ぎ・コード ----------
export const transferUrl = (t) => `${ORIGIN}/#/unlock/${encodeURIComponent(t)}`;

export async function acceptToken(t) {
  if (!/^v1\.[\w-]{4,80}\.[\w-]{20,}$/.test(t || '')) return false;
  const check = await api('premium?i=0', { token: t });
  if (!check || check.error) return false;
  store.set('premiumToken', t);
  return true;
}

function openRedeem() {
  const sheet = openModal(`
    <h2 class="sheet-title">コード・引き継ぎリンクで開く</h2>
    <p class="hint">キャンペーンのコード、またはほかの端末で表示した引き継ぎリンクを貼りつけてください。</p>
    <label class="field">コード・リンク<input id="code" maxlength="300" autocomplete="off"></label>
    <p class="hint" id="redeem-msg"></p>
    <button class="btn" id="redeem-go">開く</button>
    <button class="btn sub" data-close>とじる</button>`);
  sheet.querySelector('#redeem-go').onclick = async () => {
    const raw = sheet.querySelector('#code').value.trim();
    const m = /#\/unlock\/([^\s/]+)/.exec(raw);
    const candidate = m ? decodeURIComponent(m[1]) : raw;
    let ok = false;
    if (candidate.startsWith('v1.')) ok = await acceptToken(candidate);
    else {
      const res = await api('redeem', { method: 'POST', body: { code: candidate } });
      if (res?.token) {
        store.set('premiumToken', res.token);
        ok = true;
      }
    }
    if (!ok) {
      sheet.querySelector('#redeem-msg').textContent = 'コードを確認できませんでした';
      return;
    }
    closeModal();
    toast('完全版が開きました');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
}

// 購入後に見せる：引き継ぎリンク（自分の別の端末用）と、ふたり用ならプレゼント用リンク
export function showAfterPurchase({ giftToken = null, forChild = false } = {}) {
  const t = token();
  if (!t) return;
  openModal(`
    <h2 class="sheet-title">ありがとうございます</h2>
    ${forChild
      ? '<p><b>お子さまのスマホで、完全版が自動的に開きます。</b>お子さまにページを開き直してもらってください。</p>'
      : '<p>この端末で完全版が読めるようになりました。</p>'}
    ${giftToken ? `<div class="card gift"><h2>友達へのプレゼント</h2>
      <p>このリンクを送ると、友達も完全版を読めます（1人分）。</p>
      ${shareLinks({ text: `${SITE.quizName}の完全版をプレゼント！ このリンクを開くと読めるよ`, url: transferUrl(giftToken), channelPrefix: 'gift:' }).html}</div>` : ''}
    <div class="card"><h2>${forChild ? 'お子さまの端末で開かないとき' : 'ほかの端末で読むとき'}</h2>
      <p class="hint">この引き継ぎリンクを開くと、その端末でも読めます。他の人には送らないでください。</p>
      <button class="btn sub small" data-copy-transfer>引き継ぎリンクをコピー</button></div>
    <button class="btn" data-close>とじる</button>`).querySelector('[data-copy-transfer]').onclick = () => copyText(transferUrl(t));
}

// 決済から戻ってきたとき（/thanks/?sid=...）
export async function completePurchase(sid) {
  const res = await api(`unlock?sid=${encodeURIComponent(sid)}`, { timeout: 8000 });
  if (res?.token) {
    store.set('premiumToken', res.token);
    store.set('afterPurchase', { giftToken: res.giftToken || null, forChild: !!res.forChild });
  } else {
    toast('お支払いを確認できませんでした。少し待ってから再読みこみしてください');
  }
  const back = store.get('returnHash', '#/');
  store.set('returnHash', null);
  return back;
}

// ページを開いたときに、購入直後の案内を一度だけ出す
export function maybeShowAfterPurchase() {
  const a = store.get('afterPurchase', null);
  if (!a) return;
  store.set('afterPurchase', null);
  setTimeout(() => showAfterPurchase(a), 300);
}
