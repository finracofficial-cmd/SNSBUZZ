// 結果発表の動画（約6秒・9:16）。TikTok やリールに、そのまま投稿できる。
// できあがった結果カードを、最初はモザイク（ぼかし）で見せ、上から順にくっきりさせていく。
// 録画はブラウザの MediaRecorder で行う（iPhone の Safari は MP4、録画できない環境ではボタンを出さない）。
import { FONT } from './card.js';

const W = 720;
const H = 1280;

function pickType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return null;
  return ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || null;
}

export const canRecordVideo = () =>
  typeof document !== 'undefined' && !!pickType() && typeof HTMLCanvasElement !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;

const ease = (x) => 1 - (1 - Math.min(Math.max(x, 0), 1)) ** 3;

// card: できあがった 1080×1920 の結果カード（canvas）
export async function recordReveal(card, { seconds = 6, intro = 'わたしのポンコツは…' } = {}) {
  const type = pickType();
  if (!type) return null;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d');
  // ぼかした下絵は先に1回だけ作る（毎フレームぼかすと重い）。
  // canvas の filter（blur）は古い iPhone の Safari で効かないので、小さく縮めてから引きのばしてぼかす
  const blurred = document.createElement('canvas');
  blurred.width = W;
  blurred.height = H;
  const bctx = blurred.getContext('2d');
  const tiny = document.createElement('canvas');
  const mid = document.createElement('canvas');
  [mid.width, mid.height] = [90, 160];
  [tiny.width, tiny.height] = [27, 48];
  for (const c of [mid, tiny]) c.getContext('2d').imageSmoothingQuality = 'high';
  mid.getContext('2d').drawImage(card, 0, 0, 90, 160);
  tiny.getContext('2d').drawImage(mid, 0, 0, 27, 48);
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(tiny, 0, 0, W, H);
  bctx.fillStyle = 'rgba(255,255,255,.25)';
  bctx.fillRect(0, 0, W, H);
  [mid, tiny].forEach((c) => {
    c.width = 0;
    c.height = 0;
  });

  const stream = out.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 4_000_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((resolve) => (recorder.onstop = resolve));

  const draw = (t) => {
    // 0〜1秒：モザイクの上に「わたしのポンコツは…」
    // 1〜4.2秒：上から下へ、くっきりさせていく
    // 4.2秒〜：全体を見せて、少しだけ大きく
    ctx.drawImage(blurred, 0, 0);
    const reveal = ease((t - 1) / 3.2);
    if (reveal > 0) {
      const h = H * reveal;
      ctx.drawImage(card, 0, 0, card.width, card.height * reveal, 0, 0, W, h);
      // 境目の光る線
      if (reveal < 1) {
        const g = ctx.createLinearGradient(0, h - 40, 0, h + 10);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, 'rgba(255,255,255,.9)');
        ctx.fillStyle = g;
        ctx.fillRect(0, h - 40, W, 50);
      }
    }
    if (t > 4.2) {
      const z = 1 + 0.03 * ease((t - 4.2) / 1.2);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(z, z);
      ctx.drawImage(card, -W / 2, -H / 2, W, H);
      ctx.restore();
    }
    if (t < 1.4) {
      const a = t < 1 ? 1 : 1 - (t - 1) / 0.4;
      ctx.fillStyle = `rgba(59,47,51,${0.55 * a})`;
      ctx.fillRect(0, H / 2 - 90, W, 180);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.textAlign = 'center';
      ctx.font = `800 52px ${FONT}`;
      const dots = '・'.repeat(1 + (Math.floor(t * 4) % 3));
      ctx.fillText(intro.replace(/…$/, '') + dots, W / 2, H / 2 + 18);
    }
  };

  draw(0);
  recorder.start(250);
  const start = performance.now();
  await new Promise((resolve) => {
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      draw(Math.min(t, seconds));
      if (t >= seconds) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  recorder.stop();
  await done;
  stream.getTracks().forEach((tr) => tr.stop());
  // キャンバスのメモリはすぐ手放す（古い iPhone は、キャンバスの合計メモリに上限がある）
  [card, out, blurred].forEach((c) => {
    c.width = 0;
    c.height = 0;
  });
  return new Blob(chunks, { type: type.split(';')[0] });
}
