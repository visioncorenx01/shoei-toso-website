/**
 * Dify チャットボット — ビューポート固定・スクロールロック・キーボード対応（PC/モバイル共通）
 */
(function () {
  'use strict';

  var LOCK_CLASS = 'dify-chat-open';
  var BTN_ID = 'dify-chatbot-bubble-button';
  var WIN_ID = 'dify-chatbot-bubble-window';
  var MOBILE_MQ = window.matchMedia('(max-width: 480px)');

  var scrollY = 0;
  var chatObserver = null;
  var viewportBound = false;
  var rafId = 0;

  function isMobile() {
    return MOBILE_MQ.matches;
  }

  function getButton() {
    return document.getElementById(BTN_ID);
  }

  function getWindow() {
    return document.getElementById(WIN_ID);
  }

  function isChatOpen() {
    var win = getWindow();
    if (!win) return false;
    var style = window.getComputedStyle(win);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function scrollbarWidth() {
    return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
  }

  function lockScroll() {
    if (document.documentElement.classList.contains(LOCK_CLASS)) return;
    scrollY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.classList.add(LOCK_CLASS);
    document.documentElement.style.setProperty('--dify-scroll-lock-pad', scrollbarWidth() + 'px');
    document.body.style.position = 'fixed';
    document.body.style.top = -scrollY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }

  function unlockScroll() {
    if (!document.documentElement.classList.contains(LOCK_CLASS)) return;
    document.documentElement.classList.remove(LOCK_CLASS);
    document.documentElement.style.removeProperty('--dify-scroll-lock-pad');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollY);
  }

  function safeBottom() {
    return isMobile() ? 12 : 20;
  }

  function safeRight() {
    return isMobile() ? 12 : 20;
  }

  function getViewportMetrics() {
    var vv = window.visualViewport;
    if (!vv) {
      return {
        width: window.innerWidth,
        height: window.innerHeight,
        offsetTop: 0,
        offsetLeft: 0,
        bottom: window.innerHeight,
      };
    }
    return {
      width: vv.width,
      height: vv.height,
      offsetTop: vv.offsetTop,
      offsetLeft: vv.offsetLeft,
      bottom: vv.offsetTop + vv.height,
    };
  }

  /** レイアウト下端と visualViewport 下端の差が大きい = キーボード表示中 */
  function isKeyboardOpen(metrics) {
    return window.innerHeight - metrics.bottom > 50;
  }

  function applyFixed(el, bottomPx, rightPx) {
    el.style.setProperty('position', 'fixed', 'important');
    el.style.setProperty('left', 'auto', 'important');
    el.style.setProperty('top', 'auto', 'important');
    el.style.setProperty('bottom', bottomPx + 'px', 'important');
    el.style.setProperty('right', rightPx + 'px', 'important');
    el.style.setProperty('margin', '0', 'important');
    el.style.setProperty('transform', 'none', 'important');
  }

  function positionButton() {
    var btn = getButton();
    if (!btn) return;

    var bottom = safeBottom();
    var right = safeRight();

    if (isMobile() && isChatOpen()) {
      var metrics = getViewportMetrics();
      if (isKeyboardOpen(metrics)) {
        bottom = window.innerHeight - metrics.bottom + safeBottom();
      }
      right = Math.max(right, window.innerWidth - metrics.offsetLeft - metrics.width + right);
    }

    applyFixed(btn, bottom, right);
    btn.style.setProperty('z-index', '2147483646', 'important');
  }

  function positionWindow() {
    var win = getWindow();
    if (!win || !isChatOpen()) return;

    var metrics = getViewportMetrics();
    var bottom = safeBottom();
    var right = safeRight();
    var btn = getButton();
    var btnHeight = btn ? btn.offsetHeight || 56 : 56;
    var gap = 12;
    var topMargin = 8;

    if (isMobile()) {
      right = Math.max(right, window.innerWidth - metrics.offsetLeft - metrics.width + right);

      var winW = Math.min(Math.floor(window.innerWidth - 16), 380);
      win.style.setProperty('width', winW + 'px', 'important');
      win.style.setProperty('max-width', winW + 'px', 'important');

      var bottomPx;
      var winH;

      if (isKeyboardOpen(metrics)) {
        // キーボード表示: 窓の下端を visualViewport 下端（キーボード直上）に合わせる
        bottomPx = window.innerHeight - metrics.bottom + bottom;
        winH = Math.floor(metrics.height - topMargin - bottom);
      } else {
        // 通常: バブルボタンの上に配置
        bottomPx = btnHeight + gap + bottom;
        winH = Math.floor(
          Math.min(metrics.height * 0.85, metrics.height - btnHeight - gap - topMargin - bottom)
        );
      }

      winH = Math.max(winH, 200);
      win.style.setProperty('height', winH + 'px', 'important');
      win.style.setProperty('max-height', winH + 'px', 'important');
      applyFixed(win, bottomPx, right);
    } else {
      win.style.setProperty('width', '380px', 'important');
      win.style.setProperty('height', '500px', 'important');
      win.style.setProperty('max-height', 'calc(100dvh - 6rem)', 'important');
      bottom = btnHeight + gap + bottom;
      applyFixed(win, bottom, right);
    }

    win.style.setProperty('z-index', '2147483647', 'important');
  }

  function schedulePosition() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function () {
      rafId = 0;
      positionButton();
      positionWindow();
    });
  }

  function syncState() {
    if (isChatOpen()) {
      lockScroll();
    } else {
      unlockScroll();
    }
    schedulePosition();
  }

  function bindViewport() {
    if (viewportBound) return;
    viewportBound = true;

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', schedulePosition);
      window.visualViewport.addEventListener('scroll', schedulePosition);
    }

    window.addEventListener('resize', schedulePosition);
    document.addEventListener('focusin', schedulePosition);
    document.addEventListener('focusout', schedulePosition);
    MOBILE_MQ.addEventListener('change', syncState);
  }

  function observeChatWindow() {
    var win = getWindow();
    if (!win) return false;

    if (chatObserver) chatObserver.disconnect();
    chatObserver = new MutationObserver(syncState);
    chatObserver.observe(win, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
    syncState();
    return true;
  }

  function waitForChatbot() {
    if (observeChatWindow()) {
      positionButton();
      return;
    }

    var bodyObserver = new MutationObserver(function () {
      if (observeChatWindow()) {
        bodyObserver.disconnect();
        positionButton();
      }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener(
    'touchmove',
    function (e) {
      if (!document.documentElement.classList.contains(LOCK_CLASS)) return;

      var win = getWindow();
      var btn = getButton();
      var target = e.target;

      if (win && (target === win || win.contains(target))) return;
      if (btn && (target === btn || btn.contains(target))) return;

      e.preventDefault();
    },
    { passive: false }
  );

  bindViewport();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForChatbot);
  } else {
    waitForChatbot();
  }
})();
