// かんたん診断の結果・タイプ詳細・図鑑（シール帳）のページ。
// かんたん診断の結果は「シェアしやすさ」と「くわしい診断への入口」を優先した軽い作りにし、
// タイプの読みもの（性格・恋愛・友達・学校・トリセツ）はタイプページにまとめる。
import { SITE } from './config.js';
import { AXES, TYPES, HIDDEN, BASE_COUNT, PARAMS, isHidden, typeNo } from './data.js';
import { titleOf, rarityOf, priorDistribution, compatRanking, compatOf, axisLine, decodeResult, encodeResult } from './logic.js';
import { charaSVG } from './chara.js';
import { radarSVG } from './radar.js';
import { drawStoryCard, drawLabelCard, canvasToBlob } from './card.js';
import { app, ORIGIN, esc, store, track, loadStats, render, toast, foot, brand, shareLinks, shareImageBlob, openModal, inAppHint, navNow, busy } from './ui.js';
import { invitePairBox, openInviteModal, openGroupCreate, openQuizCreate, friends } from './social.js';
import { openProfileCard } from './profile.js';

const noLabel = (index) => (isHidden(index) ? `隠しタイプ ${typeNo(index)}` : `No.${typeNo(index)}`);
export const typePath = (index) => `#/t/${typeNo(index).toLowerCase()}`;

const shareUrl = (index, shareId) => `${ORIGIN}/t/${typeNo(index).toLowerCase()}/?s=${shareId}`;
// 「でも…」で始まる痛い一行は、それだけだと前の文が欠けて見えるので、頭の「でも」を外して使う
export const roastAlone = (t) => t.roast.replace(/^でも、?/, '');
function shareText(r) {
  const t = TYPES[r.index];
  return `【${t.label}】だった！（${titleOf(r.purity)}・ポンコツ純度${r.purity}%）\n${roastAlone(t)}\n#${SITE.hashtag} あなたは何タイプ？`;
}

// ---------- 成分表（食品表示のパロディ） ----------
export function labelPanel(index, r) {
  const t = TYPES[index];
  return `<div class="foodlabel">
    <dl>
      <dt>名称</dt><dd>${esc(t.label)}</dd>
      <dt>原材料名</dt><dd>${t.ingredients.map(esc).join('、')}</dd>
      <dt>内容量</dt><dd>${r ? `ポンコツ純度 ${r.purity}%` : 'ポンコツ 1人分'}</dd>
      <dt>保存方法</dt><dd>${esc(t.habitat)}</dd>
      <dt>製造者</dt><dd>${esc(SITE.name)}</dd>
    </dl>
    ${r ? `<div class="nutrition"><b>栄養成分表示（1人あたり）</b>${AXES.map((a, k) => `<div><span>${esc(r.sums[k] > 0 ? a.pos : a.neg)}</span><span>${r.axisPct[k]}%</span></div>`).join('')}</div>` : ''}
    <p class="caution">${esc(t.caution)}</p>
  </div>`;
}

function axisBars(r) {
  return AXES.map((a, k) => {
    const pos = r.sums[k] > 0;
    const pct = r.axisPct[k];
    return `<div class="axis">
      <div class="names"><span class="${pos ? '' : 'win'}">${esc(a.neg)} ${pos ? 100 - pct : pct}%</span><span class="${pos ? 'win' : ''}">${pos ? pct : 100 - pct}% ${esc(a.pos)}</span></div>
      <div class="bar"><i style="${pos ? 'right' : 'left'}:0;width:${pct}%"></i></div>
      <p class="axis-line">${esc(axisLine(k, r.sums[k]))}</p>
    </div>`;
  }).join('');
}

// 相性（相性◎・刺激しあう相手・友達・全タイプ）
function compatSection(index, r) {
  const t = TYPES[index];
  const base = r ? r.baseIndex : isHidden(index) ? null : index;
  const ranking = base == null ? [] : compatRanking(base).filter((x) => x.index !== base);
  const myCode = r ? encodeResult(r) : '';
  const fr = r
    ? friends()
        .slice(0, 12)
        .map((f) => ({ ...f, c: compatOf(r, f.result) }))
        .sort((x, y) => y.c.score - x.c.score)
    : [];
  const low = ranking[ranking.length - 1];
  const row = (i, name, score, href) => `<li><a href="${href}">${charaSVG(i, { size: 36 })}<span class="rl">${name}</span>
    <span class="rs"><i style="width:${score}%"></i></span><b>${score}%</b></a></li>`;
  return `<section class="card" id="sec-compat"><h2>相性</h2>
    <div class="best"><span class="chip">相性◎</span> <a href="${typePath(t.best)}"><b>${esc(TYPES[t.best].label)}</b></a><p>${esc(t.bestWhy)}</p></div>
    ${low ? `<div class="best caution"><span class="chip">刺激しあう</span> <a href="${typePath(low.index)}"><b>${esc(TYPES[low.index].label)}</b></a><p>${esc(low.care ? `${low.care}。でも、${low.good}。` : `${low.good}。`)}</p></div>` : ''}
    ${fr.length ? `<h3>友達との相性</h3><ol class="ranking">${fr.map((f) => row(f.result.index, `${esc(f.name)}さん<small class="met">${esc(TYPES[f.result.index].label)}</small>`, f.c.score, `#/pair/${f.code}/${myCode}/${encodeURIComponent(f.name)}/${encodeURIComponent('わたし')}`)).join('')}</ol>` : ''}
    ${ranking.length ? `<details class="more"><summary>全タイプとの相性を見る</summary><ol class="ranking">${ranking.map((x) => row(x.index, esc(TYPES[x.index].label), x.score, typePath(x.index))).join('')}</ol></details>` : ''}
    ${r ? '<button class="btn type" data-invite>友達と相性をくらべる</button>' : ''}
  </section>`;
}

// くわしい診断への入口（ふんわり見せる）
function detailTeaser(r) {
  const t = TYPES[r.index];
  const done = store.get('mineDetail', null);
  const doneHere = done && done.code.startsWith(`${encodeResult(r)}~`);
  const fake = [62, 48, 70, 35, 80, 30, 66, 52, 74, 40];
  return `<section class="card teaser-card">
    <p class="lead">くわしい診断（診断は無料・あと24問・約3分）</p>
    <h2 class="teaser-title"><span class="blurred">？？？な</span>${esc(t.label)}</h2>
    <p><b>二つ名</b>（240通り）・<b>恋愛タイプ</b>（8種類）・<b>10項目のステータスのランク</b>が無料でわかります。数値とくわしい解説は完全版（有料）で読めます。</p>
    <div class="teaser-radar">${radarSVG(fake, { labels: [...AXES.map((a, k) => (r.sums[k] >= 0 ? a.pos : a.neg)), ...PARAMS.map((p) => p.name.replace(/度$|力$|熱量$/, ''))], masked: true, size: 240 })}</div>
    <ul class="includes small">${PARAMS.map((p) => `<li>${esc(p.name)}</li>`).join('')}</ul>
    ${doneHere
      ? `<a class="btn type" href="#/r/${esc(done.code)}/${esc(done.shareId)}">くわしい診断の結果を見る</a>`
      : '<button class="btn type" data-go="#/d">くわしい診断に進む</button>'}
    <p class="hint center">かんたん診断の答えを引きつぐので、続きの24問だけでOK</p>
  </section>`;
}

// ---------- かんたん診断の結果 ----------
export async function viewResult(r, shareId) {
  const gen = navNow();
  const t = TYPES[r.index];
  const title = titleOf(r.purity);
  const stats = await loadStats();
  // 読みこみを待っているあいだに別の画面へ移っていたら、描かない
  if (gen !== navNow()) return;
  const rarity = rarityOf(r.index, stats);
  const ura = TYPES[r.ura.index];
  const text = shareText(r);
  const url = shareUrl(r.index, shareId);
  const boardCount = store.get('quizScores', []).length;
  render(`
    ${brand()}
    <section class="result">
      ${isHidden(r.index) ? `<div class="secret">隠しタイプを引き当てた！（計算上の出現率 約${(priorDistribution()[r.index] * 100).toFixed(1)}%）</div>` : ''}
      <p class="lead">あなたは…</p>
      <span class="no">${noLabel(r.index)}</span>
      <div class="chara-wrap">${charaSVG(r.index, { size: 240 })}</div>
      <h1 class="label">${esc(t.label)}</h1>
      <p class="catch-line">${esc(t.catch)}</p>
      <span class="chip">${esc(title)}・ポンコツ純度${r.purity}%</span>
      <p class="praise">${esc(t.praise)}</p>
      <p class="roast"><span>${esc(t.roast)}</span></p>
    </section>
    ${invitePairBox(r)}
    <section class="share">
      <button class="btn type" data-card="story">画像を保存してストーリーに投稿</button>
      ${shareLinks({ text, url, channelPrefix: '' }).html}
      ${inAppHint()}
      <div class="btn-row">
        <button class="btn sub small" data-card="label">成分表カード</button>
        <button class="btn sub small" data-prof>プロフ帳カード</button>
      </div>
    </section>
    <div class="tiles">
      <div class="tile"><b>ポンコツ純度</b><strong>${r.purity}%</strong><small>${esc(title)}</small></div>
      <div class="tile"><b>レア度</b><strong>${rarity.pct.toFixed(1)}%</strong><small>${rarity.source === 'actual' ? '診断した人の中で' : '計算上の値'}</small></div>
      <a class="tile" href="${typePath(r.ura.index)}"><b>裏タイプ</b><strong class="small">${esc(ura.label)}</strong><small>もうひとつの顔</small></a>
    </div>
    ${detailTeaser(r)}
    <section class="card"><h2>あなたの4つの軸</h2>${axisBars(r)}</section>
    <section class="card"><h2>成分表</h2>${labelPanel(r.index, r)}</section>
    <section class="card"><h2>あるある</h2><ul class="aru">${t.aru.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></section>
    ${compatSection(r.index, r)}
    <section class="card"><h2>${esc(t.label)}をもっと知る</h2>
      <p>性格・恋愛・友達・学校・バイト・推し活・トリセツまで、タイプの解説を全部読めます。</p>
      <a class="btn sub" href="${typePath(r.index)}">${esc(t.label)}の解説を読む</a>
    </section>
    <section class="card"><h2>友達と遊ぶ</h2>
      <div class="btn-col">
        <button class="btn sub" data-quiz-create>わたしクイズを出す（友達が答えを当てる）</button>
        <button class="btn sub" data-group>グループ診断をつくる（仲良しグループ・部活・推し仲間）</button>
        ${boardCount ? `<a class="btn sub" href="#/qboard">わたしクイズの成績表（${boardCount}人）</a>` : ''}
      </div>
    </section>
    <button class="btn" data-go="#/q">もう一回診断する</button>
    <button class="btn sub" data-go="#/zukan">図鑑をみる（全${TYPES.length}タイプ）</button>
    ${foot()}`, r.index);

  const ctx = { ...r, title, rarity };
  app.querySelectorAll('[data-card]').forEach((b) =>
    b.addEventListener('click', () =>
      busy(b, async () => {
        toast('画像をつくっています…');
        const canvas = b.dataset.card === 'label' ? await drawLabelCard(ctx) : await drawStoryCard(ctx);
        track('share', b.dataset.card === 'label' ? 'label-image' : 'image');
        await shareImageBlob(await canvasToBlob(canvas), { name: `ponkotsu-${typeNo(r.index)}-${b.dataset.card}.png`, text: `${text}\n${url}`, alt: `${t.label}のシェア画像` });
      }),
    ),
  );
  app.querySelectorAll('[data-invite]').forEach((b) => b.addEventListener('click', () => openInviteModal(r)));
  app.querySelector('[data-quiz-create]').addEventListener('click', () => openQuizCreate(r));
  app.querySelector('[data-group]').addEventListener('click', openGroupCreate);
  app.querySelector('[data-prof]').addEventListener('click', () => openProfileCard(r));
}

// ---------- タイプ詳細（シェアURLの着地点・図鑑から） ----------
const NAV = [
  ['sec-self', '性格'],
  ['sec-love', '恋愛'],
  ['sec-friend', '友達'],
  ['sec-school', '学校・バイト'],
  ['sec-toriset', 'トリセツ'],
  ['sec-compat', '相性'],
];

// まだ出会っていない隠しタイプ（図鑑の上に重ねて出す）
export function showLockedType(index) {
  openModal(`<div class="locked-chara">${charaSVG(index, { size: 140 })}</div>
    <h2 class="sheet-title">${noLabel(index)}は、まだ秘密</h2>
    <p class="hint">診断で引き当てるか、このタイプの友達から相性のおさそいをもらうと図鑑にのります。</p>
    <button class="btn" data-close data-go="#/q">診断する</button>`);
}

// タイプの解説ページ。まだ出会っていない隠しタイプなら描かずに false を返す
export function viewType(index) {
  const t = TYPES[index];
  const mine = store.get('mine', null);
  const unlocked = !isHidden(index) || unlockedHidden().has(index) || document.body.dataset.type === typeNo(index).toLowerCase();
  if (!unlocked) return false;
  render(`
    ${brand()}
    <section class="result">
      <span class="no">${noLabel(index)}</span>
      <div class="chara-wrap">${charaSVG(index, { size: 240 })}</div>
      <h1 class="label">${esc(t.label)}</h1>
      <p class="catch-line">${esc(t.catch)}</p>
      <p class="praise">${esc(t.praise)}</p>
      <p class="roast"><span>${esc(t.roast)}</span></p>
      <button class="btn" data-go="#/q">${mine ? 'もう一回診断する' : 'あなたは何タイプ？診断する（無料・1分）'}</button>
    </section>
    <nav class="secnav" aria-label="もくじ">${NAV.map(([id, l]) => `<button data-scroll="${id}">${l}</button>`).join('')}</nav>
    <section class="card" id="sec-self"><h2>基本の性格</h2>
      <p>${esc(t.summary)}</p>
      <div class="two">
        <div><h3>愛されポイント</h3><ul class="points good">${t.charm.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div><h3>ポンコツポイント</h3><ul class="points bad">${t.ponkotsu.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
      </div>
    </section>
    <section class="card"><h2>成分表</h2>${labelPanel(index, null)}</section>
    <section class="card"><h2>あるある</h2><ul class="aru">${t.aru.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></section>
    <section class="card" id="sec-love"><h2>恋愛</h2><p>${esc(t.love)}</p>
      <ul class="aru">${t.loveAru.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
      <p class="hint">あなたの恋愛タイプ（8種類）は、くわしい診断でわかります。</p></section>
    <section class="card" id="sec-friend"><h2>友達・グループでは</h2>
      <p><span class="chip">${esc(t.role)}</span></p><p>${esc(t.friend)}</p>
      <h3>推し活</h3><p>${esc(t.oshi)}</p>
      <h3>トーク・SNS</h3><p>${esc(t.sns)}</p>
      <h3>休日</h3><p>${esc(t.holiday)}</p>
      <h3>落ちこんだときの復活法</h3><p>${esc(t.recover)}</p>
    </section>
    <section class="card" id="sec-school"><h2>学校・バイト・仕事</h2><p>${esc(t.school)}</p>
      <h3>向いてるかもしれないバイト・仕事</h3><div class="chips">${t.jobs.map((j) => `<span class="chip soft">${esc(j)}</span>`).join('')}</div></section>
    <section class="card" id="sec-toriset"><h2>${esc(t.chara)}のトリセツ</h2>
      <div class="two">
        <div><h3>こうしてくれるとうれしい</h3><ul class="points good">${t.toriset.do.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div><h3>これはやめてね</h3><ul class="points bad">${t.toriset.dont.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
      </div>
      <dl class="facts"><dt>生息地</dt><dd>${esc(t.habitat)}</dd><dt>口ぐせ</dt><dd>「${esc(t.kuchiguse)}」</dd></dl>
    </section>
    ${compatSection(index, null)}
    <section class="card"><h2>このタイプの人へ</h2>
      <p>くわしい診断（無料）で、二つ名・恋愛タイプ・ステータスのランクがわかります。数値や「本当のあなた」などのくわしい解説は、完全版（有料）で読めます。</p>
      <button class="btn type" data-go="#/d">くわしい診断をする</button>
    </section>
    <button class="btn sub" data-go="#/zukan">図鑑をみる</button>
    ${foot()}`, index);
  app.querySelectorAll('[data-scroll]').forEach((b) =>
    b.addEventListener('click', () => app.querySelector(`#${b.dataset.scroll}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })),
  );
  return true;
}

// 自分で引き当てた／友達経由で出会った隠しタイプ
export function unlockedHidden() {
  const set = new Set(store.get('gotHidden', []));
  friends().forEach((f) => isHidden(f.result.index) && set.add(f.result.index));
  return set;
}

// ---------- 図鑑（シール帳） ----------
export function viewZukan() {
  const mine = store.get('mine', null);
  const fr = friends();
  const byType = new Map();
  fr.forEach((f) => {
    if (!byType.has(f.result.index)) byType.set(f.result.index, []);
    byType.get(f.result.index).push(f.name);
  });
  const got = unlockedHidden();
  const met = new Set([...byType.keys(), ...(mine && TYPES[mine.index] ? [mine.index] : [])]);
  const cards = TYPES.map((t, i) => {
    const locked = isHidden(i) && !got.has(i);
    const isMine = mine && mine.index === i;
    const names = byType.get(i) || [];
    const tilt = ((i * 37) % 9) - 4;
    return `<a class="sticker ${isMine ? 'mine' : ''} ${locked ? 'locked' : ''} ${met.has(i) ? 'met' : ''}" href="${typePath(i)}" style="--tilt:${tilt}deg">
      ${isMine ? '<span class="me">あなた</span>' : ''}
      <span class="seal">${charaSVG(i, { size: 120 })}</span>
      <span class="n">${noLabel(i)}</span>
      <span class="l">${locked ? '？？？' : esc(t.label)}</span>
      ${names.length ? `<span class="friends-on">${names.slice(0, 2).map(esc).join('・')}${names.length > 2 ? ` ほか${names.length - 2}人` : ''}</span>` : ''}
    </a>`;
  }).join('');
  render(`
    ${brand()}
    <section class="zukan">
      <h1>ポンコツ図鑑</h1>
      <p class="hint" style="margin:0">全${BASE_COUNT}タイプ＋隠しタイプ${HIDDEN.length}つのシール帳。友達と相性をくらべたり、クイズに答えたりすると、そのタイプのシールが集まります。</p>
      <div class="complete"><span>集めたシール</span><b>${met.size} / ${TYPES.length}</b><i style="width:${(met.size / TYPES.length) * 100}%"></i></div>
      <div class="stickerbook">${cards}</div>
    </section>
    ${mine ? '<button class="btn type" data-invite-mine style="margin-top:20px">友達を誘ってシールを集める</button>' : '<button class="btn" data-go="#/q" style="margin-top:20px">診断する</button>'}
    ${foot()}`);
  app.querySelector('[data-invite-mine]')?.addEventListener('click', () => {
    const r = decodeResult(mine.code);
    if (r) openInviteModal(r);
  });
}
