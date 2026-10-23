// シェア用の画像をcanvasで描く。ストーリーズ用(9:16)の結果・成分表・相性カードと、OGP(1.91:1)。
import { SITE } from './config.js';
import { TYPES, AXES, LOVE_TYPES, isHidden, typeNo } from './data.js';
import { charaDataURL, shade, tint } from './chara.js';
import { statValues, STAT_LABELS } from './radar.js';

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
export async function drawStoryCard({ index, purity, title, rarity, gold = false, nickname = '', loveName = '' }) {
  const t = TYPES[index];
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  await ensureFonts(`${SITE.name}${t.label}${t.praise}${t.roast}${TYPES[t.best].label}${nickname}${loveName}わたしはタイプ診断した人の純度出現率レア度理論値相性恋愛あなたは何？二つ名%0123456789.No`);

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
  if (gold) {
    // 完全版の購入者だけが保存できる金の枠
    const g = ctx.createLinearGradient(0, 0, W, H);
    ['#B8862B', '#F7E08A', '#C9973A', '#FFF1B8', '#B8862B'].forEach((c, k) => g.addColorStop(k / 4, c));
    ctx.lineWidth = 22;
    ctx.strokeStyle = g;
    ctx.stroke();
    roundRect(ctx, W / 2 - 150, 52, 300, 52, 26);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = '#5A3E0A';
    ctx.font = `800 30px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('完全版 GOLD', W / 2, 89);
  } else {
    ctx.lineWidth = 8;
    ctx.strokeStyle = shade(t.color, 0.25);
    ctx.stroke();
  }

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = shade(t.color, 0.45);
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText(SITE.name, 120, 160);
  ctx.textAlign = 'right';
  ctx.fillText(isHidden(index) ? `隠しタイプ ${typeNo(index)}` : `No.${typeNo(index)}`, W - 120, 160);

  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = `500 46px ${FONT}`;
  ctx.fillText('わたしは…', W / 2, 250);

  const img = await loadImage(charaDataURL(index));
  ctx.drawImage(img, W / 2 - 290, 270, 580, 580);

  if (nickname) {
    // 二つ名（くわしい診断）。ラベルの上に一行
    ctx.fillStyle = shade(t.color, 0.35);
    fitFont(ctx, nickname, 800, 54, 36, W - 220);
    ctx.fillText(nickname, W / 2, 878);
  }
  const labelSize = fitFont(ctx, t.label, 800, nickname ? 92 : 104, 60, W - 220);
  ctx.fillStyle = INK;
  ctx.fillText(t.label, W / 2, (nickname ? 940 : 920) + labelSize * 0.35);

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
    loveName ? ['恋愛タイプ', loveName, 'くわしい診断'] : ['レア度', `${rarity.pct.toFixed(1)}%`, rarity.source === 'actual' ? '診断した人の中で' : '理論値'],
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
    if (i === 2 || (i === 1 && loveName)) {
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
  ctx.fillText(`${SITE.quizName}　${isHidden(index) ? `隠しタイプ ${typeNo(index)}` : `No.${typeNo(index)}`}`, 560, 150);
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
  await ensureFonts(`${SITE.name}${SITE.quizName}16タイプ＋隠し4タイプ12問・1分あなたの愛すべきポンコツは？二つ名`);
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
  ctx.fillText('12問・約1分でわかる、あなたの“愛すべきポンコツ”', W / 2, 256);
  const lineup = [3, 6, 8, 12, 10, 14, 7, 1];
  const imgs = await Promise.all(lineup.map((i) => loadImage(charaDataURL(i))));
  imgs.forEach((img, k) => ctx.drawImage(img, 30 + k * 142, 300, 150, 150));
  ctx.fillStyle = '#FF7A59';
  roundRect(ctx, W / 2 - 300, 486, 600, 84, 42);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `800 38px ${FONT}`;
  ctx.fillText('16タイプ＋隠し4タイプ', W / 2, 541);
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
  ctx.fillText(isHidden(index) ? `隠しタイプ ${typeNo(index)}` : `No.${typeNo(index)}`, W - 120, 160);

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


function frame(ctx, W, H, color) {
  ctx.fillStyle = tint(color, 0.6);
  ctx.fillRect(0, 0, W, H);
  roundRect(ctx, 60, 70, W - 120, H - 140, 56);
  ctx.fillStyle = '#FFFDF9';
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = shade(color, 0.25);
  ctx.stroke();
}

function newCanvas(W, H) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  return [canvas, canvas.getContext('2d')];
}

// 成分表カード 1080×1920（食品表示のパロディ）
export async function drawLabelCard({ index, purity, sums, axisPct }) {
  const t = TYPES[index];
  const W = 1080;
  const H = 1920;
  const [canvas, ctx] = newCanvas(W, H);
  await ensureFonts(`${SITE.name}${t.label}${t.ingredients.join('')}${t.habitat}${t.caution}${AXES.map((a) => a.neg + a.pos).join('')}わたしの成分表名称原材料名内容量保存方法製造者栄養成分表示1人あたりポンコツ純度あなたは何タイプ？%0123456789`);
  frame(ctx, W, H, t.color);
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText('わたしの成分表', W / 2, 200);
  const img = await loadImage(charaDataURL(index));
  ctx.drawImage(img, W / 2 - 170, 230, 340, 340);

  // 表示ラベルの枠
  const x0 = 130;
  const x1 = W - 130;
  let y = 640;
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  const rows = [
    ['名称', t.label],
    ['原材料名', t.ingredients.join('、')],
    ['内容量', `ポンコツ純度 ${purity}%`],
    ['保存方法', t.habitat],
    ['製造者', SITE.name],
  ];
  ctx.strokeRect(x0, y, x1 - x0, 0);
  rows.forEach(([k, v]) => {
    ctx.textAlign = 'left';
    ctx.font = `800 36px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.fillText(k, x0 + 24, y + 58);
    ctx.font = `500 38px ${FONT}`;
    const lines = wrap(ctx, v, x1 - x0 - 270, false);
    lines.forEach((line, i) => ctx.fillText(line, x0 + 250, y + 58 + i * 52));
    const h = 36 + lines.length * 52;
    ctx.beginPath();
    ctx.moveTo(x0 + 230, y);
    ctx.lineTo(x0 + 230, y + h);
    ctx.stroke();
    y += h;
    ctx.strokeRect(x0, y, x1 - x0, 0);
  });
  ctx.strokeRect(x0, 640, x1 - x0, y - 640);

  // 栄養成分表示
  y += 60;
  ctx.textAlign = 'left';
  ctx.font = `800 38px ${FONT}`;
  ctx.fillText('栄養成分表示（1人あたり）', x0, y);
  y += 24;
  ctx.lineWidth = 6;
  ctx.strokeRect(x0, y, x1 - x0, 0);
  AXES.forEach((a, k) => {
    const name = sums[k] > 0 ? a.pos : a.neg;
    y += 66;
    ctx.font = `500 40px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(name, x0 + 10, y);
    ctx.textAlign = 'right';
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText(`${axisPct[k]}%`, x1 - 10, y);
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y + 20, x1 - x0, 0);
  });

  y += 100;
  ctx.textAlign = 'left';
  ctx.font = `500 36px ${FONT}`;
  ctx.fillStyle = shade(t.color, 0.45);
  wrap(ctx, `※${t.caution}`, x1 - x0).forEach((line, i) => ctx.fillText(line, x0, y + i * 50));

  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText('あなたは何タイプ？', W / 2, 1774);
  ctx.font = `500 32px ${FONT}`;
  ctx.fillStyle = shade(t.color, 0.4);
  ctx.fillText(`${hostOf(SITE.origin)}  #${SITE.hashtag}`, W / 2, 1822);
  return canvas;
}

// ふたりの相性カード 1080×1920
export async function drawPairCard({ a, b, nameA, nameB, compat }) {
  const ta = TYPES[a.index];
  const tb = TYPES[b.index];
  const W = 1080;
  const H = 1920;
  const [canvas, ctx] = newCanvas(W, H);
  await ensureFonts(`${SITE.name}${nameA}${nameB}${ta.label}${tb.label}${compat.rank}${compat.good}${compat.care || ''}ふたりの相性ただし、あなたたちは？%0123456789×`);
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, tint(ta.color, 0.55));
  bg.addColorStop(1, tint(tb.color, 0.55));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  roundRect(ctx, 60, 70, W - 120, H - 140, 56);
  ctx.fillStyle = '#FFFDF9';
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText(SITE.name, W / 2, 170);
  ctx.font = `800 72px ${FONT}`;
  ctx.fillText('ふたりの相性', W / 2, 270);

  const [ia, ib] = await Promise.all([loadImage(charaDataURL(a.index)), loadImage(charaDataURL(b.index))]);
  ctx.drawImage(ia, 100, 330, 400, 400);
  ctx.drawImage(ib, W - 500, 330, 400, 400);
  [[nameA, ta.label, 300], [nameB, tb.label, W - 300]].forEach(([n, l, x]) => {
    ctx.fillStyle = INK;
    ctx.font = `800 48px ${FONT}`;
    ctx.fillText(n, x, 790);
    fitFont(ctx, l, 500, 34, 22, 400);
    ctx.fillStyle = shade(ta.color, 0.4);
    ctx.fillText(l, x, 842);
  });
  ctx.fillStyle = INK;
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText('×', W / 2, 560);

  ctx.font = `800 200px ${FONT}`;
  ctx.fillStyle = '#FF7A59';
  ctx.fillText(`${compat.score}%`, W / 2, 1100);
  const rank = compat.rank;
  ctx.font = `800 52px ${FONT}`;
  const rw = ctx.measureText(rank).width + 90;
  roundRect(ctx, W / 2 - rw / 2, 1150, rw, 86, 43);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(rank, W / 2, 1212);

  ctx.fillStyle = INK;
  ctx.font = `500 44px ${FONT}`;
  let y = 1340;
  for (const line of wrap(ctx, `${compat.good}。`, W - 240)) {
    ctx.fillText(line, W / 2, y);
    y += 64;
  }
  if (compat.care) {
    y += 20;
    ctx.font = `800 42px ${FONT}`;
    for (const line of wrap(ctx, `ただし、${compat.care}。`, W - 240)) {
      const lw = ctx.measureText(line).width;
      ctx.fillStyle = 'rgba(255, 214, 77, .75)';
      ctx.fillRect(W / 2 - lw / 2 - 10, y - 22, lw + 20, 28);
      ctx.fillStyle = INK;
      ctx.fillText(line, W / 2, y);
      y += 62;
    }
  }
  ctx.fillStyle = INK;
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText('あなたたちは？', W / 2, 1774);
  ctx.font = `500 32px ${FONT}`;
  ctx.fillStyle = '#8A7A7F';
  ctx.fillText(`${hostOf(SITE.origin)}  #${SITE.hashtag}`, W / 2, 1822);
  return canvas;
}

// ペア・グループのURL用OGP 1200×630
export async function drawFeatureOg(kind) {
  const W = 1200;
  const H = 630;
  const [canvas, ctx] = newCanvas(W, H);
  const head = kind === 'group' ? 'グループ診断' : 'ふたりの相性';
  const sub = kind === 'group' ? 'みんなのタイプと役割が1ページに' : 'ふたりの相性は何％？';
  await ensureFonts(`${SITE.name}${SITE.quizName}${head}${sub}`);
  ctx.fillStyle = '#FFF4E8';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8A7A7F';
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText(`${SITE.name}｜${SITE.quizName}`, W / 2, 90);
  ctx.fillStyle = INK;
  ctx.font = `800 92px ${FONT}`;
  ctx.fillText(head, W / 2, 200);
  ctx.font = `500 38px ${FONT}`;
  ctx.fillText(sub, W / 2, 262);
  const lineup = kind === 'group' ? [12, 3, 15, 6, 10, 14] : [3, 15];
  const size = kind === 'group' ? 180 : 260;
  const imgs = await Promise.all(lineup.map((i) => loadImage(charaDataURL(i))));
  const start = (W - lineup.length * size) / 2;
  imgs.forEach((img, k) => ctx.drawImage(img, start + k * size, 300, size, size));
  if (kind !== 'group') {
    ctx.fillStyle = '#FF7A59';
    ctx.font = `800 80px ${FONT}`;
    ctx.fillText('♡', W / 2, 460);
  }
  return canvas;
}


// ステータスカード 1080×1920（完全版の特典。レーダーと10項目の数値）
export async function drawStatusCard(r) {
  const t = TYPES[r.index];
  const W = 1080;
  const H = 1920;
  const [canvas, ctx] = newCanvas(W, H);
  const values = statValues(r);
  const love = LOVE_TYPES[r.love];
  const name = r.nickname?.text || '';
  await ensureFonts(`${SITE.name}${t.label}${name}${love?.name || ''}${STAT_LABELS.join('')}ステータス恋愛タイプ完全版あなたは何タイプ？SABCD%0123456789`);
  frame(ctx, W, H, t.color);
  const g = ctx.createLinearGradient(0, 0, W, H);
  ['#B8862B', '#F7E08A', '#C9973A', '#FFF1B8', '#B8862B'].forEach((c, k) => g.addColorStop(k / 4, c));
  roundRect(ctx, 60, 70, W - 120, H - 140, 56);
  ctx.lineWidth = 18;
  ctx.strokeStyle = g;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = shade(t.color, 0.45);
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText(`${SITE.name}　ステータス`, W / 2, 170);
  const img = await loadImage(charaDataURL(r.index));
  ctx.drawImage(img, 120, 200, 260, 260);
  ctx.textAlign = 'left';
  ctx.fillStyle = shade(t.color, 0.35);
  fitFont(ctx, name, 800, 44, 28, W - 460);
  ctx.fillText(name, 400, 290);
  ctx.fillStyle = INK;
  fitFont(ctx, t.label, 800, 72, 44, W - 460);
  ctx.fillText(t.label, 400, 370);
  if (love) {
    ctx.font = `800 36px ${FONT}`;
    ctx.fillStyle = '#E2566B';
    ctx.fillText(`恋愛タイプ：${love.name}`, 400, 430);
  }

  // レーダー
  const cx = W / 2;
  const cy = 900;
  const R = 300;
  const n = values.length;
  const pt = (k, v) => {
    const a = -Math.PI / 2 + (k / n) * Math.PI * 2;
    return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v];
  };
  ctx.strokeStyle = '#E5D9CF';
  ctx.lineWidth = 2;
  [0.25, 0.5, 0.75, 1].forEach((f) => {
    ctx.beginPath();
    for (let k = 0; k <= n; k++) {
      const [x, y] = pt(k % n, f);
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  });
  ctx.beginPath();
  values.forEach((v, k) => {
    const [x, y] = pt(k, Math.max(v, 4) / 100);
    k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = `${shade(t.color, 0.2)}55`;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = shade(t.color, 0.3);
  ctx.stroke();
  STAT_LABELS.forEach((l, k) => {
    const [x, y] = pt(k, 1.2);
    ctx.textAlign = Math.abs(x - cx) < 6 ? 'center' : x > cx ? 'left' : 'right';
    ctx.fillStyle = INK;
    ctx.font = `800 30px ${FONT}`;
    ctx.fillText(l, x, y);
    ctx.fillStyle = shade(t.color, 0.35);
    ctx.font = `800 30px ${FONT}`;
    ctx.fillText(`${values[k]}`, x, y + 36);
  });

  // ランクの一覧（2列）
  const rank = (v) => (v >= 85 ? 'S' : v >= 67 ? 'A' : v >= 42 ? 'B' : v >= 25 ? 'C' : 'D');
  STAT_LABELS.forEach((l, k) => {
    const col = k < 5 ? 0 : 1;
    const row = k % 5;
    const x = 150 + col * 420;
    const y = 1340 + row * 72;
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.font = `500 36px ${FONT}`;
    ctx.fillText(l, x, y);
    ctx.textAlign = 'right';
    ctx.font = `800 40px ${FONT}`;
    ctx.fillStyle = rank(values[k]) === 'S' ? '#C9973A' : shade(t.color, 0.35);
    ctx.fillText(`${rank(values[k])}  ${values[k]}%`, x + 360, y);
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText('あなたは何タイプ？', W / 2, 1774);
  ctx.font = `500 32px ${FONT}`;
  ctx.fillStyle = shade(t.color, 0.4);
  ctx.fillText(`${hostOf(SITE.origin)}  #${SITE.hashtag}`, W / 2, 1822);
  return canvas;
}

// プロフ帳カード 1080×1920（平成のプロフィール帳風。自由記述は画像の中だけで、どこにも送らない）
export async function drawProfileCard({ r, nick, like, word }) {
  const t = TYPES[r.index];
  const W = 1080;
  const H = 1920;
  const [canvas, ctx] = newCanvas(W, H);
  const love = r.love != null ? LOVE_TYPES[r.love] : null;
  const rows = [
    ['なまえ', nick || '？？？'],
    ['タイプ', `${isHidden(r.index) ? '隠しタイプ' : `No.${typeNo(r.index)}`} ${t.label}`],
    ['二つ名', r.nickname ? r.nickname.text : '（くわしい診断でわかるよ）'],
    ['恋愛タイプ', love ? love.name : '（くわしい診断でわかるよ）'],
    ['口ぐせ', `「${t.kuchiguse}」`],
    ['生息地', t.habitat],
    ['相性◎', TYPES[t.best].label],
    ['すきなもの', like || ''],
    ['ひとこと', word || ''],
  ];
  await ensureFonts(`PROFILEプロフ帳${rows.flat().join('')}${SITE.name}ポンコツ純度あなたも書いて！%0123456789`);
  // 方眼のノート
  ctx.fillStyle = tint(t.color, 0.82);
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = tint(t.color, 0.6);
  ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  roundRect(ctx, 70, 120, W - 140, H - 220, 40);
  ctx.fillStyle = '#FFFDF9';
  ctx.fill();
  // マスキングテープ
  [[110, 96, -8, '#FFB7C5'], [W - 330, 100, 6, '#B5E3D8']].forEach(([x, y, deg, c]) => {
    ctx.save();
    ctx.translate(x + 110, y + 24);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.fillStyle = `${c}DD`;
    ctx.fillRect(-110, -24, 220, 48);
    ctx.restore();
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = shade(t.color, 0.35);
  ctx.font = `800 72px ${FONT}`;
  ctx.fillText('PROFILE', W / 2, 232);
  ctx.font = `800 28px ${FONT}`;
  ctx.fillText(`${SITE.name} プロフ帳`, W / 2, 276);
  // キャラは上のまんなか。左右に星のシール
  const img = await loadImage(charaDataURL(r.index));
  ctx.drawImage(img, W / 2 - 130, 296, 260, 260);
  ctx.fillStyle = '#FFD84D';
  [[260, 360, 24], [300, 430, 14], [W - 260, 380, 20], [W - 300, 470, 12]].forEach(([x, y, k]) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? k * 0.45 : k;
      ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.fill();
  });
  let y = 640;
  const x0 = 130;
  const right = W - 130;
  rows.forEach(([k, v]) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = shade(t.color, 0.4);
    ctx.font = `800 30px ${FONT}`;
    ctx.fillText(k, x0, y);
    ctx.fillStyle = INK;
    fitFont(ctx, v, 500, 40, 24, right - x0 - 200);
    ctx.fillText(v, x0 + 200, y);
    ctx.strokeStyle = tint(t.color, 0.4);
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0, y + 24);
    ctx.lineTo(right, y + 24);
    ctx.stroke();
    ctx.setLineDash([]);
    y += 106;
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = shade(t.color, 0.35);
  ctx.font = `800 38px ${FONT}`;
  ctx.fillText(`ポンコツ純度 ${r.purity}%`, W / 2, 1650);
  ctx.fillStyle = INK;
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText('あなたも書いて！', W / 2, 1736);
  ctx.font = `500 30px ${FONT}`;
  ctx.fillStyle = shade(t.color, 0.4);
  ctx.fillText(`${hostOf(SITE.origin)}  #${SITE.hashtag}`, W / 2, 1782);
  return canvas;
}
