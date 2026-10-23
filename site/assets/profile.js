// プロフ帳カードの入力（ニックネーム・すきなもの・ひとこと）。入力は画像の中だけで使い、どこにも送らない。
import { TYPES, typeNo } from './data.js';
import { drawProfileCard, canvasToBlob } from './card.js';
import { esc, store, track, toast, openModal, closeModal, cleanName, shareImageBlob } from './ui.js';

export function openProfileCard(r) {
  const saved = store.get('profile', {});
  const sheet = openModal(`
    <h2 class="sheet-title">プロフ帳カードをつくる</h2>
    <p class="hint">書いた内容は画像の中だけに入ります（どこにも送られません）。本名や学校名、連絡先は書かないでね。</p>
    <label class="field">なまえ（ニックネーム）<input id="pf-nick" maxlength="10" value="${esc(saved.nick || store.get('nick', ''))}"></label>
    <label class="field">すきなもの<input id="pf-like" maxlength="14" value="${esc(saved.like || '')}" placeholder="例：いちごミルク"></label>
    <label class="field">ひとこと<input id="pf-word" maxlength="18" value="${esc(saved.word || '')}" placeholder="例：仲良くしてね"></label>
    <button class="btn type" id="pf-go">画像をつくる</button>
    <button class="btn sub" data-close>とじる</button>`);
  sheet.querySelector('#pf-go').onclick = async () => {
    const nick = cleanName(sheet.querySelector('#pf-nick').value, 10);
    const like = cleanName(sheet.querySelector('#pf-like').value, 14);
    const word = cleanName(sheet.querySelector('#pf-word').value, 18);
    store.set('profile', { nick, like, word });
    if (nick) store.set('nick', nick);
    closeModal();
    toast('画像をつくっています…');
    const canvas = await drawProfileCard({ r, nick, like, word });
    track('share', 'prof-image');
    await shareImageBlob(await canvasToBlob(canvas), {
      name: `ponkotsu-profile-${typeNo(r.index)}.png`,
      text: `プロフ帳かいた！ わたしは「${TYPES[r.index].label}」 #ポンコツ図鑑`,
      alt: 'プロフ帳カード',
    });
  };
}
