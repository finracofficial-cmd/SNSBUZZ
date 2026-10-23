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
  // 有料部分の冒頭だけを「続きは完全版で」の予告として無料側に出す
  free.teaser = p?.deep ? `${Array.from(p.deep).slice(0, 38).join('')}…` : '';
  free.premiumLen = p
    ? { deep: len(p.deep), growth: (p.growth || []).map(len), loveDeep: len(p.loveDeep), next: len(p.next), letter: len(p.letter) }
    : null;
  types.push(free);
  if (p) premiumTypes[i] = p;
}

// くわしい診断：パラメータの段階ごとの文言（lead は無料、detail は有料）
const PARAM_KEYS = ['koi', 'yaki', 'samishi', 'mousou', 'oshi', 'tsukkomi'];
const params = JSON.parse(fs.readFileSync(path.resolve('content/params.json'), 'utf8'));
const paramText = PARAM_KEYS.map((k) => (params[k] || [{}, {}, {}]).map((lv) => ({ lead: lv.lead || '', len: len(lv.detail) })));
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

const header = '// このファイルは scripts/gen-content.mjs が content/ から生成する。直接編集しない。\n';
const js = (name, value) => `export const ${name} = ${JSON.stringify(value, null, 2)};\n`;
fs.writeFileSync(
  path.resolve('site/assets/types.js'),
  header + js('TYPES', types) + js('PARAM_TEXT', paramText) + js('LOVE_TYPES', loveFree),
);
fs.mkdirSync(path.resolve('functions/_lib'), { recursive: true });
fs.writeFileSync(
  path.resolve('functions/_lib/premium.js'),
  header + js('PREMIUM', premiumTypes) + js('PARAM_DETAIL', paramDetail) + js('LOVE_DETAIL', loveDetail),
);
const blankLeads = paramText.flat().filter((x) => !x.lead).length;
console.log(
  `types.js: ${types.length} types / premium: ${Object.keys(premiumTypes).length} types` +
    `${missing.length ? ` / 未執筆タイプ: ${missing.join(', ')}` : ''}` +
    `${blankLeads ? ` / パラメータ文言の空き: ${blankLeads}` : ''}` +
    `${loveFree.filter((l) => !l.name).length ? ` / 恋愛タイプの空き: ${loveFree.filter((l) => !l.name).length}` : ''}`,
);
