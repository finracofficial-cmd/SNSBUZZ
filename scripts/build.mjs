// site/ を dist/ にコピーし、URLを貼ったときにOGP画像が出るよう静的な着地ページを作る。
//   /t/NN/  タイプ別ページ（結果のシェアURL）
//   /i/NN/  相性診断のおさそい（送った人のタイプのOGP）
//   /k/NN/  わたしクイズ（出題者のタイプのOGP）
//   /p/     ふたりの相性
//   /g/     グループ診断
//   /thanks/ 完全版の購入後に戻ってくるページ
//   /types/ 全タイプ一覧（検索エンジン向けの入口）
// タイプページ・一覧・トップには、中身を静的なHTMLとして書き出す（scripts/prerender.mjs）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { build as esbuild, transform } from 'esbuild';
import { SITE } from '../site/assets/config.js';
import { TYPES, BASE_COUNT, typeNo } from '../site/assets/data.js';
import { typeBody, typesBody, homeBody, loadingBody, breadcrumbLd } from './prerender.mjs';

const src = path.resolve('site');
const dist = path.resolve('dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(src, dist, { recursive: true, filter: (f) => !path.basename(f).startsWith('_') });

const origin = SITE.origin.replace(/\/$/, '');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const template = fs.readFileSync(path.join(src, 'index.html'), 'utf8');

const meta = ({ title, description, image, url, noindex, ld }) => `<!--META-->
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">${ld ? `\n<script type="application/ld+json">${ld}</script>` : ''}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${image}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">${noindex ? '\n<meta name="robots" content="noindex">' : ''}
<!--/META-->`;

function page(dir, m, { type = '', kind = '', body = '' } = {}) {
  const depth = dir ? dir.split('/').length : 0;
  const html = template
    .replace(/<!--META-->[\s\S]*?<!--\/META-->/, meta(m))
    .replaceAll('"./assets/', `"${'../'.repeat(depth) || './'}assets/`)
    .replace('<body data-type="" data-page="">', `<body data-type="${type}" data-page="${kind}">`)
    .replace('<main id="app" aria-live="polite"></main>', `<main id="app" aria-live="polite">${body}</main>`);
  fs.mkdirSync(path.join(dist, dir), { recursive: true });
  fs.writeFileSync(path.join(dist, dir, 'index.html'), html);
}

const topDescription = '12問・約1分でわかる、あなたの“愛すべきポンコツ”タイプ。16タイプ＋隠し4タイプ。くわしい診断で二つ名と恋愛タイプも。';
page('', { title: `${SITE.quizName}｜${SITE.name}`, description: topDescription, image: `${origin}/og/top.png`, url: `${origin}/` }, { body: homeBody() });
page('types', {
  title: `全${BASE_COUNT}タイプ一覧｜${SITE.quizName}`,
  description: `${SITE.quizName}の全${BASE_COUNT}タイプ。性格・恋愛・友達・学校・トリセツまで、タイプごとに解説しています。`,
  image: `${origin}/og/top.png`,
  url: `${origin}/types/`,
  ld: breadcrumbLd(origin, [[SITE.name, '/'], ['全タイプ一覧', '/types/']]),
}, { kind: 'types', body: typesBody() });

const urls = [`${origin}/`, `${origin}/types/`];
TYPES.forEach((t, i) => {
  const no = typeNo(i).toLowerCase();
  const hidden = i >= BASE_COUNT;
  page(`t/${no}`, {
    title: `${t.label}｜${SITE.quizName}`,
    description: `${t.praise}${t.roast} あなたは何タイプ？`,
    image: `${origin}/og/${no}.png`,
    url: `${origin}/t/${no}/`,
    // 隠しタイプは検索に出さず、中身も書き出さない
    noindex: hidden,
    ld: hidden ? '' : breadcrumbLd(origin, [[SITE.name, '/'], ['全タイプ一覧', '/types/'], [t.label, `/t/${no}/`]]),
  }, { type: no, body: hidden ? '' : typeBody(i) });
  page(`i/${no}`, {
    title: `相性診断のおさそい｜${SITE.quizName}`,
    description: `「${t.label}」の友達から、ふたりの相性診断が届いています。12問に答えると相性がわかります。`,
    image: `${origin}/og/${no}.png`,
    url: `${origin}/i/${no}/`,
    noindex: true,
  }, { kind: 'invite', body: homeBody() });
  page(`k/${no}`, {
    title: `わたしクイズ｜${SITE.quizName}`,
    description: `「${t.label}」の友達から、わたしクイズが届いています。友達の答えを当てて、理解度をチェックしよう。`,
    image: `${origin}/og/${no}.png`,
    url: `${origin}/k/${no}/`,
    noindex: true,
  }, { kind: 'quiz', body: loadingBody('わたしクイズを読みこみ中…') });
  if (i < BASE_COUNT) urls.push(`${origin}/t/${no}/`);
});
page('p', { title: `ふたりの相性｜${SITE.quizName}`, description: 'ふたりの相性は何%？ あなたも診断して、友達との相性をくらべよう。', image: `${origin}/og/pair.png`, url: `${origin}/p/`, noindex: true }, { kind: 'pair', body: loadingBody('ふたりの相性を読みこみ中…') });
page('g', { title: `グループ診断｜${SITE.quizName}`, description: 'みんなのポンコツタイプと、グループ内の役割が1ページにまとまります。', image: `${origin}/og/group.png`, url: `${origin}/g/`, noindex: true }, { kind: 'group', body: loadingBody('グループを読みこみ中…') });
page('thanks', { title: `ご購入ありがとうございます｜${SITE.quizName}`, description: topDescription, image: `${origin}/og/top.png`, url: `${origin}/thanks/`, noindex: true }, { kind: 'thanks', body: loadingBody('お支払いを確かめています…') });

fs.writeFileSync(
  path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u}</loc></url>`)
    .join('\n')}\n</urlset>\n`,
);
// 隠しタイプのページは検索に出さない（引き当てる楽しみを残す）
const hiddenPaths = TYPES.map((_, i) => i).filter((i) => i >= BASE_COUNT).map((i) => `Disallow: /t/${typeNo(i).toLowerCase()}/`);
fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\n${hiddenPaths.join('\n')}\nDisallow: /i/\nDisallow: /k/\nDisallow: /p/\nDisallow: /g/\nDisallow: /thanks/\nSitemap: ${origin}/sitemap.xml\n`);
// Cloudflare Pages のヘッダ。
//   ・JS/CSS は名前に中身のハッシュが入っているので、1年キャッシュしてよい
//   ・/thanks/ は決済のIDがURLに入るので、ほかのサイトにURLを送らず、キャッシュもしない
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data: blob:",
  "connect-src 'self' data: blob:",
  "media-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
// ---------- JS と CSS を1つずつにまとめて小さくし、中身のハッシュを名前に入れる ----------
// （ハッシュが変わればURLも変わるので、ブラウザに長くキャッシュさせても新旧が混ざらない）
const assets = path.join(dist, 'assets');
const hashOf = (text) => crypto.createHash('sha256').update(text).digest('hex').slice(0, 10);
const bundled = await esbuild({
  entryPoints: [path.join(assets, 'app.js')],
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2020', 'safari14', 'chrome90'],
  legalComments: 'none',
  // 日本語を \uXXXX にしない（そのままのほうがずっと小さい）
  charset: 'utf8',
  write: false,
});
const appCode = bundled.outputFiles[0].text;
const cssCode = (await transform(fs.readFileSync(path.join(assets, 'style.css'), 'utf8'), { loader: 'css', minify: true, charset: 'utf8' })).code;
const appName = `app.${hashOf(appCode)}.js`;
for (const f of fs.readdirSync(assets)) fs.rmSync(path.join(assets, f));
fs.writeFileSync(path.join(assets, appName), appCode);
(function rewrite(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) rewrite(full);
    else if (f.name.endsWith('.html')) {
      // CSS は小さい（gzip で数KB）ので、別ファイルにせず HTML に入れて、読みこみの往復を1回へらす
      const html = fs.readFileSync(full, 'utf8')
        .replaceAll('assets/app.js"', `assets/${appName}"`)
        .replace(/<link rel="stylesheet" href="[./]*assets\/style\.css">/, () => `<style>${cssCode}</style>`);
      fs.writeFileSync(full, html);
    }
  }
})(dist);

fs.writeFileSync(
  path.join(dist, '_headers'),
  [
    '/*',
    `  Content-Security-Policy: ${CSP}`,
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '/og/*',
    '  Cache-Control: public, max-age=86400',
    '/thanks/*',
    '  Cache-Control: no-store',
    '  Referrer-Policy: no-referrer',
    '',
  ].join('\n'),
);

// 本番のドメインを入れたのに、特定商取引法の表記が仮のままならビルドを止める（その状態で販売を始めないため）
const placeholder = Object.values(SITE.seller).some((v) => /^（/.test(v));
if (!SITE.origin.includes('example.com') && placeholder) {
  console.error('site/assets/config.js の seller（特定商取引法の表記）が仮のままです。埋めてからビルドしてください。');
  process.exit(1);
}
if (placeholder) console.warn('注意: config.js の seller（特定商取引法の表記）が仮のままです。埋めるまで、本番の環境変数 SELLER_READY=1 は入れないでください（入れるまで販売は始まりません）。');
console.log(`built ${TYPES.length} type pages + types/invite/quiz/pair/group/thanks pages into dist/ (${appName} ${Math.round(Buffer.byteLength(appCode) / 1024)}KB, CSS ${Math.round(Buffer.byteLength(cssCode) / 1024)}KB inlined)`);
