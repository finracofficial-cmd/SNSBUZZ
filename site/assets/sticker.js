// シール帳用のシール（L判・1050×1500）。コンビニのマルチコピー機の「シール紙」で印刷して、切って使う。
// 10代のシール交換で友達の手元に渡ったとき、QR から診断に来られる（QR のリンクは相性のおさそいつき）。
// QR のライブラリは大きいので、このファイルごと、ボタンを押したときだけ読みこむ。
import qrcode from 'qrcode-generator';
import { SITE } from './config.js';
import { TYPES, LOVE_TYPES, isHidden, typeNo } from './data.js';
import { charaDataURL, shade, tint } from './chara.js';
import { FONT, INK, ensureFonts, loadImage, fitFont, roundRect, newCanvas, wrap } from './card.js';

const W = 1050;
const H = 1500;

// 切り取り線（点線）と、白いふちどりのシール
function sticker(ctx, x, y, w, h, r, fill) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.12)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.restore();
  roundRect(ctx, x + 10, y + 10, w - 20, h - 20, Math.max(r - 10, 6));
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(59,47,51,.35)';
  roundRect(ctx, x - 8, y - 8, w + 16, h + 16, r + 8);
  ctx.stroke();
  ctx.restore();
}

function pill(ctx, x, y, w, h, text, fill, color, size) {
  sticker(ctx, x, y, w, h, h / 2, fill);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  fitFont(ctx, text, 800, size, 22, w - 50);
  ctx.fillText(text, x + w / 2, y + h / 2 + size * 0.36);
}

function drawQr(ctx, text, x, y, size) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 3;
  const cell = size / (n + quiet * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = INK;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect(x + (c + quiet) * cell, y + (r + quiet) * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
}

// r: 診断結果（くわしい診断なら二つ名・恋愛タイプも入れる）、url: QR に入れるリンク
export async function drawStickerSheet(r, url) {
  const t = TYPES[r.index];
  const nickname = r.nickname?.text || '';
  const love = r.params ? LOVE_TYPES[r.love] : null;
  const [canvas, ctx] = newCanvas(W, H);
  await ensureFonts(`${SITE.name}${SITE.quizName}${t.label}${t.chara}${t.kuchiguse}${nickname}${love?.name || ''}${TYPES[t.best].label}シールポンコツ純度相性◎わたしのタイプは？読みこんでね隠しタイプNo.0123456789%#「」`);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  const deep = shade(t.color, 0.45);

  ctx.textAlign = 'left';
  ctx.fillStyle = deep;
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText(`${SITE.name} シール`, 50, 72);
  ctx.textAlign = 'right';
  ctx.fillText(isHidden(r.index) ? `隠しタイプ ${typeNo(r.index)}` : `No.${typeNo(r.index)}`, W - 50, 72);

  // 1. 大きいシール：キャラとタイプ名（くわしい診断なら二つ名も）
  const img = await loadImage(charaDataURL(r.index));
  sticker(ctx, 50, 120, 600, 660, 48, tint(t.color, 0.6));
  ctx.drawImage(img, 120, 140, 460, 460);
  ctx.textAlign = 'center';
  if (nickname) {
    ctx.fillStyle = deep;
    fitFont(ctx, nickname, 800, 40, 26, 520);
    ctx.fillText(nickname, 350, 650);
  }
  ctx.fillStyle = INK;
  fitFont(ctx, t.label, 800, 64, 36, 520);
  ctx.fillText(t.label, 350, nickname ? 720 : 700);

  // 2. QR のシール（友達が読みこむと、相性のおさそいつきで診断に来られる）
  sticker(ctx, 690, 120, 310, 400, 36, '#FFFDF9');
  drawQr(ctx, url, 715, 145, 260);
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText('わたしのタイプは？', 845, 448);
  ctx.font = `500 22px ${FONT}`;
  ctx.fillStyle = deep;
  ctx.fillText('読みこむと相性も出るよ', 845, 486);

  // 3. 口ぐせの吹き出し
  sticker(ctx, 690, 560, 310, 220, 36, tint(t.color, 0.82));
  ctx.fillStyle = INK;
  ctx.font = `800 34px ${FONT}`;
  const lines = wrap(ctx, `「${t.kuchiguse}」`, 250).slice(0, 3);
  lines.forEach((line, k) => ctx.fillText(line, 845, 680 - (lines.length - 1) * 22 + k * 46));

  // 4. 小さいキャラのシール3つ（背景の色ちがい）
  const minis = [tint(t.color, 0.35), '#FFE9A8', '#E4ECFF'];
  minis.forEach((bg, k) => {
    const x = 50 + k * 325;
    sticker(ctx, x, 830, 300, 300, 150, bg);
    ctx.drawImage(img, x + 40, 860, 220, 220);
  });
  ctx.font = `800 26px ${FONT}`;
  ctx.fillStyle = INK;
  ['よろしくね', t.chara, 'ポンコツです'].forEach((word, k) => {
    fitFont(ctx, word, 800, 26, 18, 200);
    ctx.fillText(word, 200 + k * 325, 1104);
  });

  // 5. ことばのシール
  pill(ctx, 50, 1180, 460, 96, `ポンコツ純度 ${r.purity}%`, tint(t.color, 0.55), INK, 40);
  pill(ctx, 540, 1180, 460, 96, love ? `恋愛：${love.name}` : `相性◎ ${TYPES[t.best].label}`, '#FFE0D6', '#8A3A22', 36);
  pill(ctx, 50, 1310, 460, 96, `#${SITE.hashtag}`, '#F3F0EC', deep, 40);
  pill(ctx, 540, 1310, 460, 96, SITE.quizName, '#FFFFFF', deep, 34);

  ctx.textAlign = 'center';
  ctx.font = `500 22px ${FONT}`;
  ctx.fillStyle = 'rgba(59,47,51,.55)';
  ctx.fillText('点線にそって切ってね', W / 2, 1468);
  return canvas;
}
