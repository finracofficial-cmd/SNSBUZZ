// POST /api/checkout {index} — Stripe Checkout のセッションを作り、支払いページのURLを返す
import { json, readJson, rateLimited } from '../_lib/http.js';
import { premiumEnabled } from '../_lib/token.js';

export async function onRequestPost({ request, env }) {
  if (!premiumEnabled(env)) return json({ error: 'disabled' }, 503);
  if (await rateLimited(env, request, 'checkout', 10)) return json({ error: 'rate' }, 429);
  const body = await readJson(request);
  const index = Number(body?.index);
  const origin = new URL(request.url).origin;
  const form = new URLSearchParams({
    mode: 'payment',
    'line_items[0][price]': env.STRIPE_PRICE_ID,
    'line_items[0][quantity]': '1',
    success_url: `${origin}/thanks/?sid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/`,
    locale: 'ja',
    'metadata[type]': Number.isInteger(index) ? String(index) : '',
  });
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const session = await res.json();
  if (!res.ok || !session.url) return json({ error: 'stripe' }, 502);
  return json({ url: session.url });
}
