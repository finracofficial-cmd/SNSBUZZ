// POST /api/adopt（Authorization: Bearer <購入トークン>）— 引き継ぎリンク・コード・サポートのリンクで開いた端末にも、
// Cookie に購入トークンを入れる（iOS Safari では localStorage が7日間使わないと消えるため。/api/restore で戻せるように）。
// あわせてプラン（ふたり用か）を返す。いま Cookie に自分で買った有効な購入があれば、上書きしない。
import { json, rateLimited, crossSite } from '../_lib/http.js';
import { accessOf, verifyToken, planOf, cookieHeaderFor } from '../_lib/token.js';

export async function onRequestPost({ request, env }) {
  if (!env.PREMIUM_SECRET) return json({ error: 'disabled' }, 503);
  if (crossSite(request)) return json({ error: 'origin' }, 403);
  if (await rateLimited(env, request, 'adopt', 20)) return json({ error: 'rate' }, 429);
  const token = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
  const access = await accessOf(env, token);
  if (access !== 'ok') return json({ error: access }, access === 'revoked' ? 403 : 401);
  const plan = await planOf(env, await verifyToken(env, token));
  return json({ ok: true, plan }, 200, { 'cache-control': 'no-store', ...(await cookieHeaderFor(env, request, token)) });
}
