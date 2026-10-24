// 紹介（友達3人で虹色カード）。
//   POST /api/ref {r, v} — r のリンクから来た友達（端末の番号 v）が、その端末で初めて診断を終えた。同じ友達は1回だけ数える
//   GET  /api/ref?r=…    — r のリンクから診断した友達の人数（99まで）
// r・v はどちらも端末で作ったランダムな番号。個人を特定する情報は受け取らない。
// ごほうびは見た目だけ（虹色のカード）なので、番号の自己申告で数える
import { json, readJson, rateLimited, crossSite } from '../_lib/http.js';

const REF = /^[a-z2-7]{10}$/;
const VISITOR = /^[a-z2-7]{16}$/;

export async function onRequestPost({ request, env }) {
  if (crossSite(request)) return json({ error: 'origin' }, 403);
  if (await rateLimited(env, request, 'ref', 6)) return json({ error: 'rate' }, 429);
  const body = await readJson(request);
  if (!REF.test(body?.r || '') || !VISITOR.test(body?.v || '')) return json({ error: 'bad' }, 400);
  if (!env.DB) return json({ ok: true });
  const res = await env.DB.prepare('INSERT OR IGNORE INTO refs (ref, visitor, created_at) VALUES (?1, ?2, ?3)').bind(body.r, body.v, Date.now()).run();
  if ((res?.meta?.changes ?? 0) > 0) {
    const day = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // 日本時間
    const bump = env.DB.prepare('INSERT INTO counters (k, n) VALUES (?1, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1');
    await env.DB.batch([bump.bind('ref:done'), bump.bind(`day:${day}:refdone`)]);
  }
  return json({ ok: true });
}

export async function onRequestGet({ request, env }) {
  const r = new URL(request.url).searchParams.get('r') || '';
  if (!REF.test(r)) return json({ error: 'bad' }, 400);
  if (!env.DB) return json({ n: 0 });
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM (SELECT 1 FROM refs WHERE ref = ?1 LIMIT 99)').bind(r).first();
  // 友達が診断した直後に開き直しても、古い人数が出ないように、キャッシュしない
  return json({ n: row?.n || 0 }, 200, { 'cache-control': 'no-store' });
}
