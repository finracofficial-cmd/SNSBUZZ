// GET /api/premium/status — 完全版を販売中かどうかと、選べるプラン・支払い方法、価格のテストの今週の案（arm。テストをしていなければ空）
import { json } from '../../_lib/http.js';
import { premiumEnabled, plansOf, paymentMethodsOf, priceArm } from '../../_lib/token.js';

export function onRequestGet({ env }) {
  return json(
    { enabled: premiumEnabled(env), plans: plansOf(env), methods: paymentMethodsOf(env), arm: priceArm(env) },
    200,
    { 'cache-control': 'public, max-age=300' },
  );
}
