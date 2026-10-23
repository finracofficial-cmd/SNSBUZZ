// 今週のお題の「週」。月曜0時（日本時間）に切りかわり、週の名前はその週の月曜の日付（YYYY-MM-DD）。
// site/assets/clock.js の weekIdOf と同じ内容にする（テストで確かめている）
export const WEEK_ID = /^\d{4}-\d{2}-\d{2}$/;
export function weekIdOf(now = Date.now()) {
  const d = new Date(now + 9 * 3600 * 1000);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back)).toISOString().slice(0, 10);
}
