// GET /api/premium?i=タイプ番号 — 購入トークンを持つ人にだけ、完全版の文言を返す
import { json } from '../../_lib/http.js';
import { verifyToken } from '../../_lib/token.js';
import { PREMIUM } from '../../_lib/premium.js';

export async function onRequestGet({ request, env }) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
  if (!(await verifyToken(env, token))) return json({ error: 'unauthorized' }, 401);
  const i = new URL(request.url).searchParams.get('i');
  const content = PREMIUM[i];
  if (!content) return json({ error: 'not_found' }, 404);
  return json(content, 200, { 'cache-control': 'private, no-store' });
}
