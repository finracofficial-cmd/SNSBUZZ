// GET /api/premium?i=タイプ番号&p=パラメータ6文字 — 購入トークンを持つ人にだけ、完全版の文言を返す。
// トークンは Authorization ヘッダか Cookie で受け取る。返金済み・終了したコードのトークンは 403。
// p（くわしい診断の結果。各パラメータ0〜12を36進数1文字）を付けると、
// その人のパラメータの段階と恋愛タイプに合った文言も返す。
// 段階としきい値は site/assets/logic.js・data.js と同じ（tests/api.test.mjs で一致を確かめている）。
import { json } from '../../_lib/http.js';
import { accessOf, requestToken } from '../../_lib/token.js';
import { PREMIUM, PARAM_DETAIL, LOVE_DETAIL } from '../../_lib/premium.js';

const PARAM_MAX = 12;
const LOVE_HIGH = 58;
const pct = (raw) => Math.round((raw / PARAM_MAX) * 100);
const level = (p) => (p <= 33 ? 0 : p <= 66 ? 1 : 2);

export async function onRequestGet({ request, env }) {
  if (!env.PREMIUM_SECRET) return json({ error: 'disabled' }, 503);
  const access = await accessOf(env, requestToken(request));
  if (access === 'invalid') return json({ error: 'unauthorized' }, 401);
  if (access === 'revoked') return json({ error: 'revoked' }, 403);
  const url = new URL(request.url);
  const type = PREMIUM[url.searchParams.get('i')];
  if (!type) return json({ error: 'not_found' }, 404);
  const p = url.searchParams.get('p');
  let params = null;
  let love = null;
  if (p) {
    if (!/^[0-9a-c]{6}$/.test(p)) return json({ error: 'bad_params' }, 400);
    const pcts = Array.from(p, (d) => pct(parseInt(d, 36)));
    params = pcts.map((v, k) => PARAM_DETAIL[k][level(v)]);
    const loveIndex = (pcts[0] >= LOVE_HIGH ? 4 : 0) + (pcts[1] >= LOVE_HIGH ? 2 : 0) + (pcts[2] >= LOVE_HIGH ? 1 : 0);
    love = LOVE_DETAIL[loveIndex];
  }
  return json({ type, params, love }, 200, { 'cache-control': 'private, no-store' });
}
