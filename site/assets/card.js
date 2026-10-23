// シェア用の画像をcanvasで描く。ストーリーズ用(9:16)と、タイプ別OGP(1.91:1)の2種類。
import { SITE } from './config.js';
import { TYPES, HIDDEN_INDEX, typeNo } from './data.js';
import { charaDataURL, shade, tint } from './chara.js';

export const FONT = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Hiragino Sans", "Noto Sans JP", sans-serif';
const INK = '#3B2F33';
const NO_LINE_END = '「『（(“';
const NO_LINE_START = '。、，．・ー」』）)！？!?〜…ぁぃぅぇぉっゃゅょァィゥェォッャュョ%％';

export async function ensureFonts(text) {
  if (!document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`800 40px "M PLUS Rounded 1c"`, text),
      document.fonts.load(`500 40px "M PLUS Rounded 1c"`, text),
    ]);
  } catch {
    // フォントが読めなくてもシステムフォントで描ける
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// 日本語の折り返し。単語（Intl.Segmenter）単位で切り、行頭禁則を守り、行の長さをそろえる。
const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('ja', { granularity: 'word' }) : null;

function greedy(ctx, pieces, maxWidth) {
  const lines = [];
  let line = '';
  const queue = [...pieces];
  while (queue.length) {
    const piece = queue.shift();
    // 1単語が1行より長いときだけ文字単位にばらす
    if (piece.length > 1 && ctx.measureText(piece).width > maxWidth) {
      queue.unshift(...Array.from(piece));
      continue;
    }
    if (!line || ctx.measureText(line + piece).width <= maxWidth || NO_LINE_START.includes(piece[0])) {
      line += piece;
      continue;
    }
    // 「（ などが行末に残らないよう、次の行へ送る
    let carry = '';
    while (line.length > 1 && NO_LINE_END.includes(line[line.length - 1])) {
      carry = line[line.length - 1] + carry;
      line = line.slice(0, -1);
    }
    lines.push(line);
    line = carry + piece;
  }
  if (line) lines.push(line);
  return lines;
}

function wrap(ctx, text, maxWidth, balance = true) {
  const pieces = segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text);
  const lines = greedy(ctx, pieces, maxWidth);
  if (!balance || lines.length < 2) return lines;
  // 同じ行数に収まる範囲で幅を詰めて、最後の行だけ極端に短くならないようにする
  let lo = maxWidth * 0.5;
  let hi = maxWidth;
  for (let k = 0; k < 12; k++) {
    const mid = (lo + hi) / 2;
    if (greedy(ctx, pieces, mid).length <= lines.length) hi = mid;
    else lo = mid;
  }
  return greedy(ctx, pieces, hi);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitFont(ctx, text, weight, start, min, maxWidth) {
  let size = start;
  do {
    ctx.font = `${weight} ${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  } while (size > min);
  return size;
}

const hostOf = (origin) => origin.replace(/^https?:\/\//, '').replace(/\/$/, '');

// ストーリーズ・TikTok用 1080×1920
export async function drawStoryCard({ index, purity, title, rarity }) {
  const t = TYPES[index];
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  await ensureFonts(`${SITE.name}${t.label}${t.praise}${t.roast}${TYPES[t.best].label}わたしはタイプ診断した人の純度出現率レア度理論値相性あなたは何？%0123456789.No`);

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, tint(t.color, 0.72));
  bg.addColorStop(1, tint(t.color, 0.45));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 背景の水玉
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  for (let i = 0; i < 22; i++) {
    const x = (i * 197) % W;
    const y = (i * 331) % H;
    ctx.beginPath();
    ctx.arc(x, y, 18 + (i % 4) * 10, 0, Math.PI * 2);
    ctx.fill();
  }

  roundRect(ctx, 60, 70, W - 120, H - 140, 56);
  ctx.fillStyle = '#FFFDF9';
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = shade(t.color, 0.25);
  ctx.stroke();

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = shade(t.color, 0.45);
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText(SITE.name, 120, 160);
  ctx.textAlign = 'right';
  ctx.fillText(index === HIDDEN_INDEX ? '隠しタイプ' : `No.${typeNo(index)}`, W - 120, 160);

  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = `500 46px ${FONT}`;
  ctx.fillText('わたしは…', W / 2, 250);

  const img = await loadImage(charaDataURL(index));
  ctx.drawImage(img, W / 2 - 290, 270, 580, 580);

  const labelSize = fitFont(ctx, t.label, 800, 104, 60, W - 220);
  ctx.fillStyle = INK;
  ctx.fillText(t.label, W / 2, 920 + labelSize * 0.35);

  // 称号のピル
  const chip = `${title}・純度${purity}%`;
  ctx.font = `800 40px ${FONT}`;
  const cw = ctx.measureText(chip).width + 72;
  roundRect(ctx, W / 2 - cw / 2, 1000, cw, 70, 35);
  ctx.fillStyle = shade(t.color, 0.15);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(chip, W / 2, 1049);

  // ほめ言葉
  ctx.font = `500 46px ${FONT}`;
  ctx.fillStyle = INK;
  let y = 1170;
  for (const line of wrap(ctx, t.praise, W - 240)) {
    ctx.fillText(line, W / 2, y);
    y += 66;
  }
  // 痛いところを突く一行（蛍光ペン風）
  y += 24;
  ctx.font = `800 50px ${FONT}`;
  for (const line of wrap(ctx, t.roast, W - 220)) {
    const lw = ctx.measureText(line).width;
    ctx.fillStyle = 'rgba(255, 214, 77, .75)';
    ctx.fillRect(W / 2 - lw / 2 - 10, y - 24, lw + 20, 30);
    ctx.fillStyle = INK;
    ctx.fillText(line, W / 2, y);
    y += 72;
  }

  // 数字のタイル
  const tiles = [
    ['ポンコツ純度', `${purity}%`, title],
    ['レア度', `${rarity.pct.toFixed(1)}%`, rarity.source === 'actual' ? '診断した人の中で' : '理論値'],
    ['相性◎', TYPES[t.best].label, TYPES[t.best].chara],
  ];
  const tw = (W - 240 - 40) / 3;
  const ty = 1520;
  tiles.forEach(([head, value, sub], i) => {
    const x = 120 + i * (tw + 20);
    roundRect(ctx, x, ty, tw, 190, 28);
    ctx.fillStyle = tint(t.color, 0.78);
    ctx.fill();
    ctx.fillStyle = shade(t.color, 0.45);
    ctx.font = `800 32px ${FONT}`;
    ctx.fillText(head, x + tw / 2, ty + 50);
    ctx.fillStyle = INK;
    if (i === 2) {
      ctx.font = `800 34px ${FONT}`;
      const lines = wrap(ctx, value, tw - 28).slice(0, 2);
      lines.forEach((line, k) => ctx.fillText(line, x + tw / 2, ty + (lines.length === 1 ? 112 : 98) + k * 40));
    } else {
      const vs = fitFont(ctx, value, 800, 64, 22, tw - 24);
      ctx.fillText(value, x + tw / 2, ty + 110 + vs * 0.12);
    }
    ctx.font = `500 26px ${FONT}`;
    ctx.fillStyle = shade(t.color, 0.35);
    ctx.fillText(sub, x + tw / 2, ty + 172);
  });

  ctx.fillStyle = INK;
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText('あなたは何タイプ？', W / 2, 1774);
  ctx.font = `500 32px ${FONT}`;
  ctx.fillStyle = shade(t.color, 0.4);
  ctx.fillText(`${hostOf(SITE.origin)}  #${SITE.hashtag}`, W / 2, 1822);
  return canvas;
}

// タイプ別OGP 1200×630（ビルド時にPNGへ書き出す）
export async function drawOgCard(index) {
  const t = TYPES[index];
  const W = 1200;
  const H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  await ensureFonts(`${SITE.name}${SITE.quizName}${t.label}${t.roast}${t.chara}あなたは何タイプ？隠しNo.0123456789`);

  ctx.fillStyle = tint(t.color, 0.6);
  ctx.fillRect(0, 0, W, H);
  roundRect(ctx, 36, 36, W - 72, H - 72, 44);
  ctx.fillStyle = '#FFFDF9';
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = shade(t.color, 0.25);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(300, 330, 230, 0, Math.PI * 2);
  ctx.fillStyle = tint(t.color, 0.7);
  ctx.fill();
  const img = await loadImage(charaDataURL(index));
  ctx.drawImage(img, 90, 120, 420, 420);

  ctx.textAlign = 'left';
  ctx.fillStyle = shade(t.color, 0.45);
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText(`${SITE.quizName}　${index === HIDDEN_INDEX ? '隠しタイプ' : `No.${typeNo(index)}`}`, 560, 150);
  ctx.fillStyle = INK;
  fitFont(ctx, t.label, 800, 84, 48, W - 620);
  ctx.fillText(t.label, 556, 260);
  ctx.font = `500 34px ${FONT}`;
  let y = 340;
  for (const line of wrap(ctx, t.roast, W - 640).slice(0, 3)) {
    ctx.fillText(line, 560, y);
    y += 50;
  }
  ctx.fillStyle = shade(t.color, 0.45);
  ctx.font = `800 36px ${FONT}`;
  ctx.fillText('あなたは何タイプ？', 560, 540);
  return canvas;
}

export const canvasToBlob = (canvas) =>
  new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));

// トップページ用OGP 1200×630
export async function drawTopOg() {
  const W = 1200;
  const H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  await ensureFonts(`${SITE.name}${SITE.quizName}16タイプ＋隠しタイプ12問・1分あなたの愛すべきポンコツは？`);
  ctx.fillStyle = '#FFF4E8';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8A7A7F';
  ctx.font = `800 36px ${FONT}`;
  ctx.fillText(SITE.name, W / 2, 92);
  ctx.fillStyle = INK;
  ctx.font = `800 88px ${FONT}`;
  ctx.fillText(SITE.quizName, W / 2, 196);
  ctx.font = `500 34px ${FONT}`;
  ctx.fillText('12問・1分でわかる、あなたの“愛すべきポンコツ”', W / 2, 256);
  const lineup = [3, 6, 8, 12, 10, 14, 7, 1];
  const imgs = await Promise.all(lineup.map((i) => loadImage(charaDataURL(i))));
  imgs.forEach((img, k) => ctx.drawImage(img, 30 + k * 142, 300, 150, 150));
  ctx.fillStyle = '#FF7A59';
  roundRect(ctx, W / 2 - 300, 486, 600, 84, 42);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `800 38px ${FONT}`;
  ctx.fillText('16タイプ＋隠しタイプ', W / 2, 541);
  return canvas;
}

// SNS運用向けのタイプ紹介スライド 1080×1920（「全16タイプあるある」カルーセル用）
export async function drawIntroSlide(index) {
  const t = TYPES[index];
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  await ensureFonts(`${SITE.name}${t.label}${t.aru.join('')}${t.chara}あるある診断はプロフのリンクからあなたは何タイプ？隠しNo.0123456789`);

  ctx.fillStyle = tint(t.color, 0.6);
  ctx.fillRect(0, 0, W, H);
  roundRect(ctx, 60, 70, W - 120, H - 140, 56);
  ctx.fillStyle = '#FFFDF9';
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = shade(t.color, 0.25);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = shade(t.color, 0.45);
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText(SITE.name, 120, 160);
  ctx.textAlign = 'right';
  ctx.fillText(index === HIDDEN_INDEX ? '隠しタイプ' : `No.${typeNo(index)}`, W - 120, 160);

  const img = await loadImage(charaDataURL(index));
  ctx.drawImage(img, W / 2 - 260, 190, 520, 520);
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  fitFont(ctx, t.label, 800, 104, 60, W - 220);
  ctx.fillText(t.label, W / 2, 800);

  ctx.fillStyle = shade(t.color, 0.4);
  ctx.font = `800 44px ${FONT}`;
  ctx.fillText('〜 あるある 〜', W / 2, 920);
  let y = 1020;
  ctx.textAlign = 'left';
  t.aru.forEach((a) => {
    ctx.font = `500 50px ${FONT}`;
    const lines = wrap(ctx, a, W - 400, false);
    roundRect(ctx, 120, y - 64, W - 240, lines.length * 70 + 50, 28);
    ctx.fillStyle = tint(t.color, 0.8);
    ctx.fill();
    ctx.fillStyle = shade(t.color, 0.4);
    ctx.font = `800 50px ${FONT}`;
    ctx.fillText('✓', 152, y);
    ctx.fillStyle = INK;
    ctx.font = `500 50px ${FONT}`;
    lines.forEach((line, k) => ctx.fillText(line, 220, y + k * 70));
    y += lines.length * 70 + 84;
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = `800 44px ${FONT}`;
  ctx.fillText('あなたは何タイプ？', W / 2, 1740);
  ctx.font = `500 34px ${FONT}`;
  ctx.fillStyle = shade(t.color, 0.4);
  ctx.fillText('診断はプロフのリンクから', W / 2, 1800);
  return canvas;
}
