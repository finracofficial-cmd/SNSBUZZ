// POST /api/stripe-webhook — Stripe からの通知。ブラウザが /thanks/ に戻れなかったときも購入を記録し、
// おうちの人の支払いなら子どもの端末への受け取りを用意する。
// 全額返金・チャージバック（不正利用の申し立て）では、その購入では読めなくする（一部返金では止めない）。
// カード会社からの「問い合わせ」（status が warning_ で始まる）では止めない。本当の申し立てに変わったら止める。
// 申し立てで販売者が勝ったら、また読めるようにする。購入の記録より先に届いても取りこぼさないよう、refunds 表に残す。
// Stripe のダッシュボードで次のイベントを送るように設定し、署名シークレットを STRIPE_WEBHOOK_SECRET に入れる:
//   checkout.session.completed / checkout.session.async_payment_succeeded / charge.refunded
//   charge.dispute.created / charge.dispute.updated / charge.dispute.closed
import { json, sameText } from '../_lib/http.js';
import { isOurSession, recordPurchase, jstDay } from '../_lib/purchase.js';

const TOLERANCE = 5 * 60;
const enc = new TextEncoder();

async function verify(payload, header, secret) {
  const parts = Object.fromEntries(
    String(header || '')
      .split(',')
      .map((kv) => kv.split('='))
      .filter(([k]) => k === 't'),
  );
  const t = Number(parts.t);
  const sigs = String(header || '')
    .split(',')
    .filter((kv) => kv.startsWith('v1='))
    .map((kv) => kv.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > TOLERANCE) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return sigs.some((s) => sameText(s, expected));
}

// 返金した金額を、返金した月の売上から引けるように数える。charge.refunded の amount_refunded は累計なので、
// 前に数えた分との差だけを足す（一部返金が2回あっても二重に数えない）
async function recordRefundAmount(env, pi, total) {
  if (!Number.isFinite(total) || total <= 0) return;
  const seen = await env.DB.prepare('SELECT n FROM counters WHERE k = ?1').bind(`refunded:${pi}`).first();
  const delta = total - (seen?.n || 0);
  if (delta <= 0) return;
  const add = env.DB.prepare('INSERT INTO counters (k, n) VALUES (?1, ?2) ON CONFLICT(k) DO UPDATE SET n = n + ?2');
  const day = jstDay();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO counters (k, n) VALUES (?1, ?2) ON CONFLICT(k) DO UPDATE SET n = ?2').bind(`refunded:${pi}`, total),
    add.bind(`refund:${day.slice(0, 7)}`, delta),
    add.bind(`day:${day}:refund`, delta),
  ]);
}

// 返金は申し立てより優先する（返金のあとで申し立てに勝っても、読めるようには戻さない）
async function revoke(env, pi, reason) {
  const insert = reason === 'refund' ? 'INSERT OR REPLACE' : 'INSERT OR IGNORE';
  await env.DB.batch([
    env.DB.prepare(`${insert} INTO refunds (payment_intent, reason, at) VALUES (?1, ?2, ?3)`).bind(pi, reason, Date.now()),
    env.DB.prepare('UPDATE purchases SET refunded = 1 WHERE payment_intent = ?1').bind(pi),
  ]);
}

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_WEBHOOK_SECRET || !env.PREMIUM_SECRET || !env.DB) return json({ error: 'disabled' }, 503);
  const payload = await request.text();
  if (payload.length > 200000 || !(await verify(payload, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET))) {
    return json({ error: 'signature' }, 400);
  }
  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return json({ error: 'bad' }, 400);
  }
  const obj = event?.data?.object;
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    if (isOurSession(obj) && obj.payment_status === 'paid') await recordPurchase(env, obj);
  } else if (event.type === 'charge.refunded' && obj?.payment_intent) {
    await recordRefundAmount(env, String(obj.payment_intent), Number(obj.amount_refunded));
    if (obj.refunded === true || Number(obj.amount_refunded) >= Number(obj.amount)) await revoke(env, String(obj.payment_intent), 'refund');
  } else if ((event.type === 'charge.dispute.created' || event.type === 'charge.dispute.updated') && obj?.payment_intent) {
    if (!String(obj.status || '').startsWith('warning_')) await revoke(env, String(obj.payment_intent), 'dispute');
  } else if (event.type === 'charge.dispute.closed' && obj?.payment_intent && ['won', 'warning_closed'].includes(obj.status)) {
    const pi = String(obj.payment_intent);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM refunds WHERE payment_intent = ?1 AND reason = 'dispute'").bind(pi),
      env.DB.prepare('UPDATE purchases SET refunded = 0 WHERE payment_intent = ?1 AND NOT EXISTS (SELECT 1 FROM refunds WHERE payment_intent = ?1)').bind(pi),
    ]);
  }
  return json({ received: true });
}
