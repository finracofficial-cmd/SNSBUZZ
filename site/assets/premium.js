// 完全版（有料）。中身はサーバー（/api/premium）だけが持ち、購入トークンを持つ人にだけ返す。
// 決済が未設定の環境では「準備中」として中身の一覧と予告だけを見せる。
import { SITE } from './config.js';
import { TYPES } from './data.js';
import { esc, store, api, toast, openModal, closeModal, track } from './ui.js';

let statusPromise;
const status = () =>
  (statusPromise ??= api('premium/status').then((s) => s && !s.error ? s : { enabled: false, price: SITE.premiumPrice }));

export const hasPremium = () => !!store.get('premiumToken', null);

const INCLUDES = [
  ['本当のあなた', 'ポンコツの裏にある本音と強み'],
  ['ポンコツを武器にする3つの方法', '明日から使える具体策'],
  ['恋愛の落とし穴と攻略法', '好きな人の前でやりがちなこと'],
  ['2027年の過ごし方ヒント', '季節ごとに、やってみるといいこと'],
  ['お守りメッセージ', '落ちこんだ日に読む一言'],
  ['完全版限定のゴールドカード', 'シェア画像が特別デザインに'],
];

export function premiumSection(index) {
  return `<section class="card premium" id="premium" data-index="${index}">
    <h2>完全版トリセツ</h2>
    <div class="premium-body"><p class="hint">読みこみ中…</p></div>
  </section>`;
}

export async function mountPremium(root, index, { onGold } = {}) {
  const el = root.querySelector('#premium .premium-body');
  if (!el) return;
  const token = store.get('premiumToken', null);
  if (token) {
    const data = await api(`premium?i=${index}`, { token });
    if (data && !data.error) {
      el.innerHTML = premiumContent(data);
      el.querySelector('[data-gold]')?.addEventListener('click', () => onGold?.());
      return;
    }
    if (data?.status === 401) store.set('premiumToken', null);
  }
  const s = await status();
  const t = TYPES[index];
  // 静的プレビュー（APIなし）でだけ、見本として中身を見せられるようにする
  const preview = globalThis.PZ_PREVIEW_PREMIUM?.[index];
  el.innerHTML = `
    <p class="teaser"><span>${esc(t.teaser)}</span></p>
    <ul class="includes">${INCLUDES.map(([a, b]) => `<li><b>${esc(a)}</b><small>${esc(b)}</small></li>`).join('')}</ul>
    <p class="price">全${TYPES.length}タイプ分まとめて <strong>${s.price}円</strong>（税込・買い切り）</p>
    ${s.enabled
      ? '<button class="btn gold" data-buy>完全版を読む</button>'
      : '<p class="hint center">完全版は準備中です。公開までもう少し待ってね。</p>'}
    <button class="linkish" data-redeem>コードをお持ちの方</button>
    ${preview ? '<button class="btn sub" data-preview>（プレビュー用）完全版の中身を見る</button>' : ''}`;
  el.querySelector('[data-buy]')?.addEventListener('click', () => confirmPurchase(index, s.price));
  el.querySelector('[data-preview]')?.addEventListener('click', () => {
    el.innerHTML = premiumContent(preview);
    el.querySelector('[data-gold]')?.addEventListener('click', () => onGold?.());
  });
  el.querySelector('[data-redeem]').addEventListener('click', () => openRedeem(index));
}

function premiumContent(p) {
  return `
    <h3>本当のあなた</h3><p>${esc(p.deep)}</p>
    <h3>ポンコツを武器にする3つの方法</h3><ol class="tips">${p.growth.map((g) => `<li>${esc(g)}</li>`).join('')}</ol>
    <h3>恋愛の落とし穴と攻略法</h3><p>${esc(p.loveDeep)}</p>
    <h3>2027年の過ごし方ヒント</h3><p>${esc(p.next)}</p>
    <div class="letter"><h3>お守りメッセージ</h3><p>${esc(p.letter)}</p></div>
    <button class="btn gold" data-gold>ゴールドカードを保存</button>`;
}

// 特定商取引法の「最終確認画面」に必要な項目を、決済ページへ進む前にまとめて見せる
function confirmPurchase(index, price) {
  const sheet = openModal(`
    <h2 class="sheet-title">ご購入内容の確認</h2>
    <dl class="facts confirm">
      <dt>商品</dt><dd>愛されポンコツ診断 完全版トリセツ（全${TYPES.length}タイプ・デジタルコンテンツ）</dd>
      <dt>価格</dt><dd>${price}円（税込）・1回払い。追加の料金や定期購入はありません</dd>
      <dt>支払い</dt><dd>次の画面（決済サービス Stripe）でお支払い。お支払いの時点で確定します</dd>
      <dt>提供時期</dt><dd>お支払い完了後、すぐにこの端末で読めます</dd>
      <dt>キャンセル</dt><dd>デジタルコンテンツのため、購入後の返品・キャンセルはできません</dd>
    </dl>
    <label class="check"><input type="checkbox" id="guardian"> 18歳未満の方は、保護者の同意を得ています</label>
    <label class="check"><input type="checkbox" id="agree"> 上の内容と<a href="#/legal" data-close>特定商取引法に基づく表記</a>を確認しました</label>
    <p class="hint" id="buy-msg"></p>
    <button class="btn gold" id="buy-go">支払いへすすむ</button>
    <button class="btn sub" data-close>やめる</button>`);
  sheet.querySelector('#buy-go').onclick = async () => {
    if (!sheet.querySelector('#agree').checked) {
      sheet.querySelector('#buy-msg').textContent = '確認のチェックを入れてね';
      return;
    }
    sheet.querySelector('#buy-go').disabled = true;
    const res = await api('checkout', { method: 'POST', body: { index } });
    if (!res?.url) {
      sheet.querySelector('#buy-msg').textContent = 'いまは購入できません。時間をおいて試してね';
      sheet.querySelector('#buy-go').disabled = false;
      return;
    }
    track('premium', 'checkout');
    store.set('returnHash', location.hash);
    location.href = res.url;
  };
}

function openRedeem(index) {
  const sheet = openModal(`
    <h2 class="sheet-title">コードで完全版をひらく</h2>
    <label class="field">コード<input id="code" maxlength="32" autocomplete="off"></label>
    <p class="hint" id="redeem-msg"></p>
    <button class="btn" id="redeem-go">ひらく</button>
    <button class="btn sub" data-close>とじる</button>`);
  sheet.querySelector('#redeem-go').onclick = async () => {
    const code = sheet.querySelector('#code').value.trim();
    const res = await api('redeem', { method: 'POST', body: { code } });
    if (!res?.token) {
      sheet.querySelector('#redeem-msg').textContent = res ? 'コードが正しくないようです' : 'いまは使えません（公開版で使えます）';
      return;
    }
    store.set('premiumToken', res.token);
    closeModal();
    toast('完全版がひらきました');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
}

// 決済から戻ってきたとき（/thanks/?sid=...）
export async function completePurchase(sid) {
  const res = await api(`unlock?sid=${encodeURIComponent(sid)}`, { timeout: 8000 });
  if (res?.token) {
    store.set('premiumToken', res.token);
    toast('ありがとう！完全版がひらきました');
  } else {
    toast('お支払いを確認できませんでした。少し待ってから再読みこみしてね');
  }
  const back = store.get('returnHash', '#/');
  store.set('returnHash', null);
  return back;
}
