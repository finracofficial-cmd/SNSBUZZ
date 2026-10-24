// content/ の文言から、
//   site/assets/types.js        … 無料で見せる文言（ブラウザに配る）
//   functions/_lib/premium.js   … 完全版の文言（サーバーだけが持つ。購入者にだけ返す）
// を生成する。文言を直したら `npm run content` を実行する。
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('content/types');
const count = 20;
const types = [];
const premiumTypes = {};
const missing = [];
// 有料の文章の「文字数」だけは無料側にも出す（モザイクの長さと「約〇字」の表示に使う。中身は出さない）
const len = (s) => Array.from(s || '').length;

for (let i = 0; i < count; i++) {
  const no = String(i).padStart(2, '0');
  const full = path.join(dir, `${no}.json`);
  const seed = path.join(dir, `${no}.seed.json`);
  const t = JSON.parse(fs.readFileSync(fs.existsSync(full) ? full : seed, 'utf8'));
  if (!fs.existsSync(full)) missing.push(no);
  const { premium: p, trigger, ...free } = t;
  // 有料部分の1文目だけを「続きは完全版で」の予告として無料側に出す（モザイクは2文目から）
  const firstEnd = p?.deep ? p.deep.indexOf('。') + 1 : 0;
  free.teaser = p?.deep ? p.deep.slice(0, firstEnd || undefined) : '';
  free.premiumLen = p
    ? {
        deep: len(p.deep) - len(free.teaser),
        growth: (p.growth || []).map((g) => len(g.title) + len(g.body)),
        loveDeep: len(p.loveDeep),
        next: len(p.next),
        letter: len(p.letter),
      }
    : null;
  types.push(free);
  if (p) premiumTypes[i] = p;
}

// くわしい診断：パラメータの段階ごとの文言（lead は無料、detail は有料）
const PARAM_KEYS = ['koi', 'yaki', 'samishi', 'mousou', 'oshi', 'tsukkomi'];
const params = JSON.parse(fs.readFileSync(path.resolve('content/params.json'), 'utf8'));
// 第1章の見本：二つ名のもとになったパラメータの解説の「書き出し」（1文目から、全体の3割まで）だけを無料で見せる。続きは完全版。
// URL を書きかえるとほかの項目の見本も見えるので、全18通りあわせても有料文の2割ほどにとどめる
const sampleOf = (d) => {
  const parts = String(d || '').match(/[^。]+。?/g) || [];
  let out = parts[0] || '';
  let i = 1;
  while (i < parts.length - 2 && len(out) + len(parts[i]) <= len(d) * 0.3) out += parts[i++];
  return out;
};
const paramText = PARAM_KEYS.map((k) =>
  (params[k] || [{}, {}, {}]).map((lv) => {
    const sample = sampleOf(lv.detail);
    return { lead: lv.lead || '', sample, len: len(lv.detail), rest: len(lv.detail) - len(sample) };
  }),
);
const paramDetail = PARAM_KEYS.map((k) => (params[k] || [{}, {}, {}]).map((lv) => lv.detail || ''));

// 恋愛タイプ（name・catch・lead・best は無料、detail・tips・bestWhy は有料）
const love = JSON.parse(fs.readFileSync(path.resolve('content/love.json'), 'utf8'));
const loveFree = [];
const loveDetail = [];
for (let i = 0; i < 8; i++) {
  const l = love.find((x) => x.index === i) || { index: i, name: '', catch: '', lead: '', best: i ^ 6 };
  loveFree.push({
    name: l.name,
    catch: l.catch,
    lead: l.lead,
    best: l.best,
    len: { detail: len(l.detail), tips: (l.tips || []).map(len), bestWhy: len(l.bestWhy) },
  });
  loveDetail.push({ detail: l.detail || '', tips: l.tips || [], bestWhy: l.bestWhy || '' });
}

// ふたりの相性・完全版（content/pair.json）。本文は有料（premium.js だけ）。無料のファイルには文字数だけを入れる
const pairPath = path.resolve('content/pair.json');
const pair = fs.existsSync(pairPath) ? JSON.parse(fs.readFileSync(pairPath, 'utf8')) : null;
const lens = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'axis').map(([k, v]) => [k, len(v)]));
const pairLen = pair
  ? { axes: pair.axes.map(lens), clash: pair.clash.map(lens), play: pair.play.map(lens), message: lens(pair.message) }
  : null;

const header = '// このファイルは scripts/gen-content.mjs が content/ から生成する。直接編集しない。\n';
const js = (name, value) => `export const ${name} = ${JSON.stringify(value, null, 2)};\n`;
fs.writeFileSync(
  path.resolve('site/assets/types.js'),
  header + js('TYPES', types) + js('PARAM_TEXT', paramText) + js('LOVE_TYPES', loveFree) + js('PAIR_LEN', pairLen),
);
fs.mkdirSync(path.resolve('functions/_lib'), { recursive: true });
fs.writeFileSync(
  path.resolve('functions/_lib/premium.js'),
  header + js('PREMIUM', premiumTypes) + js('PARAM_DETAIL', paramDetail) + js('LOVE_DETAIL', loveDetail) + js('PAIR', pair),
);
const blankLeads = paramText.flat().filter((x) => !x.lead).length;
console.log(
  `types.js: ${types.length} types / premium: ${Object.keys(premiumTypes).length} types` +
    `${missing.length ? ` / 未執筆タイプ: ${missing.join(', ')}` : ''}` +
    `${blankLeads ? ` / パラメータ文言の空き: ${blankLeads}` : ''}` +
    `${loveFree.filter((l) => !l.name).length ? ` / 恋愛タイプの空き: ${loveFree.filter((l) => !l.name).length}` : ''}`,
);
