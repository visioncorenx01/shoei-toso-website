/**
 * Cloudflare Pages Function — AI チャット API
 *
 * POST /api/chat
 * Body: { "message": "...", "history": [{ "role": "user"|"assistant", "content": "..." }] }
 *
 * 環境変数（Cloudflare Pages ダッシュボードで設定）:
 *   OPENAI_API_KEY  — OpenAI 互換 API キー（推奨）
 *   OPENAI_API_BASE — 省略時 https://api.openai.com/v1
 *   OPENAI_MODEL    — 省略時 gpt-4o-mini
 *   AI_PROVIDER     — "openai" | "workers-ai"（省略時 openai、キー無しなら FAQ のみ）
 */

const FAQ_CACHE_TTL_MS = 10 * 60 * 1000;
let faqCache = { data: null, fetchedAt: 0 };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

async function loadFaqData(request) {
  const now = Date.now();
  if (faqCache.data && now - faqCache.fetchedAt < FAQ_CACHE_TTL_MS) {
    return faqCache.data;
  }
  const url = new URL('/chatbot/faq-data.json', request.url);
  const res = await fetch(url.toString());
  if (!res.ok) {
    return { siteInfo: {}, faqs: [] };
  }
  const data = await res.json();
  faqCache = { data, fetchedAt: now };
  return data;
}

/** 日本語テキストを簡易正規化 */
function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[？?！!。、,\.「」『』（）()\[\]【】\s]+/g, '')
    .trim();
}

/** FAQ キーワードマッチング（スコア降順） */
function matchFaqs(query, faqs, limit = 5) {
  const q = normalize(query);
  if (!q || !faqs.length) return [];

  const scores = faqs.map((faq) => {
    const qText = normalize(faq.question);
    const aText = normalize(faq.answer);
    let score = 0;

    if (qText.includes(q) || q.includes(qText.slice(0, Math.min(qText.length, 8)))) {
      score += 8;
    }

    const terms = [
      ...qText.match(/[\u3040-\u9fff\u30a0-\u30ff]{2,}/g) || [],
      ...aText.match(/[\u3040-\u9fff\u30a0-\u30ff]{2,}/g) || [],
    ];
    const unique = [...new Set(terms)];
    for (const term of unique) {
      if (term.length >= 2 && q.includes(term)) score += term.length >= 4 ? 3 : 1;
    }

    const keywords = [
      '見積', '無料', '相場', '費用', '価格', 'エリア', '対応', '佐倉', '外壁', '屋根',
      '塗装', '工事', '期間', '保証', '塗料', 'シリコン', 'フッ素', '雨漏', '防水',
      '足場', '騒音', '近所', '支払', 'line', 'ライン', '相談', '診断', '写真',
    ];
    for (const kw of keywords) {
      if (q.includes(kw) && (qText.includes(kw) || aText.includes(kw))) score += 2;
    }

    return { ...faq, score };
  });

  return scores
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function buildSystemPrompt(siteInfo, matchedFaqs) {
  const info = siteInfo || {};
  const services = (info.services || []).join('、');
  const areas = (info.areas || []).join('、');

  let faqBlock = '';
  if (matchedFaqs.length) {
    faqBlock = matchedFaqs
      .map((f, i) => `【FAQ${i + 1}】Q: ${f.question}\nA: ${f.answer}`)
      .join('\n\n');
  }

  return `あなたは「${info.name || '昇栄塗装'}」（${info.tagline || '佐倉市の塗装会社'}）の公式AIアシスタントです。

【役割】
- 外壁・屋根塗装、リフォーム、お見積りに関する質問に、以下の情報だけを根拠に日本語で丁寧かつ親しみやすく答える
- 1〜3文程度を目安に、読みやすく自然な会話調で答える
- 確信が持てない内容は推測せず、「詳しくは現地調査・直接のご相談が必要」と伝え、連絡先を案内する
- 競合他社の話題や、サイトに無い具体的な価格の約束はしない

【会社情報】
- 所在地: ${info.location || '千葉県佐倉市'}
- サービス: ${services || '外壁塗装、屋根塗装、防水、内装、リフォーム'}
- 対応エリア: ${areas || '佐倉市および千葉県内周辺'}
- 電話: ${info.phone || '070-9119-9440'}（お見積り・相談無料）
- 営業時間: ${info.hours || '9:00〜18:00（月〜土）'}
- LINE: ${info.lineUrl || 'https://lin.ee/7khuq4Z'}
- お見積り: ${info.estimatesFree ? '無料' : '要確認'}

【参考FAQ（優先して使う）】
${faqBlock || '（該当FAQなし — 一般的な案内と連絡先を伝える）'}

【禁止】
- 上記にない情報の創作
- 長すぎる回答（400字以内）`;
}

function composeFallbackReply(query, matched, siteInfo) {
  const info = siteInfo || {};
  const phone = info.phone || '070-9119-9440';
  const lineUrl = info.lineUrl || 'https://lin.ee/7khuq4Z';

  if (!matched.length) {
    return (
      `ご質問ありがとうございます。「${query.slice(0, 40)}${query.length > 40 ? '…' : ''}」について、詳しい情報は個別のご状況により異なります。\n\n` +
      `お見積り・ご相談は無料です。お電話（${phone}）または [LINE](${lineUrl}) からお気軽にどうぞ。FAQページ（/faq/）もご覧ください。`
    );
  }

  const best = matched[0];
  const intros = [
    'はい、お答えしますね。',
    'ご質問ありがとうございます。',
    '承知しました。',
  ];
  const intro = intros[Math.floor(Math.random() * intros.length)];

  let reply = `${intro}\n\n${best.answer}`;

  if (matched.length > 1 && matched[1].score >= matched[0].score * 0.6) {
    reply += `\n\n関連情報：${matched[1].question} → ${matched[1].answer}`;
  }

  reply += `\n\nほかにもご不明点があれば、お気軽にお聞きください。詳しいお見積りは [LINE](${lineUrl}) やお電話（${phone}）でも承ります。`;
  return reply;
}

async function callOpenAICompatible(env, systemPrompt, history, userMessage) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const base = (env.OPENAI_API_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = env.OPENAI_MODEL || 'gpt-4o-mini';

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6),
    { role: 'user', content: userMessage },
  ];

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    console.error('OpenAI API error', res.status, await res.text());
    return null;
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function callWorkersAI(env, systemPrompt, history, userMessage) {
  if (!env.AI) return null;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6),
    { role: 'user', content: userMessage },
  ];

  try {
    const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages,
      max_tokens: 500,
    });
    return response?.response?.trim() || null;
  } catch (err) {
    console.error('Workers AI error', err);
    return null;
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const message = String(body.message || '').trim();
  if (!message || message.length > 500) {
    return jsonResponse({ error: 'message is required (max 500 chars)' }, 400);
  }

  const history = Array.isArray(body.history)
    ? body.history
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
        .map((m) => ({ role: m.role, content: String(m.content).slice(0, 800) }))
    : [];

  const faqBundle = await loadFaqData(request);
  const { siteInfo = {}, faqs = [] } = faqBundle;
  const matched = matchFaqs(message, faqs);
  const systemPrompt = buildSystemPrompt(siteInfo, matched);

  let reply = null;
  let mode = 'faq';

  const provider = (env.AI_PROVIDER || 'openai').toLowerCase();

  if (provider === 'workers-ai' && env.AI) {
    reply = await callWorkersAI(env, systemPrompt, history, message);
    if (reply) mode = 'ai-workers';
  } else if (env.OPENAI_API_KEY) {
    reply = await callOpenAICompatible(env, systemPrompt, history, message);
    if (reply) mode = 'ai-openai';
  }

  if (!reply) {
    reply = composeFallbackReply(message, matched, siteInfo);
    mode = matched.length ? 'faq' : 'fallback';
  }

  return jsonResponse({
    reply,
    mode,
    matchedFaq: matched[0]?.question || null,
  });
}
