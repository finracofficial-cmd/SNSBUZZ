// GET /api/premium/pair?a=タイプ&b=タイプ&rank=ランク — 完全版の購入トークン（ヘッダか Cookie）を持つ人にだけ、
// ふたりの相性・完全版の文を返す。タイプは 0〜15（隠しタイプは、ふだんの軸の番号）。{pos}・{neg} はブラウザで名前に置きかえる
import { json } from '../../_lib/http.js';
import { accessOf, requestToken } from '../../_lib/token.js';
import { PAIR } from '../../_lib/premium.js';
import { pickPair, PAIR_RANKS } from '../../_lib/pairpick.js';

const typeOf = (v) => (/^\d{1,2}$/.test(v || '') && Number(v) < 16 ? Number(v) : null);

export async function onRequestGet({ request, env }) {
  if (!env.PREMIUM_SECRET || !PAIR) return json({ error: 'disabled' }, 503);
  const access = await accessOf(env, requestToken(request));
  if (access === 'invalid') return json({ error: 'unauthorized' }, 401);
  if (access === 'revoked') return json({ error: 'revoked' }, 403);
  const url = new URL(request.url);
  const a = typeOf(url.searchParams.get('a'));
  const b = typeOf(url.searchParams.get('b'));
  const rank = url.searchParams.get('rank') || '';
  if (a === null || b === null || !PAIR_RANKS.includes(rank)) return json({ error: 'bad' }, 400);
  return json(pickPair(PAIR, a, b, rank), 200, { 'cache-control': 'private, no-store' });
}
