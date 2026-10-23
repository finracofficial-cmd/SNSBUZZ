// 日本時間の時計まわり（いまの二つ名・今週のお題）。DOM を使わないので、テストからも読める。
// いまの二つ名：日本時間の時間帯・曜日・学校のお休みで、タイプ名の前につく言葉だけが変わる（Spotify の daylist の形）。
// 深夜は寝ることをうながす言葉にして、次に変わる時刻（カウントダウン）は出さない。
const NIGHT = 'そろそろ寝たほうがいい';
// [始まる時, 言葉]。その日の最後の区切りのあとは、次の日の最初の区切りまで続く
const SCHOOL_DAY = [
  [5, '寝ぐせのままの'],
  [9, '授業中うわの空の'],
  [12, 'お昼ごはん最優先の'],
  [13, '午後の眠気と戦う'],
  [15, '寄り道したい'],
  [18, '通知待ちの'],
  [21, '夜ふかし予備軍の'],
  [23, NIGHT],
];
const DAY_OFF = [
  [5, '二度寝したい'],
  [10, 'パジャマのままの'],
  [13, '予定ゼロを満喫中の'],
  [18, '通知待ちの'],
  [23, NIGHT],
];

// 日本時間の年・月・日・曜日・時・分
export function jstParts(now = Date.now()) {
  const d = new Date(now + 9 * 3600 * 1000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), w: d.getUTCDay(), h: d.getUTCHours(), min: d.getUTCMinutes() };
}

// 学校の長いお休み（地域でずれるので、だいたいの期間）
function vacationOf({ m, d }) {
  const md = m * 100 + d;
  if (md >= 720 && md <= 831) return 'summer';
  if (md >= 1225 || md <= 107) return 'winter';
  if (md >= 325 && md <= 406) return 'spring';
  return null;
}
// 祝日（日付が決まっているものと、ハッピーマンデー）。春分・秋分の日は年でずれるので入れていない
const FIXED_HOLIDAYS = [101, 211, 223, 429, 503, 504, 505, 811, 1103, 1123];
const MONDAY_HOLIDAYS = [[1, 2], [7, 3], [9, 3], [10, 2]]; // [月, 第n月曜]
function holiday({ m, d, w }) {
  if (FIXED_HOLIDAYS.includes(m * 100 + d)) return true;
  return w === 1 && MONDAY_HOLIDAYS.some(([mm, n]) => mm === m && Math.ceil(d / 7) === n);
}

// いまの言葉と、次に変わる時刻（深夜は null）
export function nowWord(now = Date.now()) {
  // 0〜4時は前の日の夜の続きとして扱う（日曜の深夜1時は「日曜の夜」）
  const p = jstParts(now);
  const base = p.h < 5 ? jstParts(now - 5 * 3600 * 1000) : p;
  const vacation = vacationOf(base);
  const off = base.w === 0 || base.w === 6 || !!vacation || holiday(base);
  const slots = off ? DAY_OFF : SCHOOL_DAY;
  const hour = p.h < 5 ? p.h + 24 : p.h;
  let k = slots.length - 1;
  while (k > 0 && slots[k][0] > hour) k--;
  let word = slots[k][1];
  // 曜日と季節のちょっとした差しかえ
  if (!off && base.w === 1 && slots[k][0] === 5) word = '休み明けでぼんやりの';
  if (!off && base.w === 5 && slots[k][0] === 18) word = '金曜でごきげんな';
  if (off && slots[k][0] === 13) {
    if (vacation === 'summer') word = '夏休みの宿題が気になる';
    if (vacation === 'winter') word = 'こたつから出られない';
  }
  if (off && base.w === 0 && slots[k][0] === 18 && !vacation) word = '明日の準備がまだの';
  const night = word === NIGHT;
  const nextHour = night ? null : slots[k + 1]?.[0] ?? null;
  const pad = (n) => String(n).padStart(2, '0');
  return {
    word,
    night,
    next: nextHour == null ? null : `${pad(nextHour % 24)}:00`,
    stamp: `${p.m}/${p.d} ${pad(p.h)}:${pad(p.min)}`,
  };
}

export const nowNote = (n) => (n.night ? 'おやすみなさい。朝になると変わります' : `時間帯で変わります。次に変わるのは${n.next}`);

// ---------- 今週のお題 ----------
// 週は月曜0時（日本時間）に切りかわる。週の名前は、その週の月曜の日付（YYYY-MM-DD）。
// functions/_lib/week.js と同じ内容にする（テストで確かめている）
export const WEEK_ID = /^\d{4}-\d{2}-\d{2}$/;
export function weekIdOf(now = Date.now()) {
  const d = new Date(now + 9 * 3600 * 1000);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back)).toISOString().slice(0, 10);
}
export const shiftWeek = (id, n) => new Date(Date.parse(`${id}T00:00:00Z`) + n * 7 * 86400000).toISOString().slice(0, 10);
export const weeksBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (7 * 86400000));
