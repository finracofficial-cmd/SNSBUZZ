// 完全版の購入トークン。「v1.<ID>.<署名>」の形で、サーバーの秘密鍵で署名する。
// ID の種類:
//   cs_…          Stripe の Checkout Session（買った人）
//   gr-cs_…       ふたり用のプレゼントを受け取った人
//   gift-cs_…     プレゼント券（まだ読めない。/api/gift で1回だけ gr- と交換する）
//   promo-CODE    キャンペーンのコード（PROMO_CODES から消すか、期限を過ぎると読めなくなる）
import { sameText } from './http.js';

const enc = new TextEncoder();

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const TOKEN = /^v1\.([\w-]{4,100})\.([\w-]{20,})$/;

export async function issueToken(env, id) {
  return `v1.${id}.${await hmac(env.PREMIUM_SECRET, `v1.${id}`)}`;
}

// 署名が正しければ ID を、正しくなければ null を返す
export async function verifyToken(env, token) {
  if (!env.PREMIUM_SECRET || typeof token !== 'string') return null;
  const m = TOKEN.exec(token);
  if (!m) return null;
  return sameText(await hmac(env.PREMIUM_SECRET, `v1.${m[1]}`), m[2]) ? m[1] : null;
}

// キャンペーンのコード。PROMO_CODES は「CODE」または「CODE:2027-03-31」（その日の終わり・日本時間まで有効）をカンマ区切り
export function promoCodes(env, now = Date.now()) {
  return String(env.PROMO_CODES || '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)
    .map((c) => {
      const [code, until] = c.split(':');
      const end = /^\d{4}-\d{2}-\d{2}$/.test(until || '') ? Date.parse(`${until}T23:59:59+09:00`) : Infinity;
      return { code, active: now <= end };
    });
}

// トークンで読めるかどうか: 'ok' / 'invalid'（署名がちがう・プレゼント券）/ 'revoked'（返金済み・コードの終了）
export async function accessOf(env, token) {
  const id = await verifyToken(env, token);
  if (!id || id.startsWith('gift-')) return 'invalid';
  if (id.startsWith('promo-')) {
    const code = id.slice(6);
    return promoCodes(env).some((p) => p.code === code && p.active) ? 'ok' : 'revoked';
  }
  const purchaseId = id.replace(/^gr-/, '');
  if (env.DB) {
    const row = await env.DB.prepare('SELECT refunded FROM purchases WHERE id = ?1').bind(purchaseId).first();
    if (row?.refunded) return 'revoked';
  }
  return 'ok';
}

// 購入トークンを、ブラウザのデータが消えても戻せるよう HttpOnly の Cookie にも入れる
// （スクリプトが書いた localStorage は、iOS Safari では7日間使わないと消える）
export const tokenCookie = (token) =>
  `pz_t=${token}; Path=/api/; Max-Age=${400 * 24 * 3600}; HttpOnly; Secure; SameSite=Lax`;
export const cookieToken = (request) => /(?:^|;\s*)pz_t=([\w.-]+)/.exec(request.headers.get('cookie') || '')?.[1] || '';
// Authorization ヘッダ、なければ Cookie
export const requestToken = (request) =>
  (request.headers.get('authorization') || '').replace(/^Bearer /, '') || cookieToken(request);

export const premiumEnabled = (env) => !!(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID && env.PREMIUM_SECRET);

// 販売するプラン。「ふたり用」は STRIPE_PRICE_ID_DUO があるときだけ出す
// price は画面に出す価格。決済のときに Stripe の価格と同じか確かめる（checkout.js）
export function plansOf(env) {
  const plans = [{ id: 'solo', price: Number(env.PREMIUM_PRICE || 390), priceId: env.STRIPE_PRICE_ID, name: 'じぶん用' }];
  if (env.STRIPE_PRICE_ID_DUO) {
    plans.push({ id: 'duo', price: Number(env.PREMIUM_PRICE_DUO || 590), priceId: env.STRIPE_PRICE_ID_DUO, name: 'ふたり用' });
  }
  return plans.map(({ priceId, ...rest }) => ({ ...rest, available: !!priceId }));
}

export const priceIdOf = (env, plan) => (plan === 'duo' ? env.STRIPE_PRICE_ID_DUO : env.STRIPE_PRICE_ID);

// 使える支払い方法（Stripe の payment_method_types）。STRIPE_PAYMENT_METHODS="card,paypay" のように指定する。
// カードには Apple Pay・Google Pay がふくまれる。コンビニ・振込のように後から支払う方法は使わない
const METHODS = ['card', 'paypay'];
export function paymentMethodsOf(env) {
  const list = String(env.STRIPE_PAYMENT_METHODS || 'card')
    .split(',')
    .map((m) => m.trim().toLowerCase())
    .filter((m) => METHODS.includes(m));
  return list.length ? [...new Set(list)] : ['card'];
}
