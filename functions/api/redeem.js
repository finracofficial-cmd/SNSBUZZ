// POST /api/redeem {code} — キャンペーンやタイアップ用のコードで完全版をひらく。
// コードは環境変数 PROMO_CODES にカンマ区切りで入れる（例: "OSHI2027:2027-03-31,SCHOOLFES"）。
// コードを消すか期限を過ぎると、そのコードで開いた人も読めなくなる（/api/premium で確かめる）。
import { json, readJson, rateLimited, crossSite } from '../_lib/http.js';
import { issueToken, promoCodes, cookieHeaderFor } from '../_lib/token.js';

export async function onRequestPost({ request, env }) {
  if (!env.PREMIUM_SECRET) return json({ error: 'disabled' }, 503);
  if (crossSite(request)) return json({ error: 'origin' }, 403);
  if (await rateLimited(env, request, 'redeem', 5)) return json({ error: 'rate' }, 429);
  const body = await readJson(request);
  const code = String(body?.code || '').trim().toUpperCase();
  if (!code || !promoCodes(env).some((p) => p.code === code && p.active)) return json({ error: 'invalid' }, 400);
  if (env.DB) {
    await env.DB.prepare('INSERT INTO counters (k, n) VALUES (?1, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1').bind(`premium:code:${code}`).run();
  }
  const token = await issueToken(env, `promo-${code}`.replace(/[^\w-]/g, '').slice(0, 60));
  return json({ token }, 200, { 'cache-control': 'no-store', ...(await cookieHeaderFor(env, request, token)) });
}
