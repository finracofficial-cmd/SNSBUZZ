// ふたり・グループで遊ぶ機能：相性のおさそいリンク、ペア結果、グループ診断、出会ったタイプの記録
import { SITE } from './config.js';
import { TYPES, AXES, QUESTIONS, typeNo } from './data.js';
import { compatOf, decodeResult, encodeResult, quickCodeOf, resultFromSums, axisPctOf, groupRoles } from './logic.js';
import { charaSVG } from './chara.js';
import { drawPairCard, canvasToBlob } from './card.js';
import { optionsHtml } from './quiz.js';
import { app, ORIGIN, esc, cleanName, store, track, api, render, toast, openModal, closeModal, foot, brand, shareLinks, shareImageBlob, navNow, busy, copyText, confirmModal, safeDecode } from './ui.js';
import { jstParts } from './clock.js';

// ---------- 出会ったタイプ（図鑑のコンプリート用） ----------
// 友達の結果は、かんたん診断の部分（タイプと4軸）だけを持つ。くわしい診断のパラメータ（恋愛積極度など）は、
// リンクにも端末にも入れない（相性はタイプだけで決まる。友達が相性の画像をシェアしたときに公開されないように）
export function addFriend(rawName, rawCode) {
  if (!decodeResult(rawCode)) return;
  const code = quickCodeOf(rawCode);
  const name = cleanName(rawName) || '友達';
  // 同じ人（同じ名前で、かんたん診断の結果も同じ）は1人にまとめる
  const same = (f) => f.name === name && quickCodeOf(f.code) === code;
  const list = store.get('friends', []);
  store.set('friends', [{ name, code, at: Date.now() }, ...list.filter((f) => !same(f))].slice(0, 60));
}
export const friends = () =>
  store
    .get('friends', [])
    .filter((f) => f && typeof f.code === 'string')
    .map((f) => ({ ...f, code: quickCodeOf(f.code), result: decodeResult(quickCodeOf(f.code)) }))
    .filter((f) => f.result);

// ---------- おさそいリンク ----------
export function inviteUrl(result, name) {
  const params = new URLSearchParams({ f: quickCodeOf(encodeResult(result)), n: cleanName(name) || '友達' });
  return `${ORIGIN}/i/${typeNo(result.index).toLowerCase()}/?${params}`;
}

// /i/NN/?f=..&n=.. から来たとき：おさそいを保存してトップへ
export function receiveInvite(params) {
  if (!decodeResult(params.get('f'))) return false;
  const code = quickCodeOf(params.get('f'));
  const name = cleanName(params.get('n')) || '友達';
  store.set('invite', { name, code });
  addFriend(name, code);
  track('ref', '1');
  return true;
}

// シェアURL（/t/NN/?f=..）から来たとき：シェアした人の結果を、名前なしのおさそいとして保存する
export function receiveShare(params) {
  const code = params.get('f');
  const r = decodeResult(code);
  if (!r || r.mode !== 'quick') return false;
  // 自分のシェアを自分で開いたときは何もしない。名前つきのおさそいがあれば、そちらを残す
  const mine = store.get('mineQuick', null);
  if (mine && mine.code === code) return false;
  if (store.get('invite', null)?.name) return false;
  store.set('invite', { name: '', code, via: 'share' });
  track('ref', 'f');
  return true;
}

const inviterName = (inv) => (inv.name ? `${inv.name}さん` : 'シェアしてくれた友達');

export function inviteBanner({ cta = false } = {}) {
  const inv = store.get('invite', null);
  const r = inv && decodeResult(inv.code);
  if (!r) return '';
  const mine = store.get('mine', null);
  const mineResult = mine?.code && decodeResult(mine.code);
  const text = inv.name
    ? `<b>${esc(inv.name)}さん</b>（${esc(TYPES[r.index].label)}）から<br>相性診断のおさそいが届いています`
    : mineResult
      ? `このリンクを送ってくれた友達は<b>${esc(TYPES[r.index].label)}</b>。あなたとの相性は？`
      : `このリンクを送ってくれた友達（<b>${esc(TYPES[r.index].label)}</b>）との相性も、診断するとわかる`;
  // 診断を終えていれば、すぐ相性へ。まだなら診断へ
  const button = !cta
    ? ''
    : mineResult
      ? `<a class="btn small" href="#/pair/${esc(quickCodeOf(inv.code))}/${esc(quickCodeOf(mine.code))}/${encodeURIComponent(inv.name || '友達')}/${encodeURIComponent('わたし')}">相性を見る</a>`
      : '<button class="btn small" data-go="#/q">診断する（12問・約1分）</button>';
  return `<div class="invite">
    <div class="invite-chara">${charaSVG(r.index, { size: 72 })}</div>
    <div>${text}${button}</div>
  </div>`;
}

// 結果ページに出す「〇〇さんとの相性」
export function invitePairBox(mine) {
  const inv = store.get('invite', null);
  const other = inv && decodeResult(inv.code);
  if (!other) return '';
  const c = compatOf(mine, other);
  const who = inviterName(inv);
  // 相性の結果を、おさそいをくれた人へ送り返す（LINE）。相手が開くと、ふたりの相性ページになる
  const back = `${ORIGIN}/p/?${new URLSearchParams({ a: quickCodeOf(encodeResult(mine)), b: quickCodeOf(inv.code), na: store.get('nick', '') || '友達', nb: inv.name || '' })}`;
  const backText = `診断したよ！ ふたりの相性は${c.score}%「${c.rank}」だった #${SITE.hashtag}`;
  return `<section class="card pairbox">
    <h2>${esc(who)}との相性</h2>
    <div class="pair-row">
      <div>${charaSVG(mine.index, { size: 84 })}<small>あなた</small></div>
      <div class="pair-score"><strong>${c.score}%</strong><span>${esc(c.rank)}</span></div>
      <div>${charaSVG(other.index, { size: 84 })}<small>${esc(who)}</small></div>
    </div>
    <p>${esc(c.good)}。${c.care ? `ただし、${esc(c.care)}。` : ''}</p>
    <div class="btn-row">
      <a class="btn sub small" href="#/pair/${quickCodeOf(encodeResult(other))}/${quickCodeOf(encodeResult(mine))}/${encodeURIComponent(inv.name || '友達')}/${encodeURIComponent('わたし')}">ふたりの相性をくわしく</a>
      <a class="btn small" data-ch="pairback:line" href="https://line.me/R/share?text=${encodeURIComponent(`${backText}\n${back}`)}" target="_blank" rel="noopener">LINEで相性を送り返す</a>
    </div>
  </section>`;
}

// 相手を誘うモーダル（ニックネームはURLに入るだけで、どこにも保存しない）
export function openInviteModal(mine) {
  const sheet = openModal(`
    <h2 class="sheet-title">友達と相性をくらべる</h2>
    <p class="hint">リンクを送ると、友達が診断したあとに、ふたりの相性が出ます。</p>
    <label class="field">あなたのニックネーム（相手に表示されます）
      <input id="invite-name" maxlength="10" placeholder="例：ゆう" value="${esc(store.get('nick', ''))}">
    </label>
    <p class="hint">本名は入れないでね。</p>
    <div id="invite-links"></div>
    <button class="btn" id="invite-make">おさそいリンクをつくる</button>
    <button class="btn sub" data-close>とじる</button>`);
  sheet.querySelector('#invite-make').onclick = () => {
    const name = cleanName(sheet.querySelector('#invite-name').value) || '友達';
    store.set('nick', name);
    const url = inviteUrl(mine, name);
    const text = `【${SITE.quizName}】${name}が「${TYPES[mine.index].label}」だった。あなたは何タイプ？ ふたりの相性も出るよ`;
    sheet.querySelector('#invite-links').innerHTML = `<p class="hint">このリンクを送ってね</p>${shareLinks({ text, url, channelPrefix: 'invite:' }).html}`;
    sheet.querySelector('#invite-make').hidden = true;
    track('share', 'invite');
  };
}

// ---------- ペア結果 ----------
export function viewPair(codeA, codeB, nameA, nameB) {
  const a = decodeResult(codeA);
  const b = decodeResult(codeB);
  if (!a || !b) {
    location.hash = '#/';
    return;
  }
  nameA = cleanName(nameA) || 'Aさん';
  nameB = cleanName(nameB) || 'Bさん';
  const c = compatOf(a, b);
  const ta = TYPES[a.index];
  const tb = TYPES[b.index];
  const sendUrl = `${ORIGIN}/p/?${new URLSearchParams({ a: quickCodeOf(codeA), b: quickCodeOf(codeB), na: nameA, nb: nameB })}`;
  const text = `${nameA}（${ta.label}）× ${nameB}（${tb.label}）の相性は${c.score}%「${c.rank}」でした #${SITE.hashtag}`;
  render(`
    ${brand()}
    <section class="result pair">
      <p class="lead">ふたりの相性</p>
      <div class="pair-row big">
        <div>${charaSVG(a.index, { size: 130 })}<b>${esc(nameA)}</b><small>${esc(ta.label)}</small></div>
        <div class="pair-score"><strong>${c.score}%</strong><span>${esc(c.rank)}</span></div>
        <div>${charaSVG(b.index, { size: 130 })}<b>${esc(nameB)}</b><small>${esc(tb.label)}</small></div>
      </div>
      <p class="praise">${esc(c.good)}。</p>
      ${c.care ? `<p class="roast"><span>ただし、${esc(c.care)}。</span></p>` : ''}
      <button class="btn type" data-pair-card>ふたりの相性カードを保存</button>
      ${shareLinks({ text, url: sendUrl, channelPrefix: 'pair:' }).html}
    </section>
    <div class="card"><h2>ふたりの4つの軸</h2>${pairAxes(a, b, nameA, nameB)}</div>
    <div class="card"><h2>${esc(nameB)}のトリセツ（${esc(nameA)}へ）</h2><p>うれしいこと：${esc(tb.toriset.do[0])}</p><p>ちょっと苦手：${esc(tb.toriset.dont[0])}</p></div>
    <div class="card"><h2>${esc(nameA)}のトリセツ（${esc(nameB)}へ）</h2><p>うれしいこと：${esc(ta.toriset.do[0])}</p><p>ちょっと苦手：${esc(ta.toriset.dont[0])}</p></div>
    <button class="btn" data-go="#/q">自分も診断する</button>
    <button class="btn sub" data-go="#/zukan">図鑑をみる</button>
    ${foot()}`, a.index);
  const pairButton = app.querySelector('[data-pair-card]');
  pairButton.onclick = () =>
    busy(pairButton, async () => {
      toast('画像をつくっています…');
      const canvas = await drawPairCard({ a, b, nameA, nameB, compat: c });
      track('share', 'pair-image');
      await shareImageBlob(await canvasToBlob(canvas), { name: 'ponkotsu-pair.png', text: `${text}\n${sendUrl}`, alt: 'ふたりの相性カード' });
    });
}

function pairAxes(a, b, nameA, nameB) {
  return AXES.map((ax, k) => {
    const pa = a.sums[k] > 0 ? 50 + axisPctOf(a.sums[k]) / 2 : 50 - axisPctOf(a.sums[k]) / 2;
    const pb = b.sums[k] > 0 ? 50 + axisPctOf(b.sums[k]) / 2 : 50 - axisPctOf(b.sums[k]) / 2;
    return `<div class="axis">
      <div class="names"><span>${esc(ax.neg)}</span><span>${esc(ax.pos)}</span></div>
      <div class="bar dual"><i class="dot a" style="left:${pa}%" title="${esc(nameA)}"></i><i class="dot b" style="left:${pb}%" title="${esc(nameB)}"></i></div>
    </div>`;
  }).join('') + `<p class="hint legend"><i class="dot a"></i>${esc(nameA)}　<i class="dot b"></i>${esc(nameB)}</p>`;
}

// ---------- グループ診断 ----------
const eventSeason = () => [9, 10, 11].includes(jstParts().m);

// グループの結果をテキストで（LINEのトークにそのまま貼れる形）
export function groupText({ name, members, roles, bestPair, groupType, url }) {
  return [
    `【${name}】のグループ診断（${members.length}人）`,
    ...roles.map((r) => `${r.icon} ${r.role}：${r.member.nick}（${TYPES[r.member.result.index].label}）`),
    ...(bestPair ? [`💞 ベストペア：${bestPair.a.nick} × ${bestPair.b.nick}（${bestPair.c.score}%）`] : []),
    ...(groupType != null ? [`チームをひとことで：「${TYPES[groupType].label}」っぽいチーム`] : []),
    '',
    `#${SITE.hashtag} まだの人はここから参加してね`,
    url,
  ].join('\n');
}

const GROUP_ERRORS = {
  rate: '少し時間をおいて、もう一度ためしてね',
  ng: '使えない言葉が入っています。ほかの名前にしてね',
  full: 'このグループは満員です',
  locked: 'このグループは、いま参加を締め切っています',
};
// 作った人の管理用リンク（別のブラウザ・データが消えたときも管理できるように）
const adminUrl = (id, key) => `${ORIGIN}/#/g/${id}/a/${key}`;
const randomId = (n) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');

export function openGroupCreate() {
  const sheet = openModal(`
    <h2 class="sheet-title">グループ診断をつくる</h2>
    <p class="hint">仲良しグループ・部活・推し仲間で。リンクを送ると、みんなのタイプと役割が1ページにまとまります。</p>
    <label class="field">グループの名前<input id="group-name" maxlength="20" placeholder="例：いつメン"></label>
    <p class="hint">グループ名に、学校名・クラス名・本名は入れないでね。リンクを知っている人は誰でも見られます。</p>
    <p class="hint err" id="group-msg" role="alert"></p>
    <button class="btn" id="group-make">つくる</button>
    <button class="btn sub" data-close>とじる</button>`);
  sheet.querySelector('#group-make').onclick = async () => {
    const name = cleanName(sheet.querySelector('#group-name').value, 20);
    if (!name) {
      sheet.querySelector('#group-msg').textContent = '名前を入れてね';
      return;
    }
    const res = await api('groups', { method: 'POST', body: { name } });
    if (!res || res.error) {
      sheet.querySelector('#group-msg').textContent = GROUP_ERRORS[res?.error] || 'いまはグループを作れません。時間をおいて、もう一度ためしてね';
      return;
    }
    // 作った人だけが持つ管理キー（メンバーを外す・グループを消す）
    store.set(`groupAdmin:${res.id}`, res.admin);
    track('group', 'create');
    closeModal();
    location.hash = `#/g/${res.id}`;
    toast('グループができました。管理用リンクは、ページのいちばん下にあります');
  };
}

async function leaveGroup(id, body, msg) {
  const res = await api(`groups/${id}`, { method: 'DELETE', body });
  if (!res || res.error) {
    toast(GROUP_ERRORS[res?.error] || 'うまくいきませんでした');
    return false;
  }
  toast(msg);
  return true;
}

export async function viewGroup(id) {
  if (!/^[a-z0-9]{8}$/.test(id)) {
    location.hash = '#/';
    return;
  }
  const gen = navNow();
  render(`${brand()}<div class="loading small">グループを読みこみ中…<div class="dots"><i></i><i></i><i></i></div></div>`);
  const admin = store.get(`groupAdmin:${id}`, null);
  // 本人の秘密はグループごと（別のグループで同じ人だと分からないように）。ヘッダで送り、URLには入れない
  const secret = store.get(`groupSecret:${id}`, null);
  const g = await api(`groups/${id}`, { headers: { ...(secret ? { 'x-member': secret } : {}), ...(admin ? { 'x-admin': admin } : {}) } });
  if (gen !== navNow()) return;
  if (!g || g.error) {
    render(`${brand()}<div class="card"><h2>グループが見つかりません</h2><p>リンクがまちがっているか、グループの期限（作成から90日）が過ぎているか、作った人がグループを消しました。</p></div>
      <button class="btn" data-go="#/q">診断する</button>${foot()}`);
    return;
  }
  const members = g.members.map((m) => ({ ...m, result: decodeResult(m.code) })).filter((m) => m.result);
  const mine = store.get('mine', null);
  const joined = members.some((m) => m.mine);
  const roles = groupRoles(members.map((m) => m.result.sums)).map((r) => ({ ...r, member: members[r.member] }));
  const counts = new Map();
  members.forEach((m) => counts.set(m.result.index, (counts.get(m.result.index) || 0) + 1));
  const top = [...counts.entries()].sort((x, y) => y[1] - x[1])[0];
  let bestPair = null;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const c = compatOf(members[i].result, members[j].result);
      if (!bestPair || c.score > bestPair.c.score) bestPair = { a: members[i], b: members[j], c };
    }
  }
  const avg = AXES.map((_, k) => members.reduce((s, m) => s + m.result.sums[k], 0) / Math.max(members.length, 1));
  const groupType = members.length ? resultFromSums(avg.map((v) => (v > 0 ? 1 : -1))).index : null;
  const url = `${ORIGIN}/g/?id=${id}`;
  render(`
    ${brand()}
    <section class="result">
      <p class="lead">グループ診断</p>
      <h1 class="label">${esc(g.name)}</h1>
      <span class="chip">${members.length}人が参加中</span>
    </section>
    ${joined ? '' : g.locked
      ? '<div class="card"><h2>参加の受付は締め切られています</h2><p>このグループは、作った人が新しい参加を締め切っています。</p></div>'
      : mine
      ? `<div class="card"><h2>このグループに参加する</h2>
          <label class="field">ニックネーム<input id="join-name" maxlength="10" value="${esc(store.get('nick', ''))}" placeholder="例：ゆう"></label>
          <p class="hint">本名は入れないでね。グループのページには、ニックネームとかんたん診断のタイプだけが出ます。</p>
          <button class="btn" id="join">あなたのタイプで参加</button></div>`
      : `<div class="card"><h2>診断して参加しよう</h2><p>かんたん診断（12問・約1分）に答えると、このグループに参加できます。</p>
          <button class="btn" data-go="#/q">診断する</button></div>`}
    ${members.length ? `
    <div class="card"><h2>メンバー</h2><div class="members">${members.map((m) => `
      <div class="member-wrap"><a class="member ${m.mine ? 'mine' : ''}" href="#/t/${typeNo(m.result.index).toLowerCase()}">${charaSVG(m.result.index, { size: 64 })}<b>${esc(m.nick)}</b><small>${esc(TYPES[m.result.index].label)}</small></a>
      ${g.admin && !m.mine ? `<button class="linkish small" data-kick="${esc(m.handle)}" data-nick="${esc(m.nick)}" aria-label="${esc(m.nick)}をグループから外す">外す</button>` : ''}</div>`).join('')}</div></div>
    <div class="card"><h2>グループ内の役割</h2><ul class="roles">${roles.map((r) => `<li><span class="chip">${esc(r.role)}</span>${esc(r.member.nick)}${eventSeason() ? `<small>文化祭なら：${esc(r.event)}</small>` : ''}</li>`).join('')}</ul></div>
    <div class="card"><h2>このグループをひとことで</h2>
      <p>${top[1] > 1 ? `いちばん多いのは「${esc(TYPES[top[0]].label)}」（${top[1]}人）。` : 'メンバー全員がちがうタイプの、バラエティ豊かなグループ。'}グループ全体を1人にすると「${esc(TYPES[groupType].label)}」っぽいチームです。</p>
      ${bestPair ? `<p>いちばん相性がいいのは <b>${esc(bestPair.a.nick)}</b> × <b>${esc(bestPair.b.nick)}</b>（${bestPair.c.score}%・${esc(bestPair.c.rank)}）。</p>` : ''}
      ${members.length >= 2 ? '<button class="btn sub small wide" data-group-text>結果をテキストでコピー（LINEに貼る用）</button>' : ''}
    </div>` : ''}
    <div class="card"><h2>メンバーを集める</h2>${shareLinks({ text: `「${g.name}」のグループ診断。みんなのポンコツタイプと役割がわかるよ`, url, channelPrefix: 'group:' }).html}
      <p class="hint">LINEグループに送ったら、メッセージを長押しして「アナウンス」で固定しておくと、あとから来た人も参加できます。</p>
      <p class="hint">このグループは ${new Date(g.expiresAt).toLocaleDateString('ja-JP')} に消えます。</p></div>
    ${joined || g.admin ? `<div class="card"><h2>グループの設定</h2><div class="btn-col">
      ${joined ? '<button class="btn sub small" data-leave>このグループから抜ける</button>' : ''}
      ${g.admin ? `<button class="btn sub small" data-lock>${g.locked ? '参加の受付を再開する' : '参加を締め切る'}</button>
        <button class="btn sub small" data-admin-link>管理用リンクをコピー（作った人だけ）</button>
        <button class="btn sub small" data-delete-group>グループを消す（作った人だけ）</button>` : ''}
    </div>${g.admin ? '<p class="hint">締め切ると、新しい人は参加できなくなります（外した人も戻れません）。管理用リンクを保存しておくと、ほかのブラウザやデータが消えたあとでも管理できます。ほかの人には送らないでね。</p>' : ''}</div>` : ''}
    ${foot()}`);
  app.querySelector('[data-group-text]')?.addEventListener('click', () => {
    track('share', 'group-text');
    copyText(groupText({ name: g.name, members, roles, bestPair, groupType, url }));
  });
  const join = app.querySelector('#join');
  if (join) {
    join.onclick = async () => {
      const nick = cleanName(app.querySelector('#join-name').value) || 'ななし';
      store.set('nick', nick);
      const memberSecret = secret || randomId(20);
      store.set(`groupSecret:${id}`, memberSecret);
      // グループには、かんたん診断の結果だけを送る（くわしい診断のパラメータは送らない）
      const res = await api(`groups/${id}`, { method: 'POST', body: { secret: memberSecret, nick, code: quickCodeOf(mine.code) } });
      if (!res || res.error) {
        toast(GROUP_ERRORS[res?.error] || '参加できませんでした');
        return;
      }
      track('group', 'join');
      viewGroup(id);
    };
  }
  app.querySelector('[data-leave]')?.addEventListener('click', async () => {
    if (!(await confirmModal('このグループから抜けますか？', '抜ける'))) return;
    if (await leaveGroup(id, { secret }, 'グループから抜けました')) viewGroup(id);
  });
  app.querySelector('[data-delete-group]')?.addEventListener('click', async () => {
    if (!(await confirmModal('グループを消しますか？ メンバー全員のページから消えます', '消す'))) return;
    if (await leaveGroup(id, { admin, all: true }, 'グループを消しました')) {
      store.set(`groupAdmin:${id}`, null);
      location.hash = '#/';
    }
  });
  app.querySelector('[data-lock]')?.addEventListener('click', async () => {
    const res = await api(`groups/${id}`, { method: 'PATCH', body: { admin, locked: !g.locked } });
    if (!res || res.error) {
      toast(GROUP_ERRORS[res?.error] || 'うまくいきませんでした');
      return;
    }
    toast(g.locked ? '参加の受付を再開しました' : '参加を締め切りました');
    viewGroup(id);
  });
  app.querySelector('[data-admin-link]')?.addEventListener('click', () => copyText(adminUrl(id, admin)));
  app.querySelectorAll('[data-kick]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!(await confirmModal(`${b.dataset.nick}さんをグループから外しますか？`, '外す'))) return;
      if (await leaveGroup(id, { admin, handle: b.dataset.kick }, 'メンバーを外しました')) viewGroup(id);
    }),
  );
}


// ---------- わたしクイズ（友達が、自分の答えを当てる） ----------
// 本人のかんたん診断の答え12個をリンクに入れて送る。友達は5問＋タイプ当ての6問に答え、
// 正解数（理解度）を本人に送り返せる。自由記述はなく、送り返すのはニックネームと点数だけ。
const QUIZ_LEN = 5;

function quizQuestions(answers) {
  // 振り切った答え（±3）の質問を優先して、決まった順に5問選ぶ
  return QUESTIONS.map((q, i) => ({ i, strong: Math.abs(q.options[answers[i]].v) === 3 }))
    .sort((a, b) => Number(b.strong) - Number(a.strong) || a.i - b.i)
    .slice(0, QUIZ_LEN)
    .map((x) => x.i)
    .sort((a, b) => a - b);
}

export function openQuizCreate(r) {
  const answers = store.get('quickAnswers', null);
  const mine = store.get('mineQuick', null);
  if (!Array.isArray(answers) || answers.length !== QUESTIONS.length || !mine || quickCodeOf(encodeResult(r)) !== mine.code) {
    openModal(`<h2 class="sheet-title">わたしクイズ</h2>
      <p>クイズは、このスマホで診断した、いまの結果から作れます。もう一度かんたん診断をすると作れるようになります。</p>
      <button class="btn" data-close data-go="#/q">かんたん診断をする</button>`);
    return;
  }
  const sheet = openModal(`
    <h2 class="sheet-title">わたしクイズを出す</h2>
    <p>友達が、あなたの答えを当てるクイズ（6問）。友達が結果のリンクを送り返してくれると、このスマホの成績表に並びます。</p>
    <label class="field">あなたのニックネーム（友達に表示されます）
      <input id="quiz-name" maxlength="10" placeholder="例：ゆう" value="${esc(store.get('nick', ''))}">
    </label>
    <p class="hint">本名は入れないでね。</p>
    <div id="quiz-links"></div>
    <button class="btn" id="quiz-make">クイズのリンクをつくる</button>
    <button class="btn sub" data-close>とじる</button>`);
  sheet.querySelector('#quiz-make').onclick = () => {
    const name = cleanName(sheet.querySelector('#quiz-name').value) || '友達';
    store.set('nick', name);
    const params = new URLSearchParams({ f: mine.code, n: name, a: answers.join('') });
    const url = `${ORIGIN}/k/${typeNo(mine.index).toLowerCase()}/?${params}`;
    const text = `【わたしクイズ】${name}のこと、どれだけわかってる？ 全6問で理解度チェック #${SITE.hashtag}`;
    sheet.querySelector('#quiz-links').innerHTML = `<p class="hint">このリンクを送ってね</p>${shareLinks({ text, url, channelPrefix: 'quiz:' }).html}`;
    sheet.querySelector('#quiz-make').hidden = true;
    track('quiz', 'create');
  };
}

// /k/NN/?f=..&n=..&a=.. から来たとき
export function receiveQuiz(params) {
  const code = params.get('f');
  const a = params.get('a') || '';
  const r = decodeResult(code);
  if (!r || !/^[0-3]{12}$/.test(a)) return false;
  store.set('friendQuiz', { name: cleanName(params.get('n')) || '友達', code, a });
  track('ref', '1');
  return true;
}

let fq = null;

export function viewFriendQuiz() {
  const q = store.get('friendQuiz', null);
  const owner = q && decodeResult(q.code);
  if (!owner) {
    location.hash = '#/';
    return;
  }
  const answers = Array.from(q.a, Number);
  fq = { ...q, owner, answers, order: quizQuestions(answers), pos: -1, score: 0, me: store.get('nick', '') };
  render(`
    ${brand()}
    <section class="result">
      <p class="lead">わたしクイズ</p>
      <h1 class="label">${esc(q.name)}さんのこと、<br>どれだけわかってる？</h1>
      <p>${esc(q.name)}さんが診断でどう答えたかを当ててね。全6問（5問＋タイプ当て）。</p>
      <label class="field">あなたのニックネーム（${esc(q.name)}さんに届きます）
        <input id="fq-name" maxlength="10" value="${esc(fq.me)}" placeholder="例：あお"></label>
      <button class="btn" data-fq-start>はじめる</button>
    </section>
    ${foot()}`);
  app.querySelector('[data-fq-start]').onclick = () => {
    fq.me = cleanName(app.querySelector('#fq-name').value) || 'ななし';
    store.set('nick', fq.me);
    nextFriendQuestion();
  };
}

function nextFriendQuestion() {
  fq.pos++;
  const total = QUIZ_LEN + 1;
  if (fq.pos < QUIZ_LEN) {
    const qi = fq.order[fq.pos];
    const q = QUESTIONS[qi];
    render(`
      <div class="progress" aria-hidden="true"><i style="width:${(fq.pos / total) * 100}%"></i></div>
      <div class="qhead"><span>わたしクイズ　${fq.pos + 1} / ${total}</span></div>
      <p class="lead">${esc(fq.name)}さんは、どれを選んだ？</p>
      <h2 class="qtext">${esc(q.text)}</h2>
      <div class="opts">${optionsHtml('axis', qi, 'data-fq')}</div>`);
    app.querySelectorAll('[data-fq]').forEach((b) =>
      b.addEventListener('click', () => answerFriend(Number(b.dataset.fq) === fq.answers[qi], b, `[data-fq="${fq.answers[qi]}"]`)),
    );
    return;
  }
  if (fq.pos === QUIZ_LEN) {
    // タイプ当て：正解＋軸が1つだけちがう3タイプ
    const base = fq.owner.baseIndex;
    const near = [8, 4, 2, 1].map((b) => base ^ b);
    const choices = [fq.owner.index, ...near.slice(0, 3)].sort((x, y) => ((x * 7 + base) % 11) - ((y * 7 + base) % 11));
    render(`
      <div class="progress" aria-hidden="true"><i style="width:${(fq.pos / total) * 100}%"></i></div>
      <div class="qhead"><span>わたしクイズ　${total} / ${total}</span></div>
      <p class="lead">ラスト！</p>
      <h2 class="qtext">${esc(fq.name)}さんのタイプはどれ？</h2>
      <div class="type-choices">${choices.map((i) => `<button class="opt type-opt" data-ft="${i}">${charaSVG(i, { size: 64 })}<span>${esc(TYPES[i].label)}</span></button>`).join('')}</div>`);
    app.querySelectorAll('[data-ft]').forEach((b) =>
      b.addEventListener('click', () => answerFriend(Number(b.dataset.ft) === fq.owner.index, b, `[data-ft="${fq.owner.index}"]`)),
    );
    return;
  }
  friendQuizResult();
}

function answerFriend(correct, button, correctSel) {
  app.querySelectorAll('.opt').forEach((b) => (b.disabled = true));
  if (correct) fq.score++;
  button.classList.add(correct ? 'right' : 'wrong');
  app.querySelector(correctSel)?.classList.add('right');
  track('quiz', 'answer');
  toast(correct ? '正解！' : 'ざんねん…');
  const gen = navNow();
  setTimeout(() => gen === navNow() && nextFriendQuestion(), 900);
}

const QUIZ_RANKS = [
  [6, '大親友', '全問正解！ もはや本人より本人にくわしい。'],
  [5, '親友', 'ほとんどお見通し。いつもちゃんと見てくれてる証拠。'],
  [3, '友達', 'いいところまでわかってる。これからもっと仲良くなれる。'],
  [0, 'これから仲良く', 'まだ知らない一面があるみたい。それも楽しみのうち。'],
];
const quizRank = (score) => QUIZ_RANKS.find(([min]) => score >= min);

function friendQuizResult() {
  const total = QUIZ_LEN + 1;
  const [, rank, comment] = quizRank(fq.score);
  const t = TYPES[fq.owner.index];
  const back = `${ORIGIN}/#/qs/${encodeURIComponent(fq.me)}/${fq.score}`;
  track('quiz', 'done');
  addFriend(fq.name, fq.code);
  render(`
    ${brand()}
    <section class="result">
      <p class="lead">${esc(fq.name)}さんのわたしクイズ</p>
      <div class="quiz-score"><strong>${fq.score}</strong><span>/ ${total}問</span></div>
      <span class="chip">理解度：${esc(rank)}</span>
      <p class="praise">${esc(comment)}</p>
      <div class="card"><h2>${esc(fq.name)}さんのタイプ</h2>
        <div class="mini-type">${charaSVG(fq.owner.index, { size: 72 })}<div><b>${esc(t.label)}</b><small>${esc(t.catch)}</small></div></div></div>
      <h2 class="sheet-title">${esc(fq.name)}さんに結果を送る</h2>
      ${shareLinks({ text: `${fq.name}のわたしクイズ、${total}問中${fq.score}問正解だった（${rank}）`, url: back, channelPrefix: 'quiz:' }).html}
      <button class="btn type" data-fq-invite>自分も診断して、${esc(fq.name)}さんとの相性を見る</button>
    </section>
    ${foot()}`);
  app.querySelector('[data-fq-invite]').onclick = () => {
    store.set('invite', { name: fq.name, code: fq.code });
    location.hash = '#/q';
  };
}

// 友達から届いた点数（本人の端末にだけ記録する）
export function receiveQuizScore(name, score) {
  // リンクが途中で切れて名前が読めなくても、点数は残す
  const n = cleanName(safeDecode(name)) || 'ななし';
  const sc = Number(score);
  if (!Number.isInteger(sc) || sc < 0 || sc > QUIZ_LEN + 1) return false;
  const list = store.get('quizScores', []).filter((x) => x.name !== n);
  list.push({ name: n, score: sc, at: Date.now() });
  store.set('quizScores', list.slice(-50));
  return true;
}

export function viewQuizBoard() {
  const list = [...store.get('quizScores', [])].sort((a, b) => b.score - a.score || a.at - b.at);
  render(`
    ${brand()}
    <section class="result">
      <p class="lead">わたしクイズの成績表</p>
      <h1 class="label">一番わかってるのは！？</h1>
    </section>
    ${list.length
      ? `<ol class="board">${list.map((x, k) => `<li><span class="bn">${k + 1}</span><b>${esc(x.name)}</b><span class="chip soft">${esc(quizRank(x.score)[1])}</span><strong>${x.score}/${QUIZ_LEN + 1}</strong>
          <button class="linkish" data-del="${esc(x.name)}" aria-label="${esc(x.name)}を消す">消す</button></li>`).join('')}</ol>`
      : '<p class="hint center">まだ届いていません。わたしクイズのリンクを送ってみてね。</p>'}
    <p class="hint center">成績は、このスマホの中にだけ保存されています。</p>
    <button class="btn sub" data-go="#/">トップへ</button>
    ${foot()}`);
  app.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => {
      store.set('quizScores', store.get('quizScores', []).filter((x) => x.name !== b.dataset.del));
      viewQuizBoard();
    }),
  );
}
