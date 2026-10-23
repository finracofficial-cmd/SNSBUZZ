// POST /api/groups {name} — グループ診断を作る。作った人には、メンバーを外したりグループを消したりできる管理キーを返す
import { json, readJson, rateLimited, crossSite, hasNgWord } from '../../_lib/http.js';
import { cleanup } from '../../_lib/purchase.js';

const clean = (s, max) =>
  Array.from(String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim())
    .slice(0, max)
    .join('');
const randomId = (n) =>
  [...crypto.getRandomValues(new Uint8Array(n))].map((b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'disabled' }, 503);
  if (crossSite(request)) return json({ error: 'origin' }, 403);
  if (await rateLimited(env, request, 'group', 5)) return json({ error: 'rate' }, 429);
  const body = await readJson(request);
  const name = clean(body?.name, 20);
  if (!name) return json({ error: 'name' }, 400);
  if (hasNgWord(name)) return json({ error: 'ng' }, 400);
  const id = randomId(8);
  const admin = randomId(16);
  await env.DB.prepare('INSERT INTO groups (id, name, admin, created_at) VALUES (?1, ?2, ?3, ?4)').bind(id, name, admin, Date.now()).run();
  // 期限を過ぎたグループ・受け取りIDなどを、ときどき消す
  if (Math.random() < 0.1) await cleanup(env);
  return json({ id, admin });
}
