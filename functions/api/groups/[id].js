// グループ診断のメンバー。
// 本人は、グループごとに端末で作った秘密（secret）で参加・更新・退出する。D1 には秘密のハッシュだけを保存し、誰にも返さない。
// ほかの人に見せるのは、行ごとのランダムな番号（handle）だけ。作った人（管理キー）は handle でメンバーを外せる。
//   GET    /api/groups/:id（ヘッダ x-member: 秘密 ／ x-admin: 管理キー）— グループとメンバー一覧（自分の行には mine: true）
//   POST   /api/groups/:id {secret, nick, code} — 参加・更新（保存するのは、かんたん診断の結果だけ）。締め切り中は新しく参加できない
//   PATCH  /api/groups/:id {admin, locked} — 作った人が、参加を締め切る／再開する
//   DELETE /api/groups/:id {secret} — 自分が抜ける ／ {admin, handle} — 作った人がメンバーを外す ／ {admin, all: true} — グループを消す
import { json, readJson, rateLimited, crossSite, hasNgWord, cleanText, sameText, sha256Hex, RESULT_CODE, quickCode } from '../../_lib/http.js';

const TTL = 90 * 24 * 3600 * 1000;
const MAX_MEMBERS = 50;
const SECRET = /^[a-z0-9]{16,32}$/;
const HANDLE = /^[a-z0-9]{8}$/;
const randomId = (n) =>
  [...crypto.getRandomValues(new Uint8Array(n))].map((b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
const memberKey = (groupId, secret) => sha256Hex(`member:${groupId}:${secret}`, 16);

async function findGroup(env, id) {
  if (!/^[a-z0-9]{8}$/.test(id)) return null;
  const g = await env.DB.prepare('SELECT id, name, admin, locked, created_at FROM groups WHERE id = ?1').bind(id).first();
  return g && Date.now() - g.created_at < TTL ? g : null;
}
const isAdmin = (g, key) => !!g.admin && sameText(String(key || ''), g.admin);

export async function onRequestGet({ params, request, env }) {
  if (!env.DB) return json({ error: 'disabled' }, 503);
  if (await rateLimited(env, request, 'group-get', 120)) return json({ error: 'rate' }, 429);
  const g = await findGroup(env, params.id);
  if (!g) return json({ error: 'not_found' }, 404);
  const secret = request.headers.get('x-member') || '';
  const me = SECRET.test(secret) ? await memberKey(g.id, secret) : '';
  const { results } = await env.DB.prepare('SELECT member_id, handle, nick, code FROM members WHERE group_id = ?1 ORDER BY created_at').bind(g.id).all();
  return json(
    {
      name: g.name,
      admin: isAdmin(g, request.headers.get('x-admin')),
      locked: !!g.locked,
      expiresAt: g.created_at + TTL,
      members: results.map((m) => ({ handle: m.handle, nick: m.nick, code: quickCode(m.code), mine: !!me && m.member_id === me })),
    },
    200,
    { 'cache-control': 'private, no-store' },
  );
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
  const secret = String(body?.secret || '');
  const nick = cleanText(body?.nick, 10) || 'ななし';
  const code = String(body?.code || '');
  if (!SECRET.test(secret) || !RESULT_CODE.test(code)) return json({ error: 'bad' }, 400);
  if (hasNgWord(nick)) return json({ error: 'ng' }, 400);
  const key = await memberKey(g.id, secret);
  const exists = await env.DB.prepare('SELECT 1 FROM members WHERE group_id = ?1 AND member_id = ?2').bind(g.id, key).first();
  if (exists) {
    await env.DB.prepare('UPDATE members SET nick = ?3, code = ?4 WHERE group_id = ?1 AND member_id = ?2').bind(g.id, key, nick, quickCode(code)).run();
    return json({ ok: true });
  }
  if (g.locked) return json({ error: 'locked' }, 403);
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE group_id = ?1').bind(g.id).first();
  if (n >= MAX_MEMBERS) return json({ error: 'full' }, 409);
  await env.DB.prepare('INSERT OR IGNORE INTO members (group_id, member_id, handle, nick, code, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(g.id, key, randomId(8), nick, quickCode(code), Date.now())
    .run();
  return json({ ok: true });
}

export async function onRequestPatch({ params, request, env }) {
  if (!env.DB) return json({ error: 'disabled' }, 503);
  if (crossSite(request)) return json({ error: 'origin' }, 403);
  if (await rateLimited(env, request, 'group-admin', 30)) return json({ error: 'rate' }, 429);
  const g = await findGroup(env, params.id);
  if (!g) return json({ error: 'not_found' }, 404);
  const body = await readJson(request);
  if (!isAdmin(g, body?.admin)) return json({ error: 'forbidden' }, 403);
  await env.DB.prepare('UPDATE groups SET locked = ?2 WHERE id = ?1').bind(g.id, body.locked === true ? 1 : 0).run();
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
    const handle = String(body.handle || '');
    if (!HANDLE.test(handle)) return json({ error: 'bad' }, 400);
    await env.DB.prepare('DELETE FROM members WHERE group_id = ?1 AND handle = ?2').bind(g.id, handle).run();
    return json({ ok: true });
  }
  const secret = String(body?.secret || '');
  if (!SECRET.test(secret)) return json({ error: 'bad' }, 400);
  await env.DB.prepare('DELETE FROM members WHERE group_id = ?1 AND member_id = ?2').bind(g.id, await memberKey(g.id, secret)).run();
  return json({ ok: true });
}
