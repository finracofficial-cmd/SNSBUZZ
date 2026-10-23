// タイプ別OGP画像（site/og/NN.png）とトップ用（site/og/top.png）を書き出す。
// 画像はリポジトリにコミットする（Cloudflare Pagesのビルド環境にブラウザがなくても動くように）。
// キャラや文言を変えたら `npm run og` で作り直す。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { TYPES, typeNo } from '../site/assets/data.js';

const site = path.resolve('site');
const outDir = path.join(site, 'og');
const executablePath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/__og') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@500;800&display=swap">');
    return;
  }
  const file = path.join(site, decodeURIComponent(url.pathname));
  if (!file.startsWith(site) || !fs.existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error(e));
await page.goto(`${base}/__og`);
const images = await page.evaluate(async (count) => {
  const card = await import('/assets/card.js');
  const out = {};
  for (let i = 0; i < count; i++) out[i] = (await card.drawOgCard(i)).toDataURL('image/png');
  out.top = (await card.drawTopOg()).toDataURL('image/png');
  return out;
}, TYPES.length);
await browser.close();
server.close();

fs.mkdirSync(outDir, { recursive: true });
for (const [key, dataUrl] of Object.entries(images)) {
  const name = key === 'top' ? 'top' : typeNo(Number(key));
  fs.writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
}
console.log(`wrote ${Object.keys(images).length} images to ${path.relative(process.cwd(), outDir)}/`);
