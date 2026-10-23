// いまの二つ名：日本時間の時間帯・曜日・学校のお休みで、タイプ名の前につく言葉だけが変わる（Spotify の daylist の形）。
// 先のことを言い当てる占いではなく、「いまの自分」に名前を付けるだけ。タイプの判定は変えない。
// 言葉の決め方は clock.js。
import { SITE } from './config.js';
import { TYPES, typeNo } from './data.js';
import { charaDataURL, shade, tint } from './chara.js';
import { FONT, INK, ensureFonts, loadImage, fitFont, roundRect, newCanvas, searchBand, hostOf, canvasToBlob } from './card.js';
import { app, esc, track, toast, busy, copySilently, shareImageBlob } from './ui.js';
import { nowWord, nowNote } from './clock.js';

export const nowName = (index, now = Date.now()) => {
  const n = nowWord(now);
  return { ...n, text: `${n.word}${TYPES[index].label}` };
};

// 結果ページ・トップに置く小さなカード
export function nowCard(index) {
  const n = nowName(index);
  return `<section class="card now-name" data-now>
    <p class="lead">いまの二つ名 <small>（<span data-now-stamp>${n.stamp}</span>）</small></p>
    <p class="now-word"><b data-now-word>${esc(n.word)}</b>${esc(TYPES[index].label)}</p>
    <p class="hint" data-now-note>${esc(nowNote(n))}</p>
    <button class="btn sub small wide" data-now-card>いまのわたしを画像で保存</button>
  </section>`;
}

// 9:16 のカード「10/23 21:40のわたし」
export async function drawNowCard(index, now = Date.now()) {
  const t = TYPES[index];
  const n = nowName(index, now);
  const W = 1080;
  const H = 1920;
  const [canvas, ctx] = newCanvas(W, H);
  await ensureFonts(`${SITE.name}${t.label}${n.word}${n.stamp}のわたしいまの二つ名${nowNote(n)}あなたは何タイプ？0123456789:/`);
  const night = n.night || Number(n.stamp.split(' ')[1].slice(0, 2)) >= 18;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  if (night) {
    bg.addColorStop(0, '#2E2A4F');
    bg.addColorStop(1, shade(t.color, 0.55));
  } else {
    bg.addColorStop(0, tint(t.color, 0.7));
    bg.addColorStop(1, tint(t.color, 0.4));
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // 夜は星、昼は水玉
  for (let i = 0; i < 30; i++) {
    const x = (i * 211 + 30) % W;
    const y = (i * 379 + 60) % H;
    ctx.fillStyle = night ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.35)';
    ctx.beginPath();
    ctx.arc(x, y, night ? 3 + (i % 3) * 2 : 16 + (i % 4) * 9, 0, Math.PI * 2);
    ctx.fill();
  }
  roundRect(ctx, 60, 70, W - 120, H - 140, 56);
  ctx.fillStyle = '#FFFDF9';
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = shade(t.color, 0.25);
  ctx.stroke();

  // 大事な文字は y=230〜1660 に収める（ストーリーの上下はアカウント名と返信欄が重なる）
  ctx.textAlign = 'left';
  ctx.fillStyle = shade(t.color, 0.45);
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText(SITE.name, 120, 160);
  ctx.textAlign = 'center';
  // 時刻（本当の時刻だけ）
  ctx.fillStyle = INK;
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText(`${n.stamp}のわたし`, W / 2, 330);
  ctx.fillStyle = shade(t.color, 0.45);
  ctx.font = `800 38px ${FONT}`;
  ctx.fillText('いまの二つ名', W / 2, 402);
  const img = await loadImage(charaDataURL(index));
  ctx.drawImage(img, W / 2 - 250, 440, 500, 500);

  // 言葉（色つき）とタイプ名
  ctx.fillStyle = shade(t.color, 0.42);
  fitFont(ctx, n.word, 800, 80, 48, W - 220);
  ctx.fillText(n.word, W / 2, 1060);
  ctx.fillStyle = INK;
  const size = fitFont(ctx, t.label, 800, 104, 60, W - 220);
  ctx.fillText(t.label, W / 2, 1080 + size);

  ctx.font = `500 38px ${FONT}`;
  ctx.fillStyle = shade(t.color, 0.5);
  ctx.fillText(nowNote(n), W / 2, 1320);

  searchBand(ctx, W / 2, 1420, t.color);
  ctx.fillStyle = INK;
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText('いまのあなたは？', W / 2, 1580);
  ctx.font = `500 30px ${FONT}`;
  ctx.fillStyle = shade(t.color, 0.4);
  ctx.fillText(`${hostOf(SITE.origin)}  #${SITE.hashtag}`, W / 2, 1800);
  return canvas;
}

// 開いたままのページでも、言葉と時刻が古いまま残らないように、30秒ごとと、アプリから戻ってきたときに書きかえる
let refresh = null;
let timer = null;
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && refresh?.());
export function keepNowFresh(index, gen, navNow) {
  clearInterval(timer);
  refresh = () => {
    if (gen !== navNow()) {
      clearInterval(timer);
      refresh = null;
      return;
    }
    const n = nowName(index);
    app.querySelectorAll('[data-now-word]').forEach((el) => (el.textContent = n.word));
    app.querySelectorAll('[data-now-stamp]').forEach((el) => (el.textContent = n.stamp));
    app.querySelectorAll('[data-now-note]').forEach((el) => (el.textContent = nowNote(n)));
    app.querySelectorAll('[data-now-line]').forEach((el) => (el.textContent = `いまは「${n.text}」`));
  };
  timer = setInterval(refresh, 30000);
}

// 「いまのわたしを画像で保存」。押した直後に結果のリンクをコピーしておく（ストーリーのリンクスタンプ用）
export function bindNowCard(index, url) {
  const b = app.querySelector('[data-now-card]');
  b?.addEventListener('click', () => {
    const linkCopied = copySilently(url);
    busy(b, async () => {
      toast('画像をつくっています…');
      const n = nowName(index);
      const canvas = await drawNowCard(index);
      track('share', 'now-nick');
      await shareImageBlob(await canvasToBlob(canvas), {
        name: `ponkotsu-now-${typeNo(index)}.png`,
        text: `${n.stamp}のわたしは「${n.text}」\n#${SITE.hashtag} いまのあなたは？\n${url}`,
        alt: `いまの二つ名「${n.text}」の画像`,
        linkCopied: await linkCopied,
      });
    });
  });
}
