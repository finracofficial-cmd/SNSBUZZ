// site/ を dist/ にコピーし、URLを貼ったときにOGP画像が出るよう静的な着地ページを作る。
//   /t/NN/  タイプ別ページ（結果のシェアURL）
//   /i/NN/  相性診断のおさそい（送った人のタイプのOGP）
//   /k/NN/  わたしクイズ（出題者のタイプのOGP）
//   /p/     ふたりの相性
//   /g/     グループ診断
//   /thanks/ 完全版の購入後に戻ってくるページ
import fs from 'node:fs';
import path from 'node:path';
import { SITE } from '../site/assets/config.js';
import { TYPES, BASE_COUNT, typeNo } from '../site/assets/data.js';

const src = path.resolve('site');
const dist = path.resolve('dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(src, dist, { recursive: true, filter: (f) => !path.basename(f).startsWith('_') });

const origin = SITE.origin.replace(/\/$/, '');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const template = fs.readFileSync(path.join(src, 'index.html'), 'utf8');

const meta = ({ title, description, image, url, noindex }) => `<!--META-->
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${image}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">${noindex ? '\n<meta name="robots" content="noindex">' : ''}
<!--/META-->`;

function page(dir, m, { type = '', kind = '' } = {}) {
  const depth = dir ? dir.split('/').length : 0;
  const html = template
    .replace(/<!--META-->[\s\S]*?<!--\/META-->/, meta(m))
    .replaceAll('"./assets/', `"${'../'.repeat(depth) || './'}assets/`)
    .replace('<body data-type="" data-page="">', `<body data-type="${type}" data-page="${kind}">`);
  fs.mkdirSync(path.join(dist, dir), { recursive: true });
  fs.writeFileSync(path.join(dist, dir, 'index.html'), html);
}

const topDescription = '12問・約1分でわかる、あなたの“愛すべきポンコツ”タイプ。16タイプ＋隠し4タイプ。くわしい診断で二つ名と恋愛タイプも。';
page('', { title: `${SITE.quizName}｜${SITE.name}`, description: topDescription, image: `${origin}/og/top.png`, url: `${origin}/` });

const urls = [`${origin}/`];
TYPES.forEach((t, i) => {
  const no = typeNo(i).toLowerCase();
  page(`t/${no}`, {
    title: `${t.label}｜${SITE.quizName}`,
    description: `${t.roast} あなたは何タイプ？`,
    image: `${origin}/og/${no}.png`,
    url: `${origin}/t/${no}/`,
  }, { type: no });
  page(`i/${no}`, {
    title: `相性診断のおさそい｜${SITE.quizName}`,
    description: `「${t.label}」の友達から、ふたりの相性診断が届いています。12問に答えると相性がわかります。`,
    image: `${origin}/og/${no}.png`,
    url: `${origin}/i/${no}/`,
    noindex: true,
  }, { kind: 'invite' });
  page(`k/${no}`, {
    title: `わたしクイズ｜${SITE.quizName}`,
    description: `「${t.label}」の友達から、わたしクイズが届いています。友達の答えを当てて、理解度をチェックしよう。`,
    image: `${origin}/og/${no}.png`,
    url: `${origin}/k/${no}/`,
    noindex: true,
  }, { kind: 'quiz' });
  if (i < BASE_COUNT) urls.push(`${origin}/t/${no}/`);
});
page('p', { title: `ふたりの相性｜${SITE.quizName}`, description: 'ふたりの相性は何％？ あなたも診断して、友達との相性をくらべよう。', image: `${origin}/og/pair.png`, url: `${origin}/p/`, noindex: true }, { kind: 'pair' });
page('g', { title: `グループ診断｜${SITE.quizName}`, description: 'みんなのポンコツタイプと、グループ内の役割が1ページにまとまります。', image: `${origin}/og/group.png`, url: `${origin}/g/`, noindex: true }, { kind: 'group' });
page('thanks', { title: `ご購入ありがとうございます｜${SITE.quizName}`, description: topDescription, image: `${origin}/og/top.png`, url: `${origin}/thanks/`, noindex: true }, { kind: 'thanks' });

fs.writeFileSync(
  path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u}</loc></url>`)
    .join('\n')}\n</urlset>\n`,
);
// 隠しタイプのページは検索に出さない（引き当てる楽しみを残す）
const hiddenPaths = TYPES.map((_, i) => i).filter((i) => i >= BASE_COUNT).map((i) => `Disallow: /t/${typeNo(i).toLowerCase()}/`);
fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\n${hiddenPaths.join('\n')}\nDisallow: /i/\nDisallow: /k/\nDisallow: /p/\nDisallow: /g/\nDisallow: /thanks/\nSitemap: ${origin}/sitemap.xml\n`);
fs.writeFileSync(
  path.join(dist, '_headers'),
  `/assets/*\n  Cache-Control: public, max-age=3600\n/og/*\n  Cache-Control: public, max-age=86400\n`,
);
console.log(`built ${TYPES.length} type pages + invite/quiz/pair/group/thanks pages into dist/`);
