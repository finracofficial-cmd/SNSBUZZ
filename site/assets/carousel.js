// TikTok のフォトモード・Instagram のカルーセル向けに、結果を6枚の画像（9:16）にまとめる。
//   1 表紙（キャラ・二つ名・タイプ名） 2 あるある 3 ステータス（くわしい診断）／成分（かんたん診断）
//   4 恋愛 5 トリセツ 6 相性◎と「あなたは何タイプ？」
// 載せるのは無料で見られる内容だけ（くわしい診断のパラメータは、数値ではなくランクだけ）。
import { SITE } from './config.js';
import { TYPES, AXES, LOVE_TYPES, isHidden, typeNo } from './data.js';
import { rankOf, skillsOf } from './logic.js';
import { charaDataURL, shade, tint } from './chara.js';
import { statValues, statLabels } from './radar.js';
import { FONT, INK, ensureFonts, loadImage, wrap, roundRect, fitFont, hostOf, newCanvas, searchBand } from './card.js';

const W = 1080;
const H = 1920;
export const SLIDES = 6;
const RANK_COLORS = { S: ['#FFE9A8', '#8A5A00'], A: ['#FFE0D6', '#B8432A'], B: ['#E4ECFF', '#3D55B0'], C: ['#E6F4EC', '#2F7A54'], D: ['#EEEEEE', '#666666'] };

// 共通の枠：背景・白いカード・ヘッダ（サイト名と 2/6）・フッタ（ハッシュタグ）・右下のスワイプ矢印
function base(ctx, t, n) {
  ctx.fillStyle = tint(t.color, 0.58);
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  for (let i = 0; i < 16; i++) {
    ctx.beginPath();
    ctx.arc((i * 263 + n * 71) % W, (i * 389) % H, 16 + (i % 4) * 10, 0, Math.PI * 2);
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
  ctx.font = `800 38px ${FONT}`;
  ctx.fillText(SITE.name, 120, 158);
  ctx.textAlign = 'right';
  ctx.fillText(`${n} / ${SLIDES}`, W - 120, 158);
  ctx.textAlign = 'center';
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText(`#${SITE.hashtag}  ${hostOf(SITE.origin)}`, W / 2, H - 112);
  if (n < SLIDES) {
    // 次の1枚があることを知らせる矢印
    ctx.fillStyle = shade(t.color, 0.3);
    ctx.beginPath();
    ctx.arc(W - 150, H - 220, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `800 48px ${FONT}`;
    ctx.fillText('→', W - 150, H - 204);
  }
}

function heading(ctx, t, text, y, size = 72) {
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  fitFont(ctx, text, 800, size, 40, W - 240);
  ctx.fillText(text, W / 2, y);
  ctx.fillStyle = tint(t.color, 0.35);
  const w = Math.min(ctx.measureText(text).width, W - 240);
  ctx.fillRect(W / 2 - w / 2, y + 18, w, 10);
}

// 箇条書き：白いカードに丸印と文。高さを返す
function bullets(ctx, t, items, y, { mark = '✓', size = 50, gap = 34, color } = {}) {
  ctx.textAlign = 'left';
  for (const text of items) {
    ctx.font = `500 ${size}px ${FONT}`;
    const lines = wrap(ctx, text, W - 420, false);
    const h = lines.length * (size + 22) + 52;
    roundRect(ctx, 120, y, W - 240, h, 30);
    ctx.fillStyle = tint(color || t.color, 0.82);
    ctx.fill();
    ctx.fillStyle = shade(color || t.color, 0.4);
    ctx.font = `800 ${size}px ${FONT}`;
    ctx.fillText(mark, 160, y + 26 + size);
    ctx.fillStyle = INK;
    ctx.font = `500 ${size}px ${FONT}`;
    lines.forEach((line, k) => ctx.fillText(line, 232, y + 26 + size + k * (size + 22)));
    y += h + gap;
  }
  return y;
}

function rankChip(ctx, rank, x, y, size = 64) {
  const [bg, fg] = RANK_COLORS[rank];
  roundRect(ctx, x, y, size, size, 16);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.font = `800 ${Math.round(size * 0.62)}px ${FONT}`;
  ctx.fillText(rank, x + size / 2, y + size * 0.74);
}

// 1. 表紙
async function cover(r, t, img, nickname) {
  const [canvas, ctx] = newCanvas(W, H);
  base(ctx, t, 1);
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = `800 58px ${FONT}`;
  ctx.fillText('わたしのポンコツ、判明。', W / 2, 290);
  ctx.drawImage(img, W / 2 - 300, 340, 600, 600);
  let y = 1040;
  if (nickname) {
    ctx.fillStyle = shade(t.color, 0.35);
    fitFont(ctx, nickname, 800, 60, 36, W - 220);
    ctx.fillText(nickname, W / 2, y);
    y += 100;
  }
  ctx.fillStyle = INK;
  const size = fitFont(ctx, t.label, 800, 110, 60, W - 200);
  ctx.fillText(t.label, W / 2, y + size * 0.3);
  y += size + 40;
  ctx.font = `500 46px ${FONT}`;
  ctx.fillStyle = shade(t.color, 0.4);
  ctx.fillText(isHidden(r.index) ? `隠しタイプ ${typeNo(r.index)}` : `No.${typeNo(r.index)} ／ 全${TYPES.length}タイプ`, W / 2, y);
  y += 110;
  ctx.font = `800 54px ${FONT}`;
  const lines = wrap(ctx, `「${t.catch}」`, W - 260);
  lines.forEach((line, k) => {
    const lw = ctx.measureText(line).width;
    ctx.fillStyle = 'rgba(255, 214, 77, .7)';
    ctx.fillRect(W / 2 - lw / 2 - 10, y + k * 76 - 26, lw + 20, 32);
    ctx.fillStyle = INK;
    ctx.fillText(line, W / 2, y + k * 76);
  });
  ctx.font = `500 40px ${FONT}`;
  ctx.fillStyle = shade(t.color, 0.4);
  ctx.fillText('スワイプしてね', W / 2, H - 205);
  return canvas;
}

// 2. あるある
function aru(r, t) {
  const [canvas, ctx] = newCanvas(W, H);
  base(ctx, t, 2);
  heading(ctx, t, `${t.label}あるある`, 310);
  const y = bullets(ctx, t, t.aru.slice(0, 4), 430);
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = `800 56px ${FONT}`;
  ctx.fillText('わかる人いる？', W / 2, Math.min(y + 90, H - 330));
  return canvas;
}

// 3. ステータス（くわしい診断）／成分（かんたん診断）
function status(r, t) {
  const [canvas, ctx] = newCanvas(W, H);
  base(ctx, t, 3);
  if (r.params) {
    heading(ctx, t, 'ステータス', 310);
    const labels = statLabels(r);
    const values = statValues(r);
    const colW = (W - 240 - 40) / 2;
    labels.forEach((label, k) => {
      const col = k < 5 ? 0 : 1;
      const row = k % 5;
      const x = 120 + col * (colW + 40);
      const y = 410 + row * 134;
      roundRect(ctx, x, y, colW, 112, 26);
      ctx.fillStyle = tint(t.color, 0.84);
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillStyle = INK;
      fitFont(ctx, label, 800, 46, 28, colW - 140);
      ctx.fillText(label, x + 28, y + 72);
      rankChip(ctx, rankOf(values[k]), x + colW - 98, y + 18, 76);
    });
    const sk = skillsOf(r);
    let y = 1110;
    if (sk) {
      [['必殺技', sk.skill.skill], ['弱点', sk.weak.weak]].forEach(([head, text], i) => {
        roundRect(ctx, 120, y, W - 240, 170, 30);
        ctx.fillStyle = i ? '#F3F0EC' : tint(t.color, 0.75);
        ctx.fill();
        ctx.textAlign = 'left';
        ctx.fillStyle = shade(t.color, 0.4);
        ctx.font = `800 36px ${FONT}`;
        ctx.fillText(head, 160, y + 58);
        ctx.fillStyle = INK;
        fitFont(ctx, `「${text}」`, 800, 52, 34, W - 320);
        ctx.fillText(`「${text}」`, 160, y + 130);
        y += 200;
      });
    }
    ctx.textAlign = 'center';
    ctx.font = `500 34px ${FONT}`;
    ctx.fillStyle = shade(t.color, 0.4);
    ctx.fillText('S〜Dは高さの目安。よい・わるいではありません', W / 2, Math.min(y + 70, H - 320));
  } else {
    heading(ctx, t, 'わたしの成分', 310);
    let y = 470;
    AXES.forEach((a, k) => {
      const pos = r.sums[k] > 0;
      const pct = r.axisPct[k];
      // 寄っている側を濃く、反対側を薄く
      ctx.font = `800 48px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = pos ? '#B3A8AC' : INK;
      ctx.fillText(`${a.neg} ${pos ? 100 - pct : pct}%`, 120, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = pos ? INK : '#B3A8AC';
      ctx.fillText(`${pos ? pct : 100 - pct}% ${a.pos}`, W - 120, y);
      roundRect(ctx, 120, y + 30, W - 240, 40, 20);
      ctx.fillStyle = '#F2E8E0';
      ctx.fill();
      const bw = (W - 240) * (pct / 100);
      roundRect(ctx, pos ? W - 120 - bw : 120, y + 30, bw, 40, 20);
      ctx.fillStyle = shade(t.color, 0.15);
      ctx.fill();
      y += 200;
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.font = `800 52px ${FONT}`;
    ctx.fillText(`ポンコツ純度 ${r.purity}%`, W / 2, y + 60);
    ctx.font = `500 38px ${FONT}`;
    ctx.fillStyle = shade(t.color, 0.4);
    ctx.fillText('くわしい診断で、二つ名とステータスも出るよ', W / 2, y + 150);
  }
  return canvas;
}

// 4. 恋愛
function love(r, t) {
  const [canvas, ctx] = newCanvas(W, H);
  base(ctx, t, 4);
  heading(ctx, t, '恋愛では…', 310);
  let y = 420;
  if (r.params) {
    const l = LOVE_TYPES[r.love];
    roundRect(ctx, 120, y, W - 240, 300, 40);
    ctx.fillStyle = '#FFE6EC';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#C0435E';
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText('恋愛タイプ', W / 2, y + 80);
    fitFont(ctx, l.name, 800, 84, 48, W - 300);
    ctx.fillText(l.name, W / 2, y + 190);
    ctx.font = `500 40px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.fillText(`「${l.catch}」`, W / 2, y + 260);
    y += 360;
    ctx.font = `500 46px ${FONT}`;
    wrap(ctx, l.lead, W - 280).forEach((line, k) => ctx.fillText(line, W / 2, y + 40 + k * 70));
    y += 260;
    ctx.fillStyle = shade(t.color, 0.4);
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText(`相性のいい恋愛タイプは「${LOVE_TYPES[l.best].name}」`, W / 2, y);
    bullets(ctx, t, t.loveAru, y + 70, { mark: '♡', color: '#F08AA0', size: 46 });
  } else {
    y = bullets(ctx, t, t.loveAru, y, { mark: '♡', color: '#F08AA0' });
    ctx.textAlign = 'center';
    ctx.font = `500 44px ${FONT}`;
    ctx.fillStyle = INK;
    const lines = wrap(ctx, t.love, W - 280);
    lines.forEach((line, k) => ctx.fillText(line, W / 2, y + 50 + k * 66));
    y += 50 + lines.length * 66 + 30;
    roundRect(ctx, 120, y, W - 240, 150, 30);
    ctx.fillStyle = '#FFE6EC';
    ctx.fill();
    ctx.fillStyle = '#C0435E';
    ctx.font = `800 42px ${FONT}`;
    ctx.fillText('くわしい診断で、8種類の', W / 2, y + 64);
    ctx.fillText('恋愛タイプもわかる', W / 2, y + 120);
  }
  return canvas;
}

// 5. トリセツ
function toriset(r, t) {
  const [canvas, ctx] = newCanvas(W, H);
  base(ctx, t, 5);
  heading(ctx, t, `${t.chara}のトリセツ`, 310);
  ctx.textAlign = 'left';
  ctx.fillStyle = shade(t.color, 0.4);
  ctx.font = `800 44px ${FONT}`;
  ctx.fillText('こうしてくれるとうれしい', 130, 440);
  let y = bullets(ctx, t, t.toriset.do, 470, { mark: '♥', size: 48, gap: 22 });
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8A7A80';
  ctx.font = `800 44px ${FONT}`;
  ctx.fillText('これはやめてね', 130, y + 60);
  y = bullets(ctx, t, t.toriset.dont.slice(0, 2), y + 90, { mark: '×', size: 48, gap: 22, color: '#B8B0B4' });
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = `800 46px ${FONT}`;
  ctx.fillText('保存して、友達に送っておいてね', W / 2, Math.min(y + 80, H - 330));
  return canvas;
}

// 6. 相性◎と、診断へのさそい
async function last(r, t) {
  const [canvas, ctx] = newCanvas(W, H);
  base(ctx, t, 6);
  const best = TYPES[t.best];
  heading(ctx, t, '相性◎のタイプ', 310);
  const img = await loadImage(charaDataURL(t.best));
  ctx.drawImage(img, W / 2 - 190, 350, 380, 380);
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  fitFont(ctx, best.label, 800, 76, 44, W - 240);
  ctx.fillText(best.label, W / 2, 810);
  ctx.font = `500 44px ${FONT}`;
  wrap(ctx, t.bestWhy, W - 300).forEach((line, k) => ctx.fillText(line, W / 2, 890 + k * 64));
  // TikTok の説明文が重なる画面下を避けて、さそいは中ほどに置く
  roundRect(ctx, 120, 1080, W - 240, 400, 44);
  ctx.fillStyle = shade(t.color, 0.15);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `800 72px ${FONT}`;
  ctx.fillText('あなたは何タイプ？', W / 2, 1215);
  ctx.font = `500 44px ${FONT}`;
  ctx.fillText('12問・約1分の無料診断', W / 2, 1305);
  ctx.font = `800 48px ${FONT}`;
  ctx.fillText('診断はプロフのリンクから', W / 2, 1400);
  searchBand(ctx, W / 2, 1515, t.color);
  ctx.fillStyle = INK;
  ctx.font = `800 46px ${FONT}`;
  ctx.fillText('結果をコメントで教えてね', W / 2, 1660);
  return canvas;
}

// 6枚をまとめて描く
export async function drawCarousel(r) {
  const t = TYPES[r.index];
  const nickname = r.nickname?.text || '';
  const loveText = r.params ? `${LOVE_TYPES[r.love].name}${LOVE_TYPES[r.love].catch}${LOVE_TYPES[r.love].lead}${LOVE_TYPES[LOVE_TYPES[r.love].best].name}` : `${t.loveAru.join('')}${t.love}`;
  const sk = skillsOf(r);
  await ensureFonts(
    `${SITE.name}${SITE.hashtag}${t.label}${t.catch}${t.aru.join('')}${t.chara}${t.toriset.do.join('')}${t.toriset.dont.join('')}${TYPES[t.best].label}${t.bestWhy}${nickname}${loveText}${sk ? sk.skill.skill + sk.weak.weak : ''}${statLabels(r).join('')}${AXES.map((a) => a.neg + a.pos).join('')}わたしのポンコツ判明スワイプしてね${SITE.quizName}全タイプあるあるわかる人いる？ステータス必殺技弱点成分純度恋愛では相性◎トリセツこうしてくれるとうれしいこれはやめてね保存友達送あなたは何？無料診断問約分プロフのリンクから結果をコメントで教えてね隠しNo.よい・わるいではありません高さの目安くわしい二つ名出るよ0123456789/%→♡♥×✓「」`,
  );
  const img = await loadImage(charaDataURL(r.index));
  return [await cover(r, t, img, nickname), aru(r, t), status(r, t), love(r, t), toriset(r, t), await last(r, t)];
}
