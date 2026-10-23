// POST /api/stripe-webhook — Stripe からの通知。ブラウザが /thanks/ に戻れなかったときも購入を記録し、
// おうちの人の支払いなら子どもの端末への受け取りを用意する。
// 全額返金・チャージバック（不正利用の申し立て）では、その購入では読めなくする（一部返金では止めない）。
// カード会社からの「問い合わせ」（status が warning_ で始まる）では止めない。本当の申し立てに変わったら止める。
// 申し立てで販売者が勝ったら、また読めるようにする。購入の記録より先に届いても取りこぼさないよう、refunds 表に残す。
// Stripe のダッシュボードで次のイベントを送るように設定し、署名シークレットを STRIPE_WEBHOOK_SECRET に入れる:
//   checkout.session.completed / checkout.session.async_payment_succeeded / charge.refunded
//   charge.dispute.created / charge.dispute.updated / charge.dispute.closed
import { json, sameText } from '../_lib/http.js';
import { isOurSession, recordPurchase } from '../_lib/purchase.js';

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
