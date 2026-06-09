/**
 * HTML / CSS をミニファイし、dist/ に出力する
 * 使い方: npm run minify
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
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

const NETLIFY_ZIP_NAME = 'netlify-deploy.zip';
const NETLIFY_DIR_NAME = 'netlify-deploy';
const REQUIRED_NETLIFY_FILES = ['index.html', 'googlecca4ceb7f381e372.html', 'sitemap.xml'];

function syncNetlifyDeployFolder() {
  const deployDir = path.join(root, NETLIFY_DIR_NAME);
  if (fs.existsSync(deployDir)) {
    fs.rmSync(deployDir, { recursive: true, force: true });
  }
  copyDir(dist, deployDir);
  console.log('✓ ' + NETLIFY_DIR_NAME + '/ を dist/ と同期しました');
}

function verifyNetlifyZip() {
  const zipPath = path.join(root, NETLIFY_ZIP_NAME);
  const listing = execFileSync('unzip', ['-l', zipPath], { encoding: 'utf8' });
  const missing = REQUIRED_NETLIFY_FILES.filter((name) => {
    const pattern = new RegExp(`\\s${name.replace('.', '\\.')}$`, 'm');
    return !pattern.test(listing);
  });
  if (missing.length > 0) {
    throw new Error('ZIP に必要なファイルがありません: ' + missing.join(', '));
  }
  if (/\s(?:dist|netlify-deploy)\//m.test(listing)) {
    throw new Error('ZIP 内に dist/ や netlify-deploy/ フォルダが含まれています。ルート直下に index.html がある構成にしてください。');
  }
  console.log('✓ ' + NETLIFY_ZIP_NAME + ' の内容を確認しました（ルートに index.html と google 検証ファイルあり）');
}

function createNetlifyZip() {
  const zipPath = path.join(root, NETLIFY_ZIP_NAME);
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
  execFileSync('zip', ['-r', zipPath, '.'], { cwd: dist, stdio: 'inherit' });
  verifyNetlifyZip();
  console.log('\n✓ ' + NETLIFY_ZIP_NAME + ' を作成しました（プロジェクト直下）');
  console.log('  Netlify Drop には **' + NETLIFY_ZIP_NAME + ' だけ** を1つドロップしてください。');
  console.log('  ※ netlify-deploy/ フォルダをドロップしても同じ内容ですが、ZIP の方が確実です。');
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

  // JS（Instagram施工事例など）をコピー
  for (const name of ['instagram-posts.js', 'instagram-works.js']) {
    const src = path.join(root, name);
    if (fs.existsSync(src)) {
      copyFile(src, path.join(dist, name));
      console.log('✓ ' + name + ' をコピー → dist/');
    }
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

  // 旧 Netlify Drop 用の成果物（netlify-deploy/ と netlify-deploy.zip）。
  // zip コマンドが無いCI環境（Cloudflare Pages 等）では作成に失敗するが、
  // 公開には dist/ だけあればよいため、失敗してもビルド全体は止めない。
  try {
    syncNetlifyDeployFolder();
    createNetlifyZip();
    console.log('\n完了。dist/ は preview:dist 用。Netlify Drop を使う場合は ' + NETLIFY_ZIP_NAME + ' を1つドロップしてください。');
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    console.warn('⚠ Netlify Drop 用の成果物作成をスキップしました（CI環境では正常）: ' + msg);
    console.log('\n完了。dist/ を公開ディレクトリとして使用します（Cloudflare Pages 等）。');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
