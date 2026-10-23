// GET /api/restore — ブラウザの保存データが消えたとき、Cookie に残っている購入トークンを返す
import { json, rateLimited } from '../_lib/http.js';
import { accessOf, cookieToken } from '../_lib/token.js';

export async function onRequestGet({ request, env }) {
  if (!env.PREMIUM_SECRET) return json({ error: 'disabled' }, 503);
  if (await rateLimited(env, request, 'restore', 20)) return json({ error: 'rate' }, 429);
  const token = cookieToken(request);
  if (!token || (await accessOf(env, token)) !== 'ok') return json({ error: 'none' }, 404, { 'cache-control': 'no-store' });
  return json({ token }, 200, { 'cache-control': 'private, no-store' });
}
