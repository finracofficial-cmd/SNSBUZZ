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

const enc = new TextEncoder();
const hex = (buf, bytes) => [...new Uint8Array(buf).slice(0, bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

// 回数制限のためのIPのまとめ方。IPv6 は利用者ごとに /64 が割り当てられるので、/64 単位で数える
export function ipGroup(request) {
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  if (!ip.includes(':')) return ip;
  const parts = ip.split('::')[0].split(':');
  return `${parts.slice(0, 4).join(':')}::/64`;
}

// 個人を特定しない形で、IPごとの回数制限をかける（IPそのものは保存しない）
export async function rateLimited(env, request, name, limitPerMinute, scope = null) {
  if (!env.DB) return false;
  const who = scope ?? ipGroup(request);
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`${env.RATE_SALT || env.PREMIUM_SECRET || 'pz'}:${who}`));
  const minute = Math.floor(Date.now() / 60000);
  const key = `${name}:${hex(digest, 8)}:${minute}`;
  const row = await env.DB.prepare('INSERT INTO rl (k, n, exp) VALUES (?1, 1, ?2) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n')
    .bind(key, (minute + 2) * 60000)
    .first();
  // 期限切れの行は、ときどきまとめて消す（Pages Functions には定期実行がないため）
  if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM rl WHERE exp < ?1').bind(Date.now()).run();
  return (row?.n ?? 0) > limitPerMinute;
}

// 別のサイトから送られてきたPOSTを弾く（Originヘッダがあるときだけ確かめる）
export function crossSite(request) {
  const origin = request.headers.get('origin');
  return !!origin && origin !== new URL(request.url).origin;
}

// 時間が一定の文字列比較
export function sameText(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function sha256Hex(text, bytes = 32) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)), bytes);
}

// 結果コード（site/assets/logic.js の encodeResult と同じ形。くわしい診断はパラメータ6桁つき）
export const RESULT_CODE = /^[0-9a-j]~-?\d_-?\d_-?\d_-?\d(?:~[0-9a-c]{6})?$/;
// グループに保存するのは、かんたん診断の部分だけ（くわしい診断のパラメータは保存しない）
export const quickCode = (code) => code.split('~').slice(0, 2).join('~');

// ニックネーム・グループ名に使えない言葉（悪口・個人を特定しやすい語の代表例）
const NG_NAMES = [
  'ばか', 'バカ', 'あほ', 'アホ', 'ぶす', 'ブス', 'でぶ', 'デブ', 'きも', 'キモ', 'うざ', 'ウザ', 'しね', '死ね', '氏ね', 'ころす', '殺',
  'くず', 'クズ', 'ごみ', 'ゴミ', 'かす', 'カス', 'ぼっち', 'ボッチ', '陰キャ', 'いじめ', 'イジメ', '消えろ', 'きえろ', 'fuck', 'shit',
  '小学校', '中学校', '高校', '学園', '大学',
];
export const hasNgWord = (s) => {
  const t = String(s).toLowerCase();
  return NG_NAMES.some((w) => t.includes(w.toLowerCase()));
};
