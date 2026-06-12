/**
 * シングルページ化: FAQ 52件を index.html に統合し、faq/index.html をリダイレクトに差し替え
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const faqPath = path.join(root, 'faq', 'index.html');
const indexPath = path.join(root, 'index.html');
const buildBlogPath = path.join(root, 'scripts', 'build-blog.js');
const minifyPath = path.join(root, 'scripts', 'minify.js');

const faqHtml = fs.readFileSync(faqPath, 'utf8');
let indexHtml = fs.readFileSync(indexPath, 'utf8');

const jsonLdMatch = faqHtml.match(/<script type="application\/ld\+json">\s*(\{[\s\S]*?\})\s*<\/script>/);
if (!jsonLdMatch) throw new Error('FAQ JSON-LD not found');
const faqJsonLd = jsonLdMatch[1];

const faqLines = faqHtml.split('\n');
const startIdx = faqLines.findIndex((l) => l.includes('<div class="faq-list">'));
const endIdx = faqLines.findIndex((l, i) => i > startIdx && l.includes('トップページに戻る'));
if (startIdx === -1 || endIdx === -1) throw new Error('faq-list not found');
const faqList = faqLines
  .slice(startIdx + 1, endIdx - 1)
  .join('\n')
  .replace(/\.\.\/index\.html#contact/g, '#contact')
  .trim();

indexHtml = indexHtml.replace(
  /<div class="logo">\s*<img src="images\/logo\.png" alt="昇栄塗装" \/>\s*<\/div>/,
  '<div class="logo">\n        <a href="#home"><img src="images/logo.png" alt="昇栄塗装" /></a>\n      </div>'
);
indexHtml = indexHtml.replace(/<a href="faq\/index\.html">FAQ<\/a>/, '<a href="#faq">FAQ</a>');
indexHtml = indexHtml.replace(
  /<script type="application\/ld\+json">\s*\{\s*"@context": "https:\/\/schema\.org",\s*"@type": "FAQPage"[\s\S]*?<\/script>/,
  '<script type="application/ld+json">\n' + faqJsonLd + '\n  </script>'
);
indexHtml = indexHtml.replace(
  /<!-- よくある質問セクション -->[\s\S]*?<!-- お問い合わせセクション -->/,
  `<!-- よくある質問セクション -->
    <section id="faq" class="section">
      <div class="container">
        <div class="section-heading">
          <h2 class="section-title">よくある質問</h2>
          <p class="section-lead">
            外壁・屋根塗装やリフォームに関して、お客様からよくいただくご質問をカテゴリ別にまとめました。
          </p>
        </div>
        <div class="faq-list">
${faqList}
        </div>
      </div>
    </section>

    <!-- お問い合わせセクション -->`
);

fs.writeFileSync(indexPath, indexHtml);

fs.writeFileSync(
  faqPath,
  `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>よくある質問｜昇栄塗装</title>
  <meta http-equiv="refresh" content="0; url=../index.html#faq" />
  <link rel="canonical" href="https://shoei-toso-website.pages.dev/#faq" />
  <script>location.replace('../index.html#faq');</script>
</head>
<body>
  <p><a href="../index.html#faq">よくある質問ページへ移動しています…</a></p>
</body>
</html>
`
);

let buildBlog = fs.readFileSync(buildBlogPath, 'utf8');
buildBlog = buildBlog.replace(
  '<a href="index.html">ブログ</a>\n        <a href="../index.html#about">会社概要</a>\n        <a href="../faq/index.html">FAQ</a>',
  '<a href="../index.html#blog">ブログ</a>\n        <a href="../index.html#about">会社概要</a>\n        <a href="../index.html#faq">FAQ</a>'
);
buildBlog = buildBlog.replace(
  `  // ブログ一覧
  urls.push({ loc: \`\${SITE_URL}/blog/\`, lastmod: todayIso, changefreq: 'weekly', priority: '0.8' });
  // FAQ
  urls.push({ loc: \`\${SITE_URL}/faq/\`, lastmod: todayIso, changefreq: 'monthly', priority: '0.7' });
  // 各記事（拡張子なしURL）`,
  `  // ブログ一覧
  urls.push({ loc: \`\${SITE_URL}/blog/\`, lastmod: todayIso, changefreq: 'weekly', priority: '0.8' });
  // 各記事（拡張子なしURL）`
);
fs.writeFileSync(buildBlogPath, buildBlog);

let minify = fs.readFileSync(minifyPath, 'utf8');
minify = minify.replace(
  '  // FAQページ（faq/index.html）をミニファイ → dist/faq/',
  '  // FAQリダイレクト（faq/index.html → index.html#faq）をミニファイ → dist/faq/'
);
minify = minify.replace(
  "    console.log('✓ faq/index.html をミニファイ → dist/faq/');\n  } else {\n    console.warn('⚠ faq/index.html がありません。FAQページはスキップします。');\n  }",
  "    console.log('✓ faq/index.html（リダイレクト）をミニファイ → dist/faq/');\n  }"
);
fs.writeFileSync(minifyPath, minify);

const faqCount = (faqList.match(/<details class="faq-item">/g) || []).length;
const jsonCount = (faqJsonLd.match(/"@type": "Question"/g) || []).length;
console.log(`✓ index.html: FAQ ${faqCount}件、JSON-LD ${jsonCount}件`);
console.log('✓ faq/index.html → リダイレクト');
console.log('✓ build-blog.js / minify.js 更新');
