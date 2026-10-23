// ふたり・グループで遊ぶ機能：相性のおさそいリンク、ペア結果、グループ診断、出会ったタイプの記録
import { SITE } from './config.js';
import { TYPES, AXES, typeNo } from './data.js';
import { compatOf, decodeResult, encodeResult, resultFromSums, axisPctOf } from './logic.js';
import { charaSVG } from './chara.js';
import { drawPairCard, canvasToBlob } from './card.js';
import { app, ORIGIN, esc, cleanName, store, track, api, render, toast, openModal, closeModal, foot, brand, shareLinks, shareImageBlob } from './ui.js';

// ---------- 出会ったタイプ（図鑑のコンプリート用） ----------
export function addFriend(name, code) {
  const r = decodeResult(code);
  if (!r) return;
  const friends = store.get('friends', []).filter((f) => !(f.name === name && f.code === code));
  friends.unshift({ name, code, at: Date.now() });
  store.set('friends', friends.slice(0, 60));
}
export const friends = () =>
  store
    .get('friends', [])
    .map((f) => ({ ...f, result: decodeResult(f.code) }))
    .filter((f) => f.result);

// ---------- おさそいリンク ----------
export function inviteUrl(result, name) {
  const params = new URLSearchParams({ f: encodeResult(result), n: cleanName(name) || '友達' });
  return `${ORIGIN}/i/${typeNo(result.index).toLowerCase()}/?${params}`;
}

// /i/NN/?f=..&n=.. から来たとき：おさそいを保存してトップへ
export function receiveInvite(params) {
  const code = params.get('f');
  const name = cleanName(params.get('n')) || '友達';
  if (!decodeResult(code)) return false;
  store.set('invite', { name, code });
  addFriend(name, code);
  track('ref', '1');
  return true;
}

export function inviteBanner() {
  const inv = store.get('invite', null);
  const r = inv && decodeResult(inv.code);
  if (!r) return '';
  return `<div class="invite">
    <div class="invite-chara">${charaSVG(r.index, { size: 72 })}</div>
    <div><b>${esc(inv.name)}さん</b>（${esc(TYPES[r.index].label)}）から<br>相性診断のおさそいが届いています</div>
  </div>`;
}

// 結果ページに出す「〇〇さんとの相性」
export function invitePairBox(mine) {
  const inv = store.get('invite', null);
  const other = inv && decodeResult(inv.code);
  if (!other) return '';
  const c = compatOf(mine, other);
  return `<section class="card pairbox">
    <h2>${esc(inv.name)}さんとの相性</h2>
    <div class="pair-row">
      <div>${charaSVG(mine.index, { size: 84 })}<small>あなた</small></div>
      <div class="pair-score"><strong>${c.score}%</strong><span>${esc(c.rank)}</span></div>
      <div>${charaSVG(other.index, { size: 84 })}<small>${esc(inv.name)}さん</small></div>
    </div>
    <p>${esc(c.good)}。${c.care ? `ただし、${esc(c.care)}。` : ''}</p>
    <div class="btn-row">
      <a class="btn sub small" href="#/pair/${encodeResult(other)}/${encodeResult(mine)}/${encodeURIComponent(inv.name)}/${encodeURIComponent('わたし')}">ふたりの相性をくわしく</a>
    </div>
  </section>`;
}

// 相手を誘うモーダル（ニックネームはURLに入るだけで、どこにも保存しない）
export function openInviteModal(mine) {
  const sheet = openModal(`
    <h2 class="sheet-title">友達と相性をくらべる</h2>
    <p class="hint">リンクを送ると、友達が診断したあとに、ふたりの相性が出ます。</p>
    <label class="field">あなたのニックネーム（相手に表示されます）
      <input id="invite-name" maxlength="10" placeholder="例：ゆい" value="${esc(store.get('nick', ''))}">
    </label>
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
  const sendUrl = `${ORIGIN}/p/?${new URLSearchParams({ a: codeA, b: codeB, na: nameA, nb: nameB })}`;
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
    <div class="card"><h2>${esc(nameA)}から見た${esc(nameB)}</h2><p>${esc(tb.toriset.do[0])}。${esc(tb.toriset.dont[0])}は、ちょっと苦手。</p></div>
    <div class="card"><h2>${esc(nameB)}から見た${esc(nameA)}</h2><p>${esc(ta.toriset.do[0])}。${esc(ta.toriset.dont[0])}は、ちょっと苦手。</p></div>
    <button class="btn" data-go="#/q">自分も診断する</button>
    <button class="btn sub" data-go="#/zukan">図鑑をみる</button>
    ${foot()}`, a.index);
  app.querySelector('[data-pair-card]').onclick = async () => {
    toast('画像をつくっています…');
    const canvas = await drawPairCard({ a, b, nameA, nameB, compat: c });
    track('share', 'pair-image');
    await shareImageBlob(await canvasToBlob(canvas), { name: 'ponkotsu-pair.png', text: `${text}\n${sendUrl}`, alt: 'ふたりの相性カード' });
  };
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
const ROLES = [
  { name: '幹事役', score: (s) => s[0] + s[1] - s[2] },
  { name: 'ムードメーカー', score: (s) => s[1] + s[2] },
  { name: '切り込み隊長', score: (s) => s[0] + s[2] },
  { name: '参謀', score: (s) => -s[2] - s[3] },
  { name: '癒し担当', score: (s) => -s[0] + s[3] },
  { name: '聞き役', score: (s) => -s[1] - s[3] },
  { name: '自由人', score: (s) => s[2] + s[3] - s[1] },
];

export function groupRoles(members) {
  const taken = new Set();
  const out = [];
  for (const role of ROLES) {
    if (taken.size >= members.length) break;
    const best = members
      .filter((m) => !taken.has(m.id))
      .map((m) => ({ m, v: role.score(m.result.sums) }))
      .sort((x, y) => y.v - x.v)[0];
    if (!best) break;
    taken.add(best.m.id);
    out.push({ role: role.name, member: best.m });
  }
  return out;
}

export function openGroupCreate() {
  const sheet = openModal(`
    <h2 class="sheet-title">グループ診断をつくる</h2>
    <p class="hint">クラス・部活・サークル・推し仲間で。リンクを送ると、みんなのタイプと役割が1ページにまとまります。</p>
    <label class="field">グループの名前<input id="group-name" maxlength="20" placeholder="例：2年3組"></label>
    <p class="hint" id="group-msg"></p>
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
      sheet.querySelector('#group-msg').textContent = res?.error === 'rate' ? '少し時間をおいてもう一度試してね' : 'いまはグループを作れません（公開版で使えます）';
      return;
    }
    track('group', 'create');
    closeModal();
    location.hash = `#/g/${res.id}`;
  };
}

export async function viewGroup(id) {
  if (!/^[a-z0-9]{8}$/.test(id)) {
    location.hash = '#/';
    return;
  }
  render(`${brand()}<div class="loading small">グループを読みこみ中…<div class="dots"><i></i><i></i><i></i></div></div>`);
  const g = await api(`groups/${id}?me=${encodeURIComponent(store.get('memberId', '') || '')}`);
  if (!g || g.error) {
    render(`${brand()}<div class="card"><h2>グループが見つかりません</h2><p>リンクが古いか、まだ公開版でしか使えない機能です。</p></div>
      <button class="btn" data-go="#/q">診断する</button>${foot()}`);
    return;
  }
  const members = g.members.map((m) => ({ ...m, result: decodeResult(m.code) })).filter((m) => m.result);
  const me = store.get('memberId', null);
  const mine = store.get('mine', null);
  const joined = members.some((m) => m.id === me);
  const roles = groupRoles(members);
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
    ${joined ? '' : mine
      ? `<div class="card"><h2>このグループに参加する</h2>
          <label class="field">ニックネーム<input id="join-name" maxlength="10" value="${esc(store.get('nick', ''))}" placeholder="例：ゆい"></label>
          <button class="btn" id="join">あなたのタイプで参加</button></div>`
      : `<div class="card"><h2>診断して参加しよう</h2><p>20問に答えると、このグループに参加できます。</p>
          <button class="btn" data-go="#/q">診断する</button></div>`}
    ${members.length ? `
    <div class="card"><h2>メンバー</h2><div class="members">${members.map((m) => `
      <a class="member ${m.id === me ? 'mine' : ''}" href="#/t/${typeNo(m.result.index).toLowerCase()}">${charaSVG(m.result.index, { size: 64 })}<b>${esc(m.nick)}</b><small>${esc(TYPES[m.result.index].label)}</small></a>`).join('')}</div></div>
    <div class="card"><h2>グループ内の役割</h2><ul class="roles">${roles.map((r) => `<li><span class="chip">${esc(r.role)}</span>${esc(r.member.nick)}</li>`).join('')}</ul></div>
    <div class="card"><h2>このグループをひとことで</h2>
      <p>${top[1] > 1 ? `いちばん多いのは「${esc(TYPES[top[0]].label)}」（${top[1]}人）。` : 'メンバー全員がちがうタイプの、バラエティ豊かなグループ。'}グループ全体を1人にすると「${esc(TYPES[groupType].label)}」っぽいチームです。</p>
      ${bestPair ? `<p>いちばん相性がいいのは <b>${esc(bestPair.a.nick)}</b> × <b>${esc(bestPair.b.nick)}</b>（${bestPair.c.score}%・${esc(bestPair.c.rank)}）。</p>` : ''}
    </div>` : ''}
    <div class="card"><h2>メンバーを集める</h2>${shareLinks({ text: `「${g.name}」のグループ診断。みんなのポンコツタイプと役割がわかるよ`, url, channelPrefix: 'group:' }).html}</div>
    ${foot()}`);
  const join = app.querySelector('#join');
  if (join) {
    join.onclick = async () => {
      const nick = cleanName(app.querySelector('#join-name').value) || 'ななし';
      store.set('nick', nick);
      const memberId = me || Math.random().toString(36).slice(2, 12);
      store.set('memberId', memberId);
      const res = await api(`groups/${id}`, { method: 'POST', body: { id: memberId, nick, code: mine.code } });
      if (!res || res.error) {
        toast(res?.error === 'full' ? 'このグループは満員です' : '参加できませんでした');
        return;
      }
      track('group', 'join');
      viewGroup(id);
    };
  }
}
