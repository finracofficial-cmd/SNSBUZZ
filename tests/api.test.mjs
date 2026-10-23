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
    run: async () => {
      const r = db.prepare(sql).run(...args);
      return { success: true, meta: { changes: Number(r.changes) } };
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
const STRIPE = { STRIPE_SECRET_KEY: 'sk_test', STRIPE_PRICE_ID: 'price_solo', STRIPE_PRICE_ID_DUO: 'price_duo' };

// Stripe の API を差し替える（価格・Checkout Session）
function stubStripe(sessions, prices = { price_solo: 390, price_duo: 590 }) {
  const realFetch = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    sent.push({ url: u, body: init.body ? String(init.body) : '' });
    if (init.method === 'POST') return Response.json({ url: 'https://checkout.stripe.com/c/pay/x' });
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
    cs_test_solo00000000: paid('solo'),
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
    assert.equal((await unlock('cs_test_other0000000')).status, 404);
    assert.equal((await unlock('cs_test_unpaid000000')).status, 402);
    assert.equal((await unlock('cs_test_old000000000')).status, 410);
    assert.equal((await unlock('nope')).status, 400);
    // Cookie から戻せる
    const restored = await restoreGet({ request: req('/api/restore', { headers: { cookie: `pz_t=${b1.token}` } }), env });
    assert.equal((await restored.json()).token, b1.token);
    assert.equal((await restoreGet({ request: req('/api/restore'), env })).status, 404);
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
  assert.equal((await send(completed)).status, 200);
  assert.equal((await send(completed)).status, 200, '同じ通知が2回来ても大丈夫');
  assert.equal(DB.raw.prepare("SELECT n FROM counters WHERE k = 'premium:paid'").get().n, 1);
  // 子どもの端末は秘密で受け取れる。リンクに入っている受け取りIDだけでは受け取れない
  const claimed = await (await claimGet({ request: req(`/api/claim?s=${secret}`), env })).json();
  assert.equal(await verifyToken(env, claimed.token), 'cs_test_parent000000');
  assert.equal((await claimGet({ request: req(`/api/claim?s=${rid}`), env })).status, 400);
  assert.equal((await claimGet({ request: req(`/api/claim?s=${'b'.repeat(26)}`), env })).status, 404);
  assert.equal((await premiumGet({ request: req('/api/premium?i=1', bearer(claimed.token)), env })).status, 200);
  // ほかの商品の通知は記録しない
  await send({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_other', payment_status: 'paid', metadata: { plan: 'solo' } } } });
  assert.equal(DB.raw.prepare("SELECT COUNT(*) AS n FROM purchases WHERE id = 'cs_test_other'").get().n, 0);
  // 返金
  assert.equal((await send({ type: 'charge.refunded', data: { object: { payment_intent: 'pi_parent', refunded: true } } })).status, 200);
  assert.equal((await premiumGet({ request: req('/api/premium?i=1', bearer(claimed.token)), env })).status, 403);
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
      assert.ok(t.rest >= Array.from(detail).length * 0.4, `後半が残っている ${k}-${lv}`);
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
  ]) {
    assert.equal((await send(k, v)).status, status, `${k}:${v}`);
  }
  assert.equal((await send('start', '', { origin: 'https://evil.example' })).status, 403);
  const pub = await (await statsGet({ request: req('/api/stats'), env })).json();
  assert.deepEqual(pub, { total: 2, counts: { 6: 1, 19: 1 } });
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

test('グループ：作成・参加・NGワード・かんたん診断の結果だけ保存・抜ける・外す・消す・上限・期限切れ', async () => {
  const DB = fakeD1();
  const env = { DB };
  assert.equal((await groupCreate({ request: post('/api/groups', { name: 'バカの集まり' }), env })).status, 400);
  const created = await (await groupCreate({ request: post('/api/groups', { name: 'いつメン<script>' }), env })).json();
  assert.match(created.id, /^[a-z0-9]{8}$/);
  assert.match(created.admin, /^[a-z0-9]{16}$/);
  const params = { id: created.id };
  const join = (body, headers) => groupJoin({ params, request: post(`/api/groups/${created.id}`, body, headers), env });
  assert.equal((await join({ id: 'abc123def', nick: 'ゆう', code: '6~-3_5_-7_1' })).status, 200);
  assert.equal((await join({ id: 'zzz999yyy', nick: 'けん', code: 'f~9_9_3_-5~123456' })).status, 200);
  assert.equal((await join({ id: 'ngngng111', nick: 'キモい', code: '6~-3_5_-7_1' })).status, 400);
  assert.equal((await join({ id: 'bad', nick: 'x', code: '<b>' })).status, 400);
  // くわしい診断のパラメータは保存しない
  assert.equal(DB.raw.prepare("SELECT code FROM members WHERE member_id = 'zzz999yyy'").get().code, 'f~9_9_3_-5');
  // 同じIDなら更新（人数は増えない）
  assert.equal((await join({ id: 'abc123def', nick: 'ゆうゆう', code: '6~-3_5_-7_1' })).status, 200);
  const g = await (await groupGet({ params, request: req(`/api/groups/${created.id}?me=abc123def`), env })).json();
  assert.equal(g.name, 'いつメンscript');
  assert.equal(g.admin, false);
  assert.equal(g.members.length, 2);
  assert.equal(g.members[0].id, 'abc123def');
  assert.equal(g.members[0].nick, 'ゆうゆう');
  assert.notEqual(g.members[1].id, 'zzz999yyy');
  assert.ok(g.expiresAt > Date.now());
  // 作った人だけが、本当のメンバーIDを見て外せる
  const asAdmin = await (await groupGet({ params, request: req(`/api/groups/${created.id}?admin=${created.admin}`), env })).json();
  assert.equal(asAdmin.admin, true);
  assert.equal(asAdmin.members[1].id, 'zzz999yyy');
  assert.equal((await groupDelete({ params, request: del(`/api/groups/${created.id}`, { admin: 'wrongwrongwrong1', member: 'zzz999yyy' }), env })).status, 403);
  assert.equal((await groupDelete({ params, request: del(`/api/groups/${created.id}`, { admin: created.admin, member: 'zzz999yyy' }), env })).status, 200);
  // 自分で抜ける
  assert.equal((await groupDelete({ params, request: del(`/api/groups/${created.id}`, { id: 'abc123def' }), env })).status, 200);
  assert.equal((await (await groupGet({ params, request: req(`/api/groups/${created.id}`), env })).json()).members.length, 0);
  // 50人で満員（回数制限に当たらないよう、残りはDBに直接入れる）
  const ins = DB.raw.prepare('INSERT INTO members (group_id, member_id, nick, code, created_at) VALUES (?1, ?2, ?3, ?4, ?5)');
  for (let i = 0; i < 50; i++) ins.run(created.id, `member${String(i).padStart(4, '0')}`, `m${i}`, '6~-3_5_-7_1', Date.now() + i);
  assert.equal((await join({ id: 'latecomer1', nick: 'おそい', code: '6~-3_5_-7_1' })).status, 409);
  // 同じWi-Fiから21人目も参加できる（IPごとの上限は1分60回）
  const g2 = await (await groupCreate({ request: post('/api/groups', { name: '部活' }, { 'cf-connecting-ip': '10.0.0.9' }), env })).json();
  const join2 = (i) => groupJoin({ params: { id: g2.id }, request: post(`/api/groups/${g2.id}`, { id: `student${String(i).padStart(3, '0')}`, nick: `s${i}`, code: '6~-3_5_-7_1' }), env });
  for (let i = 0; i < 30; i++) assert.equal((await join2(i)).status, 200, `${i + 1}人目`);
  // 作った人がグループを消す
  assert.equal((await groupDelete({ params, request: del(`/api/groups/${created.id}`, { admin: created.admin, all: true }), env })).status, 200);
  assert.equal((await groupGet({ params, request: req(`/api/groups/${created.id}`), env })).status, 404);
  assert.equal(DB.raw.prepare('SELECT COUNT(*) AS n FROM members WHERE group_id = ?1').get(created.id).n, 0);
  // 90日を過ぎたら見えない
  DB.raw.prepare('UPDATE groups SET created_at = ?1 WHERE id = ?2').run(Date.now() - 91 * 24 * 3600 * 1000, g2.id);
  assert.equal((await groupGet({ params: { id: g2.id }, request: req(`/api/groups/${g2.id}`), env })).status, 404);
});
