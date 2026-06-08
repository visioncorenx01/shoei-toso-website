/**
 * Instagram 施工事例 — 編集用ファイル（このファイルだけ編集）
 *
 * 【自動表示（おすすめ）】
 * 1. INSTAGRAM_DISPLAY_MODE を 'widget' にする
 * 2. https://behold.so/ で Instagram 連携 → フィード作成 → Embed Code の feed-id を BEHOLD_FEED_ID に貼る
 * 3. Behold 管理画面で「表示件数」を INSTAGRAM_POST_LIMIT（既定 3）に合わせる
 *
 * 【手動表示】
 * INSTAGRAM_DISPLAY_MODE を 'manual' にし、INSTAGRAM_POST_URLS に投稿 URL を追加
 */

var INSTAGRAM_ACCOUNT_URL = 'https://www.instagram.com/shoeitosou7/';

/** @type {'manual'|'widget'} */
var INSTAGRAM_DISPLAY_MODE = 'widget';

/** Behold の Embed Code にある feed-id（未設定のときは設定案内を表示） */
var BEHOLD_FEED_ID = 'zZkXdYIr24ff3UMXmJRa';

/** 表示件数（manual: 先頭からこの件数 / widget: Behold 側でも同じ件数に設定） */
var INSTAGRAM_POST_LIMIT = 3;

var INSTAGRAM_POST_URLS = [
  'https://www.instagram.com/reel/DYri3x2vdNs/',
];
