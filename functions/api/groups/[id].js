// GET    /api/groups/:id?me=メンバーID[&admin=管理キー] — グループとメンバー一覧（他人のメンバーIDは、管理キーがあるときだけ返す）
// POST   /api/groups/:id {id, nick, code} — 参加・更新（保存するのは、かんたん診断の結果だけ）
// DELETE /api/groups/:id {id} — 自分が抜ける ／ {admin, member} — 作った人がメンバーを外す ／ {admin, all: true} — グループを消す
import { json, readJson, rateLimited, crossSite, hasNgWord, sameText, RESULT_CODE, quickCode } from '../../_lib/http.js';

const TTL = 90 * 24 * 3600 * 1000;
const MAX_MEMBERS = 50;
const clean = (s, max) =>
  Array.from(String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim())
    .slice(0, max)
    .join('');

async function findGroup(env, id) {
  if (!/^[a-z0-9]{8}$/.test(id)) return null;
  const g = await env.DB.prepare('SELECT id, name, admin, created_at FROM groups WHERE id = ?1').bind(id).first();
  return g && Date.now() - g.created_at < TTL ? g : null;
}
const isAdmin = (g, key) => !!g.admin && sameText(String(key || ''), g.admin);

export async function onRequestGet({ params, request, env }) {
  if (!env.DB) return json({ error: 'disabled' }, 503);
  const g = await findGroup(env, params.id);
  if (!g) return json({ error: 'not_found' }, 404);
  const url = new URL(request.url);
  const me = url.searchParams.get('me') || '';
  const admin = isAdmin(g, url.searchParams.get('admin'));
  const { results } = await env.DB.prepare('SELECT member_id, nick, code FROM members WHERE group_id = ?1 ORDER BY created_at').bind(g.id).all();
  return json({
    name: g.name,
    admin,
    expiresAt: g.created_at + TTL,
    members: results.map((m, i) => ({ id: m.member_id === me || admin ? m.member_id : `m${i}`, nick: m.nick, code: quickCode(m.code) })),
  });
}

export async function onRequestPost({ params, request, env }) {
  if (!env.DB) return json({ error: 'disabled' }, 503);
  if (crossSite(request)) return json({ error: 'origin' }, 403);
  // 教室の同じWi-Fiからいっせいに参加できるよう、IPごとは緩めに。グループごとにも上限をかける
  if (await rateLimited(env, request, 'join', 60)) return json({ error: 'rate' }, 429);
  if (await rateLimited(env, request, 'join-group', 60, `group:${params.id}`)) return json({ error: 'rate' }, 429);
  const g = await findGroup(env, params.id);
  if (!g) return json({ error: 'not_found' }, 404);
  const body = await readJson(request);
  const memberId = String(body?.id || '');
  const nick = clean(body?.nick, 10) || 'ななし';
  const code = String(body?.code || '');
  if (!/^[a-z0-9]{6,16}$/.test(memberId) || !RESULT_CODE.test(code)) return json({ error: 'bad' }, 400);
  if (hasNgWord(nick)) return json({ error: 'ng' }, 400);
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE group_id = ?1').bind(g.id).first();
  const exists = await env.DB.prepare('SELECT 1 FROM members WHERE group_id = ?1 AND member_id = ?2').bind(g.id, memberId).first();
  if (!exists && n >= MAX_MEMBERS) return json({ error: 'full' }, 409);
  await env.DB.prepare(
    `INSERT INTO members (group_id, member_id, nick, code, created_at) VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(group_id, member_id) DO UPDATE SET nick = excluded.nick, code = excluded.code`,
  )
    .bind(g.id, memberId, nick, quickCode(code), Date.now())
    .run();
  return json({ ok: true });
}

export async function onRequestDelete({ params, request, env }) {
  if (!env.DB) return json({ error: 'disabled' }, 503);
  if (crossSite(request)) return json({ error: 'origin' }, 403);
  if (await rateLimited(env, request, 'leave', 30)) return json({ error: 'rate' }, 429);
  const g = await findGroup(env, params.id);
  if (!g) return json({ error: 'not_found' }, 404);
  const body = await readJson(request);
  if (body?.admin !== undefined) {
    if (!isAdmin(g, body.admin)) return json({ error: 'forbidden' }, 403);
    if (body.all === true) {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM members WHERE group_id = ?1').bind(g.id),
        env.DB.prepare('DELETE FROM groups WHERE id = ?1').bind(g.id),
      ]);
      return json({ ok: true });
    }
    const member = String(body.member || '');
    if (!/^[a-z0-9]{6,16}$/.test(member)) return json({ error: 'bad' }, 400);
    await env.DB.prepare('DELETE FROM members WHERE group_id = ?1 AND member_id = ?2').bind(g.id, member).run();
    return json({ ok: true });
  }
  const memberId = String(body?.id || '');
  if (!/^[a-z0-9]{6,16}$/.test(memberId)) return json({ error: 'bad' }, 400);
  await env.DB.prepare('DELETE FROM members WHERE group_id = ?1 AND member_id = ?2').bind(g.id, memberId).run();
  return json({ ok: true });
}
