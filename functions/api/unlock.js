// GET /api/unlock?sid=Checkoutセッション — 支払い済みなら購入トークンを返す
import { json, rateLimited } from '../_lib/http.js';
import { issueToken, premiumEnabled } from '../_lib/token.js';

export async function onRequestGet({ request, env }) {
  if (!premiumEnabled(env)) return json({ error: 'disabled' }, 503);
  if (await rateLimited(env, request, 'unlock', 20)) return json({ error: 'rate' }, 429);
  const sid = new URL(request.url).searchParams.get('sid') || '';
  if (!/^cs_[\w]{10,200}$/.test(sid)) return json({ error: 'bad_session' }, 400);
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sid}`, {
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  const session = await res.json();
  if (!res.ok || session.payment_status !== 'paid') return json({ error: 'unpaid' }, 402);
  if (env.DB) {
    await env.DB.prepare('INSERT INTO counters (k, n) VALUES (?1, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1').bind('premium:paid').run();
  }
  return json({ token: await issueToken(env, sid.slice(0, 64)) });
}
