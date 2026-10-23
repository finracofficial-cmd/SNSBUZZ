CREATE TABLE IF NOT EXISTS counters (
  k TEXT PRIMARY KEY,
  n INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  group_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  nick TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, member_id)
);

-- おうちの人に払ってもらったとき、子どもの端末が受け取るまで購入トークンを預かる（7日で無効）
CREATE TABLE IF NOT EXISTS claims (
  rid TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
