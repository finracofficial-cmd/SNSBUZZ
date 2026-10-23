// site/ を dist/ にコピーし、タイプ別のシェア着地ページ dist/t/NN/index.html と sitemap を作る。
// /t/NN/ はXやLINEでURLを貼ったときにタイプ別のOGP画像を出すためのページ。
import fs from 'node:fs';
import path from 'node:path';
import { SITE } from '../site/assets/config.js';
import { TYPES, typeNo } from '../site/assets/data.js';

const src = path.resolve('site');
const dist = path.resolve('dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(src, dist, { recursive: true, filter: (f) => !path.basename(f).startsWith('_') });

const origin = SITE.origin.replace(/\/$/, '');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const template = fs.readFileSync(path.join(src, 'index.html'), 'utf8');

const meta = ({ title, description, image, url }) => `<!--META-->
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${image}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">
<!--/META-->`;
const replaceMeta = (html, m) => html.replace(/<!--META-->[\s\S]*?<!--\/META-->/, meta(m));

const topDescription = '12問・1分でわかる、あなたの“愛すべきポンコツ”タイプ。16タイプ＋隠しタイプ1つ。';
fs.writeFileSync(
  path.join(dist, 'index.html'),
  replaceMeta(template, {
    title: `${SITE.quizName}｜${SITE.name}`,
    description: topDescription,
    image: `${origin}/og/top.png`,
    url: `${origin}/`,
  }),
);

const urls = [`${origin}/`];
TYPES.forEach((t, i) => {
  const no = typeNo(i);
  const dir = path.join(dist, 't', no);
  fs.mkdirSync(dir, { recursive: true });
  const html = replaceMeta(template, {
    title: `${t.label}｜${SITE.quizName}`,
    description: `${t.roast} あなたは何タイプ？`,
    image: `${origin}/og/${no}.png`,
    url: `${origin}/t/${no}/`,
  })
    .replaceAll('"./assets/', '"../../assets/')
    .replace('<body data-type="">', `<body data-type="${no}">`);
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  if (i < 16) urls.push(`${origin}/t/${no}/`);
});

fs.writeFileSync(
  path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u}</loc></url>`)
    .join('\n')}\n</urlset>\n`,
);
// 隠しタイプのページは検索に出さない（引き当てる楽しみを残す）
fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nDisallow: /t/00/\nSitemap: ${origin}/sitemap.xml\n`);
fs.writeFileSync(
  path.join(dist, '_headers'),
  `/assets/*\n  Cache-Control: public, max-age=3600\n/og/*\n  Cache-Control: public, max-age=86400\n`,
);
console.log(`built ${TYPES.length} type pages into dist/`);
