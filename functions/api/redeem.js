// POST /api/redeem {code} — キャンペーンやタイアップ用のコードで完全版をひらく。
// コードは環境変数 PROMO_CODES にカンマ区切りで入れる（例: "OSHI2027,SCHOOLFES"）。
import { json, readJson, rateLimited } from '../_lib/http.js';
import { issueToken } from '../_lib/token.js';

export async function onRequestPost({ request, env }) {
  if (!env.PREMIUM_SECRET) return json({ error: 'disabled' }, 503);
  if (await rateLimited(env, request, 'redeem', 5)) return json({ error: 'rate' }, 429);
  const body = await readJson(request);
  const code = String(body?.code || '').trim().toUpperCase();
  const codes = String(env.PROMO_CODES || '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  if (!code || !codes.includes(code)) return json({ error: 'invalid' }, 400);
  if (env.DB) {
    await env.DB.prepare('INSERT INTO counters (k, n) VALUES (?1, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1').bind(`premium:code:${code}`).run();
  }
  return json({ token: await issueToken(env, `promo-${code}`.replace(/[^\w-]/g, '').slice(0, 60)) });
}
