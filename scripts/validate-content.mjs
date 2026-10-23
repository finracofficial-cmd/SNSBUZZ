// content/types/NN.json の形・文字数・NGワードを検査する。
// 使い方: node scripts/validate-content.mjs [番号...]（省略で全タイプ）
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('content/types');
const len = (s) => Array.from(s).length;

// [最小, 最大] 文字数。配列は [個数, 1つあたりの最大文字数]
export const LIMITS = {
  label: [3, 11],
  chara: [2, 8],
  catch: [6, 16],
  praise: [15, 40],
  roast: [15, 45],
  summary: [130, 200],
  love: [90, 150],
  friend: [70, 130],
  role: [4, 14],
  school: [70, 130],
  oshi: [40, 90],
  sns: [40, 90],
  holiday: [35, 80],
  recover: [35, 80],
  caution: [12, 40],
  habitat: [2, 16],
  kuchiguse: [2, 18],
  bestWhy: [15, 45],
};
export const LISTS = {
  charm: [3, 20],
  ponkotsu: [3, 22],
  aru: [5, 32],
  loveAru: [2, 30],
  jobs: [3, 16],
  ingredients: [5, 8],
};
export const PREMIUM = {
  deep: [140, 230],
  loveDeep: [140, 220],
  next: [120, 200],
  letter: [55, 110],
};
// 商標・実在サービス名・容姿や病気を連想させる言葉・未成年に不向きな話題・性別を決めつける言葉
export const NG = [
  'MBTI', 'SBTI', 'LINE', 'ライン', 'インスタ', 'Instagram', 'TikTok', 'ティックトック', 'YouTube', 'ユーチューブ', 'ツイッター', 'Twitter',
  'メンヘラ', '病み', 'コミュ障', '陰キャ', '陽キャ', 'ブス', 'デブ', 'バカ', 'アホ', '頭が悪', '死ぬ', '死に', '消えたい', '鬱', 'うつ病', '発達', 'ADHD', '障害',
  '彼氏', '彼女', 'お酒', '酒', 'ビール', '飲み会', 'タバコ', 'ギャンブル', 'パチンコ',
];

function check(file) {
  const errors = [];
  let t;
  try {
    t = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [`JSONとして読めない: ${e.message}`];
  }
  const text = (k, v, [min, max]) => {
    if (typeof v !== 'string') errors.push(`${k}: 文字列がない`);
    else if (len(v) < min || len(v) > max) errors.push(`${k}: ${len(v)}字（${min}〜${max}字）`);
  };
  Object.entries(LIMITS).forEach(([k, lim]) => text(k, t[k], lim));
  Object.entries(LISTS).forEach(([k, [n, max]]) => {
    if (!Array.isArray(t[k]) || t[k].length !== n) errors.push(`${k}: ${n}個の配列が必要`);
    else t[k].forEach((v, i) => text(`${k}[${i}]`, v, [2, max]));
  });
  ['do', 'dont'].forEach((k) => {
    const list = t.toriset?.[k];
    if (!Array.isArray(list) || list.length !== 3) errors.push(`toriset.${k}: 3個の配列が必要`);
    else list.forEach((v, i) => text(`toriset.${k}[${i}]`, v, [4, 24]));
  });
  if (!t.premium) errors.push('premium がない');
  else {
    Object.entries(PREMIUM).forEach(([k, lim]) => text(`premium.${k}`, t.premium[k], lim));
    if (!Array.isArray(t.premium.growth) || t.premium.growth.length !== 3) errors.push('premium.growth: 3個の配列が必要');
    else t.premium.growth.forEach((v, i) => text(`premium.growth[${i}]`, v, [10, 36]));
  }
  if (!Number.isInteger(t.index) || !Number.isInteger(t.best)) errors.push('index / best は整数');
  const all = JSON.stringify(t);
  NG.forEach((w) => {
    if (all.includes(w)) errors.push(`NGワード「${w}」`);
  });
  if (/[!?]/.test(all.replace(/https?:\/\/\S+/g, ''))) errors.push('半角の ! ? は全角にする');
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv.slice(2).map((n) => n.padStart(2, '0'));
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^\d\d\.json$/.test(f))
    .filter((f) => !only.length || only.includes(f.slice(0, 2)));
  let bad = 0;
  for (const f of files) {
    const errors = check(path.join(dir, f));
    if (errors.length) {
      bad++;
      console.log(`✗ ${f}\n  - ${errors.join('\n  - ')}`);
    } else {
      console.log(`✓ ${f}`);
    }
  }
  process.exit(bad ? 1 : 0);
}
