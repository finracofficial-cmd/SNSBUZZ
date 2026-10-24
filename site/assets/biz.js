// 法人・学校の方へ（#/biz）。タイアップ・オリジナル診断の制作・キャラクターのライセンス・広告掲載の窓口。
// 価格は「目安」。問い合わせ先は config.js の links.bizContact（メールアドレスか、フォームのURL）。空なら「準備中」と出す。
// 10代が多いサイトなので、受けない案件と、守ること（PR表記・個人情報を渡さない）を先に書いておく
import { SITE } from './config.js';
import { TYPES } from './data.js';
import { esc, render, brand, foot, loadStats, navNow } from './ui.js';
import { charaSVG } from './chara.js';

export const BIZ_MENU = [
  ['タイアップ企画', '「タイプ別のおすすめ」「このタイプが好きそうな◯◯」を、PR表記つきで結果ページ・図鑑に載せます。シェア画像に入れる企画もご相談ください。', '30万円〜'],
  ['オリジナル診断の制作', '商品・イベント・学校・自治体向けに、同じしくみ（10〜20問・シェア画像・相性・グループ診断つき）で専用の診断を作ります。', '80万円〜'],
  ['キャラクターのライセンス', `${TYPES.length}タイプのキャラクターを、グッズ・コラボカフェ・ノベルティ・LINEスタンプなどに使えます。`, 'ご相談（売上に応じた料率など）'],
  ['広告掲載（純広告）', 'トップ・結果ページ・図鑑の枠に、期間を決めて掲載します。年齢に合わない商材はお断りしています。', '月10万円〜'],
];
const NG = [
  'お酒・たばこ・ギャンブル・出会い系・美容医療・投資や副業の勧誘など、10代に向かない商材',
  'PR表記をしない宣伝（ステルスマーケティング）',
  '診断の結果や回答を、宣伝の対象選びに使うこと（このサイトは個人情報を集めていないので、お渡しできるものもありません）',
];

const contactHref = (c) => (/^https?:\/\//.test(c) ? c : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c) ? `mailto:${c}?subject=${encodeURIComponent(`【${SITE.name}】お問い合わせ`)}` : '');

// 実数は十分にたまってから、上2けたで切り捨てて出す（app.js の proofText と同じ考え方）
const floor2 = (n) => {
  const unit = 10 ** Math.max(String(Math.floor(n)).length - 2, 0);
  return (Math.floor(n / unit) * unit).toLocaleString('ja-JP');
};

export async function viewBiz() {
  const gen = navNow();
  const stats = await loadStats();
  if (gen !== navNow()) return;
  const href = contactHref(SITE.links?.bizContact || '');
  const facts = [
    stats?.total >= 10000 ? `これまでの診断 ${floor2(stats.total)}回${stats.since ? `（${stats.since.replace(/-/g, '/')}から）` : ''}` : '',
    `${TYPES.length}タイプのキャラクター・シェア画像・相性・グループ診断・今週のお題`,
    '登録不要。回答や個人を特定する情報は集めていません',
  ].filter(Boolean);
  render(`
    ${brand()}
    <section class="card biz">
      <h1 class="sheet-title">法人・学校の方へ</h1>
      <div class="parade" aria-hidden="true">${[3, 6, 12, 10].map((i) => charaSVG(i, { size: 72 })).join('')}</div>
      <p>${esc(SITE.quizName)}（${esc(SITE.name)}）は、“愛すべきポンコツ”を笑って分かちあうエンタメ診断です。結果の画像や相性を、友達どうしでシェアして遊ばれています。</p>
      <ul class="biz-facts">${facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
    </section>
    <section class="card"><h2>ご依頼いただけること</h2>
      <dl class="biz-menu">${BIZ_MENU.map(([name, text, price]) => `<dt>${esc(name)}<span>${esc(price)}</span></dt><dd>${esc(text)}</dd>`).join('')}</dl>
      <p class="hint">価格は税別の目安です。内容・期間・規模によって変わります。</p>
    </section>
    <section class="card"><h2>学校・塾・部活での利用</h2>
      <p>授業・クラス替えのアイスブレイク・部活の自己紹介などで使うのは無料です。申請はいりません。印刷して配るときは、シール帳用のシール（結果ページから作れます）が便利です。</p>
    </section>
    <section class="card"><h2>お受けしていないこと</h2>
      <ul class="biz-ng">${NG.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    </section>
    <section class="card"><h2>お問い合わせ</h2>
      ${href
        ? `<p>会社名・ご担当者名・ご希望の内容と時期を書いてお送りください。</p><a class="btn" href="${esc(href)}" ${href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''} data-out="biz">問い合わせる</a>`
        : '<p class="hint">窓口を準備中です。</p>'}
    </section>
    ${foot()}`);
}
