/**
 * Notion のページURLを指定すると、その記事を取得して blog-data.json の先頭に追加する
 * 使い方: NOTION_API_KEY=xxx node scripts/import-from-notion.js "https://www.notion.so/..."
 *
 * 事前準備:
 * 1. https://www.notion.so/my-integrations でインテグレーションを作成し、APIキーを発行
 * 2. 取り込みたいNotionページを開き、「共有」でそのインテグレーションを追加
 * 3. 環境変数 NOTION_API_KEY にAPIキーを設定（または .env に記載）
 */

const fs = require('fs');
const path = require('path');

// .env があれば読み込み（dotenv は optional）
try {
  require('dotenv').config();
} catch (_) {}

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const root = path.join(__dirname, '..');
const blogDataPath = path.join(root, 'blog-data.json');

function extractPageId(url) {
  if (!url || typeof url !== 'string') return null;
  const u = url.trim().replace(/#.*$/, '');
  const match = u.match(/notion\.so\/(?:[^/]+\/)?([a-f0-9]{32}|[a-f0-9-]{36})/i);
  if (match) return match[1].replace(/-/g, '');
  const lastSegment = u.split('/').filter(Boolean).pop();
  if (lastSegment && /^[a-f0-9-]{32,36}$/i.test(lastSegment))
    return lastSegment.replace(/-/g, '');
  return null;
}

function getPlainText(block) {
  const type = block.type;
  const prop = block[type];
  if (!prop || !Array.isArray(prop.rich_text)) return '';
  return prop.rich_text.map((t) => t.plain_text || '').join('');
}

async function fetchNotionPage(client, pageId) {
  const page = await client.pages.retrieve({ page_id: pageId });
  const titleProp = page.properties.title || page.properties.Title;
  const titleArr = titleProp && titleProp.title;
  const title = Array.isArray(titleArr) && titleArr[0]
    ? titleArr[0].plain_text
    : '（タイトルなし）';

  const blocks = await client.blocks.children.list({ block_id: pageId, page_size: 100 });
  const lines = [];
  for (const block of blocks.results || []) {
    const text = getPlainText(block);
    if (text) lines.push(text);
    if (block.has_children) {
      const childBlocks = await client.blocks.children.list({
        block_id: block.id,
        page_size: 100,
      });
      for (const c of childBlocks.results || []) {
        const ct = getPlainText(c);
        if (ct) lines.push(ct);
      }
    }
  }
  const text = lines.join('\n\n').trim();
  return { title, text };
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('使い方: NOTION_API_KEY=xxx node scripts/import-from-notion.js "NotionのページURL"');
    process.exit(1);
  }

  const pageId = extractPageId(url);
  if (!pageId) {
    console.error('エラー: URLからページIDを取得できませんでした。NotionのページURLをそのまま指定してください。');
    process.exit(1);
  }

  if (!NOTION_API_KEY) {
    console.error('エラー: 環境変数 NOTION_API_KEY が設定されていません。');
    console.error('  .env に NOTION_API_KEY=secret_xxx を書くか、実行時に NOTION_API_KEY=xxx を付けてください。');
    process.exit(1);
  }

  let Client;
  try {
    Client = require('@notionhq/client').Client;
  } catch (e) {
    console.error('エラー: @notionhq/client がインストールされていません。');
    console.error('  npm install @notionhq/client を実行してください。');
    process.exit(1);
  }

  const notion = new Client({ auth: NOTION_API_KEY });

  let title, text;
  try {
    const result = await fetchNotionPage(notion, pageId);
    title = result.title;
    text = result.text;
  } catch (e) {
    console.error('Notion API エラー:', e.message || e);
    if (e.code === 'object_not_found' || e.status === 404) {
      console.error('  → そのページをNotionで「共有」し、作成したインテグレーションを追加してください。');
    }
    process.exit(1);
  }

  const article = {
    date: todayStr(),
    category: 'お知らせ',
    title,
    text: text || '',
  };

  let articles = [];
  if (fs.existsSync(blogDataPath)) {
    const raw = fs.readFileSync(blogDataPath, 'utf8');
    try {
      articles = JSON.parse(raw);
    } catch (_) {
      articles = [];
    }
  }
  if (!Array.isArray(articles)) articles = [];

  articles.unshift(article);
  fs.writeFileSync(blogDataPath, JSON.stringify(articles, null, 2), 'utf8');

  console.log('OK: ブログに1件追加しました。');
  console.log('  タイトル:', title);
  console.log('  保存先:', blogDataPath);
  console.log('  → 反映するには npm run minify を実行してください。');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
