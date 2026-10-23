// POST /api/checkout {plan, index, rid, ab} — Stripe Checkout のセッションを作り、支払いページのURLとセッションIDを返す。
// rid は「おうちの人に払ってもらう」ときの受け取りID。支払い後、子どもの端末がこのIDで完全版を受け取る。
// 画面に出している価格と、Stripe に登録した価格がちがうときは販売しない（表示と請求額のずれを防ぐ）。
import { json, readJson, rateLimited, crossSite } from '../_lib/http.js';
import { premiumEnabled, priceIdOf, plansOf, paymentMethodsOf } from '../_lib/token.js';
import { abTagsOf } from '../_lib/purchase.js';

const priceCache = new Map();
async function stripePrice(env, priceId) {
  const hit = priceCache.get(priceId);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.price;
  const res = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) return null;
  const price = await res.json();
  priceCache.set(priceId, { at: Date.now(), price });
  return price;
}

const SUBMIT_NOTE =
  'デジタルコンテンツのため、購入後の返品・キャンセルはできません（18歳未満の方の購入で、保護者からお申し出があった場合は全額返金します）。お支払いが終わると、すぐに読めます。';

export async function onRequestPost({ request, env }) {
  if (!premiumEnabled(env)) return json({ error: 'disabled' }, 503);
  if (crossSite(request)) return json({ error: 'origin' }, 403);
  if (await rateLimited(env, request, 'checkout', 10)) return json({ error: 'rate' }, 429);
  const body = await readJson(request);
  const plan = body?.plan === 'duo' ? 'duo' : 'solo';
  const priceId = priceIdOf(env, plan);
  if (!priceId) return json({ error: 'plan' }, 400);
  const shown = plansOf(env).find((p) => p.id === plan).price;
  const price = await stripePrice(env, priceId);
  if (!price || price.currency !== 'jpy' || price.unit_amount !== shown || price.active === false) {
    return json({ error: 'price' }, 503);
  }
  const rid = /^[a-z2-7]{16}$/.test(body?.rid || '') ? body.rid : '';
  const origin = new URL(request.url).origin;
  const form = new URLSearchParams({
    mode: 'payment',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: `${origin}/thanks/?sid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/thanks/?canceled=1`,
    locale: 'ja',
    'metadata[app]': 'ponkotsu',
    'metadata[plan]': plan,
    'custom_text[submit][message]': SUBMIT_NOTE,
    // 決済の画面は60分で切れる（やめた決済を、端末がいつまでも確かめに行かないように）
    expires_at: String(Math.floor(Date.now() / 1000) + 3600),
  });
  paymentMethodsOf(env).forEach((m, i) => form.set(`payment_method_types[${i}]`, m));
  if (Number.isInteger(body?.index) && body.index >= 0 && body.index < 20) form.set('metadata[type]', String(body.index));
  if (rid) form.set('client_reference_id', rid);
  const ab = abTagsOf(body?.ab);
  if (ab.length) form.set('metadata[ab]', ab.join(','));
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const session = await res.json();
  if (!res.ok || !session.url) return json({ error: 'stripe' }, 502);
  // Session ID も返す。ブラウザは決済へ移る前にこれを覚えておき、/thanks/ に戻れなかったときも受け取れるようにする
  return json({ url: session.url, id: session.id });
}
