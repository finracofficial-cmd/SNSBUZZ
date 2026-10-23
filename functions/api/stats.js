// GET /api/stats — タイプ別の診断完了数（レア度の表示用）。60秒キャッシュ。
// GET /api/stats?all=1 と Authorization: Bearer <KPI_TOKEN> で全カウンタ（日別・シェア別）を返す。
import { sameText } from '../_lib/http.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json({ total: 0, counts: {} });
  const url = new URL(request.url);
  if (url.searchParams.has('all')) {
    if (!env.KPI_TOKEN || !sameText(request.headers.get('authorization') || '', `Bearer ${env.KPI_TOKEN}`)) {
      return new Response('unauthorized', { status: 401 });
    }
    const { results } = await env.DB.prepare('SELECT k, n FROM counters ORDER BY k').all();
    return Response.json(Object.fromEntries(results.map((r) => [r.k, r.n])));
  }
  // 主キーの範囲で読む（LIKE だと表全体を読んでしまう）
  const { results } = await env.DB.prepare("SELECT k, n FROM counters WHERE k >= 'done:' AND k < 'done;'").all();
  const counts = {};
  let total = 0;
  for (const r of results) {
    counts[r.k.slice(5)] = r.n;
    total += r.n;
  }
  return Response.json({ total, counts }, { headers: { 'cache-control': 'public, max-age=60' } });
}
