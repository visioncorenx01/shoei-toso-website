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
 *   - microCMS 取得に成功した場合も blog/blog-data.json は常に読み込み、
 *     次のルールでマージします（本番 Cloudflare Pages でもフォールバックが活きる）:
 *       1) 同一 id → microCMS を優先（フォールバックは無視）
 *       2) フォールバック id が microCMS に無く、タイトルが一致 → microCMS 本文で
 *          フォールバック id の HTML を追加生成（canonical は microCMS 側 id）
 *       3) 上記以外 → microCMS に無いフォールバック記事を一覧・サイトマップに追加
 *          （`"publishFallback": true` を付けた記事のみ。未指定はローカル開発用）
 *     microCMS 未設定 / 取得失敗時はフォールバックのみ使用します。
 *
 * 想定する microCMS のスキーマ（API ID: blogs）:
 *   - title               : テキスト
 *   - content             : リッチエディタ（HTMLがそのまま入る）
 *   - category            : セレクト（お知らせ / 施工事例 / コラム など）
 *   - eyecatch            : 画像（任意）
 *   - affiliateHtml       : リッチエディタ（任意）— A8.net のバナー・リンク HTML
 *   - showAffiliateNotice : 真偽値（任意）— PR 表記を表示するか
 *   - 公開日              : microCMS 標準の publishedAt を使用
 *
 * ── microCMS 側の設定手順（A8.net アフィリエイト） ──
 *
 * 1. API「blogs」のスキーマに以下のフィールドを追加する
 *    - affiliateHtml（フィールドID: affiliateHtml）
 *      種類: リッチエディタ / 必須: いいえ
 *    - showAffiliateNotice（フィールドID: showAffiliateNotice）
 *      種類: 真偽値 / 必須: いいえ
 *
 * 2. A8.net 管理画面でリンク・バナーを取得する
 *    - テキストリンク: A8 が発行する <a href="...">...</a> をコピー
 *    - バナー画像: <a href="..."><img src="..." alt="..." /></a> をコピー
 *    - affiliateHtml リッチエディタに HTML を貼り付ける（ソース編集モード推奨）
 *      例: <a href="https://px.a8.net/svt/ejp?a8mat=..." rel="nofollow"><img ... alt="広告"></a><img width="1" height="1" src="https://www12.a8.net/0.gif?a8mat=..." alt="">
 *    - 記事本文（content）内に直接リンクを置く場合も showAffiliateNotice を ON にする
 *
 * 3. 表示ルール（ビルド時）
 *    - affiliateHtml に内容がある → 記事下部に「おすすめの商品・サービス」枠を表示
 *    - affiliateHtml がある、または showAffiliateNotice が true → PR 表記を表示
 *    - どちらも空/false → 既存記事と同じ見た目（枠・PR 表記なし）
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
const blogDataPath = path.join(root, 'blog', 'blog-data.json');
const indexHtmlPath = path.join(root, 'index.html');

// サイトの公開URL（canonical / OGP 用）。本番ドメインに合わせる。
const SITE_URL = (process.env.SITE_URL || 'https://shoeitosou.com').replace(/\/$/, '');
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

// microCMS / blog-data.json どちらから来ても同じ形に正規化する
function normalizeArticle(item, index, idPrefix) {
  let contentHtml = item.contentHtml || item.content || '';
  if (!contentHtml && item.text) {
    contentHtml = String(item.text)
      .split(/\n{2,}/)
      .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br />')}</p>`)
      .join('\n');
  }

  const affiliateHtml = String(item.affiliateHtml || '').trim();
  const showAffiliateNotice = item.showAffiliateNotice === true;

  return {
    id: item.id || `${idPrefix}-${index + 1}`,
    title: item.title || '（タイトルなし）',
    contentHtml,
    category: normalizeCategory(item.category),
    eyecatchUrl: item.eyecatch && item.eyecatch.url ? item.eyecatch.url : item.eyecatchUrl || '',
    eyecatchW: item.eyecatch && item.eyecatch.width ? item.eyecatch.width : '',
    eyecatchH: item.eyecatch && item.eyecatch.height ? item.eyecatch.height : '',
    date: item.publishedAt || item.createdAt || item.date || '',
    affiliateHtml,
    showAffiliateNotice,
    publishFallback: item.publishFallback === true,
  };
}

function shouldShowAffiliateNotice(article) {
  return article.showAffiliateNotice || Boolean(String(article.affiliateHtml || '').trim());
}

// タイトル一致判定（空白・全角スペースを正規化）
function normalizeTitle(title) {
  return String(title || '')
    .replace(/\s+/g, '')
    .trim();
}

function articleTimestamp(article) {
  const { iso } = formatDate(article.date);
  if (iso) return new Date(iso).getTime();
  return 0;
}

function sortByDateDesc(articles) {
  return [...articles].sort((a, b) => articleTimestamp(b) - articleTimestamp(a));
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
    return contents.map((item, i) => normalizeArticle(item, i, 'post'));
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
    return arr.map((item, i) => normalizeArticle(item, i, 'local'));
  } catch (err) {
    console.warn('⚠ blog-data.json の読み込みに失敗しました。記事0件として扱います。:', err.message || err);
    return [];
  }
}

// microCMS と blog-data.json をマージする。
// 戻り値: { articles: 一覧・トップ・サイトマップ用, aliases: エイリアス HTML のみ生成 }
function mergeArticles(cmsArticles, fallbackArticles) {
  if (cmsArticles == null) {
    return { articles: sortByDateDesc(fallbackArticles), aliases: [] };
  }

  const cmsById = new Map(cmsArticles.map((a) => [a.id, a]));
  const cmsByTitle = new Map();
  for (const article of cmsArticles) {
    const key = normalizeTitle(article.title);
    if (key && !cmsByTitle.has(key)) cmsByTitle.set(key, article);
  }

  const articles = [...cmsArticles];
  const aliases = [];

  for (const fb of fallbackArticles) {
    if (cmsById.has(fb.id)) {
      console.log(`  · フォールバック "${fb.id}" は microCMS と同一 ID のため microCMS を優先`);
      continue;
    }

    const titleMatch = cmsByTitle.get(normalizeTitle(fb.title));
    if (titleMatch) {
      aliases.push({
        ...titleMatch,
        id: fb.id,
        canonicalId: titleMatch.id,
        isAlias: true,
      });
      console.log(
        `  · フォールバック "${fb.id}" を microCMS "${titleMatch.id}" のエイリアスとして生成（同一タイトル）`,
      );
      continue;
    }

    if (!fb.publishFallback) {
      console.log(`  · フォールバック "${fb.id}" は publishFallback 未指定のためスキップ（ローカル開発用）`);
      continue;
    }

    articles.push(fb);
    console.log(`  · フォールバック "${fb.id}" を microCMS に無い記事として追加`);
  }

  return { articles: sortByDateDesc(articles), aliases };
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
        <a href="../faq/index.html">FAQ</a>
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

// Dify AIチャットボット（chatbot/dify-embed.html を全ブログページに注入）
const DIFY_EMBED_PATH = path.join(root, 'chatbot', 'dify-embed.html');

function blogChatbotScripts() {
  if (!fs.existsSync(DIFY_EMBED_PATH)) {
    console.warn('⚠ chatbot/dify-embed.html がありません。チャットボット埋め込みをスキップします。');
    return '';
  }
  return fs.readFileSync(DIFY_EMBED_PATH, 'utf8').trim();
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

// アフィリエイト記事の PR 表記（A8.net）。affiliateHtml があるか showAffiliateNotice が true のときのみ
function blogPrNotice(article) {
  if (!shouldShowAffiliateNotice(article)) return '';
  return `        <p class="blog-pr-notice">※当ページにはアフィリエイト広告（A8.net）が含まれています。リンク先の商品・サービスを紹介し、成果報酬を得る場合があります。</p>`;
}

// 記事下部の A8 おすすめ枠（affiliateHtml が空なら非表示）
function blogAffiliateBlock(article) {
  const html = String(article.affiliateHtml || '').trim();
  if (!html) return '';
  return `        <aside class="blog-affiliate-block">
          <h2 class="blog-affiliate-block-title">おすすめの商品・サービス</h2>
          <div class="blog-affiliate-block-body">
${html}
          </div>
        </aside>`;
}

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

// カード／詳細のアイキャッチ（未設定時はグレー背景のプレースホルダ div）
function blogCardImg(article) {
  if (article.eyecatchUrl) {
    return `      <div class="blog-card-img"><img src="${escapeHtml(article.eyecatchUrl)}" alt="${escapeHtml(article.title)}" loading="lazy" /></div>\n`;
  }
  return `      <div class="blog-card-img" aria-hidden="true"></div>\n`;
}

function blogDetailEyecatch(article) {
  if (article.eyecatchUrl) {
    return `        <div class="blog-detail-eyecatch"><img src="${escapeHtml(article.eyecatchUrl)}" alt="${escapeHtml(article.title)}" /></div>\n`;
  }
  return `        <div class="blog-detail-eyecatch" aria-hidden="true"></div>\n`;
}

// 一覧カード（トップページ用 / 一覧ページ用 共通）。base は記事へのパス接頭辞。
function articleCard(article, base) {
  const { display, iso } = formatDate(article.date);
  const excerpt = truncate(stripHtml(article.contentHtml), 80);
  const href = `${base}${encodeURIComponent(article.id)}.html`;
  const eyecatch = blogCardImg(article);
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
  <meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content" />
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
${blogChatbotScripts()}
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
  const canonicalUrl = article.canonicalId
    ? `${SITE_URL}/blog/${encodeURIComponent(article.canonicalId)}.html`
    : pageUrl;
  const ogImage = article.eyecatchUrl || `${SITE_URL}/images/og-image.png`;
  const category = article.category
    ? `<span class="blog-category">${escapeHtml(article.category)}</span>`
    : '';
  const eyecatch = blogDetailEyecatch(article);

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
  <meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content" />
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
  <link rel="canonical" href="${canonicalUrl}" />
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
${blogPrNotice(article)}
${blogAffiliateBlock(article)}
${blogCta()}
        <p class="blog-more-actions">
          <a href="index.html" class="btn-instagram-more">ブログ一覧に戻る</a>
        </p>
      </div>
    </section>
  </main>

${blogFooter()}
${blogChatbotScripts()}
</body>
</html>
`;
  fs.writeFileSync(path.join(blogDir, `${article.id}.html`), html, 'utf8');
  if (article.isAlias) {
    console.log(`  · blog/${article.id}.html（→ ${article.canonicalId} へのエイリアス）`);
  }
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
  // FAQ
  urls.push({ loc: `${SITE_URL}/faq/`, lastmod: todayIso, changefreq: 'monthly', priority: '0.7' });
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
  const fallback = loadFallback();
  const cmsArticles = await fetchFromMicroCMS();
  const { articles, aliases } = mergeArticles(cmsArticles, fallback);
  if (cmsArticles != null && fallback.length) {
    console.log('✓ microCMS と blog-data.json をマージしました。');
  }

  cleanBlogDir();
  buildListPage(articles);
  for (const article of articles) {
    buildArticlePage(article);
  }
  for (const alias of aliases) {
    buildArticlePage(alias);
  }
  const pageCount = articles.length + aliases.length;
  if (pageCount) {
    console.log(
      `✓ blog/<id>.html を ${pageCount} 件生成しました（記事 ${articles.length} 件 + エイリアス ${aliases.length} 件）。`,
    );
  }
  injectHomepage(articles);
  buildSitemap(articles);

  console.log(`\n完了。一覧 ${articles.length} 件、エイリアス ${aliases.length} 件でブログを生成しました。`);
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
