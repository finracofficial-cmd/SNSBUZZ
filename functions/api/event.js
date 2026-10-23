// POST /api/event {k, v} — 診断開始・完了・シェア・流入を数えるだけ。個人を識別する情報は受け取らない。
const ALLOWED = {
  start: () => '',
  done: (v) => (/^(\d|1[0-6])$/.test(v) ? v : null),
  share: (v) => (['x', 'line', 'link', 'native', 'image'].includes(v) ? v : null),
  ref: () => '',
};

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('bad json', { status: 400 });
  }
  const check = typeof body?.k === 'string' && Object.hasOwn(ALLOWED, body.k) ? ALLOWED[body.k] : null;
  const v = check ? check(String(body.v ?? '')) : null;
  if (v === null) return new Response('bad event', { status: 400 });
  if (!env.DB) return new Response(null, { status: 204 });

  const day = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // JST
  const keys = [body.k, `day:${day}:${body.k}`];
  if (v) keys.push(`${body.k}:${v}`);
  const stmt = env.DB.prepare('INSERT INTO counters (k, n) VALUES (?1, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1');
  await env.DB.batch(keys.map((k) => stmt.bind(k)));
  return new Response(null, { status: 204 });
}
