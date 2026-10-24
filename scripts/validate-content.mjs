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
  deep: [280, 380],
  loveDeep: [260, 360],
  next: [260, 360],
  letter: [110, 180],
};
// premium.growth は {title, body} を3つ
export const GROWTH = { title: [8, 24], body: [40, 90] };
// premium.deep の1文目は、第4章の予告として無料で見せる
export const TEASER = [20, 60];
// 商標・実在サービス名・容姿や病気を連想させる言葉・未成年に不向きな話題・性別を決めつける言葉
export const NG = [
  'MBTI', 'SBTI', 'LINE', 'ライン', 'インスタ', 'Instagram', 'TikTok', 'ティックトック', 'YouTube', 'ユーチューブ', 'ツイッター', 'Twitter',
  'メンヘラ', '病み', 'コミュ障', '陰キャ', '陽キャ', 'ブス', 'デブ', 'バカ', 'アホ', '頭が悪', '死ぬ', '死に', '消えたい', '鬱', 'うつ病', '発達', 'ADHD', '障害',
  '彼氏', '彼女', 'お酒', '酒', 'ビール', '飲み会', 'タバコ', 'ギャンブル', 'パチンコ',
  // 「占い」に見える言葉（Stripe Japan の禁止業種対策）
  '占い', '運勢', '運気', '開運', '星座', '守護霊', '前世', '引き寄せ', 'スピリチュアル', '大吉', '吉日', '運命', 'お守り', 'られ運',
  // 生き死にの比喩・お酒の場面・知らない人との接触・実在の機能名・書き残し
  '生かされ', '生きる意味', '生き返', '生きるって', '乾杯', 'スクリーンタイム', '〇〇',
];
// 有料の文章で使わない書き出し・言い方（型どおりに見える／時期がずれる）
export const PREMIUM_NG = ['今年', 'の正体は', '恋の落とし穴は'];
// 予言のように読める言い回し（2027年の章などは「行動の提案」として書く）
export const PREDICTION = ['ありそう', '訪れ', '起こりそう', '待っている予感', '巡ってく', 'チャンスが来る', 'でしょう', '必ずいる', '必ず来る', 'はずです'];

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
    else {
      t.premium.growth.forEach((g, i) => {
        text(`premium.growth[${i}].title`, g?.title, GROWTH.title);
        text(`premium.growth[${i}].body`, g?.body, GROWTH.body);
      });
    }
    const first = typeof t.premium.deep === 'string' ? t.premium.deep.split('。')[0] : '';
    if (len(first) < TEASER[0] || len(first) > TEASER[1]) errors.push(`premium.deep の1文目: ${len(first)}字（${TEASER[0]}〜${TEASER[1]}字。無料の予告に使う）`);
    const premiumText = JSON.stringify(t.premium);
    PREMIUM_NG.forEach((w) => premiumText.includes(w) && errors.push(`有料の文章に「${w}」`));
  }
  if (!Number.isInteger(t.index) || !Number.isInteger(t.best)) errors.push('index / best は整数');
  const all = JSON.stringify(t);
  NG.forEach((w) => {
    if (all.includes(w)) errors.push(`NGワード「${w}」`);
  });
  if (/[!?]/.test(all.replace(/https?:\/\/\S+/g, ''))) errors.push('半角の ! ? は全角にする');
  PREDICTION.forEach((w) => {
    if (t.premium && JSON.stringify(t.premium).includes(w)) errors.push(`予言っぽい言い回し「${w}」`);
  });
  return errors;
}

// くわしい診断のパラメータ文言（content/params.json）
export function checkParams(obj) {
  const errors = [];
  const keys = ['koi', 'yaki', 'samishi', 'mousou', 'oshi', 'tsukkomi'];
  keys.forEach((k) => {
    const levels = obj[k];
    if (!Array.isArray(levels) || levels.length !== 3) {
      errors.push(`${k}: 3段階（低め・ふつう・高め）が必要`);
      return;
    }
    levels.forEach((lv, i) => {
      if (typeof lv.lead !== 'string' || len(lv.lead) < 25 || len(lv.lead) > 60) errors.push(`${k}[${i}].lead: ${len(lv.lead || '')}字（25〜60字）`);
      if (typeof lv.detail !== 'string' || len(lv.detail) < 140 || len(lv.detail) > 230) errors.push(`${k}[${i}].detail: ${len(lv.detail || '')}字（140〜230字）`);
    });
  });
  return errors;
}

// 恋愛タイプ（content/love.json）
export function checkLove(list) {
  const errors = [];
  if (!Array.isArray(list) || list.length !== 8) return ['恋愛タイプは8つ必要'];
  list.forEach((l, i) => {
    if (l.index !== i) errors.push(`love[${i}].index がずれている`);
    if (l.best !== (i ^ 6)) errors.push(`love[${i}].best は ${i ^ 6}`);
    [['name', 4, 12], ['catch', 6, 18], ['lead', 40, 80], ['detail', 160, 240], ['bestWhy', 15, 45]].forEach(([k, min, max]) => {
      if (typeof l[k] !== 'string' || len(l[k]) < min || len(l[k]) > max) errors.push(`love[${i}].${k}: ${len(l[k] || '')}字（${min}〜${max}字）`);
    });
    if (!Array.isArray(l.tips) || l.tips.length !== 3 || l.tips.some((x) => len(x) > 30 || len(x) < 8)) errors.push(`love[${i}].tips: 8〜30字を3つ`);
  });
  return errors;
}

// ふたりの相性・完全版（content/pair.json）。{pos} は軸の1側（全力・人たらし・ノリ派・秒で忘れる）の人、{neg} は0側の人
export const PAIR_RANKS = ['分身', '最強の相方', '名コンビ', 'いい感じ', '刺激しあう仲'];
export function checkPair(p) {
  const errors = [];
  const both = (t) => t.includes('{pos}') && t.includes('{neg}');
  const none = (t) => !/[{}]/.test(t);
  const spec = {
    axes: [['both1', 100, 150, none], ['both0', 100, 150, none], ['diff', 100, 150, both]],
    clash: [['scene', 70, 120, both], ['fix', 70, 120, both], ['trap1', 60, 110, none], ['trap0', 60, 110, none]],
    play: [['both1', 40, 80, none], ['both0', 40, 80, none], ['diff', 40, 80, (t) => !/[{}]/.test(t.replace(/\{pos\}|\{neg\}/g, ''))]],
  };
  for (const [key, fields] of Object.entries(spec)) {
    if (!Array.isArray(p?.[key]) || p[key].length !== 4) {
      errors.push(`${key} は4つ（軸0〜3）必要`);
      continue;
    }
    p[key].forEach((item, k) => {
      if (item.axis !== k) errors.push(`${key}[${k}].axis がずれている`);
      fields.forEach(([f, min, max, ok]) => {
        const t = item[f];
        if (typeof t !== 'string' || len(t) < min || len(t) > max) errors.push(`${key}[${k}].${f}: ${len(t || '')}字（${min}〜${max}字）`);
        else if (!ok(t)) errors.push(`${key}[${k}].${f}: {pos}・{neg} の入れ方がちがう`);
      });
    });
  }
  PAIR_RANKS.forEach((r) => {
    const t = p?.message?.[r];
    if (typeof t !== 'string' || len(t) < 80 || len(t) > 130) errors.push(`message.${r}: ${len(t || '')}字（80〜130字）`);
  });
  return errors;
}

function checkWords(obj, where) {
  const errors = [];
  const all = JSON.stringify(obj);
  NG.forEach((w) => all.includes(w) && errors.push(`${where}: NGワード「${w}」`));
  PREDICTION.forEach((w) => all.includes(w) && errors.push(`${where}: 予言っぽい言い回し「${w}」`));
  if (/[!?]/.test(all)) errors.push(`${where}: 半角の ! ? は全角にする`);
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
  if (!only.length) {
    const extra = [
      ['params.json', (o) => [...checkParams(o), ...checkWords(o, 'params')]],
      ['love.json', (o) => [...checkLove(o), ...checkWords(o, 'love')]],
      ['pair.json', (o) => [...checkPair(o), ...checkWords(o, 'pair')]],
    ];
    for (const [f, fn] of extra) {
      const file = path.resolve('content', f);
      if (!fs.existsSync(file)) continue;
      const errors = fn(JSON.parse(fs.readFileSync(file, 'utf8')));
      if (errors.length) {
        bad++;
        console.log(`✗ ${f}\n  - ${errors.join('\n  - ')}`);
      } else {
        console.log(`✓ ${f}`);
      }
    }
  }
  process.exit(bad ? 1 : 0);
}
