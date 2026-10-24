// 紹介：自分のリンク（結果のシェア・相性のおさそい）から友達が診断すると1人と数え、3人で虹色のカードを保存できる。
//   ・リンクの r は、この端末のランダムな番号（個人を特定する情報は入れない）
//   ・数えるのは、リンクを開いた端末で「初めて」診断を終えたときだけ（すでに診断したことのある人・やり直しは数えない）
//   ・同じ友達は1回だけ（友達の端末のランダムな番号 v で見分ける）
// ごほうびは見た目だけ。完全版の中身は開けない（買った人との不公平を作らない）
import { TYPES, typeNo } from './data.js';
import { app, store, api, track, toast, busy, copySilently, shareImageBlob } from './ui.js';
import { drawStoryCard, canvasToBlob } from './card.js';

export const REF_GOAL = 3;
const B32 = 'abcdefghijklmnopqrstuvwxyz234567';
const randomId = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => B32[b % 32]).join('');
const REF = /^[a-z2-7]{10}$/;

function ownId(key, n) {
  let id = store.get(key, null);
  if (typeof id !== 'string' || id.length !== n || !/^[a-z2-7]+$/.test(id)) {
    id = randomId(n);
    store.set(key, id);
  }
  return id;
}
export const myRef = () => ownId('refId', 10);

// リンクから来たとき（?r=…）。まだ診断したことがなく、ほかの人のリンクからも来ていなければ覚えておく
export function receiveRef(params) {
  const r = params.get('r');
  if (!REF.test(r || '') || r === store.get('refId', null)) return;
  if (store.get('mine', null) || store.get('refBy', null)) return;
  store.set('refBy', r);
}

// 診断を終えたとき（quiz.js）。その端末で初めての診断なら、リンクをくれた人に1人と数える。
// 送れなかったとき（通信が切れた・同じ Wi-Fi から一度にたくさん）は印を残し、次に開いたときに送り直す（sendPendingRef）
export function reportRef(firstTime) {
  const r = store.get('refBy', null);
  if (!firstTime || !REF.test(r || '') || store.get('refSent', false)) return;
  store.set('refPending', true);
  sendPendingRef();
}
let sending = false;
export async function sendPendingRef() {
  const r = store.get('refBy', null);
  if (sending || !store.get('refPending', false) || store.get('refSent', false) || !REF.test(r || '')) return;
  sending = true;
  const res = await api('ref', { method: 'POST', body: { r, v: ownId('visitorId', 16) } });
  sending = false;
  // 形がちがう（400）ときは送り直しても通らないので、やめる
  if ((res && !res.error) || res?.status === 400) {
    store.set('refSent', true);
    store.set('refPending', false);
  }
}

const dots = (n) => Array.from({ length: REF_GOAL }, (_, k) => `<i class="${k < n ? 'on' : ''}"></i>`).join('');

// 結果ページのカード。人数は、あとから読みこんで書きかえる
export function referCard() {
  return `<section class="card refer" data-refer>
    <h2 data-refer-title>友達${REF_GOAL}人で、虹色カード</h2>
    <p>上のボタンでシェアしたリンクや、相性のおさそいから友達が診断すると1人としてカウント。${REF_GOAL}人で、ここでしか保存できない<b>虹色の結果カード</b>がもらえます。</p>
    <div class="ref-dots" data-ref-dots role="img" aria-label="0/${REF_GOAL}人">${dots(0)}</div>
    <p class="hint center" data-ref-count>いま0人（初めて診断した友達だけ数えます）</p>
    <button class="btn rainbow" data-rainbow hidden>虹色カードを保存</button>
  </section>`;
}

// r: 自分の結果（drawStoryCard に渡すもの）、url: シェアのリンク、text: シェアの文
export function bindReferCard(r, { url, text, gen, navNow }) {
  const box = app.querySelector('[data-refer]');
  if (!box) return;
  api(`ref?r=${myRef()}`).then((res) => {
    if (gen !== navNow() || !res || res.error) return;
    const n = Math.min(Number(res.n) || 0, 99);
    box.querySelector('[data-ref-dots]').innerHTML = dots(Math.min(n, REF_GOAL));
    box.querySelector('[data-ref-dots]').setAttribute('aria-label', `${Math.min(n, REF_GOAL)}/${REF_GOAL}人`);
    box.querySelector('[data-ref-count]').textContent = n >= REF_GOAL ? `${n}人の友達が、あなたのリンクから診断しました` : `いま${n}人（あと${REF_GOAL - n}人）`;
    if (n < REF_GOAL) return;
    box.classList.add('done');
    box.querySelector('[data-refer-title]').textContent = '虹色カードをもらいました！';
    const b = box.querySelector('[data-rainbow]');
    b.hidden = false;
    b.addEventListener('click', () => {
      const linkCopied = copySilently(url);
      busy(b, async () => {
        toast('画像をつくっています…');
        const canvas = await drawStoryCard({ ...r, rainbow: true });
        track('share', 'rainbow-image');
        await shareImageBlob(await canvasToBlob(canvas), {
          name: `ponkotsu-${typeNo(r.index)}-rainbow.png`,
          text: `${text}\n${url}`,
          alt: `${TYPES[r.index].label}の虹色カード`,
          linkCopied: await linkCopied,
        });
      });
    });
  });
}
