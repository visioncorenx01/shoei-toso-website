/**
 * Instagram 施工事例の表示（編集不要）
 * instagram-posts.js の設定に従い、手動埋め込みまたは Behold ウィジェットを表示します。
 */
(function () {
  'use strict';

  var GRID_ID = 'instagram-works-grid';
  var BEHOLD_ID = 'instagram-works-behold';
  var EMPTY_ID = 'instagram-works-empty';
  var MORE_LINK_ID = 'instagram-more-link';
  var EMBED_SCRIPT_URL = 'https://www.instagram.com/embed.js';
  var BEHOLD_SCRIPT_URL = 'https://w.behold.so/widget.js';

  function getDisplayMode() {
    var mode =
      typeof INSTAGRAM_DISPLAY_MODE === 'string'
        ? INSTAGRAM_DISPLAY_MODE.trim().toLowerCase()
        : 'manual';
    return mode === 'widget' ? 'widget' : 'manual';
  }

  function getPostLimit() {
    var limit = Number(INSTAGRAM_POST_LIMIT);
    if (!Number.isFinite(limit) || limit < 1) return 3;
    return Math.floor(limit);
  }

  function getBeholdFeedId() {
    return typeof BEHOLD_FEED_ID === 'string' ? BEHOLD_FEED_ID.trim() : '';
  }

  function normalizePostUrl(url) {
    var trimmed = String(url).trim();
    if (!trimmed) return '';
    return trimmed.replace(/\/?$/, '/').split('?')[0];
  }

  function isInstagramPostUrl(url) {
    return /instagram\.com\/(p|reel)\//i.test(url);
  }

  function createEmbedBlockquote(permalink) {
    var el = document.createElement('blockquote');
    el.className = 'instagram-media';
    el.setAttribute('data-instgrm-permalink', permalink);
    el.setAttribute('data-instgrm-version', '14');
    el.style.cssText =
      'background:#FFF;border:0;border-radius:12px;margin:0;max-width:100%;min-width:0;padding:0;width:100%;';
    return el;
  }

  function loadScriptOnce(id, src, options) {
    if (document.getElementById(id)) return;
    var script = document.createElement('script');
    script.id = id;
    script.src = src;
    if (options && options.async) script.async = true;
    if (options && options.type) script.type = options.type;
    document.head.appendChild(script);
  }

  function processEmbeds() {
    if (window.instgrm && window.instgrm.Embeds && typeof window.instgrm.Embeds.process === 'function') {
      window.instgrm.Embeds.process();
      return true;
    }
    return false;
  }

  function waitForEmbedScript() {
    if (processEmbeds()) return;
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      if (processEmbeds() || attempts > 100) {
        clearInterval(timer);
      }
    }, 100);
  }

  function setVisible(el, visible) {
    if (!el) return;
    el.hidden = !visible;
  }

  function showEmptyMessage(emptyEl, html) {
    if (!emptyEl) return;
    emptyEl.innerHTML = html;
    setVisible(emptyEl, true);
  }

  function getWidgetSetupMessage() {
    var limit = getPostLimit();
    return (
      '<p><strong>Instagramの最新' +
      limit +
      '件を自動表示する設定が未完了です。</strong></p>' +
      '<p>次の手順で <a href="https://behold.so/" target="_blank" rel="noopener noreferrer">Behold</a>（無料）を設定してください。</p>' +
      '<ol class="works-setup-steps">' +
      '<li>Behold に登録し、Instagram アカウント（@shoeitosou7）を連携</li>' +
      '<li>「Add feed」→ User → ソースにアカウントを選択 → タイプは <strong>Widget</strong></li>' +
      '<li>管理画面で表示件数を <strong>' +
      limit +
      '件</strong>・列数を <strong>3列</strong> に設定</li>' +
      '<li>Embed Code の <code>feed-id="..."</code> の ID をコピー</li>' +
      '<li><code>instagram-posts.js</code> の <code>BEHOLD_FEED_ID</code> に貼り付け（<code>INSTAGRAM_DISPLAY_MODE</code> は <code>\'widget\'</code> のまま）</li>' +
      '</ol>' +
      '<p class="works-setup-hint">設定後は新しい投稿が自動で反映されます（反映まで数分かかることがあります）。</p>' +
      '<p class="works-setup-hint">今すぐ手動で表示する場合は、<code>INSTAGRAM_DISPLAY_MODE</code> を <code>\'manual\'</code> に変更し、<code>INSTAGRAM_POST_URLS</code> に URL を追加してください。</p>'
    );
  }

  function initManual(grid, emptyEl) {
    var postUrls = Array.isArray(INSTAGRAM_POST_URLS) ? INSTAGRAM_POST_URLS : [];
    var limit = getPostLimit();

    var validUrls = postUrls
      .map(normalizePostUrl)
      .filter(function (url) {
        return url && isInstagramPostUrl(url);
      })
      .slice(0, limit);

    grid.innerHTML = '';

    if (validUrls.length === 0) {
      showEmptyMessage(
        emptyEl,
        '<p>表示する投稿がありません。</p>' +
          '<p><code>instagram-posts.js</code> の <code>INSTAGRAM_POST_URLS</code> に、Instagramの投稿URLを追加してください（最大 ' +
          limit +
          '件）。</p>'
      );
      setVisible(grid, false);
      return;
    }

    setVisible(emptyEl, false);
    setVisible(grid, true);

    validUrls.forEach(function (permalink) {
      var item = document.createElement('div');
      item.className = 'work-instagram-item';
      item.appendChild(createEmbedBlockquote(permalink));
      grid.appendChild(item);
    });

    loadScriptOnce('instagram-embed-script', EMBED_SCRIPT_URL, { async: true });
    waitForEmbedScript();
  }

  function initWidget(beholdWrap, emptyEl) {
    var feedId = getBeholdFeedId();

    if (!feedId) {
      showEmptyMessage(emptyEl, getWidgetSetupMessage());
      setVisible(beholdWrap, false);
      return;
    }

    setVisible(emptyEl, false);
    setVisible(beholdWrap, true);
    beholdWrap.innerHTML = '';

    var widget = document.createElement('behold-widget');
    widget.setAttribute('feed-id', feedId);
    beholdWrap.appendChild(widget);

    loadScriptOnce('behold-widget-script', BEHOLD_SCRIPT_URL, { type: 'module' });
  }

  function init() {
    var grid = document.getElementById(GRID_ID);
    var beholdWrap = document.getElementById(BEHOLD_ID);
    var emptyEl = document.getElementById(EMPTY_ID);
    var moreLink = document.getElementById(MORE_LINK_ID);
    if (!grid || !beholdWrap) return;

    var accountUrl =
      typeof INSTAGRAM_ACCOUNT_URL === 'string' ? INSTAGRAM_ACCOUNT_URL.trim() : '';
    if (moreLink && accountUrl) {
      moreLink.href = accountUrl;
    }

    setVisible(grid, false);
    setVisible(beholdWrap, false);
    setVisible(emptyEl, false);

    if (getDisplayMode() === 'widget') {
      initWidget(beholdWrap, emptyEl);
    } else {
      initManual(grid, emptyEl);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
