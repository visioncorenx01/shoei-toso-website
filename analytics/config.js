/**
 * Cloudflare Web Analytics — トークン設定
 *
 * 【token の取得手順】
 * 1. https://dash.cloudflare.com/ にログイン
 * 2. 左メニュー → Analytics & Logs → Web Analytics
 * 3. shoeitosou.com のカードで「Manage site」をクリック
 * 4. 「Enable with JS Snippet installation」を選択 → Update
 *    ※ 手動スニペットを HTML に埋め込む場合は、自動注入モード（Enable）と併用しない
 * 5. 表示される JavaScript スニペット内の token をコピー
 *    形式: data-cf-beacon='{"token": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}'
 *    token は 32 文字の英数字（例: cca12fb9e60b4d2c90fe95a7cdadcf23）
 *
 * 【反映手順】
 * 1. 下記 CF_BEACON_TOKEN に貼り付け
 * 2. analytics/cloudflare-beacon.html の 8b65efb530f64523adfcb1d3470dfa5a も同じ値に差し替え
 * 3. index.html / faq/index.html / sakura/index.html の 8b65efb530f64523adfcb1d3470dfa5a も同じ値に差し替え
 * 4. npm run build を実行して dist/ を再生成
 * 5. dist/ をデプロイ
 *
 * 【補足】
 * - ダッシュボードに visits が見えていても、本番 HTML にビーコンが無い場合は計測が不完全なことがある
 * - Cloudflare プロキシ経由の「自動注入」だけに依存せず、HTML に明示的に埋め込むことを推奨
 */
const CF_BEACON_TOKEN = '8b65efb530f64523adfcb1d3470dfa5a';

module.exports = { CF_BEACON_TOKEN };
