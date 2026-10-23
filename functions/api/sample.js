// GET /api/sample?i=タイプ番号&p=パラメータ6文字 — 完全版の「見本」として、
// 二つ名のもとになったパラメータの詳しい解説だけを無料で返す（くわしい診断の第1章）。
// 二つ名の決め方は site/assets/logic.js の nicknameOf と同じ（tests/api.test.mjs で一致を確かめている）。
import { json } from '../_lib/http.js';
import { PARAM_DETAIL } from '../_lib/premium.js';

const PARAM_MAX = 12;
const pct = (raw) => Math.round((raw / PARAM_MAX) * 100);
const level = (p) => (p <= 33 ? 0 : p <= 66 ? 1 : 2);

export function onRequestGet({ request }) {
  const url = new URL(request.url);
  const i = Number(url.searchParams.get('i'));
  const p = url.searchParams.get('p') || '';
  if (!Number.isInteger(i) || i < 0 || i > 15 || !/^[0-9a-c]{6}$/.test(p)) return json({ error: 'bad' }, 400);
  const pcts = Array.from(p, (d) => pct(parseInt(d, 36)));
  let k = i % pcts.length;
  for (let j = 1; j < pcts.length; j++) {
    const n = (i + j) % pcts.length;
    if (Math.abs(pcts[n] - 50) > Math.abs(pcts[k] - 50)) k = n;
  }
  return json({ param: k, level: level(pcts[k]), detail: PARAM_DETAIL[k][level(pcts[k])] }, 200, {
    'cache-control': 'public, max-age=86400',
  });
}
