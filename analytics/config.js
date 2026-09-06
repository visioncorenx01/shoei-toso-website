/**
 * Cloudflare Web Analytics — トークン設定
 *
 * 【設定手順】
 * 1. Cloudflare ダッシュボード → Analytics & Logs → Web Analytics
 * 2. 「Add a site」→ shoeitosou.com を登録
 * 3. 表示された token を下記 CF_BEACON_TOKEN に貼り付け
 * 4. analytics/cloudflare-beacon.html の REPLACE_WITH_CF_TOKEN も同じ値に差し替え
 * 5. npm run build を実行して dist/ を再生成
 */
const CF_BEACON_TOKEN = 'REPLACE_WITH_CF_TOKEN';

module.exports = { CF_BEACON_TOKEN };
