// GET /api/unlock?sid=Checkoutセッション — 支払い済みなら購入トークンを返す。
// ふたり用なら、友達にプレゼントする用のトークンも返す。
// 受け取りID（client_reference_id）付きの購入なら、子どもの端末が受け取れるよう保存する。
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
  const id = sid.slice(0, 64);
  const token = await issueToken(env, id);
  const giftToken = session.metadata?.plan === 'duo' ? await issueToken(env, `${id.slice(0, 58)}-gift`) : null;
  const rid = session.client_reference_id;
  if (env.DB) {
    const bump = env.DB.prepare('INSERT INTO counters (k, n) VALUES (?1, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1');
    const stmts = [bump.bind(`premium:paid:${session.metadata?.plan === 'duo' ? 'duo' : 'solo'}`)];
    if (rid && /^[a-z0-9]{16}$/.test(rid)) {
      stmts.push(env.DB.prepare('INSERT OR IGNORE INTO claims (rid, token, created_at) VALUES (?1, ?2, ?3)').bind(rid, token, Date.now()));
    }
    await env.DB.batch(stmts);
  }
  return json({ token, giftToken, forChild: !!rid });
}
