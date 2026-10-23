// SNS運用で使う画像を書き出す（リポジトリには入れない）。
//   cards/intro/NN.png … タイプ紹介スライド（TikTok・Instagramのカルーセル用）
//   cards/story/NN.png … 診断結果のシェア画像の見本（純度87%・理論値で固定）
// 使い方: npm run build && npm run cards [出力先]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { TYPES, typeNo } from '../site/assets/data.js';

const dist = path.resolve('dist');
const out = path.resolve(process.argv[2] || 'cards');
const executablePath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  let file = path.join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!file.startsWith(dist) || !fs.existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error(e));
await page.goto(`http://localhost:${server.address().port}/#/about`);
const images = await page.evaluate(async (count) => {
  const card = await import('/assets/card.js');
  const result = { intro: [], story: [] };
  for (let i = 0; i < count; i++) {
    result.intro.push((await card.drawIntroSlide(i)).toDataURL('image/png'));
    const story = await card.drawStoryCard({ index: i, purity: 87, title: 'ガチ勢', rarity: { pct: 6.1, source: 'prior' } });
    result.story.push(story.toDataURL('image/png'));
  }
  return result;
}, TYPES.length);
await browser.close();
server.close();

for (const kind of ['intro', 'story']) {
  fs.mkdirSync(path.join(out, kind), { recursive: true });
  images[kind].forEach((url, i) => {
    fs.writeFileSync(path.join(out, kind, `${typeNo(i)}.png`), Buffer.from(url.split(',')[1], 'base64'));
  });
}
console.log(`wrote ${TYPES.length * 2} images to ${path.relative(process.cwd(), out)}/`);
