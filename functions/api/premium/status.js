// GET /api/premium/status — 完全版を販売中かどうかと、選べるプラン・支払い方法
import { json } from '../../_lib/http.js';
import { premiumEnabled, plansOf, paymentMethodsOf } from '../../_lib/token.js';

export function onRequestGet({ env }) {
  return json(
    { enabled: premiumEnabled(env), plans: plansOf(env), methods: paymentMethodsOf(env) },
    200,
    { 'cache-control': 'public, max-age=300' },
  );
}
