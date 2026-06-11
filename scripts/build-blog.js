/**
 * ブログのビルドスクリプト（microCMS + 静的HTML生成）
 *
 * 使い方:
 *   npm run build-blog
 *
 * やること:
 *   1. microCMS REST API から記事一覧を取得
 *      （環境変数 MICROCMS_SERVICE_DOMAIN / MICROCMS_API_KEY を使用）
 *   2. ブログ一覧ページ  blog/index.html を生成
 *   3. 各記事ページ      blog/<id>.html を静的HTMLとして生成（SEO対応）
 *   4. トップページ index.html の「最新ブログ」セクションを差し込み
 *      （<!-- BLOG_LATEST:START --> 〜 <!-- BLOG_LATEST:END --> の間を置換）
 *
 * 重要:
 *   - 環境変数が未設定でも、取得に失敗しても、ビルドは落ちません。
 *     その場合はローカルの blog-data.json をフォールバックに使い、
 *     それも無ければ「記事0件」として空の一覧を生成します。
 *
 * 想定する microCMS のスキーマ（API ID: blogs）:
 *   - title    : テキスト
 *   - content  : リッチエディタ（HTMLがそのまま入る）
 *   - category : セレクト（お知らせ / 施工事例 / コラム など）
 *   - eyecatch : 画像（任意）
 *   - 公開日   : microCMS 標準の publishedAt を使用
 */

const fs = require('fs');
const path = require('path');

// .env があれば読み込み（dotenv は任意。無くても動く）
try {
  require('dotenv').config();
} catch (_) {}

const root = path.join(__dirname, '..');
const blogDir = path.join(root, 'blog');
const distDir = path.join(root, 'dist');
const blogDataPath = path.join(root, 'blog-data.json');
const indexHtmlPath = path.join(root, 'index.html');

// サイトの公開URL（canonical / OGP 用）。Cloudflare Pages のドメインに合わせる。
const SITE_URL = (process.env.SITE_URL || 'https://shoei-toso-website.pages.dev').replace(/\/$/, '');
const SITE_NAME = '昇栄塗装';
const LATEST_COUNT = 3; // トップページに出す最新記事の件数

const SERVICE_DOMAIN = process.env.MICROCMS_SERVICE_DOMAIN;
const API_KEY = process.env.MICROCMS_API_KEY;
const API_ENDPOINT = 'blogs';

/* ----------------------------- ユーティリティ ----------------------------- */

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 本文(HTML)からプレーンテキストの抜粋を作る（meta description / 一覧の本文用）
function stripHtml(html) {
  return String(html == null ? '' : html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text, max) {
  const t = String(text || '');
  return t.length > max ? t.slice(0, max) + '…' : t;
}

// 日付の表示用文字列（YYYY年M月D日）と ISO 文字列を返す
function formatDate(value) {
  if (!value) return { display: '', iso: '' };

  // "YYYY.MM.DD" 形式（既存 blog-data.json 互換）
  const dotMatch = String(value).match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  let d;
  if (dotMatch) {
    d = new Date(Number(dotMatch[1]), Number(dotMatch[2]) - 1, Number(dotMatch[3]));
  } else {
    d = new Date(value);
  }
  if (isNaN(d.getTime())) {
    return { display: String(value), iso: '' };
  }
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    display: `${y}年${m}月${day}日`,
    iso: `${y}-${pad(m)}-${pad(day)}`,
  };
}

// microCMS の select は配列・文字列どちらの可能性もあるので吸収する
function normalizeCategory(category) {
  if (Array.isArray(category)) return category.filter(Boolean).join(' / ');
  if (typeof category === 'string') return category;
  if (category && typeof category === 'object' && category.name) return category.name;
  return '';
}

/* ----------------------------- 記事の取得 ----------------------------- */

// microCMS から記事を取得（失敗時は null を返す＝フォールバックへ）
async function fetchFromMicroCMS() {
  if (!SERVICE_DOMAIN || !API_KEY) {
    console.warn('⚠ MICROCMS_SERVICE_DOMAIN / MICROCMS_API_KEY が未設定です。フォールバックを使用します。');
    return null;
  }
  const url = `https://${SERVICE_DOMAIN}.microcms.io/api/v1/${API_ENDPOINT}?limit=100&orders=-publishedAt`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      headers: { 'X-MICROCMS-API-KEY': API_KEY },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`⚠ microCMS から取得できませんでした（HTTP ${res.status}）。フォールバックを使用します。`);
      return null;
    }
    const data = await res.json();
    const contents = Array.isArray(data.contents) ? data.contents : [];
    console.log(`✓ microCMS から ${contents.length} 件の記事を取得しました。`);
    return contents.map((item, i) => ({
      id: item.id || `post-${i + 1}`,
      title: item.title || '（タイトルなし）',
      contentHtml: item.content || '',
      category: normalizeCategory(item.category),
      eyecatchUrl: item.eyecatch && item.eyecatch.url ? item.eyecatch.url : '',
      eyecatchW: item.eyecatch && item.eyecatch.width ? item.eyecatch.width : '',
      eyecatchH: item.eyecatch && item.eyecatch.height ? item.eyecatch.height : '',
      date: item.publishedAt || item.createdAt || '',
    }));
  } catch (err) {
    console.warn('⚠ microCMS 取得中にエラーが発生しました。フォールバックを使用します。:', err.message || err);
    return null;
  }
}

// blog-data.json をフォールバックとして読み込む
function loadFallback() {
  if (!fs.existsSync(blogDataPath)) {
    console.warn('⚠ blog-data.json も見つかりません。記事0件として一覧を生成します。');
    return [];
  }
  try {
    const raw = fs.readFileSync(blogDataPath, 'utf8');
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    console.log(`✓ blog-data.json から ${arr.length} 件の記事を読み込みました（フォールバック）。`);
    return arr.map((item, i) => {
      // 本文: HTML(content) があればそれを、無ければ text を段落化
      let contentHtml = item.content || item.contentHtml || '';
      if (!contentHtml && item.text) {
        contentHtml = String(item.text)
          .split(/\n{2,}/)
          .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br />')}</p>`)
          .join('\n');
      }
      return {
        id: item.id || `local-${i + 1}`,
        title: item.title || '（タイトルなし）',
        contentHtml,
        category: normalizeCategory(item.category),
        eyecatchUrl: item.eyecatch && item.eyecatch.url ? item.eyecatch.url : item.eyecatchUrl || '',
        eyecatchW: '',
        eyecatchH: '',
        date: item.publishedAt || item.date || '',
      };
    });
  } catch (err) {
    console.warn('⚠ blog-data.json の読み込みに失敗しました。記事0件として扱います。:', err.message || err);
    return [];
  }
}

/* ----------------------------- HTML パーツ ----------------------------- */

// ブログ配下ページ共通のヘッダー（パスはトップから1つ下の階層基準）
function blogHeader() {
  return `  <header class="site-header">
    <div class="container header-inner">
      <div class="logo">
        <a href="../index.html"><img src="../images/logo.png" alt="昇栄塗装" /></a>
      </div>
      <nav class="nav">
        <a href="../index.html#home">ホーム</a>
        <a href="../index.html#service">サービス</a>
        <a href="../index.html#works">施工事例</a>
        <a href="index.html">ブログ</a>
        <a href="../index.html#about">会社概要</a>
        <a href="../index.html#faq">FAQ</a>
        <a href="../index.html#contact">お問い合わせ</a>
      </nav>
    </div>
  </header>`;
}

function blogFooter() {
  return `  <footer class="site-footer">
    <div class="container">
      <p>© 2026 昇栄塗装 All rights reserved. Since 2023.7</p>
    </div>
  </footer>`;
}

// 問い合わせ手段（電話 / LINE / フォーム）。CTAから参照する。
const CONTACT_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScdONJKAYkz8pzI9c9Z_BLGXxjnS9x1AO8wdSmXgufy1xrJrQ/viewform';
const CONTACT_TEL_DISPLAY = '070-9119-9440';
const CONTACT_TEL_HREF = 'tel:07091199440';
const CONTACT_LINE_URL = 'https://lin.ee/7khuq4Z';

// CTAボタン用アイコン（draft-site のSVGを流用）
const ICON_TEL =
  '<svg class="blog-cta-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
const ICON_LINE =
  '<svg class="blog-cta-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 5.69 2 10.23c0 4.07 3.55 7.48 8.35 8.13.32.07.77.21.88.49.1.25.06.65.03.9l-.14.85c-.04.25-.2.98.86.53s5.7-3.36 7.78-5.75h0c1.43-1.57 2.24-3.17 2.24-5.15C22 5.69 17.52 2 12 2ZM7.9 12.86H6.06a.49.49 0 0 1-.49-.48V8.7a.49.49 0 0 1 .98 0v3.19H7.9a.49.49 0 0 1 0 .97Zm1.92-.48a.49.49 0 0 1-.98 0V8.7a.49.49 0 0 1 .98 0v3.68Zm4.25 0a.49.49 0 0 1-.33.46h-.16a.48.48 0 0 1-.39-.2l-1.88-2.56v2.3a.49.49 0 0 1-.98 0V8.7a.49.49 0 0 1 .33-.46h.16c.15 0 .3.08.39.2l1.88 2.56V8.7a.49.49 0 0 1 .98 0v3.68Zm3.04-2.32a.49.49 0 0 1 0 .97h-1.35v.87h1.35a.49.49 0 0 1 0 .97h-1.84a.49.49 0 0 1-.49-.48V8.7a.49.49 0 0 1 .49-.48h1.84a.49.49 0 0 1 0 .97h-1.35v.87h1.35Z"/></svg>';
const ICON_FORM =
  '<svg class="blog-cta-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';

// 記事を読み終えた人向けの問い合わせCTA（記事末尾・一覧末尾で共通利用）
function blogCta() {
  return `        <aside class="blog-cta">
          <h2 class="blog-cta-title">外壁・屋根のことならお気軽にご相談ください</h2>
          <p class="blog-cta-lead">お見積り・ご相談は無料です。</p>
          <div class="blog-cta-actions">
            <a class="blog-cta-btn blog-cta-btn-tel" href="${CONTACT_TEL_HREF}">${ICON_TEL}<span>お電話する（${CONTACT_TEL_DISPLAY}）</span></a>
            <a class="blog-cta-btn blog-cta-btn-line" href="${CONTACT_LINE_URL}" target="_blank" rel="noopener noreferrer">${ICON_LINE}<span>LINEで相談</span></a>
            <a class="blog-cta-btn blog-cta-btn-form" href="${CONTACT_FORM_URL}" target="_blank" rel="noopener noreferrer">${ICON_FORM}<span>お問い合わせフォーム</span></a>
          </div>
        </aside>`;
}

// 一覧カード（トップページ用 / 一覧ページ用 共通）。base は記事へのパス接頭辞。
function articleCard(article, base) {
  const { display, iso } = formatDate(article.date);
  const excerpt = truncate(stripHtml(article.contentHtml), 80);
  const href = `${base}${encodeURIComponent(article.id)}.html`;
  const eyecatch = article.eyecatchUrl
    ? `      <div class="blog-card-img"><img src="${escapeHtml(article.eyecatchUrl)}" alt="${escapeHtml(article.title)}" loading="lazy" /></div>\n`
    : '';
  const category = article.category
    ? `<span class="blog-category">${escapeHtml(article.category)}</span>`
    : '';
  return `    <a class="blog-card" href="${escapeHtml(href)}">
${eyecatch}      <div class="blog-card-body">
        <div class="blog-meta">${category}<time datetime="${escapeHtml(iso)}">${escapeHtml(display)}</time></div>
        <h3 class="blog-card-title">${escapeHtml(article.title)}</h3>
        <p class="blog-card-excerpt">${escapeHtml(excerpt)}</p>
      </div>
    </a>`;
}

/* ----------------------------- ページ生成 ----------------------------- */

function buildListPage(articles) {
  const cards = articles.length
    ? `  <div class="blog-card-grid">\n${articles.map((a) => articleCard(a, '')).join('\n')}\n  </div>`
    : `  <p class="blog-empty">まだ記事がありません。最初の記事が公開されるとここに表示されます。</p>`;

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>ブログ・お知らせ | ${SITE_NAME}</title>
  <meta name="description" content="佐倉市の昇栄塗装のブログ・お知らせ一覧です。外壁・屋根塗装やリフォームに関する施工事例・コラム・最新情報をお届けします。" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="index, follow" />
  <link rel="icon" type="image/png" href="../images/logo.png" />
  <meta name="theme-color" content="#0070f3" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${SITE_URL}/blog/" />
  <meta property="og:title" content="ブログ・お知らせ | ${SITE_NAME}" />
  <meta property="og:description" content="佐倉市の昇栄塗装のブログ・お知らせ一覧。施工事例・コラム・最新情報をお届けします。" />
  <meta property="og:image" content="${SITE_URL}/images/og-image.png" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta property="og:locale" content="ja_JP" />
  <link rel="stylesheet" href="../style.css" />
  <link rel="canonical" href="${SITE_URL}/blog/" />
</head>
<body>
  <div class="site-fixed-bg" aria-hidden="true"></div>
${blogHeader()}

  <main>
    <section class="section">
      <div class="container">
        <div class="section-heading">
          <h2 class="section-title">ブログ・お知らせ</h2>
          <p class="section-lead">外壁・屋根塗装やリフォームに関する施工事例・コラム・最新情報をお届けします。</p>
        </div>
${cards}
${blogCta()}
        <p class="blog-more-actions">
          <a href="../index.html" class="btn-instagram-more">トップページに戻る</a>
        </p>
      </div>
    </section>
  </main>

${blogFooter()}
</body>
</html>
`;
  fs.writeFileSync(path.join(blogDir, 'index.html'), html, 'utf8');
  console.log('✓ blog/index.html を生成しました。');
}

function buildArticlePage(article) {
  const { display, iso } = formatDate(article.date);
  const descr = truncate(stripHtml(article.contentHtml), 110) || `${SITE_NAME}のブログ記事です。`;
  const pageUrl = `${SITE_URL}/blog/${encodeURIComponent(article.id)}.html`;
  const ogImage = article.eyecatchUrl || `${SITE_URL}/images/og-image.png`;
  const category = article.category
    ? `<span class="blog-category">${escapeHtml(article.category)}</span>`
    : '';
  const eyecatch = article.eyecatchUrl
    ? `        <div class="blog-detail-eyecatch"><img src="${escapeHtml(article.eyecatchUrl)}" alt="${escapeHtml(article.title)}" /></div>\n`
    : '';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: descr,
    image: ogImage,
    datePublished: iso || undefined,
    dateModified: iso || undefined,
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/images/logo.png` },
    },
  };
  if (article.category) jsonLd.articleSection = article.category;

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(article.title)} | ${SITE_NAME}</title>
  <meta name="description" content="${escapeHtml(descr)}" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="index, follow" />
  <link rel="icon" type="image/png" href="../images/logo.png" />
  <meta name="theme-color" content="#0070f3" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:title" content="${escapeHtml(article.title)} | ${SITE_NAME}" />
  <meta property="og:description" content="${escapeHtml(descr)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta property="og:locale" content="ja_JP" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(article.title)} | ${SITE_NAME}" />
  <meta name="twitter:description" content="${escapeHtml(descr)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>
  <link rel="stylesheet" href="../style.css" />
  <link rel="canonical" href="${pageUrl}" />
</head>
<body>
  <div class="site-fixed-bg" aria-hidden="true"></div>
${blogHeader()}

  <main>
    <section class="section">
      <div class="container">
        <article class="blog-detail-item">
          <div class="blog-meta">${category}<time datetime="${escapeHtml(iso)}">${escapeHtml(display)}</time></div>
          <h1 class="blog-detail-title">${escapeHtml(article.title)}</h1>
${eyecatch}          <div class="blog-detail-text">
${article.contentHtml || '<p>本文がありません。</p>'}
          </div>
        </article>
${blogCta()}
        <p class="blog-more-actions">
          <a href="index.html" class="btn-instagram-more">ブログ一覧に戻る</a>
        </p>
      </div>
    </section>
  </main>

${blogFooter()}
</body>
</html>
`;
  fs.writeFileSync(path.join(blogDir, `${article.id}.html`), html, 'utf8');
}

// トップページの <!-- BLOG_LATEST:START --> 〜 END の間を最新記事カードで差し替え
function injectHomepage(articles) {
  if (!fs.existsSync(indexHtmlPath)) {
    console.warn('⚠ index.html が見つかりません。トップページへの差し込みをスキップします。');
    return;
  }
  const startMark = '<!-- BLOG_LATEST:START -->';
  const endMark = '<!-- BLOG_LATEST:END -->';
  let html = fs.readFileSync(indexHtmlPath, 'utf8');

  if (!html.includes(startMark) || !html.includes(endMark)) {
    console.warn('⚠ index.html にブログ差し込み用のマーカーがありません。スキップします。');
    return;
  }

  const latest = articles.slice(0, LATEST_COUNT);
  const inner = latest.length
    ? latest.map((a) => articleCard(a, 'blog/')).join('\n')
    : '    <p class="blog-empty">まだ記事がありません。最初の記事が公開されるとここに表示されます。</p>';

  const pattern = new RegExp(
    `${startMark}[\\s\\S]*?${endMark}`,
  );
  html = html.replace(pattern, `${startMark}\n${inner}\n          ${endMark}`);
  fs.writeFileSync(indexHtmlPath, html, 'utf8');
  console.log(`✓ index.html に最新記事 ${latest.length} 件を差し込みました。`);
}

// 過去ビルドで生成した blog/*.html を一度クリア（一覧 index.html は作り直す）
function cleanBlogDir() {
  ensureDir(blogDir);
  for (const name of fs.readdirSync(blogDir)) {
    if (name.endsWith('.html')) {
      fs.unlinkSync(path.join(blogDir, name));
    }
  }
}

/* ----------------------------- サイトマップ生成 ----------------------------- */

// サイトマップ(XML)を生成して dist/sitemap.xml に書き出す。
//
// 設計方針:
//   - 記事URLは Cloudflare Pages の URL 正規化に合わせ、拡張子 .html を付けない
//     （トップ "/"、一覧 "/blog/"、各記事 "/blog/<id>"）。
//   - 生成物は「ビルド成果物」として dist/ に直接書き出す。
//     リポジトリ直下の sitemap.xml（トップのみの最小版）はそのまま残し、
//     ローカルのフォールバック記事URLで git 差分が出てノイズになるのを防ぐ。
//   - minify.js は dist/sitemap.xml が既にあれば上書きしないため、
//     本番ビルド（npm run build = build-blog → minify）では必ず
//     ここで生成した「トップ＋一覧＋全記事」を含む sitemap が公開される。
function buildSitemap(articles) {
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const urls = [];

  // トップページ
  urls.push({ loc: `${SITE_URL}/`, lastmod: todayIso, changefreq: 'monthly', priority: '1.0' });
  // ブログ一覧
  urls.push({ loc: `${SITE_URL}/blog/`, lastmod: todayIso, changefreq: 'weekly', priority: '0.8' });
  // 各記事（拡張子なしURL）
  for (const article of articles) {
    const { iso } = formatDate(article.date);
    urls.push({
      loc: `${SITE_URL}/blog/${encodeURIComponent(article.id)}`,
      lastmod: iso || todayIso,
      changefreq: 'monthly',
      priority: '0.6',
    });
  }

  const body = urls
    .map((u) => {
      const parts = [`    <loc>${escapeHtml(u.loc)}</loc>`];
      if (u.lastmod) parts.push(`    <lastmod>${u.lastmod}</lastmod>`);
      if (u.changefreq) parts.push(`    <changefreq>${u.changefreq}</changefreq>`);
      if (u.priority) parts.push(`    <priority>${u.priority}</priority>`);
      return `  <url>\n${parts.join('\n')}\n  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

  ensureDir(distDir);
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), xml, 'utf8');
  console.log(`✓ dist/sitemap.xml を生成しました（トップ + 一覧 + 記事 ${articles.length} 件 = 計 ${urls.length} URL）。`);
}

/* ----------------------------- メイン ----------------------------- */

async function run() {
  let articles = await fetchFromMicroCMS();
  if (articles == null) {
    articles = loadFallback();
  }

  cleanBlogDir();
  buildListPage(articles);
  for (const article of articles) {
    buildArticlePage(article);
  }
  if (articles.length) {
    console.log(`✓ blog/<id>.html を ${articles.length} 件生成しました。`);
  }
  injectHomepage(articles);
  buildSitemap(articles);

  console.log(`\n完了。記事 ${articles.length} 件でブログを生成しました。`);
}

run().catch((err) => {
  // ここに来てもビルド全体は失敗させない（記事0件の一覧だけは残す）
  console.error('ブログ生成中に想定外のエラーが発生しましたが、処理を継続します:', err);
  try {
    ensureDir(blogDir);
    buildListPage([]);
    injectHomepage([]);
    buildSitemap([]);
  } catch (_) {}
});
