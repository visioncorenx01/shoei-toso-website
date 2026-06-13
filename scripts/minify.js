/**
 * HTML / CSS をミニファイし、dist/ に出力する
 * 使い方: npm run minify
 */
const fs = require('fs');
const path = require('path');
const { minify: minifyHtml } = require('html-minifier-terser');
const CleanCSS = require('clean-css');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

const htmlOptions = {
  collapseWhitespace: true,
  removeComments: true,
  minifyCSS: true,
  minifyJS: true,
  removeOptionalTags: false,
  keepClosingSlash: true,
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  ensureDir(destDir);
  for (const name of fs.readdirSync(srcDir)) {
    const srcPath = path.join(srcDir, name);
    const destPath = path.join(destDir, name);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function run() {
  ensureDir(dist);

  // HTML ミニファイ
  for (const name of ['index.html']) {
    const htmlPath = path.join(root, name);
    if (fs.existsSync(htmlPath)) {
      const html = fs.readFileSync(htmlPath, 'utf8');
      const htmlMin = await minifyHtml(html, htmlOptions);
      fs.writeFileSync(path.join(dist, name), htmlMin, 'utf8');
      console.log('✓ ' + name + ' をミニファイ → dist/');
    }
  }

  // ブログHTML（blog/index.html, blog/<id>.html）をミニファイ → dist/blog/
  const blogSrc = path.join(root, 'blog');
  if (fs.existsSync(blogSrc)) {
    const blogDest = path.join(dist, 'blog');
    ensureDir(blogDest);
    let blogCount = 0;
    for (const name of fs.readdirSync(blogSrc)) {
      if (!name.endsWith('.html')) continue;
      const srcPath = path.join(blogSrc, name);
      const html = fs.readFileSync(srcPath, 'utf8');
      const htmlMin = await minifyHtml(html, htmlOptions);
      fs.writeFileSync(path.join(blogDest, name), htmlMin, 'utf8');
      blogCount++;
    }
    console.log('✓ blog/*.html を ' + blogCount + ' 件ミニファイ → dist/blog/');
  } else {
    console.warn('⚠ blog/ がありません。先に npm run build-blog を実行してください（ブログはスキップ）。');
  }

  // FAQページ（faq/index.html）をミニファイ → dist/faq/
  const faqPath = path.join(root, 'faq', 'index.html');
  if (fs.existsSync(faqPath)) {
    const faqHtml = fs.readFileSync(faqPath, 'utf8');
    const faqMin = await minifyHtml(faqHtml, htmlOptions);
    ensureDir(path.join(dist, 'faq'));
    fs.writeFileSync(path.join(dist, 'faq', 'index.html'), faqMin, 'utf8');
    console.log('✓ faq/index.html をミニファイ → dist/faq/');
  } else {
    console.warn('⚠ faq/index.html がありません。FAQページはスキップします。');
  }

  // CSS ミニファイ（style.css が無い場合はスキップ）
  const cssPath = path.join(root, 'style.css');
  if (fs.existsSync(cssPath)) {
    const css = fs.readFileSync(cssPath, 'utf8');
    const cssMin = new CleanCSS({}).minify(css).styles;
    fs.writeFileSync(path.join(dist, 'style.css'), cssMin, 'utf8');
    console.log('✓ style.css をミニファイ → dist/style.css');
  } else {
    console.warn('⚠ style.css がありません。CSS はスキップします。');
  }

  // JS（サービススライダー・Instagram施工事例・チャットボットなど）をコピー
  for (const name of ['script.js', 'instagram-posts.js', 'instagram-works.js']) {
    const src = path.join(root, name);
    if (fs.existsSync(src)) {
      copyFile(src, path.join(dist, name));
      console.log('✓ ' + name + ' をコピー → dist/');
    }
  }

  const chatbotSrc = path.join(root, 'chatbot');
  if (fs.existsSync(chatbotSrc)) {
    copyDir(chatbotSrc, path.join(dist, 'chatbot'));
    console.log('✓ chatbot/ をコピー → dist/chatbot/');
  }

  // その他ファイルをコピー（ブログ・SEO用）
  const copyList = ['sitemap.xml', 'robots.txt', 'googlecca4ceb7f381e372.html'];
  for (const file of copyList) {
    // sitemap.xml は build-blog.js が dist/ に「トップ + 一覧 + 全記事」を含む
    // 完全版を生成しているため、それがあればルートの最小版で上書きしない。
    if (file === 'sitemap.xml' && fs.existsSync(path.join(dist, file))) {
      console.log('✓ sitemap.xml は build-blog 生成版（全URL）を使用 → dist/');
      continue;
    }
    const src = path.join(root, file);
    if (fs.existsSync(src)) {
      copyFile(src, path.join(dist, file));
      console.log('✓ ' + file + ' をコピー → dist/');
    } else {
      console.warn('⚠ ' + file + ' がプロジェクトにありません。スキップします。');
    }
  }

  // images フォルダをコピー
  const imagesSrc = path.join(root, 'images');
  if (fs.existsSync(imagesSrc)) {
    copyDir(imagesSrc, path.join(dist, 'images'));
    console.log('✓ images/ をコピー → dist/images/');
  }

  console.log('\n完了。dist/ を公開ディレクトリとして使用します。');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
