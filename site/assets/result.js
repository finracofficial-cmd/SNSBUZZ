// 診断結果とタイプ詳細のページ。16Personalities のタイプページのように、
// 性格・恋愛・友達・学校・トリセツ・相性まで1ページで読めるようにしている。
import { SITE } from './config.js';
import { AXES, TYPES, HIDDEN, BASE_COUNT, isHidden, typeNo } from './data.js';
import { titleOf, rarityOf, priorDistribution, compatRanking, compatOf, axisLine, decodeResult, encodeResult } from './logic.js';
import { charaSVG } from './chara.js';
import { drawStoryCard, drawLabelCard, canvasToBlob } from './card.js';
import { app, ORIGIN, esc, store, track, loadStats, render, toast, foot, brand, shareLinks, shareImageBlob, openModal, inAppHint } from './ui.js';
import { invitePairBox, openInviteModal, openGroupCreate, friends } from './social.js';
import { premiumSection, mountPremium, hasPremium } from './premium.js';

const noLabel = (index) => (isHidden(index) ? `隠しタイプ ${typeNo(index)}` : `No.${typeNo(index)}`);
export const typePath = (index) => `#/t/${typeNo(index).toLowerCase()}`;

function shareUrl(index, shareId) {
  return `${ORIGIN}/t/${typeNo(index).toLowerCase()}/?s=${shareId}`;
}

function shareText(r) {
  const t = TYPES[r.index];
  return `私は【${t.label}（${titleOf(r.purity)}）】でした。ポンコツ純度${r.purity}%\n${t.roast}\n#${SITE.hashtag} あなたは何タイプ？`;
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

const NAV = [
  ['sec-self', '性格'],
  ['sec-label', '成分表'],
  ['sec-love', '恋愛'],
  ['sec-friend', '友達'],
  ['sec-school', '学校・バイト'],
  ['sec-toriset', 'トリセツ'],
  ['sec-compat', '相性'],
  ['premium', '完全版'],
];

// タイプの読みもの部分（結果ページとタイプページで共通）
function typeSections(index, r) {
  const t = TYPES[index];
  const base = r ? r.baseIndex : isHidden(index) ? null : index;
  const ranking = base == null ? [] : compatRanking(base);
  const met = new Map(friends().map((f) => [f.result.index, f.name]));
  const myCode = r ? encodeResult(r) : '';
  const friendScores = r
    ? friends()
        .slice(0, 12)
        .map((f) => ({ ...f, c: compatOf(r, f.result) }))
        .sort((x, y) => y.c.score - x.c.score)
    : [];
  return `
    <nav class="secnav" aria-label="もくじ">${NAV.map(([id, l]) => `<button data-scroll="${id}">${l}</button>`).join('')}</nav>
    <section class="card" id="sec-self"><h2>基本の性格</h2>
      <p>${esc(t.summary)}</p>
      <div class="two">
        <div><h3>愛されポイント</h3><ul class="points good">${t.charm.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div><h3>ポンコツポイント</h3><ul class="points bad">${t.ponkotsu.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
      </div>
      ${r ? `<h3>あなたの4つの軸</h3>${axisBars(r)}` : ''}
    </section>
    <section class="card" id="sec-label"><h2>成分表</h2>${labelPanel(index, r)}
      ${r ? '<button class="btn sub small" data-card="label">成分表を画像で保存</button>' : ''}
    </section>
    <section class="card"><h2>あるある</h2><ul class="aru">${t.aru.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></section>
    <section class="card" id="sec-love"><h2>恋愛</h2><p>${esc(t.love)}</p>
      <ul class="aru">${t.loveAru.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></section>
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
    <section class="card" id="sec-compat"><h2>相性</h2>
      <div class="best"><span class="chip">相性◎</span> <a href="${typePath(t.best)}"><b>${esc(TYPES[t.best].label)}</b></a><p>${esc(t.bestWhy)}</p></div>
      ${ranking.length ? (() => {
        const low = ranking[ranking.length - 1];
        const c = low.care || low.good;
        return `<div class="best caution"><span class="chip">刺激しあう</span> <a href="${typePath(low.index)}"><b>${esc(TYPES[low.index].label)}</b></a><p>${esc(c)}。おたがいのトリセツを読んでおくと安心。</p></div>`;
      })() : ''}
      ${r && friendScores.length ? `<h3>友達との相性</h3><ol class="ranking">${friendScores.map((f) => `
        <li><a href="#/pair/${f.code}/${myCode}/${encodeURIComponent(f.name)}/${encodeURIComponent('わたし')}">${charaSVG(f.result.index, { size: 36 })}<span class="rl">${esc(f.name)}さん<small class="met">${esc(TYPES[f.result.index].label)}</small></span>
          <span class="rs"><i style="width:${f.c.score}%"></i></span><b>${f.c.score}%</b></a></li>`).join('')}</ol>` : ''}
      <h3>全タイプとの相性</h3>
      ${ranking.length ? `<ol class="ranking">${ranking.filter((x) => x.index !== base).map((x) => `
        <li><a href="${typePath(x.index)}">${charaSVG(x.index, { size: 36 })}<span class="rl">${esc(TYPES[x.index].label)}${met.has(x.index) ? `<small class="met">${esc(met.get(x.index))}さん</small>` : ''}</span>
          <span class="rs"><i style="width:${x.score}%"></i></span><b>${x.score}%</b></a></li>`).join('')}</ol>` : ''}
      ${r ? '<button class="btn type" data-invite>友達と相性をくらべる</button>' : ''}
    </section>`;
}

function scrollNav(root) {
  root.querySelectorAll('[data-scroll]').forEach((b) =>
    b.addEventListener('click', () => root.querySelector(`#${b.dataset.scroll}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })),
  );
}

// ---------- 結果ページ ----------
export async function viewResult(r, shareId) {
  const t = TYPES[r.index];
  const title = titleOf(r.purity);
  const stats = await loadStats();
  const rarity = rarityOf(r.index, stats);
  const ura = TYPES[r.ura.index];
  const text = shareText(r);
  const url = shareUrl(r.index, shareId);
  render(`
    ${brand()}
    <section class="result">
      ${isHidden(r.index) ? `<div class="secret">隠しタイプを引き当てた！（出現率 理論値 ${(priorDistribution()[r.index] * 100).toFixed(1)}%）</div>` : ''}
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
      <button class="btn type" data-card="story">画像を保存してストーリーズへ</button>
      ${shareLinks({ text, url, channelPrefix: '' }).html}
      ${inAppHint()}
      <button class="btn sub" data-invite>友達と相性をくらべる</button>
    </section>
    <div class="tiles">
      <div class="tile"><b>ポンコツ純度</b><strong>${r.purity}%</strong><small>${esc(title)}</small></div>
      <div class="tile"><b>レア度</b><strong>${rarity.pct.toFixed(1)}%</strong><small>${rarity.source === 'actual' ? '診断した人の中で' : '理論値'}</small></div>
      <a class="tile" href="${typePath(r.ura.index)}"><b>裏タイプ</b><strong class="small">${esc(ura.label)}</strong><small>もうひとつの顔</small></a>
    </div>
    ${typeSections(r.index, r)}
    ${premiumSection(r.index)}
    <section class="card"><h2>みんなで遊ぶ</h2>
      <p>クラスや部活、推し仲間のグループで診断すると、メンバーの役割（幹事役・癒し担当…）と、いちばん相性のいいペアがわかります。</p>
      <button class="btn sub" data-group>グループ診断をつくる</button>
    </section>
    <button class="btn" data-go="#/q">もう一回診断する</button>
    <button class="btn sub" data-go="#/zukan">図鑑をみる（全${TYPES.length}タイプ）</button>
    ${foot()}`, r.index);

  const ctx = { ...r, title, rarity, gold: hasPremium() };
  app.querySelectorAll('[data-card]').forEach((b) =>
    b.addEventListener('click', () => saveCard(b.dataset.card, ctx, `${text}\n${url}`)),
  );
  app.querySelectorAll('[data-invite]').forEach((b) => b.addEventListener('click', () => openInviteModal(r)));
  app.querySelector('[data-group]').addEventListener('click', openGroupCreate);
  scrollNav(app);
  mountPremium(app, r.index, { onGold: () => saveCard('story', { ...ctx, gold: true }, `${text}\n${url}`) });
}

async function saveCard(kind, ctx, text) {
  toast('画像をつくっています…');
  const canvas = kind === 'label' ? await drawLabelCard(ctx) : await drawStoryCard(ctx);
  track('share', kind === 'label' ? 'label-image' : ctx.gold ? 'gold-image' : 'image');
  await shareImageBlob(await canvasToBlob(canvas), {
    name: `ponkotsu-${typeNo(ctx.index)}-${kind}.png`,
    text,
    alt: `${TYPES[ctx.index].label}のシェア画像`,
  });
}

// ---------- タイプ詳細（シェアURLの着地点・図鑑から） ----------
export function viewType(index) {
  const t = TYPES[index];
  const mine = store.get('mine', null);
  const unlocked = !isHidden(index) || unlockedHidden().has(index) || document.body.dataset.type === typeNo(index).toLowerCase();
  if (!unlocked) {
    openModal(`<div class="locked-chara">${charaSVG(index, { size: 140 })}</div>
      <h2 class="sheet-title">${noLabel(index)}は、まだ秘密</h2>
      <p class="hint">診断で引き当てるか、このタイプの友達から相性のおさそいをもらうと図鑑にのります。</p>
      <button class="btn" data-close data-go="#/q">診断する</button>`);
    return false;
  }
  render(`
    ${brand()}
    <section class="result">
      <span class="no">${noLabel(index)}</span>
      <div class="chara-wrap">${charaSVG(index, { size: 240 })}</div>
      <h1 class="label">${esc(t.label)}</h1>
      <p class="catch-line">${esc(t.catch)}</p>
      <p class="praise">${esc(t.praise)}</p>
      <p class="roast"><span>${esc(t.roast)}</span></p>
      <button class="btn" data-go="#/q">${mine ? 'もう一回診断する' : 'あなたは何タイプ？診断する（無料）'}</button>
    </section>
    ${typeSections(index, null)}
    ${premiumSection(index)}
    <button class="btn sub" data-go="#/zukan">図鑑をみる</button>
    ${foot()}`, index);
  scrollNav(app);
  mountPremium(app, index);
  return true;
}

// 自分で引き当てた／友達経由で出会った隠しタイプ
export function unlockedHidden() {
  const set = new Set(store.get('gotHidden', []));
  friends().forEach((f) => isHidden(f.result.index) && set.add(f.result.index));
  return set;
}

// ---------- 図鑑 ----------
export function viewZukan() {
  const mine = store.get('mine', null);
  const fr = friends();
  const byType = new Map();
  fr.forEach((f) => {
    if (!byType.has(f.result.index)) byType.set(f.result.index, []);
    byType.get(f.result.index).push(f.name);
  });
  const got = unlockedHidden();
  const met = new Set([...byType.keys(), ...(mine ? [mine.index] : [])]);
  const cards = TYPES.map((t, i) => {
    const locked = isHidden(i) && !got.has(i);
    const isMine = mine && mine.index === i;
    const names = byType.get(i) || [];
    return `<a class="zcard ${isMine ? 'mine' : ''} ${locked ? 'locked' : ''} ${met.has(i) ? 'met' : ''}" href="${typePath(i)}">
      ${isMine ? '<span class="me">あなた</span>' : ''}
      ${charaSVG(i, { size: 150 })}
      <div class="n">${noLabel(i)}</div>
      <div class="l">${locked ? '？？？' : esc(t.label)}</div>
      ${names.length ? `<div class="friends-on">${names.slice(0, 3).map(esc).join('・')}${names.length > 3 ? ` ほか${names.length - 3}人` : ''}</div>` : ''}
    </a>`;
  }).join('');
  render(`
    ${brand()}
    <section class="zukan">
      <h1>ポンコツ図鑑</h1>
      <p class="hint" style="margin:0">全${BASE_COUNT}タイプ＋隠しタイプ${HIDDEN.length}つ。友達と相性をくらべると、そのタイプが図鑑に登録されます。</p>
      <div class="complete"><span>出会ったタイプ</span><b>${met.size} / ${TYPES.length}</b><i style="width:${(met.size / TYPES.length) * 100}%"></i></div>
      <div class="grid">${cards}</div>
    </section>
    ${mine ? '<button class="btn type" data-invite-mine style="margin-top:20px">友達を誘って図鑑をうめる</button>' : '<button class="btn" data-go="#/q" style="margin-top:20px">診断する</button>'}
    ${foot()}`);
  app.querySelector('[data-invite-mine]')?.addEventListener('click', () => {
    const r = decodeResult(mine.code);
    if (r) openInviteModal(r);
  });
}

