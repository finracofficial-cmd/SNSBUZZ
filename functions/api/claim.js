// GET /api/claim?s=子どもの端末の秘密 — おうちの人の支払いが終わっていれば、子どもの端末に購入トークンを渡す。
// おうちの人に送るリンクには、秘密そのものではなくハッシュ（受け取りID）しか入れないので、
// リンクが転送されても、ほかの人は受け取れない。
import { json, rateLimited } from '../_lib/http.js';
import { cookieHeaderFor } from '../_lib/token.js';
import { claimIdOf } from '../_lib/purchase.js';

const TTL = 7 * 24 * 3600 * 1000;

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'disabled' }, 503);
  if (await rateLimited(env, request, 'claim', 30)) return json({ error: 'rate' }, 429);
  const s = new URL(request.url).searchParams.get('s') || '';
  if (!/^[a-z2-7]{26}$/.test(s)) return json({ error: 'bad' }, 400);
  const rid = await claimIdOf(s);
  const row = await env.DB.prepare('SELECT token, created_at FROM claims WHERE rid = ?1').bind(rid).first();
  if (!row || Date.now() - row.created_at > TTL) return json({ status: 'pending' }, 404, { 'cache-control': 'no-store' });
  return json({ token: row.token }, 200, { 'cache-control': 'no-store', ...(await cookieHeaderFor(env, request, row.token)) });
}
