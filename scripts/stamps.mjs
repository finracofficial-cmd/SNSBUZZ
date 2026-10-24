// LINEスタンプ（LINE Creators Market）の申請用の画像を書き出す（リポジトリには入れない）。
//   stamps/main.png … メイン画像 240×240
//   stamps/tab.png  … トークルームのタブ画像 96×74
//   stamps/01.png〜40.png … スタンプ 370×320（背景は透明・まわりに10pxの余白・縦横とも偶数）
// 全20タイプ × 2つのセリフ＝40個。セリフは会話でそのまま使える短い言葉にする（タイプのポンコツに合わせて）。
// 長いセリフは \n で2行にする（1行のまま小さくすると、トークの中で読めない）。
// 使い方: npm run content && npm run stamps [出力先]
// 申請するときは、書き出したフォルダの中身をそのまま ZIP にしてアップロードできる（ファイル名は Creators Market の決まりに合わせてある）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { TYPES } from '../site/assets/data.js';

// [タイプの番号, セリフ]（並び順がスタンプの番号になる）
export const STAMPS = [
  [3, 'おはよ…'], [19, '了解です'], [6, '見てるよ'], [7, '行けたら行く'],
  [5, 'ありがと〜♡'], [2, 'さっきの\n忘れて…'], [18, 'おなかすいた'], [10, 'まだ\n起きてる？'],
  [12, '店\nとっといた！'], [15, 'なかよくしよ！'], [14, 'がんばる！！'], [17, '金欠です'],
  [0, 'えっ中止!?'], [1, '3行でおねがい'], [4, 'そろそろ\n帰る…？'], [8, '尊い…'],
  [9, 'ひとりで\n行ってきた'], [11, '明日から本気'], [13, 'その日\nうまってる'], [16, '充電やばい'],
  [3, 'おやすみ'], [19, 'おつかれさま'], [6, 'あとで返す'], [7, 'りょ！'],
  [5, 'おねがい♡'], [2, '反省中…'], [18, 'なに食べる？'], [10, '深夜\nテンション'],
  [12, '集合〜！'], [15, 'はじめまして\n親友'], [14, 'やっちゃった…'], [17, '給料日\nまだ？'],
  [0, '雨ふれ〜'], [1, '倍速でいく'], [4, 'たのしかった！'], [8, '推しは正義'],
  [9, 'おひとりさま\n最高'], [11, '今日だけ休む'], [13, 'スキマなら\n空いてる'], [16, 'それ知ってる！'],
];

// ビルド後の dist はひとまとめにしてあるので、モジュールを1つずつ読める site/ を配る
const dist = path.resolve('site');
const out = path.resolve(process.argv[2] || 'stamps');
const executablePath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
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
  const images = await page.evaluate(async (stamps) => {
    const { FONT, ensureFonts, loadImage, fitFont } = await import('/assets/card.js');
    const { charaDataURL } = await import('/assets/chara.js');
    await ensureFonts(stamps.map(([, text]) => text).join(''));
    const canvasOf = (w, h) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return [c, c.getContext('2d')];
    };
    // 白いふちどりつきの文字（どんな色のトーク画面でも読めるように）
    const outlined = (ctx, text, x, y, size) => {
      ctx.font = `800 ${size}px ${FONT}`;
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.round(size * 0.28);
      ctx.strokeStyle = '#fff';
      ctx.strokeText(text, x, y);
      ctx.fillStyle = '#3B2F33';
      ctx.fillText(text, x, y);
    };
    const result = {};
    // スタンプ 370×320：上にキャラクター、下にセリフ。余白10px
    for (const [k, [index, text]] of stamps.entries()) {
      const [c, ctx] = canvasOf(370, 320);
      const img = await loadImage(charaDataURL(index));
      const lines = text.split('\n');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      if (lines.length === 1) {
        ctx.drawImage(img, 185 - 105, 10, 210, 210);
        outlined(ctx, text, 185, 300, fitFont(ctx, text, 800, 52, 30, 330));
      } else {
        // 2行：キャラクターを少し小さくして、文字を大きく
        ctx.drawImage(img, 185 - 85, 8, 170, 170);
        const size = Math.min(...lines.map((l) => fitFont(ctx, l, 800, 50, 30, 330)));
        lines.forEach((l, j) => outlined(ctx, l, 185, 300 - (lines.length - 1 - j) * (size + 8), size));
      }
      result[String(k + 1).padStart(2, '0')] = c.toDataURL('image/png');
    }
    // メイン画像 240×240（いちばん使われそうな「見てるよ」のキャラクター）、タブ画像 96×74
    {
      const [c, ctx] = canvasOf(240, 240);
      ctx.drawImage(await loadImage(charaDataURL(stamps[2][0])), 10, 10, 220, 220);
      result.main = c.toDataURL('image/png');
    }
    {
      const [c, ctx] = canvasOf(96, 74);
      ctx.drawImage(await loadImage(charaDataURL(stamps[2][0])), 14, 2, 70, 70);
      result.tab = c.toDataURL('image/png');
    }
    return result;
  }, STAMPS);
  await browser.close();
  server.close();

  fs.mkdirSync(out, { recursive: true });
  Object.entries(images).forEach(([name, url]) => fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(url.split(',')[1], 'base64')));
  const used = new Set(STAMPS.map(([i]) => i));
  console.log(`wrote ${Object.keys(images).length} images to ${path.relative(process.cwd(), out)}/ (${STAMPS.length} stamps, ${used.size}/${TYPES.length} types)`);
}
