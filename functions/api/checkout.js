// POST /api/checkout {plan, index, rid} — Stripe Checkout のセッションを作り、支払いページのURLを返す。
// rid は「おうちの人に払ってもらう」ときの受け取りID。支払い後、子どもの端末がこのIDで完全版を受け取る。
import { json, readJson, rateLimited } from '../_lib/http.js';
import { premiumEnabled, priceIdOf } from '../_lib/token.js';

export async function onRequestPost({ request, env }) {
  if (!premiumEnabled(env)) return json({ error: 'disabled' }, 503);
  if (await rateLimited(env, request, 'checkout', 10)) return json({ error: 'rate' }, 429);
  const body = await readJson(request);
  const plan = body?.plan === 'duo' ? 'duo' : 'solo';
  const priceId = priceIdOf(env, plan);
  if (!priceId) return json({ error: 'plan' }, 400);
  const rid = /^[a-z0-9]{16}$/.test(body?.rid || '') ? body.rid : '';
  const index = Number(body?.index);
  const origin = new URL(request.url).origin;
  const form = new URLSearchParams({
    mode: 'payment',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: `${origin}/thanks/?sid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/`,
    locale: 'ja',
    'metadata[plan]': plan,
    'metadata[type]': Number.isInteger(index) ? String(index) : '',
  });
  if (rid) form.set('client_reference_id', rid);
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const session = await res.json();
  if (!res.ok || !session.url) return json({ error: 'stripe' }, 502);
  return json({ url: session.url });
}
