/**
 * AIチャットボット — クライアント設定
 *
 * 【ユーザーが行う設定】
 * 1. Cloudflare Pages ダッシュボード → 設定 → 環境変数
 *    - OPENAI_API_KEY   : OpenAI / Groq 等の API キー（任意・推奨）
 *    - OPENAI_API_BASE  : 互換 API のベース URL（省略時 https://api.openai.com/v1）
 *    - OPENAI_MODEL     : モデル名（省略時 gpt-4o-mini）
 *    - AI_PROVIDER      : "openai"（デフォルト）| "workers-ai"（Cloudflare Workers AI）
 *
 * 2. Cloudflare Pages の Functions が有効であること
 *    - リポジトリ直下の functions/api/chat.js が自動デプロイされます
 *    - ビルド出力ディレクトリは dist/ のままで OK（Functions は dist 外）
 *
 * 3. API キー未設定の場合
 *    - FAQ キーワードマッチングのみで応答（無料・API 不要）
 *
 * 4. 無料で AI を使う例
 *    - Groq: https://console.groq.com/ → API キー取得
 *      OPENAI_API_BASE=https://api.groq.com/openai/v1
 *      OPENAI_MODEL=llama-3.1-8b-instant
 *    - Cloudflare Workers AI: AI_PROVIDER=workers-ai（Workers Paid または従量）
 */
window.CHATBOT_CONFIG = {
  /** チャット API（サイトルートからの相対パス。全ページ共通） */
  apiUrl: '/api/chat',

  /** ボット表示名 */
  botName: '昇栄塗装アシスタント',

  /** 初回メッセージ */
  welcomeMessage:
    'こんにちは！昇栄塗装のアシスタントです。外壁・屋根塗装やお見積りについて、お気軽にご質問ください。',

  /** クイック質問（チップ） */
  quickQuestions: [
    '見積もりは無料ですか？',
    '対応エリアを教えてください',
    '工事期間はどのくらいですか？',
    '外壁塗装の相場を知りたい',
  ],

  /** フォールバック連絡先（API 未設定時の案内にも使用） */
  contact: {
    phone: '070-9119-9440',
    phoneHref: 'tel:07091199440',
    lineUrl: 'https://lin.ee/7khuq4Z',
    formUrl:
      'https://docs.google.com/forms/d/e/1FAIpQLScdONJKAYkz8pzI9c9Z_BLGXxjnS9x1AO8wdSmXgufy1xrJrQ/viewform',
  },
};
