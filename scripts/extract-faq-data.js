/**
 * faq/index.html の JSON-LD から FAQ を抽出し chatbot/faq-data.json を生成する
 *
 * 使い方: npm run extract-faq
 * build 時にも自動実行されます。
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const faqHtmlPath = path.join(root, 'faq', 'index.html');
const outPath = path.join(root, 'chatbot', 'faq-data.json');

const SITE_INFO = {
  name: '昇栄塗装',
  tagline: '佐倉市の外壁・屋根塗装・リフォーム',
  location: '千葉県佐倉市王子台6−42−2',
  services: [
    '外壁塗装',
    '屋根塗装',
    '防水工事',
    '内装塗装',
    'リフォーム工事',
    '部分塗装',
  ],
  phone: '070-9119-9440',
  lineUrl: 'https://lin.ee/7khuq4Z',
  contactFormUrl:
    'https://docs.google.com/forms/d/e/1FAIpQLScdONJKAYkz8pzI9c9Z_BLGXxjnS9x1AO8wdSmXgufy1xrJrQ/viewform',
  hours: '9:00〜18:00（月〜土）',
  areas: [
    '佐倉市',
    '四街道市',
    '千葉市',
    '八千代市',
    '印西市',
    '成田市',
    '八街市',
    '習志野市',
    '船橋市',
    '富里市',
  ],
  estimatesFree: true,
  website: 'https://shoeitosou.com',
  faqPage: 'https://shoeitosou.com/faq/',
};

function extractFaqsFromHtml(html) {
  const regex = /<script type="application\/ld\+json">\s*([\s\S]*?)<\/script>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      if (data['@type'] === 'FAQPage' && Array.isArray(data.mainEntity)) {
        return data.mainEntity.map((item) => ({
          question: item.name || '',
          answer: (item.acceptedAnswer && item.acceptedAnswer.text) || '',
        }));
      }
    } catch (_) {
      /* 次の script を試す */
    }
  }
  return [];
}

function run() {
  if (!fs.existsSync(faqHtmlPath)) {
    console.error('✗ faq/index.html が見つかりません');
    process.exit(1);
  }

  const html = fs.readFileSync(faqHtmlPath, 'utf8');
  const faqs = extractFaqsFromHtml(html);

  if (!faqs.length) {
    console.warn('⚠ FAQ が 0 件です。faq/index.html の JSON-LD を確認してください。');
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    siteInfo: SITE_INFO,
    faqs,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`✓ chatbot/faq-data.json を生成しました（FAQ ${faqs.length} 件）`);
}

run();
