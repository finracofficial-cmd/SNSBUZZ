// GET /api/premium/status — 完全版を販売中かどうかと、選べるプラン
import { json } from '../../_lib/http.js';
import { premiumEnabled, plansOf } from '../../_lib/token.js';

export function onRequestGet({ env }) {
  return json({ enabled: premiumEnabled(env), plans: plansOf(env) }, 200, { 'cache-control': 'public, max-age=300' });
}
