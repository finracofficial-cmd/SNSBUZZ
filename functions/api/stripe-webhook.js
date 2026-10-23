// POST /api/stripe-webhook — Stripe からの通知。ブラウザが /thanks/ に戻れなかったときも購入を記録し、
// おうちの人の支払いなら子どもの端末への受け取りを用意する。返金されたら、その購入では読めなくする。
// Stripe のダッシュボードで次のイベントを送るように設定し、署名シークレットを STRIPE_WEBHOOK_SECRET に入れる:
//   checkout.session.completed / checkout.session.async_payment_succeeded / charge.refunded
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
    await env.DB.prepare('UPDATE purchases SET refunded = 1 WHERE payment_intent = ?1').bind(String(obj.payment_intent)).run();
  }
  return json({ received: true });
}
