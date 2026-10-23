// GET /api/unlock?sid=Checkoutセッション — 決済から戻ってきたブラウザに、購入トークンを渡す。
// 記録は Webhook（stripe-webhook.js）でも行うので、ここで失敗しても、もう一度呼べば受け取れる。
// アドレスバーに残った sid から他人が受け取らないよう、受け取れるのは決済から24時間まで。
// ふたり用のプレゼント券は、ここでは返さない（買った人のトークンで /api/gift から受け取る）。
import { json, rateLimited } from '../_lib/http.js';
import { premiumEnabled, cookieHeaderFor } from '../_lib/token.js';
import { isOurSession, recordPurchase } from '../_lib/purchase.js';

const WINDOW = 24 * 3600 * 1000;

export async function onRequestGet({ request, env }) {
  if (!premiumEnabled(env)) return json({ error: 'disabled' }, 503);
  if (await rateLimited(env, request, 'unlock', 20)) return json({ error: 'rate' }, 429);
  const sid = new URL(request.url).searchParams.get('sid') || '';
  if (!/^cs_\w{10,200}$/.test(sid)) return json({ error: 'bad_session' }, 400);
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sid}`, {
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) return json({ error: 'stripe' }, res.status === 404 ? 404 : 502);
  const session = await res.json();
  if (!isOurSession(session)) return json({ error: 'not_ours' }, 404);
  // 未払い。決済の画面が切れていれば（session: 'expired'）、端末はもう確かめに来なくてよい
  if (session.payment_status !== 'paid') return json({ error: 'unpaid', session: session.status || '' }, 402);
  if (Date.now() - Number(session.created || 0) * 1000 > WINDOW) return json({ error: 'expired' }, 410);
  const p = await recordPurchase(env, session);
  if (p.refunded) return json({ error: 'revoked' }, 403);
  return json(
    { token: p.token, plan: p.plan, forChild: !!session.client_reference_id },
    200,
    { 'cache-control': 'no-store', ...(await cookieHeaderFor(env, request, p.token)) },
  );
}
