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
  const day = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // 日本時間
  const [done, today, first, agree] = await env.DB.batch([
    env.DB.prepare("SELECT k, n FROM counters WHERE k >= 'done:' AND k < 'done;'"),
    env.DB.prepare('SELECT n FROM counters WHERE k = ?1').bind(`day:${day}:done`),
    env.DB.prepare("SELECT k FROM counters WHERE k >= 'day:' AND k < 'day;' ORDER BY k LIMIT 1"),
    env.DB.prepare("SELECT k, n FROM counters WHERE k IN ('agree:yes', 'agree:no')"),
  ]);
  const counts = {};
  let total = 0;
  for (const r of done.results) {
    counts[r.k.slice(5)] = r.n;
    total += r.n;
  }
  const agreeCount = Object.fromEntries(agree.results.map((r) => [r.k.slice(6), r.n]));
  return Response.json(
    {
      total,
      counts,
      // トップに出す実数（出すかどうかは、ブラウザ側で件数を見て決める）
      today: today.results[0]?.n || 0,
      since: first.results[0]?.k.slice(4, 14) || null,
      agree: { yes: agreeCount.yes || 0, no: agreeCount.no || 0 },
    },
    { headers: { 'cache-control': 'public, max-age=60' } },
  );
}
