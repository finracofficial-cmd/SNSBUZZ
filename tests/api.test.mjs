// Pages Functions を、本物のスキーマを入れたSQLite（D1の代わり）で動かして確かめる
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { issueToken, verifyToken } from '../functions/_lib/token.js';
import { onRequestGet as premiumGet } from '../functions/api/premium/index.js';
import { onRequestGet as statusGet } from '../functions/api/premium/status.js';
import { onRequestPost as redeemPost } from '../functions/api/redeem.js';
import { onRequestPost as checkoutPost } from '../functions/api/checkout.js';
import { onRequestGet as unlockGet } from '../functions/api/unlock.js';
import { onRequestGet as claimGet } from '../functions/api/claim.js';
import { onRequestGet as sampleGet } from '../functions/api/sample.js';
import { onRequestPost as eventPost } from '../functions/api/event.js';
import { onRequestGet as statsGet } from '../functions/api/stats.js';
import { onRequestPost as groupCreate } from '../functions/api/groups/index.js';
import { onRequestGet as groupGet, onRequestPost as groupJoin } from '../functions/api/groups/[id].js';
import { PREMIUM, PARAM_DETAIL, LOVE_DETAIL } from '../functions/_lib/premium.js';
import { paramLevel, nicknameOf } from '../site/assets/logic.js';
import { loveIndexOf } from '../site/assets/data.js';

function fakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync('schema.sql', 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    run: async () => (db.prepare(sql).run(...args), { success: true }),
    all: async () => ({ results: db.prepare(sql).all(...args) }),
  });
  return { prepare: (sql) => stmt(sql), batch: async (list) => Promise.all(list.map((s) => s.run())), raw: db };
}

const req = (url, init = {}) => new Request(`https://example.com${url}`, init);
const post = (url, body, headers = {}) =>
  req(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const SECRET = { PREMIUM_SECRET: 'test-secret-0123456789' };

test('購入トークン：正しい署名だけ通る', async () => {
  const token = await issueToken(SECRET, 'cs_test_abc');
  assert.ok(await verifyToken(SECRET, token));
  assert.equal(await verifyToken({ PREMIUM_SECRET: 'other-secret' }, token), false);
  assert.equal(await verifyToken(SECRET, token.slice(0, -2) + 'xx'), false);
  assert.equal(await verifyToken(SECRET, 'v1.cs_test_abc.short'), false);
  assert.equal(await verifyToken({}, token), false);
});

test('完全版：トークンなしは401、ありならタイプの文言、パラメータ付きなら段階と恋愛タイプの文言', async () => {
  assert.equal((await premiumGet({ request: req('/api/premium?i=6'), env: SECRET })).status, 401);
  const token = await issueToken(SECRET, 'promo-TEST');
  const auth = { headers: { authorization: `Bearer ${token}` } };
  const r1 = await premiumGet({ request: req('/api/premium?i=6', auth), env: SECRET });
  assert.equal(r1.status, 200);
  const b1 = await r1.json();
  assert.deepEqual(b1.type, PREMIUM[6]);
  assert.equal(b1.params, null);
  // 0〜12 の各値で、サーバーの段階と恋愛タイプがブラウザの paramLevel・loveIndexOf と一致する
  const digits = '0c8463';
  const r2 = await premiumGet({ request: req(`/api/premium?i=6&p=${digits}`, auth), env: SECRET });
  const b2 = await r2.json();
  const pcts = Array.from(digits, (d) => Math.round((parseInt(d, 36) / 12) * 100));
  pcts.forEach((p, k) => assert.equal(b2.params[k], PARAM_DETAIL[k][paramLevel(p)]));
  assert.deepEqual(b2.love, LOVE_DETAIL[loveIndexOf(pcts)]);
  for (let d = 0; d <= 12; d++) {
    const p = Math.round((d / 12) * 100);
    const c = d.toString(36);
    const r = await (await premiumGet({ request: req(`/api/premium?i=0&p=${c.repeat(6)}`, auth), env: SECRET })).json();
    assert.equal(r.params[0], PARAM_DETAIL[0][paramLevel(p)], `値 ${d}`);
    assert.deepEqual(r.love, LOVE_DETAIL[loveIndexOf([p, p, p])], `恋愛タイプ ${d}`);
  }
  assert.equal((await premiumGet({ request: req('/api/premium?i=6&p=d00000', auth), env: SECRET })).status, 400);
  assert.equal((await premiumGet({ request: req('/api/premium?i=6&p=12', auth), env: SECRET })).status, 400);
  assert.equal((await premiumGet({ request: req('/api/premium?i=99', auth), env: SECRET })).status, 404);
});

test('コードで開放：大文字小文字を問わず、登録されたコードだけ', async () => {
  const env = { ...SECRET, PROMO_CODES: 'OSHI2027, SCHOOLFES' };
  assert.equal((await redeemPost({ request: post('/api/redeem', { code: 'nope' }), env })).status, 400);
  const ok = await redeemPost({ request: post('/api/redeem', { code: 'oshi2027' }), env });
  assert.equal(ok.status, 200);
  assert.ok(await verifyToken(env, (await ok.json()).token));
  assert.equal((await redeemPost({ request: post('/api/redeem', { code: 'x' }), env: {} })).status, 503);
});

test('決済：Stripeの設定がなければ販売しない。プランは設定に応じて出る', async () => {
  assert.equal((await checkoutPost({ request: post('/api/checkout', { index: 1 }), env: SECRET })).status, 503);
  const s = await (await statusGet({ env: SECRET })).json();
  assert.equal(s.enabled, false);
  assert.deepEqual(s.plans.map((p) => [p.id, p.price, p.available]), [['solo', 390, false]]);
  const full = { ...SECRET, STRIPE_SECRET_KEY: 'sk_test', STRIPE_PRICE_ID: 'price_solo', STRIPE_PRICE_ID_DUO: 'price_duo' };
  const s2 = await (await statusGet({ env: full })).json();
  assert.equal(s2.enabled, true);
  assert.deepEqual(s2.plans.map((p) => [p.id, p.price, p.available]), [['solo', 390, true], ['duo', 590, true]]);
  assert.ok(!JSON.stringify(s2).includes('price_'), '価格IDは返さない');
});

test('決済の流れ（Stripeは差し替え）：プラン・受け取りID・プレゼント・子どもの受け取り', async () => {
  const DB = fakeD1();
  const env = { ...SECRET, DB, STRIPE_SECRET_KEY: 'sk_test', STRIPE_PRICE_ID: 'price_solo', STRIPE_PRICE_ID_DUO: 'price_duo' };
  const realFetch = globalThis.fetch;
  const sent = [];
  const sessions = {
    cs_test_solo00000000: { payment_status: 'paid', metadata: { plan: 'solo' } },
    cs_test_duo000000000: { payment_status: 'paid', metadata: { plan: 'duo' }, client_reference_id: 'abcdefgh12345678' },
    cs_test_unpaid000000: { payment_status: 'unpaid', metadata: { plan: 'solo' } },
  };
  globalThis.fetch = async (url, init = {}) => {
    sent.push({ url: String(url), body: init.body ? String(init.body) : '' });
    if (init.method === 'POST') return new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/pay/x' }), { status: 200 });
    const sid = String(url).split('/').pop();
    return new Response(JSON.stringify(sessions[sid] || {}), { status: sessions[sid] ? 200 : 404 });
  };
  try {
    // チェックアウト：プランごとの価格IDと受け取りID
    const c1 = await checkoutPost({ request: post('/api/checkout', { plan: 'duo', index: 3, rid: 'abcdefgh12345678' }), env });
    assert.equal(c1.status, 200);
    const form = new URLSearchParams(sent.at(-1).body);
    assert.equal(form.get('line_items[0][price]'), 'price_duo');
    assert.equal(form.get('client_reference_id'), 'abcdefgh12345678');
    assert.equal(form.get('metadata[plan]'), 'duo');
    await checkoutPost({ request: post('/api/checkout', { plan: 'weird', rid: 'BAD' }), env });
    const form2 = new URLSearchParams(sent.at(-1).body);
    assert.equal(form2.get('line_items[0][price]'), 'price_solo');
    assert.equal(form2.get('client_reference_id'), null);
    // 受け取り前は pending
    assert.equal((await claimGet({ request: req('/api/claim?rid=abcdefgh12345678'), env })).status, 404);
    // 支払い確認
    const solo = await (await unlockGet({ request: req('/api/unlock?sid=cs_test_solo00000000'), env })).json();
    assert.ok(await verifyToken(env, solo.token));
    assert.equal(solo.giftToken, null);
    const duo = await (await unlockGet({ request: req('/api/unlock?sid=cs_test_duo000000000'), env })).json();
    assert.ok(await verifyToken(env, duo.token));
    assert.ok(await verifyToken(env, duo.giftToken));
    assert.notEqual(duo.token, duo.giftToken);
    assert.equal(duo.forChild, true);
    assert.equal((await unlockGet({ request: req('/api/unlock?sid=cs_test_unpaid000000'), env })).status, 402);
    // 子どもの端末が受け取る
    const claimed = await (await claimGet({ request: req('/api/claim?rid=abcdefgh12345678'), env })).json();
    assert.equal(claimed.token, duo.token);
    assert.equal((await claimGet({ request: req('/api/claim?rid=short'), env })).status, 400);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('見本：二つ名のもとになったパラメータの解説だけを返し、選び方はブラウザと一致する', async () => {
  for (const [i, p] of [[0, '0c8463'], [5, '666666'], [11, 'c0c0c0'], [15, '123456']]) {
    const b = await (await sampleGet({ request: req(`/api/sample?i=${i}&p=${p}`) })).json();
    const pcts = Array.from(p, (d) => Math.round((parseInt(d, 36) / 12) * 100));
    const nick = nicknameOf(pcts, i);
    assert.equal(b.param, nick.param, `${i} ${p}`);
    assert.equal(b.detail, PARAM_DETAIL[nick.param][paramLevel(pcts[nick.param])]);
    assert.equal(Object.keys(b).sort().join(','), 'detail,level,param');
  }
  assert.equal((await sampleGet({ request: req('/api/sample?i=16&p=000000') })).status, 400);
  assert.equal((await sampleGet({ request: req('/api/sample?i=1&p=zzzzzz') })).status, 400);
});

test('計測：許可したキーだけ数え、日別にも記録する', async () => {
  const DB = fakeD1();
  const env = { DB, KPI_TOKEN: 'kpi' };
  const send = (k, v) => eventPost({ request: post('/api/event', { k, v }), env });
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
  const pub = await (await statsGet({ request: req('/api/stats'), env })).json();
  assert.deepEqual(pub, { total: 2, counts: { 6: 1, 19: 1 } });
  assert.equal((await statsGet({ request: req('/api/stats?all=1'), env })).status, 401);
  const all = await (await statsGet({ request: req('/api/stats?all=1', { headers: { authorization: 'Bearer kpi' } }), env })).json();
  assert.equal(all['detail:done'], 1);
  assert.ok(Object.keys(all).some((k) => /^day:\d{4}-\d{2}-\d{2}:start$/.test(k)));
});

test('グループ：作成・参加・更新・上限・他人のIDを返さない・期限切れ', async () => {
  const DB = fakeD1();
  const env = { DB };
  const created = await (await groupCreate({ request: post('/api/groups', { name: '2年3組<script>' }), env })).json();
  assert.match(created.id, /^[a-z0-9]{8}$/);
  const params = { id: created.id };
  const join = (body) => groupJoin({ params, request: post(`/api/groups/${created.id}`, body), env });
  assert.equal((await join({ id: 'abc123def', nick: 'ゆい', code: '6~-3_5_-7_1' })).status, 200);
  assert.equal((await join({ id: 'zzz999yyy', nick: 'けん', code: 'f~9_9_3_-5~123456' })).status, 200);
  assert.equal((await join({ id: 'bad', nick: 'x', code: '<b>' })).status, 400);
  // 同じIDなら更新（人数は増えない）
  assert.equal((await join({ id: 'abc123def', nick: 'ゆいゆい', code: '6~-3_5_-7_1' })).status, 200);
  const g = await (await groupGet({ params, request: req(`/api/groups/${created.id}?me=abc123def`), env })).json();
  assert.equal(g.name, '2年3組script');
  assert.equal(g.members.length, 2);
  assert.equal(g.members[0].id, 'abc123def');
  assert.equal(g.members[0].nick, 'ゆいゆい');
  assert.notEqual(g.members[1].id, 'zzz999yyy');
  // 50人で満員（回数制限に当たらないよう、残りはDBに直接入れる）
  const ins = DB.raw.prepare('INSERT INTO members (group_id, member_id, nick, code, created_at) VALUES (?1, ?2, ?3, ?4, ?5)');
  for (let i = 0; i < 48; i++) ins.run(created.id, `member${String(i).padStart(4, '0')}`, `m${i}`, '6~-3_5_-7_1', Date.now() + i);
  assert.equal((await join({ id: 'latecomer1', nick: 'おそい', code: '6~-3_5_-7_1' })).status, 409);
  // 同じIPから1分に20回を超える参加は弾く
  let limited = false;
  for (let i = 0; i < 25 && !limited; i++) limited = (await join({ id: 'abc123def', nick: 'ゆい', code: '6~-3_5_-7_1' })).status === 429;
  assert.ok(limited);
  // 90日を過ぎたら見えない
  DB.raw.prepare('UPDATE groups SET created_at = ?1 WHERE id = ?2').run(Date.now() - 91 * 24 * 3600 * 1000, created.id);
  assert.equal((await groupGet({ params, request: req(`/api/groups/${created.id}`), env })).status, 404);
});
