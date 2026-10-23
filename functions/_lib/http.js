// Pages Functions 共通の小道具
export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });

export async function readJson(request, maxBytes = 2048) {
  const text = await request.text();
  if (text.length > maxBytes) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// 個人を特定しない形で、IPごとの回数制限をかける（IPそのものは保存しない）
export async function rateLimited(env, request, name, limitPerMinute) {
  if (!env.DB) return false;
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${env.RATE_SALT || 'pz'}:${ip}`));
  const tag = [...new Uint8Array(digest).slice(0, 6)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const minute = Math.floor(Date.now() / 60000);
  const key = `rl:${name}:${tag}:${minute}`;
  const row = await env.DB.prepare('INSERT INTO counters (k, n) VALUES (?1, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n')
    .bind(key)
    .first();
  return (row?.n ?? 0) > limitPerMinute;
}

// 結果コード（site/assets/logic.js の encodeResult と同じ形。くわしい診断はパラメータ6桁つき）
export const RESULT_CODE = /^[0-9a-j]~-?\d_-?\d_-?\d_-?\d(?:~[0-9a-c]{6})?$/;
