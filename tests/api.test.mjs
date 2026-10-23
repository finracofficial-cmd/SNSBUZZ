// Pages Functions を、本物のスキーマを入れたSQLite（D1の代わり）で動かして確かめる
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { issueToken, verifyToken, accessOf } from '../functions/_lib/token.js';
import { claimIdOf } from '../functions/_lib/purchase.js';
import { onRequestGet as premiumGet } from '../functions/api/premium/index.js';
import { onRequestGet as statusGet } from '../functions/api/premium/status.js';
import { onRequestPost as redeemPost } from '../functions/api/redeem.js';
import { onRequestPost as checkoutPost } from '../functions/api/checkout.js';
import { onRequestGet as unlockGet } from '../functions/api/unlock.js';
import { onRequestGet as claimGet } from '../functions/api/claim.js';
import { onRequestGet as giftGet, onRequestPost as giftPost } from '../functions/api/gift.js';
import { onRequestGet as restoreGet } from '../functions/api/restore.js';
import { onRequestPost as adoptPost } from '../functions/api/adopt.js';
import { onRequestPost as webhookPost } from '../functions/api/stripe-webhook.js';
import { onRequestPost as eventPost } from '../functions/api/event.js';
import { onRequestGet as statsGet } from '../functions/api/stats.js';
import { onRequestPost as groupCreate } from '../functions/api/groups/index.js';
import { onRequestGet as groupGet, onRequestPost as groupJoin, onRequestDelete as groupDelete } from '../functions/api/groups/[id].js';
import { PREMIUM, PARAM_DETAIL, LOVE_DETAIL } from '../functions/_lib/premium.js';
import { PARAM_TEXT } from '../site/assets/types.js';
import { paramLevel } from '../site/assets/logic.js';
import { loveIndexOf } from '../site/assets/data.js';

function fakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync('schema.sql', 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    // D1 と同じく、SELECT なら results に行が入る（batch の結果もこの形）
    run: async () => {
      if (/^\s*SELECT/i.test(sql)) return { success: true, meta: { changes: 0 }, results: db.prepare(sql).all(...args) };
      const r = db.prepare(sql).run(...args);
      return { success: true, meta: { changes: Number(r.changes) }, results: [] };
    },
    all: async () => ({ results: db.prepare(sql).all(...args) }),
  });
  return { prepare: (sql) => stmt(sql), batch: async (list) => Promise.all(list.map((s) => s.run())), raw: db };
}

const req = (url, init = {}) => new Request(`https://example.com${url}`, init);
const post = (url, body, headers = {}) =>
  req(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const del = (url, body) => req(url, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const bearer = (t) => ({ headers: { authorization: `Bearer ${t}` } });
const SECRET = { PREMIUM_SECRET: 'test-secret-0123456789' };
const STRIPE = { STRIPE_SECRET_KEY: 'sk_test', STRIPE_PRICE_ID: 'price_solo', STRIPE_PRICE_ID_DUO: 'price_duo', SELLER_READY: '1' };

// Stripe の API を差し替える（価格・Checkout Session）
function stubStripe(sessions, prices = { price_solo: 390, price_duo: 590 }) {
  const realFetch = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    sent.push({ url: u, body: init.body ? String(init.body) : '' });
    if (init.method === 'POST') return Response.json({ url: 'https://checkout.stripe.com/c/pay/x', id: 'cs_test_created00000' });
    const id = decodeURIComponent(u.split('/').pop());
    if (u.includes('/v1/prices/')) {
      return id in prices ? Response.json({ unit_amount: prices[id], currency: 'jpy', active: true }) : new Response('{}', { status: 404 });
    }
    return sessions[id] ? Response.json({ id, ...sessions[id] }) : new Response('{}', { status: 404 });
  };
  return { sent, restore: () => (globalThis.fetch = realFetch) };
}
const now = () => Math.floor(Date.now() / 1000);
const paid = (plan, extra = {}) => ({ payment_status: 'paid', created: now(), metadata: { app: 'ponkotsu', plan }, payment_intent: `pi_${plan}_${Math.random().toString(36).slice(2, 8)}`, ...extra });

test('購入トークン：正しい署名だけ通り、IDを返す', async () => {
  const token = await issueToken(SECRET, 'cs_test_abc');
  assert.equal(await verifyToken(SECRET, token), 'cs_test_abc');
  assert.equal(await verifyToken({ PREMIUM_SECRET: 'other-secret' }, token), null);
  assert.equal(await verifyToken(SECRET, token.slice(0, -2) + 'xx'), null);
  assert.equal(await verifyToken(SECRET, 'v1.cs_test_abc.short'), null);
  assert.equal(await verifyToken({}, token), null);
});

test('完全版：トークンなしは401、プレゼント券では読めない、パラメータ付きなら段階と恋愛タイプの文言', async () => {
  const env = { ...SECRET, PROMO_CODES: 'TEST' };
  assert.equal((await premiumGet({ request: req('/api/premium?i=6'), env })).status, 401);
  assert.equal((await premiumGet({ request: req('/api/premium?i=6'), env: {} })).status, 503);
  const voucher = await issueToken(env, 'gift-cs_test_x');
  assert.equal((await premiumGet({ request: req('/api/premium?i=6', bearer(voucher)), env })).status, 401);
  const token = await issueToken(env, 'promo-TEST');
  const r1 = await premiumGet({ request: req('/api/premium?i=6', bearer(token)), env });
  assert.equal(r1.status, 200);
  const b1 = await r1.json();
  assert.deepEqual(b1.type, PREMIUM[6]);
  assert.equal(b1.params, null);
  // Cookie でも読める
  const viaCookie = await premiumGet({ request: req('/api/premium?i=6', { headers: { cookie: `a=1; pz_t=${token}` } }), env });
  assert.equal(viaCookie.status, 200);
  // 0〜12 の各値で、サーバーの段階と恋愛タイプがブラウザの paramLevel・loveIndexOf と一致する
  const digits = '0c8463';
  const b2 = await (await premiumGet({ request: req(`/api/premium?i=6&p=${digits}`, bearer(token)), env })).json();
  const pcts = Array.from(digits, (d) => Math.round((parseInt(d, 36) / 12) * 100));
  pcts.forEach((p, k) => assert.equal(b2.params[k], PARAM_DETAIL[k][paramLevel(p)]));
  assert.deepEqual(b2.love, LOVE_DETAIL[loveIndexOf(pcts)]);
  for (let d = 0; d <= 12; d++) {
    const p = Math.round((d / 12) * 100);
    const r = await (await premiumGet({ request: req(`/api/premium?i=0&p=${d.toString(36).repeat(6)}`, bearer(token)), env })).json();
    assert.equal(r.params[0], PARAM_DETAIL[0][paramLevel(p)], `値 ${d}`);
    assert.deepEqual(r.love, LOVE_DETAIL[loveIndexOf([p, p, p])], `恋愛タイプ ${d}`);
  }
  assert.equal((await premiumGet({ request: req('/api/premium?i=6&p=d00000', bearer(token)), env })).status, 400);
  assert.equal((await premiumGet({ request: req('/api/premium?i=99', bearer(token)), env })).status, 404);
});

test('コード：大文字小文字を問わず、登録中で期限内のコードだけ。コードを消すと読めなくなる', async () => {
  const env = { ...SECRET, PROMO_CODES: 'OSHI2027, SCHOOLFES:2020-01-01' };
  assert.equal((await redeemPost({ request: post('/api/redeem', { code: 'nope' }), env })).status, 400);
  assert.equal((await redeemPost({ request: post('/api/redeem', { code: 'schoolfes' }), env })).status, 400, '期限切れ');
  const ok = await redeemPost({ request: post('/api/redeem', { code: 'oshi2027' }), env });
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('set-cookie'), /^pz_t=v1\.promo-OSHI2027\..*HttpOnly; Secure/);
  const { token } = await ok.json();
  assert.equal(await accessOf(env, token), 'ok');
  assert.equal(await accessOf({ ...env, PROMO_CODES: 'OTHER' }, token), 'revoked');
  assert.equal((await premiumGet({ request: req('/api/premium?i=1', bearer(token)), env: { ...env, PROMO_CODES: '' } })).status, 403);
  assert.equal((await redeemPost({ request: post('/api/redeem', { code: 'x' }), env: {} })).status, 503);
  assert.equal((await redeemPost({ request: post('/api/redeem', { code: 'oshi2027' }, { origin: 'https://evil.example' }), env })).status, 403);
});

test('販売状況：Stripeの設定がなければ販売しない。プランと支払い方法は設定に応じて出る', async () => {
  assert.equal((await checkoutPost({ request: post('/api/checkout', { index: 1 }), env: SECRET })).status, 503);
  const s = await (await statusGet({ env: SECRET })).json();
  assert.equal(s.enabled, false);
  assert.deepEqual(s.plans.map((p) => [p.id, p.price, p.available]), [['solo', 390, false]]);
  assert.deepEqual(s.methods, ['card']);
  const s2 = await (await statusGet({ env: { ...SECRET, ...STRIPE, STRIPE_PAYMENT_METHODS: 'paypay, card, konbini' } })).json();
  assert.equal(s2.enabled, true);
  assert.deepEqual(s2.plans.map((p) => [p.id, p.price, p.available]), [['solo', 390, true], ['duo', 590, true]]);
  assert.deepEqual(s2.methods, ['paypay', 'card'], '後払いの方法は使わない');
  assert.ok(!JSON.stringify(s2).includes('price_'), '価格IDは返さない');
});

test('決済の開始：Stripeの価格と画面の価格がちがえば止める。支払い方法・受け取りID・戻り先', async () => {
  const env = { ...SECRET, ...STRIPE };
  const stripe = stubStripe({}, { price_solo: 390, price_duo: 690 });
  try {
    const rid = 'abcdefghijklmnop';
    const c1 = await checkoutPost({ request: post('/api/checkout', { plan: 'solo', index: 3, rid }), env });
    assert.equal(c1.status, 200);
    assert.ok('id' in (await c1.json()), 'セッションIDも返す（/thanks/ に戻れなかったときの受け取り用）');
    // 特商法の表記を書きかえるまで（SELLER_READY なし）は売らない
    assert.equal((await checkoutPost({ request: post('/api/checkout', { plan: 'solo' }), env: { ...env, SELLER_READY: '' } })).status, 503);
    const form = new URLSearchParams(stripe.sent.at(-1).body);
    assert.equal(form.get('line_items[0][price]'), 'price_solo');
    assert.equal(form.get('client_reference_id'), rid);
    assert.equal(form.get('metadata[plan]'), 'solo');
    assert.equal(form.get('metadata[app]'), 'ponkotsu');
    assert.equal(form.get('metadata[type]'), '3');
    assert.equal(form.get('payment_method_types[0]'), 'card');
    assert.equal(form.get('payment_method_types[1]'), null);
    assert.match(form.get('cancel_url'), /\/thanks\/\?canceled=1$/);
    assert.match(form.get('custom_text[submit][message]'), /返品・キャンセルはできません/);
    const expires = Number(form.get('expires_at')) - Math.floor(Date.now() / 1000);
    assert.ok(expires > 3500 && expires <= 3600, `決済の画面は60分で切れる: ${expires}`);
    assert.equal(form.get('metadata[ab]'), null);
    await checkoutPost({ request: post('/api/checkout', { plan: 'solo', ab: 'paybar:specific,paybar:amount,autopay:off,evil:x' }), env });
    assert.equal(new URLSearchParams(stripe.sent.at(-1).body).get('metadata[ab]'), 'paybar:specific,autopay:off', 'A/Bの目印は定義にあるもの・1実験1つだけ');
    // おうちの人の購入（index なし）では、タイプを記録しない。古い形式の受け取りIDは使わない
    await checkoutPost({ request: post('/api/checkout', { plan: 'weird', index: null, rid: 'abcdefgh12345678' }), env });
    const form2 = new URLSearchParams(stripe.sent.at(-1).body);
    assert.equal(form2.get('metadata[type]'), null);
    assert.equal(form2.get('client_reference_id'), null);
    // ふたり用：Stripe は690円なのに画面は590円 → 売らない
    const c3 = await checkoutPost({ request: post('/api/checkout', { plan: 'duo' }), env });
    assert.equal(c3.status, 503);
    assert.equal((await c3.json()).error, 'price');
    assert.equal((await checkoutPost({ request: post('/api/checkout', { plan: 'duo' }), env: { ...env, PREMIUM_PRICE_DUO: '690' } })).status, 200);
  } finally {
    stripe.restore();
  }
});

test('支払いの受け取り：記録は1回だけ数え、ほかの商品・未払い・24時間後は渡さない。Cookie にも入れる', async () => {
  const DB = fakeD1();
  const env = { ...SECRET, ...STRIPE, DB };
  const stripe = stubStripe({
    cs_test_solo00000000: paid('solo', { metadata: { app: 'ponkotsu', plan: 'solo', ab: 'paybar:specific,autopay:on' } }),
    cs_test_other0000000: { payment_status: 'paid', created: now(), metadata: { plan: 'solo' } },
    cs_test_unpaid000000: { payment_status: 'unpaid', created: now(), metadata: { app: 'ponkotsu', plan: 'solo' } },
    cs_test_old000000000: paid('solo', { created: now() - 25 * 3600 }),
  });
  try {
    const unlock = (sid) => unlockGet({ request: req(`/api/unlock?sid=${sid}`), env });
    const r1 = await unlock('cs_test_solo00000000');
    assert.equal(r1.status, 200);
    const b1 = await r1.json();
    assert.equal(await verifyToken(env, b1.token), 'cs_test_solo00000000');
    assert.equal(b1.plan, 'solo');
    assert.match(r1.headers.get('set-cookie'), /^pz_t=v1\./);
    assert.equal((await unlock('cs_test_solo00000000')).status, 200, '再読みこみしても受け取れる');
    const count = DB.raw.prepare("SELECT n FROM counters WHERE k = 'premium:paid:solo'").get();
    assert.equal(count.n, 1, '支払い完了は1回だけ数える');
    assert.equal(DB.raw.prepare("SELECT n FROM counters WHERE k = 'ab:paybar:specific:paid'").get().n, 1, 'A/Bの案ごとの支払い完了');
    assert.equal(DB.raw.prepare("SELECT COUNT(*) AS n FROM counters WHERE k LIKE 'day:%:paid'").get().n, 1, '日別の支払い完了');
    assert.equal((await unlock('cs_test_other0000000')).status, 404);
    assert.equal((await unlock('cs_test_unpaid000000')).status, 402);
    assert.equal((await unlock('cs_test_old000000000')).status, 410);
    assert.equal((await unlock('nope')).status, 400);
    // Cookie から戻せる（プランも）
    const restored = await (await restoreGet({ request: req('/api/restore', { headers: { cookie: `pz_t=${b1.token}` } }), env })).json();
    assert.equal(restored.token, b1.token);
    assert.equal(restored.plan, 'solo');
    assert.equal((await restoreGet({ request: req('/api/restore'), env })).status, 404);
    // 引き継ぎリンクで開いた端末にも Cookie を付ける。いまの Cookie に自分の有効な購入があれば上書きしない
    const adopt = (t, cookie) => adoptPost({ request: post('/api/adopt', {}, { authorization: `Bearer ${t}`, ...(cookie ? { cookie } : {}) }), env });
    const a1 = await adopt(b1.token);
    assert.equal(a1.status, 200);
    assert.match(a1.headers.get('set-cookie'), /^pz_t=v1\.cs_test_solo/);
    const promo = await issueToken(env, 'promo-X');
    assert.equal((await adopt(promo, `pz_t=${b1.token}`)).headers.get('set-cookie'), null, '自分の購入の Cookie をコードで上書きしない');
    assert.equal((await adopt('v1.cs_x.bad-signature-000000000000')).status, 401);
    assert.equal((await adoptPost({ request: post('/api/adopt', {}, { authorization: `Bearer ${b1.token}`, origin: 'https://evil.example' }), env })).status, 403);
  } finally {
    stripe.restore();
  }
});

test('Webhook：署名を確かめて購入と受け取りを記録し、返金されたら読めなくする', async () => {
  const DB = fakeD1();
  const env = { ...SECRET, ...STRIPE, DB, STRIPE_WEBHOOK_SECRET: 'whsec_test' };
  const sign = (payload, t = now(), secret = 'whsec_test') =>
    `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')}`;
  const send = (event, sig) => {
    const payload = JSON.stringify(event);
    return webhookPost({ request: req('/api/stripe-webhook', { method: 'POST', headers: { 'stripe-signature': sig ?? sign(payload) }, body: payload }), env });
  };
  const secret = 'abcdefghijklmnopqrstuvwxyz';
  const rid = await claimIdOf(secret);
  assert.match(rid, /^[a-z2-7]{16}$/);
  const session = { id: 'cs_test_parent000000', ...paid('solo', { payment_intent: 'pi_parent' }), client_reference_id: rid };
  const completed = { type: 'checkout.session.completed', data: { object: session } };
  // 署名がちがう・古い
  assert.equal((await send(completed, 't=1,v1=00')).status, 400);
  assert.equal((await send(completed, sign(JSON.stringify(completed), now() - 3600))).status, 400);
  assert.equal((await send(completed, sign(JSON.stringify(completed), now(), 'other'))).status, 400);
  // 受け取り前は pending
  assert.equal((await claimGet({ request: req(`/api/claim?s=${secret}`), env })).status, 404);
  const paidOf = async () => (await claimGet({ request: req(`/api/claim?rid=${rid}`), env })).json();
  assert.deepEqual(await paidOf(), { paid: false }, '支払い前');
  assert.equal((await send(completed)).status, 200);
  assert.equal((await send(completed)).status, 200, '同じ通知が2回来ても大丈夫');
  assert.equal(DB.raw.prepare("SELECT n FROM counters WHERE k = 'premium:paid'").get().n, 1);
  // おうちの人のページ：支払い済みかどうかだけが分かる（トークンは返らない）
  assert.deepEqual(await paidOf(), { paid: true });
  // 子どもの端末は秘密で受け取れる。リンクに入っている受け取りIDだけでは受け取れない
  const claimed = await (await claimGet({ request: req(`/api/claim?s=${secret}`), env })).json();
  assert.equal(await verifyToken(env, claimed.token), 'cs_test_parent000000');
  assert.equal((await claimGet({ request: req(`/api/claim?s=${rid}`), env })).status, 400);
  assert.equal((await claimGet({ request: req(`/api/claim?s=${'b'.repeat(26)}`), env })).status, 404);
  assert.equal((await premiumGet({ request: req('/api/premium?i=1', bearer(claimed.token)), env })).status, 200);
  // ほかの商品の通知は記録しない
  await send({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_other', payment_status: 'paid', metadata: { plan: 'solo' } } } });
  assert.equal(DB.raw.prepare("SELECT COUNT(*) AS n FROM purchases WHERE id = 'cs_test_other'").get().n, 0);
  // 一部返金では止めない。全額返金で止める
  assert.equal((await send({ type: 'charge.refunded', data: { object: { payment_intent: 'pi_parent', refunded: false, amount: 390, amount_refunded: 10 } } })).status, 200);
  assert.equal((await premiumGet({ request: req('/api/premium?i=1', bearer(claimed.token)), env })).status, 200, '一部返金では読める');
  assert.equal((await send({ type: 'charge.refunded', data: { object: { payment_intent: 'pi_parent', refunded: true, amount: 390, amount_refunded: 390 } } })).status, 200);
  assert.equal((await premiumGet({ request: req('/api/premium?i=1', bearer(claimed.token)), env })).status, 403);
  // 申し立てに勝っても、返金済みなら戻さない
  await send({ type: 'charge.dispute.closed', data: { object: { payment_intent: 'pi_parent', status: 'won' } } });
  assert.equal((await premiumGet({ request: req('/api/premium?i=1', bearer(claimed.token)), env })).status, 403);
  // 購入の記録より先に返金が届いても、取りこぼさない
  await send({ type: 'charge.refunded', data: { object: { payment_intent: 'pi_early', refunded: true, amount: 390, amount_refunded: 390 } } });
  await send({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_early0000000', ...paid('solo', { payment_intent: 'pi_early' }) } } });
  const early = await issueToken(env, 'cs_test_early0000000');
  assert.equal((await premiumGet({ request: req('/api/premium?i=1', bearer(early)), env })).status, 403, '先に届いた返金も効く');
  // チャージバック：申し立てで止め、販売者が勝ったら戻す
  await send({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_dispute00000', ...paid('solo', { payment_intent: 'pi_dispute' }) } } });
  const disputed = await issueToken(env, 'cs_test_dispute00000');
  await send({ type: 'charge.dispute.created', data: { object: { payment_intent: 'pi_dispute', status: 'needs_response' } } });
  assert.equal((await premiumGet({ request: req('/api/premium?i=1', bearer(disputed)), env })).status, 403);
  await send({ type: 'charge.dispute.closed', data: { object: { payment_intent: 'pi_dispute', status: 'won' } } });
  assert.equal((await premiumGet({ request: req('/api/premium?i=1', bearer(disputed)), env })).status, 200, '申し立てに勝ったら戻す');
  // カード会社の問い合わせ（warning_）では止めない。申し立てに変わったら止め、問い合わせのまま閉じたら戻す
  await send({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_inquiry00000', ...paid('solo', { payment_intent: 'pi_inquiry' }) } } });
  const inquired = await issueToken(env, 'cs_test_inquiry00000');
  const readable = async () => (await premiumGet({ request: req('/api/premium?i=1', bearer(inquired)), env })).status;
  await send({ type: 'charge.dispute.created', data: { object: { payment_intent: 'pi_inquiry', status: 'warning_needs_response' } } });
  assert.equal(await readable(), 200, '問い合わせでは止めない');
  await send({ type: 'charge.dispute.updated', data: { object: { payment_intent: 'pi_inquiry', status: 'needs_response' } } });
  assert.equal(await readable(), 403, '申し立てに変わったら止める');
  await send({ type: 'charge.dispute.closed', data: { object: { payment_intent: 'pi_inquiry', status: 'warning_closed' } } });
  assert.equal(await readable(), 200, '問い合わせのまま閉じたら戻す');
  assert.equal((await webhookPost({ request: req('/api/stripe-webhook', { method: 'POST', body: '{}' }), env: SECRET })).status, 503);
});

test('ふたり用のプレゼント：買った人だけが券を出せて、受け取れるのは最初の1人だけ', async () => {
  const DB = fakeD1();
  const env = { ...SECRET, ...STRIPE, DB };
  const stripe = stubStripe({ cs_test_duo000000000: paid('duo'), cs_test_solo00000000: paid('solo') });
  try {
    const duo = await (await unlockGet({ request: req('/api/unlock?sid=cs_test_duo000000000'), env })).json();
    const solo = await (await unlockGet({ request: req('/api/unlock?sid=cs_test_solo00000000'), env })).json();
    assert.equal(duo.plan, 'duo');
    assert.equal('giftToken' in duo, false, 'プレゼント券は unlock では返さない');
    assert.equal((await giftGet({ request: req('/api/gift', bearer(solo.token)), env })).status, 404);
    assert.equal((await giftGet({ request: req('/api/gift'), env })).status, 401);
    const g = await (await giftGet({ request: req('/api/gift', bearer(duo.token)), env })).json();
    assert.equal(g.used, false);
    assert.equal(await verifyToken(env, g.gift), 'gift-cs_test_duo000000000');
    // 買った本人が開いても受け取れない（プレゼントが消えないように）。自分で買った完全版を持っている人も
    assert.equal((await giftPost({ request: post('/api/gift', { gift: g.gift }, { authorization: `Bearer ${duo.token}` }), env })).status, 409);
    assert.equal((await (await giftPost({ request: post('/api/gift', { gift: g.gift }, { cookie: `pz_t=${solo.token}` }), env })).json()).error, 'has');
    assert.equal((await giftPost({ request: post('/api/gift', { gift: g.gift }, { origin: 'https://evil.example' }), env })).status, 403);
    assert.equal((await (await giftGet({ request: req('/api/gift', bearer(duo.token)), env })).json()).used, false, 'まだ受け取られていない');
    const first = await giftPost({ request: post('/api/gift', { gift: g.gift }), env });
    assert.equal(first.status, 200);
    const friend = (await first.json()).token;
    assert.equal(await verifyToken(env, friend), 'gr-cs_test_duo000000000');
    assert.equal((await premiumGet({ request: req('/api/premium?i=2', bearer(friend)), env })).status, 200);
    assert.equal((await giftPost({ request: post('/api/gift', { gift: g.gift }), env })).status, 409, '2人目は受け取れない');
    assert.equal((await (await giftGet({ request: req('/api/gift', bearer(duo.token)), env })).json()).used, true);
    assert.equal((await giftPost({ request: post('/api/gift', { gift: duo.token }), env })).status, 400, '本人のトークンは券ではない');
    // 返金されたら、受け取った人も読めなくなる
    DB.raw.prepare("UPDATE purchases SET refunded = 1 WHERE id = 'cs_test_duo000000000'").run();
    assert.equal((await premiumGet({ request: req('/api/premium?i=2', bearer(friend)), env })).status, 403);
  } finally {
    stripe.restore();
  }
});

test('第1章の見本：二つ名の解説は前半だけ無料（types.js）、後半は有料の文章にだけある', () => {
  PARAM_DETAIL.forEach((levels, k) =>
    levels.forEach((detail, lv) => {
      const t = PARAM_TEXT[k][lv];
      assert.ok(t.sample.length > 0 && detail.startsWith(t.sample), `${k}-${lv}`);
      assert.equal(t.len, Array.from(detail).length);
      assert.equal(t.rest, Array.from(detail).length - Array.from(t.sample).length);
      assert.ok(t.rest >= Array.from(detail).length * 0.65, `続きの大半が残っている ${k}-${lv}`);
    }),
  );
  assert.ok(!fs.existsSync('functions/api/sample.js'), '有料文を返す見本APIはない');
  const free = fs.readFileSync('site/assets/types.js', 'utf8');
  PARAM_DETAIL.flat().forEach((d) => assert.ok(!free.includes(d.slice(-20)), '有料文の後半が無料のファイルに入っていない'));
});

test('計測：許可したキーだけ数え、日別にも記録する。回数制限と別サイトからの送信', async () => {
  const DB = fakeD1();
  const env = { DB, KPI_TOKEN: 'kpi' };
  const send = (k, v, headers) => eventPost({ request: post('/api/event', { k, v }, headers), env });
  for (const [k, v, status] of [
    ['start', '', 204],
    ['done', '6', 204],
    ['done', '19', 204],
    ['done', '20', 400],
    ['detail', 'done', 204],
    ['paywall', 'view', 204],
    ['share', 'nick-image', 204],
    ['share', 'evil', 400],
    ['premium', 'paid', 400],
    ['constructor', 'x', 400],
    ['__proto__', 'x', 400],
    ['ab', 'paybar:amount:exposure', 204],
    ['ab', 'autopay:off:checkout', 204],
    ['ab', 'paybar:amount:paid', 400],
    ['ab', 'paybar:nope:exposure', 400],
    ['ab', 'hasOwnProperty:x:exposure', 400],
    ['ab', 'calc:on:exposure', 400],
    ['ab', 'calc:on:result', 204],
    ['ab', 'calc:off:share', 204],
    ['ab', 'paybar:amount:share', 400],
    ['share', 'now-nick', 204],
    ['visit', 'return', 204],
    ['visit', 'first', 400],
  ]) {
    assert.equal((await send(k, v)).status, status, `${k}:${v}`);
  }
  assert.equal((await send('start', '', { origin: 'https://evil.example' })).status, 403);
  assert.equal((await send('agree', 'yes')).status, 204);
  assert.equal((await send('agree', 'maybe')).status, 400);
  const pub = await (await statsGet({ request: req('/api/stats'), env })).json();
  assert.deepEqual({ total: pub.total, counts: pub.counts }, { total: 2, counts: { 6: 1, 19: 1 } });
  assert.equal(pub.today, 2, '今日の完了数');
  assert.match(pub.since, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(pub.agree, { yes: 1, no: 0 });
  assert.equal((await statsGet({ request: req('/api/stats?all=1'), env })).status, 401);
  assert.equal((await statsGet({ request: req('/api/stats?all=1', bearer('kp')), env })).status, 401);
  const all = await (await statsGet({ request: req('/api/stats?all=1', bearer('kpi')), env })).json();
  assert.equal(all['detail:done'], 1);
  assert.ok(Object.keys(all).some((k) => /^day:\d{4}-\d{2}-\d{2}:start$/.test(k)));
  assert.ok(!Object.keys(all).some((k) => k.startsWith('rl') || k.includes(':rl')), '回数制限の行は counters に入れない');
  // 1分に60回まで
  let limited = false;
  for (let i = 0; i < 70 && !limited; i++) limited = (await send('start', '')).status === 429;
  assert.ok(limited);
  // 回数制限は IPv6 の /64 単位
  const v6 = (ip) => post('/api/event', { k: 'start', v: '' }, { 'cf-connecting-ip': ip });
  const env2 = { DB: fakeD1() };
  let blocked = false;
  for (let i = 0; i < 70 && !blocked; i++) blocked = (await eventPost({ request: v6(`2001:db8:1:2::${i.toString(16)}`), env: env2 })).status === 429;
  assert.ok(blocked, '同じ /64 のアドレスを変えても数えられる');
});

test('グループ：作成・参加・NGワード・かんたん診断の結果だけ保存・抜ける・外す・締め切る・消す・上限・期限切れ', async () => {
  const DB = fakeD1();
  const env = { DB };
  assert.equal((await groupCreate({ request: post('/api/groups', { name: 'バカの集まり' }), env })).status, 400);
  const created = await (await groupCreate({ request: post('/api/groups', { name: 'いつメン<script>' }), env })).json();
  assert.match(created.id, /^[a-z0-9]{8}$/);
  assert.match(created.admin, /^[a-z0-9]{16}$/);
  const params = { id: created.id };
  const join = (body, headers) => groupJoin({ params, request: post(`/api/groups/${created.id}`, body, headers), env });
  const get = (headers = {}) => groupGet({ params, request: req(`/api/groups/${created.id}`, { headers }), env }).then((r) => r.json());
  const yu = 'yusecret00000000aa';
  const ken = 'kensecret0000000bb';
  assert.equal((await join({ secret: yu, nick: 'ゆう', code: '6~-3_5_-7_1' })).status, 200);
  assert.equal((await join({ secret: ken, nick: 'けん', code: 'f~9_9_3_-5~123456' })).status, 200);
  assert.equal((await join({ secret: 'ngsecret00000000cc', nick: 'キモい', code: '6~-3_5_-7_1' })).status, 400);
  assert.equal((await join({ secret: 'short', nick: 'x', code: '6~-3_5_-7_1' })).status, 400);
  assert.equal((await join({ secret: yu, nick: 'x', code: '<b>' })).status, 400);
  // 秘密そのものは保存しない。くわしい診断のパラメータも保存しない
  const rows = DB.raw.prepare('SELECT member_id, handle, code FROM members ORDER BY created_at').all();
  assert.ok(rows.every((r) => r.member_id !== yu && r.member_id !== ken && /^[0-9a-f]{32}$/.test(r.member_id)));
  assert.equal(rows[1].code, 'f~9_9_3_-5');
  // 同じ秘密なら更新（人数は増えない）
  assert.equal((await join({ secret: yu, nick: 'ゆうゆう', code: '6~-3_5_-7_1' })).status, 200);
  const g = await get({ 'x-member': yu });
  assert.equal(g.name, 'いつメンscript');
  assert.equal(g.admin, false);
  assert.equal(g.members.length, 2);
  assert.equal(g.members[0].mine, true);
  assert.equal(g.members[0].nick, 'ゆうゆう');
  assert.equal(g.members[1].mine, false);
  assert.ok(!JSON.stringify(g).includes(rows[0].member_id), 'ハッシュも返さない');
  assert.ok(g.expiresAt > Date.now());
  // 作った人でも、ほかの人の秘密は見えない。見えるのは handle だけで、handle では名前を書きかえられない
  const asAdmin = await get({ 'x-admin': created.admin });
  assert.equal(asAdmin.admin, true);
  const kenHandle = asAdmin.members[1].handle;
  assert.match(kenHandle, /^[a-z0-9]{8}$/);
  assert.equal((await join({ secret: kenHandle.padEnd(16, '0'), nick: 'のっとり', code: '6~-3_5_-7_1' })).status, 200, '別の人として参加になるだけ');
  assert.equal((await get()).members.find((m) => m.handle === kenHandle).nick, 'けん', 'けんの名前は変わらない');
  // 別のグループでは、同じ端末でも別人として扱う（グループをまたいで追いかけられない）
  assert.equal((await groupDelete({ params, request: del(`/api/groups/${created.id}`, { admin: 'wrongwrongwrong1', handle: kenHandle }), env })).status, 403);
  assert.equal((await groupDelete({ params, request: del(`/api/groups/${created.id}`, { admin: created.admin, handle: kenHandle }), env })).status, 200);
  assert.equal((await get()).members.length, 2);
  // 締め切ると、新しい人は参加できない（いる人の更新はできる）
  const { onRequestPatch: groupPatch } = await import('../functions/api/groups/[id].js');
  const patch = (body) => groupPatch({ params, request: req(`/api/groups/${created.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), env });
  assert.equal((await patch({ admin: 'nope', locked: true })).status, 403);
  assert.equal((await patch({ admin: created.admin, locked: true })).status, 200);
  assert.equal((await get()).locked, true);
  assert.equal((await join({ secret: ken, nick: 'けん', code: '6~-3_5_-7_1' })).status, 403, '外された人も、締め切り中は戻れない');
  assert.equal((await join({ secret: yu, nick: 'ゆう', code: '6~-3_5_-7_1' })).status, 200, 'いる人は更新できる');
  await patch({ admin: created.admin, locked: false });
  // 自分で抜ける
  assert.equal((await groupDelete({ params, request: del(`/api/groups/${created.id}`, { secret: yu }), env })).status, 200);
  assert.equal((await get()).members.length, 1);
  // 50人で満員（回数制限に当たらないよう、残りはDBに直接入れる）
  const ins = DB.raw.prepare('INSERT INTO members (group_id, member_id, handle, nick, code, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)');
  for (let i = 0; i < 49; i++) ins.run(created.id, `hash${i}`, `hd${String(i).padStart(6, '0')}`, `m${i}`, '6~-3_5_-7_1', Date.now() + i);
  assert.equal((await join({ secret: 'latecomer0000000dd', nick: 'おそい', code: '6~-3_5_-7_1' })).status, 409);
  // 同じWi-Fiから21人目も参加できる（IPごとの上限は1分60回）
  const g2 = await (await groupCreate({ request: post('/api/groups', { name: '部活' }, { 'cf-connecting-ip': '10.0.0.9' }), env })).json();
  const join2 = (i) => groupJoin({ params: { id: g2.id }, request: post(`/api/groups/${g2.id}`, { secret: `student${String(i).padStart(9, '0')}`, nick: `s${i}`, code: '6~-3_5_-7_1' }), env });
  for (let i = 0; i < 30; i++) assert.equal((await join2(i)).status, 200, `${i + 1}人目`);
  // 作った人がグループを消す
  assert.equal((await groupDelete({ params, request: del(`/api/groups/${created.id}`, { admin: created.admin, all: true }), env })).status, 200);
  assert.equal((await groupGet({ params, request: req(`/api/groups/${created.id}`), env })).status, 404);
  assert.equal(DB.raw.prepare('SELECT COUNT(*) AS n FROM members WHERE group_id = ?1').get(created.id).n, 0);
  // 90日を過ぎたら見えない
  DB.raw.prepare('UPDATE groups SET created_at = ?1 WHERE id = ?2').run(Date.now() - 91 * 24 * 3600 * 1000, g2.id);
  assert.equal((await groupGet({ params: { id: g2.id }, request: req(`/api/groups/${g2.id}`), env })).status, 404);
});

test('NGワード：表記ゆれ（半角・全角・空白・見えない文字）も弾き、よくある名前は通す', async () => {
  const { hasNgWord, cleanText } = await import('../functions/_lib/http.js');
  for (const bad of ['バカ', 'ﾊﾞｶ', 'ば か', 'ば\u200bか', 'ＢＡＫＡ', '馬鹿', 'ブサイク', '死んで', 'ばーか', 'ＦＵＣＫ', '3年2組の高校']) {
    assert.ok(hasNgWord(bad), bad);
  }
  for (const ok of ['かすみ', 'カスミ', 'くずは', 'きもちいい', 'カステラ部', 'ぼっち・ざ・ろっく', '殺せんせー推し', 'ゆう', 'あお', 'ゆき もも', 'まき もか', 'みき・もえ', 'もも ころすけ', 'かすが', 'たかすぎ', 'あきもと', 'ぼっちゃん']) {
    assert.ok(!hasNgWord(ok), ok);
  }
  // 許可語に続けて書いても、悪口は通さない
  for (const bad of ['しねまじで', 'きもちわるい', 'キモチワルイ', 'ばかすみ', 'し ね']) assert.ok(hasNgWord(bad), bad);
  assert.equal(cleanText('ゆ\u202eう\u200b<b>', 10), 'ゆうb');
});

test('今週のお題：今週にだけ投票でき、30票に満たない集計は出さない', async () => {
  const { onRequestPost: pollPost, onRequestGet: pollGet } = await import('../functions/api/poll.js');
  const { weekIdOf } = await import('../functions/_lib/week.js');
  const env = { DB: fakeD1() };
  const week = weekIdOf();
  const vote = (body, ip = '203.0.113.1') => pollPost({ request: post('/api/poll', body, { 'cf-connecting-ip': ip }), env });
  assert.equal((await vote({ week, choice: 1, type: 3 })).status, 200);
  assert.equal((await vote({ week: '2020-01-06', choice: 1, type: 3 })).status, 409, '前の週には投票できない');
  assert.equal((await vote({ week, choice: 4, type: 3 })).status, 400);
  assert.equal((await vote({ week, choice: 1, type: 20 })).status, 400);
  assert.equal((await vote({ week, choice: '1' })).status, 400);
  assert.equal((await vote({ week, choice: 2, type: null })).status, 200, 'タイプなしでも投票できる');
  let data = await (await pollGet({ request: req(`/api/poll?week=${week}`), env })).json();
  assert.equal(data.total, 2);
  assert.equal(data.all, null, '少ないうちは割合を出さない');
  assert.deepEqual(data.types, {});
  // 1つのIPからは1分に10票まで
  let limited = false;
  for (let i = 0; i < 12 && !limited; i++) limited = (await vote({ week, choice: 0 }, '198.51.100.7')).status === 429;
  assert.ok(limited, '回数制限がかかる');
  for (let i = 0; i < 30; i++) await vote({ week, choice: i % 3 === 0 ? 0 : 1, type: 3 }, `192.0.2.${i}`);
  data = await (await pollGet({ request: req(`/api/poll?week=${week}`), env })).json();
  assert.ok(data.total >= 30 && Array.isArray(data.all) && data.all.length === 4);
  // タイプ3以外の票（タイプなし・回数制限の前の票など）が30票未満なので、引き算で分からないようタイプ別は出さない
  assert.deepEqual(data.types, {}, '隠した票が少ないときはタイプ別を出さない');
  for (let i = 0; i < 30; i++) await vote({ week, choice: 2, type: 5 }, `198.18.0.${i}`);
  data = await (await pollGet({ request: req(`/api/poll?week=${week}`), env })).json();
  assert.deepEqual(data.types, {}, 'タイプなしの票がまだ30票未満');
  for (let i = 0; i < 30; i++) await vote({ week, choice: 3 }, `198.19.0.${i}`);
  data = await (await pollGet({ request: req(`/api/poll?week=${week}`), env })).json();
  assert.deepEqual(data.types['3'], [10, 21, 0, 0]);
  assert.deepEqual(data.types['5'], [0, 0, 30, 0]);
  assert.equal((await pollGet({ request: req('/api/poll?week=2999-01-04'), env })).status, 400, '先の週は読めない');
  assert.equal((await pollGet({ request: req('/api/poll?week=x'), env })).status, 400);
  // 他のサイトからの投票は弾く
  assert.equal((await pollPost({ request: post('/api/poll', { week, choice: 0 }, { origin: 'https://evil.example' }), env })).status, 403);
});
