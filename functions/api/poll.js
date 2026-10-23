// 今週のお題の投票と集計。
//   POST /api/poll {week, choice, type} … 今週のお題にだけ投票できる。1端末1票はブラウザ側で守り、ここではIPごとの回数制限をかける
//   GET  /api/poll?week=YYYY-MM-DD   … 全体とタイプ別の票数。30票に満たないものは出さない（少ない人数の答えが推測できないように）
// 票は counters 表に poll:<週>:all:<選択肢> と poll:<週>:t<タイプ>:<選択肢> で数える（誰が何を選んだかは残さない）
import { json, readJson, rateLimited, crossSite } from '../_lib/http.js';
import { weekIdOf, WEEK_ID } from '../_lib/week.js';

const CHOICES = 4;
const TYPE_COUNT = 20;
const MIN = 30;
const sum = (c) => c.reduce((a, b) => a + b, 0);

export async function onRequestPost({ request, env }) {
  if (crossSite(request)) return json({ error: 'origin' }, 403);
  const body = await readJson(request, 256);
  const { week, choice } = body || {};
  const type = body?.type ?? null;
  if (typeof week !== 'string' || !WEEK_ID.test(week) || !Number.isInteger(choice) || choice < 0 || choice >= CHOICES) return json({ error: 'bad' }, 400);
  if (type !== null && !(Number.isInteger(type) && type >= 0 && type < TYPE_COUNT)) return json({ error: 'bad' }, 400);
  if (week !== weekIdOf()) return json({ error: 'week' }, 409);
  if (!env.DB) return json({ ok: true });
  if (await rateLimited(env, request, 'poll', 10)) return json({ error: 'rate' }, 429);
  const day = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // 日本時間
  const keys = [`poll:${week}:all:${choice}`, 'poll', `day:${day}:poll`];
  if (type !== null) keys.push(`poll:${week}:t${type}:${choice}`);
  const stmt = env.DB.prepare('INSERT INTO counters (k, n) VALUES (?1, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1');
  await env.DB.batch(keys.map((k) => stmt.bind(k)));
  return json({ ok: true });
}

export async function onRequestGet({ request, env }) {
  const week = new URL(request.url).searchParams.get('week') || '';
  const current = weekIdOf();
  if (!WEEK_ID.test(week) || week > current) return json({ error: 'bad' }, 400);
  if (!env.DB) return json({ week, total: 0, all: null, types: {} });
  // 主キーの範囲で読む（':' の次の文字は ';'）
  const { results } = await env.DB.prepare('SELECT k, n FROM counters WHERE k >= ?1 AND k < ?2').bind(`poll:${week}:`, `poll:${week};`).all();
  const all = Array(CHOICES).fill(0);
  const types = {};
  for (const { k, n } of results) {
    const [, , who, c] = k.split(':');
    const i = Number(c);
    if (!Number.isInteger(i) || i < 0 || i >= CHOICES) continue;
    if (who === 'all') all[i] = n;
    else if (/^t\d+$/.test(who)) (types[who.slice(1)] ??= Array(CHOICES).fill(0))[i] = n;
  }
  const total = sum(all);
  return json(
    { week, total, all: total >= MIN ? all : null, types: Object.fromEntries(Object.entries(types).filter(([, c]) => sum(c) >= MIN)) },
    200,
    { 'cache-control': `public, max-age=${week === current ? 60 : 3600}` },
  );
}
