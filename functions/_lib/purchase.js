// 購入の記録（D1 の purchases・claims）。Webhook と /api/unlock の両方から呼ぶので、何度呼んでも同じ結果になるようにする。
import { issueToken } from './token.js';
import { sha256Hex } from './http.js';
import { EXPERIMENTS } from './experiments.js';

// このサイトが作った Checkout Session か（同じ Stripe アカウントのほかの商品では開けない）
export const isOurSession = (s) => s?.metadata?.app === 'ponkotsu' && ['solo', 'duo'].includes(s?.metadata?.plan);

export const purchaseIdOf = (sessionId) => String(sessionId).slice(0, 90);

// おうちの人に払ってもらうときの受け取りID。子どもの端末が持つ秘密 s のハッシュの先頭16文字
const B32 = 'abcdefghijklmnopqrstuvwxyz234567';
export async function claimIdOf(secret) {
  const h = await sha256Hex(`claim:${secret}`, 10);
  let bits = '';
  for (let i = 0; i < h.length; i += 2) bits += parseInt(h.slice(i, i + 2), 16).toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length && out.length < 16; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

// 決済に付けてきたA/Bテストの目印（"paybar:amount,autopay:on"）のうち、定義にあるものだけ
// 1つの実験につき1つだけ（同じ実験の案が2つ来ても、最初の1つだけ数える）
export function abTagsOf(raw) {
  const seen = new Set();
  return String(raw || '')
    .split(',')
    .filter((tag) => {
      const [name, variant] = tag.split(':');
      if (!Object.hasOwn(EXPERIMENTS, name) || !EXPERIMENTS[name].includes(variant) || seen.has(name)) return false;
      seen.add(name);
      return true;
    });
}

// 支払い済みの Session を記録する。新しく記録したときだけ isNew = true（支払い完了の数はそのときだけ数える）
export async function recordPurchase(env, session) {
  const id = purchaseIdOf(session.id);
  const plan = session.metadata.plan;
  const token = await issueToken(env, id);
  if (!env.DB) return { id, plan, token, isNew: true, refunded: false };
  const pi = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null;
  const res = await env.DB.prepare('INSERT OR IGNORE INTO purchases (id, plan, payment_intent, created_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(id, plan, pi, Date.now())
    .run();
  const isNew = (res?.meta?.changes ?? 0) > 0;
  const stmts = [];
  if (isNew) {
    const bump = env.DB.prepare('INSERT INTO counters (k, n) VALUES (?1, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1');
    const day = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // 日本時間
    stmts.push(bump.bind(`premium:paid:${plan}`), bump.bind('premium:paid'), bump.bind(`day:${day}:paid`));
    // A/Bテストの案ごとの支払い完了
    abTagsOf(session.metadata?.ab).forEach((tag) => stmts.push(bump.bind(`ab:${tag}:paid`)));
  }
  const rid = session.client_reference_id;
  if (rid && /^[a-z2-7]{16}$/.test(rid)) {
    stmts.push(env.DB.prepare('INSERT OR IGNORE INTO claims (rid, token, created_at) VALUES (?1, ?2, ?3)').bind(rid, token, Date.now()));
  }
  if (stmts.length) await env.DB.batch(stmts);
  const row = await env.DB.prepare('SELECT refunded FROM purchases WHERE id = ?1').bind(id).first();
  return { id, plan, token, isNew, refunded: !!row?.refunded };
}

// 期限を過ぎたデータを消す（ときどき呼ぶ）
export async function cleanup(env) {
  if (!env.DB) return;
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM claims WHERE created_at < ?1').bind(now - 7 * 24 * 3600 * 1000),
    env.DB.prepare('DELETE FROM members WHERE group_id IN (SELECT id FROM groups WHERE created_at < ?1)').bind(now - 90 * 24 * 3600 * 1000),
    env.DB.prepare('DELETE FROM groups WHERE created_at < ?1').bind(now - 90 * 24 * 3600 * 1000),
    env.DB.prepare('DELETE FROM rl WHERE exp < ?1').bind(now),
  ]);
}
