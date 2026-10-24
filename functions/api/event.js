// POST /api/event {k, v} — 診断開始・完了・シェア・流入を数えるだけ。個人を識別する情報は受け取らない。
import { rateLimited, crossSite } from '../_lib/http.js';
import { EXPERIMENTS, metricsOf } from '../_lib/experiments.js';

const SHARE = [
  'x', 'line', 'link', 'native', 'invite', 'quiz',
  'image', 'label-image', 'gold-image', 'pair-image', 'nick-image', 'status-image', 'prof-image', 'carousel', 'carousel-feed', 'wallpaper', 'text', 'video', 'now-nick', 'group-text', 'sticker',
];
const ALLOWED = {
  start: () => '',
  done: (v) => (/^(\d|1\d)$/.test(v) ? v : null),
  share: (v) => (SHARE.includes(v) ? v : null),
  // 流入：f＝相性のおさそいつきのシェアURL、print＝シールの QR
  ref: (v) => (['f', 'print'].includes(v) ? v : ''),
  detail: (v) => (['start', 'done'].includes(v) ? v : null),
  // 購入案内（view＝自動・cta＝ボタン・ask＝おうちの人に頼む・pair＝ふたりの相性の画面から）
  paywall: (v) => (['view', 'cta', 'ask', 'pair'].includes(v) ? v : null),
  quiz: (v) => (['create', 'answer', 'done'].includes(v) ? v : null),
  group: (v) => (['create', 'join'].includes(v) ? v : null),
  // 結果への「わかる〜！」「ちょっとちがう」
  agree: (v) => (['yes', 'no'].includes(v) ? v : null),
  // アフィリエイトのリンク（タイプ番号）・外のお店（LINEスタンプ・グッズ・LINE公式アカウント）
  aff: (v) => (/^(\d|1\d)$/.test(v) ? v : null),
  out: (v) => (['stamps', 'goods', 'line'].includes(v) ? v : null),
  // 結果を持っている端末が、別の日にまた開いた（1日1回）
  visit: (v) => (v === 'return' ? v : null),
  // トップの1問目のカードから始めた
  lp: (v) => (v === 'q1' ? v : null),
  // 支払い完了とコード利用はサーバー側（unlock / redeem）で数える
  premium: (v) => (v === 'checkout' ? v : null),
  // A/Bテスト「実験:案:段階」。支払い完了（paid）はサーバー側で数える
  ab: (v) => {
    const [name, variant, step] = v.split(':');
    return Object.hasOwn(EXPERIMENTS, name) && EXPERIMENTS[name].includes(variant) && metricsOf(name).includes(step) && step !== 'paid' ? v : null;
  },
};

export async function onRequestPost({ request, env }) {
  if (crossSite(request)) return new Response('origin', { status: 403 });
  if (await rateLimited(env, request, 'event', 60)) return new Response('rate', { status: 429 });
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
