// POST /api/groups {name} — グループ診断を作る
import { json, readJson, rateLimited } from '../../_lib/http.js';

const clean = (s, max) =>
  Array.from(String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim())
    .slice(0, max)
    .join('');

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'disabled' }, 503);
  if (await rateLimited(env, request, 'group', 5)) return json({ error: 'rate' }, 429);
  const body = await readJson(request);
  const name = clean(body?.name, 20);
  if (!name) return json({ error: 'name' }, 400);
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const id = [...bytes].map((b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
  await env.DB.prepare('INSERT INTO groups (id, name, created_at) VALUES (?1, ?2, ?3)').bind(id, name, Date.now()).run();
  return json({ id });
}
