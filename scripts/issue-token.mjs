// サポート用：購入者から「読めなくなった」と連絡があったときに、引き継ぎリンクを作り直す。
// Stripe のダッシュボードで、お客さまのメールアドレスから支払いを探し、Checkout Session の ID（cs_…）を確かめてから使う。
// 使い方: PREMIUM_SECRET=本番と同じ値 node scripts/issue-token.mjs cs_live_xxx [https://本番のドメイン]
import { issueToken } from '../functions/_lib/token.js';

const [sid, origin = 'https://example.com'] = process.argv.slice(2);
if (!process.env.PREMIUM_SECRET || !/^cs_\w{10,200}$/.test(sid || '')) {
  console.error('使い方: PREMIUM_SECRET=... node scripts/issue-token.mjs cs_live_xxx [https://ドメイン]');
  process.exit(1);
}
const token = await issueToken({ PREMIUM_SECRET: process.env.PREMIUM_SECRET }, sid.slice(0, 90));
console.log(`${origin.replace(/\/$/, '')}/#/unlock/${encodeURIComponent(token)}`);
