// GET /api/claim?rid=受け取りID — おうちの人の支払いが終わっていれば、子どもの端末に購入トークンを渡す
import { json, rateLimited } from '../_lib/http.js';

const TTL = 7 * 24 * 3600 * 1000;

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'disabled' }, 503);
  if (await rateLimited(env, request, 'claim', 30)) return json({ error: 'rate' }, 429);
  const rid = new URL(request.url).searchParams.get('rid') || '';
  if (!/^[a-z0-9]{16}$/.test(rid)) return json({ error: 'bad' }, 400);
  const row = await env.DB.prepare('SELECT token, created_at FROM claims WHERE rid = ?1').bind(rid).first();
  if (!row || Date.now() - row.created_at > TTL) return json({ status: 'pending' }, 404);
  return json({ token: row.token }, 200, { 'cache-control': 'no-store' });
}
