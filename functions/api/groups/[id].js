// GET  /api/groups/:id?me=メンバーID — グループとメンバー一覧（他人のメンバーIDは返さない）
// POST /api/groups/:id {id, nick, code} — 参加・更新
import { json, readJson, rateLimited, RESULT_CODE } from '../../_lib/http.js';

const TTL = 90 * 24 * 3600 * 1000;
const MAX_MEMBERS = 50;
const clean = (s, max) =>
  Array.from(String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim())
    .slice(0, max)
    .join('');

async function findGroup(env, id) {
  if (!/^[a-z0-9]{8}$/.test(id)) return null;
  const g = await env.DB.prepare('SELECT id, name, created_at FROM groups WHERE id = ?1').bind(id).first();
  return g && Date.now() - g.created_at < TTL ? g : null;
}

export async function onRequestGet({ params, request, env }) {
  if (!env.DB) return json({ error: 'disabled' }, 503);
  const g = await findGroup(env, params.id);
  if (!g) return json({ error: 'not_found' }, 404);
  const me = new URL(request.url).searchParams.get('me') || '';
  const { results } = await env.DB.prepare('SELECT member_id, nick, code FROM members WHERE group_id = ?1 ORDER BY created_at').bind(g.id).all();
  return json({
    name: g.name,
    members: results.map((m, i) => ({ id: m.member_id === me ? me : `m${i}`, nick: m.nick, code: m.code })),
  });
}

export async function onRequestPost({ params, request, env }) {
  if (!env.DB) return json({ error: 'disabled' }, 503);
  if (await rateLimited(env, request, 'join', 20)) return json({ error: 'rate' }, 429);
  const g = await findGroup(env, params.id);
  if (!g) return json({ error: 'not_found' }, 404);
  const body = await readJson(request);
  const memberId = String(body?.id || '');
  const nick = clean(body?.nick, 10) || 'ななし';
  const code = String(body?.code || '');
  if (!/^[a-z0-9]{6,16}$/.test(memberId) || !RESULT_CODE.test(code)) return json({ error: 'bad' }, 400);
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE group_id = ?1').bind(g.id).first();
  const exists = await env.DB.prepare('SELECT 1 FROM members WHERE group_id = ?1 AND member_id = ?2').bind(g.id, memberId).first();
  if (!exists && n >= MAX_MEMBERS) return json({ error: 'full' }, 409);
  await env.DB.prepare(
    `INSERT INTO members (group_id, member_id, nick, code, created_at) VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(group_id, member_id) DO UPDATE SET nick = excluded.nick, code = excluded.code`,
  )
    .bind(g.id, memberId, nick, code, Date.now())
    .run();
  return json({ ok: true });
}
