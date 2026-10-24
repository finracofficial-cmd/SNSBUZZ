CREATE TABLE IF NOT EXISTS counters (
  k TEXT PRIMARY KEY,
  n INTEGER NOT NULL DEFAULT 0
);

-- 回数制限（IPのハッシュ×1分ごと）。期限を過ぎた行は、ときどきまとめて消す
CREATE TABLE IF NOT EXISTS rl (
  k TEXT PRIMARY KEY,
  n INTEGER NOT NULL DEFAULT 0,
  exp INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rl_exp ON rl (exp);

-- locked = 1 のあいだは、新しいメンバーは参加できない（作った人が締め切る）
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  admin TEXT NOT NULL DEFAULT '',
  locked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- member_id は、本人の端末だけが持つ秘密（グループごと）のハッシュ。誰にも返さない。
-- handle は、ほかの人に見せるランダムな番号（作った人がメンバーを外すときに使う）
CREATE TABLE IF NOT EXISTS members (
  group_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  handle TEXT NOT NULL,
  nick TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, member_id)
);

-- 完全版の購入（Stripe の Checkout Session ごとに1行）。
-- 返金されたら refunded = 1 にして、その購入のトークンでは読めなくする。
-- プレゼント（ふたり用）は、受け取られたら gift_used_at を入れて、2人目からは受け取れなくする。
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  plan TEXT NOT NULL,
  payment_intent TEXT,
  created_at INTEGER NOT NULL,
  gift_used_at INTEGER,
  refunded INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS purchases_payment_intent ON purchases (payment_intent);

-- 全額返金とチャージバック（reason = refund / dispute）。購入の記録より先に届いても取りこぼさないよう、別に残す
CREATE TABLE IF NOT EXISTS refunds (
  payment_intent TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  at INTEGER NOT NULL
);

-- おうちの人に払ってもらったとき、子どもの端末が受け取るまで購入トークンを預かる（7日で無効）。
-- rid は子どもの端末だけが持つ秘密のハッシュ。リンクを知っているだけでは受け取れない。
CREATE TABLE IF NOT EXISTS claims (
  rid TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 紹介：ref（シェアした人の端末のランダムな番号）のリンクから、visitor（友達の端末のランダムな番号）が初めて診断を終えた。
-- 1人の友達は1回だけ数える。個人を特定する情報は入れない
CREATE TABLE IF NOT EXISTS refs (
  ref TEXT NOT NULL,
  visitor TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (ref, visitor)
);
