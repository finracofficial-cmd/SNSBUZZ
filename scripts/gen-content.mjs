// content/types/NN.json から、
//   site/assets/types.js        … 無料で見せる文言（ブラウザに配る）
//   functions/_lib/premium.js   … 完全版の文言（サーバーだけが持つ。購入者にだけ返す）
// を生成する。文言を直したら `npm run content` を実行する。
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('content/types');
const count = 20;
const types = [];
const premium = {};
const missing = [];

for (let i = 0; i < count; i++) {
  const no = String(i).padStart(2, '0');
  const full = path.join(dir, `${no}.json`);
  const seed = path.join(dir, `${no}.seed.json`);
  const t = JSON.parse(fs.readFileSync(fs.existsSync(full) ? full : seed, 'utf8'));
  if (!fs.existsSync(full)) missing.push(no);
  const { premium: p, trigger, ...free } = t;
  // 有料部分の冒頭だけを「続きは完全版で」の予告として無料側に出す
  free.teaser = p?.deep ? `${Array.from(p.deep).slice(0, 38).join('')}…` : '';
  types.push(free);
  if (p) premium[i] = p;
}

const header = '// このファイルは scripts/gen-content.mjs が content/types/*.json から生成する。直接編集しない。\n';
fs.writeFileSync(path.resolve('site/assets/types.js'), `${header}export const TYPES = ${JSON.stringify(types, null, 2)};\n`);
fs.mkdirSync(path.resolve('functions/_lib'), { recursive: true });
fs.writeFileSync(path.resolve('functions/_lib/premium.js'), `${header}export const PREMIUM = ${JSON.stringify(premium, null, 2)};\n`);
console.log(`types.js: ${types.length} types / premium: ${Object.keys(premium).length} types${missing.length ? ` / 未執筆: ${missing.join(', ')}` : ''}`);
