// ふたり用のプレゼント
//   GET  /api/gift（買った人のトークン）→ プレゼント券と、受け取られたかどうか。何度でも出し直せる
//   POST /api/gift {gift: プレゼント券} → 1回だけ、受け取った人の購入トークンと交換する。
//     買った本人（同じ購入のトークン）と、自分で買った完全版をもう持っている人は受け取れない（プレゼントが無駄にならないように）
import { json, readJson, rateLimited, crossSite } from '../_lib/http.js';
import { issueToken, verifyToken, requestToken, accessOf, cookieHeaderFor } from '../_lib/token.js';

async function purchaseOf(env, id) {
  return env.DB.prepare('SELECT id, plan, gift_used_at, refunded FROM purchases WHERE id = ?1').bind(id).first();
}

export async function onRequestGet({ request, env }) {
  if (!env.DB || !env.PREMIUM_SECRET) return json({ error: 'disabled' }, 503);
  const id = await verifyToken(env, requestToken(request));
  if (!id || !id.startsWith('cs_')) return json({ error: 'unauthorized' }, 401);
  const p = await purchaseOf(env, id);
  if (!p || p.plan !== 'duo') return json({ error: 'not_duo' }, 404);
  if (p.refunded) return json({ error: 'revoked' }, 403);
  return json({ gift: await issueToken(env, `gift-${id}`), used: !!p.gift_used_at }, 200, { 'cache-control': 'private, no-store' });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB || !env.PREMIUM_SECRET) return json({ error: 'disabled' }, 503);
  if (crossSite(request)) return json({ error: 'origin' }, 403);
  if (await rateLimited(env, request, 'gift', 10)) return json({ error: 'rate' }, 429);
  const body = await readJson(request);
  const id = await verifyToken(env, String(body?.gift || ''));
  if (!id || !id.startsWith('gift-')) return json({ error: 'invalid' }, 400);
  const purchaseId = id.slice(5);
  const current = requestToken(request);
  const currentId = await verifyToken(env, current);
  if (currentId === purchaseId || currentId === `gr-${purchaseId}`) return json({ error: 'own' }, 409);
  if (currentId && !currentId.startsWith('promo-') && (await accessOf(env, current)) === 'ok') return json({ error: 'has' }, 409);
  const p = await purchaseOf(env, purchaseId);
  if (!p || p.plan !== 'duo') return json({ error: 'invalid' }, 400);
  if (p.refunded) return json({ error: 'revoked' }, 403);
  const res = await env.DB.prepare('UPDATE purchases SET gift_used_at = ?1 WHERE id = ?2 AND gift_used_at IS NULL')
    .bind(Date.now(), purchaseId)
    .run();
  if (!((res?.meta?.changes ?? 0) > 0)) return json({ error: 'used' }, 409);
  const token = await issueToken(env, `gr-${purchaseId}`);
  return json({ token }, 200, { 'cache-control': 'no-store', ...(await cookieHeaderFor(env, request, token)) });
}
