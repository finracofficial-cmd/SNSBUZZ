// GET /api/premium/status — 完全版を販売中かどうかと価格
import { json } from '../../_lib/http.js';
import { premiumEnabled } from '../../_lib/token.js';

export function onRequestGet({ env }) {
  return json({ enabled: premiumEnabled(env), price: Number(env.PREMIUM_PRICE || 390) }, 200, { 'cache-control': 'public, max-age=300' });
}
