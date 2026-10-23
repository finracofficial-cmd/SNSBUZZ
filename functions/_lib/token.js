// 完全版の購入トークン。「v1.<購入ID>.<署名>」の形で、サーバーの秘密鍵で署名する。
// データベースに購入記録を持たなくても、署名を確かめるだけで本物か判定できる。
const enc = new TextEncoder();

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function issueToken(env, purchaseId) {
  return `v1.${purchaseId}.${await hmac(env.PREMIUM_SECRET, `v1.${purchaseId}`)}`;
}

export async function verifyToken(env, token) {
  if (!env.PREMIUM_SECRET || typeof token !== 'string') return false;
  const m = /^v1\.([\w-]{4,80})\.([\w-]{20,})$/.exec(token);
  if (!m) return false;
  const expected = await hmac(env.PREMIUM_SECRET, `v1.${m[1]}`);
  // 長さの同じ文字列を最後まで比べる（途中で抜けない）
  let diff = expected.length ^ m[2].length;
  for (let i = 0; i < Math.min(expected.length, m[2].length); i++) diff |= expected.charCodeAt(i) ^ m[2].charCodeAt(i);
  return diff === 0;
}

export const premiumEnabled = (env) => !!(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID && env.PREMIUM_SECRET);

// 販売するプラン。「ふたり用」は STRIPE_PRICE_ID_DUO があるときだけ出す
export function plansOf(env) {
  const plans = [{ id: 'solo', price: Number(env.PREMIUM_PRICE || 390), priceId: env.STRIPE_PRICE_ID, name: 'じぶん用' }];
  if (env.STRIPE_PRICE_ID_DUO) {
    plans.push({ id: 'duo', price: Number(env.PREMIUM_PRICE_DUO || 590), priceId: env.STRIPE_PRICE_ID_DUO, name: 'ふたり用（友達に1つプレゼント）' });
  }
  return plans.map(({ priceId, ...rest }) => ({ ...rest, available: !!priceId }));
}

export const priceIdOf = (env, plan) => (plan === 'duo' ? env.STRIPE_PRICE_ID_DUO : env.STRIPE_PRICE_ID);
