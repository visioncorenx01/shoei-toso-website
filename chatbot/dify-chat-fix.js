/**
 * Dify チャットボット — visualViewport 基準レイアウト（iOS Safari キーボード対応）
 */
(function () {
  'use strict';

  var LOCK_CLASS = 'dify-chat-open';
  var BTN_ID = 'dify-chatbot-bubble-button';
  var WIN_ID = 'dify-chatbot-bubble-window';
  var MOBILE_MQ = window.matchMedia('(max-width: 768px)');

  var chatObserver = null;
  var viewportBound = false;
  var rafId = 0;
  var applying = false;

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
    document.documentElement.classList.add(LOCK_CLASS);
    document.documentElement.style.setProperty('--dify-scroll-lock-pad', scrollbarWidth() + 'px');
  }

  function unlockScroll() {
    if (!document.documentElement.classList.contains(LOCK_CLASS)) return;
    document.documentElement.classList.remove(LOCK_CLASS);
    document.documentElement.style.removeProperty('--dify-scroll-lock-pad');
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
      };
    }
    return {
      width: vv.width,
      height: vv.height,
      offsetTop: vv.offsetTop,
      offsetLeft: vv.offsetLeft,
    };
  }

  function setImportant(el, prop, value) {
    el.style.setProperty(prop, value, 'important');
  }

  function clearLayoutProps(el, props) {
    for (var i = 0; i < props.length; i += 1) {
      el.style.removeProperty(props[i]);
    }
  }

  function hideButton(btn) {
    setImportant(btn, 'display', 'none');
    setImportant(btn, 'pointer-events', 'none');
    setImportant(btn, 'visibility', 'hidden');
  }

  function positionClosedButton(btn) {
    var metrics = getViewportMetrics();
    var bottom = safeBottom();
    var right = safeRight();
    var bottomPx = window.innerHeight - metrics.offsetTop - metrics.height + bottom;
    var rightPx = window.innerWidth - metrics.offsetLeft - metrics.width + right;

    setImportant(btn, 'display', 'flex');
    setImportant(btn, 'visibility', 'visible');
    setImportant(btn, 'pointer-events', 'auto');
    setImportant(btn, 'position', 'fixed');
    setImportant(btn, 'top', 'auto');
    setImportant(btn, 'left', 'auto');
    setImportant(btn, 'bottom', bottomPx + 'px');
    setImportant(btn, 'right', rightPx + 'px');
    setImportant(btn, 'width', isMobile() ? '3.25rem' : '3.5rem');
    setImportant(btn, 'height', isMobile() ? '3.25rem' : '3.5rem');
    setImportant(btn, 'margin', '0');
    setImportant(btn, 'transform', 'none');
    setImportant(btn, 'z-index', '2147483646');
  }

  function applyMobileOpenWindow(win) {
    var metrics = getViewportMetrics();

    setImportant(win, 'position', 'fixed');
    setImportant(win, 'top', metrics.offsetTop + 'px');
    setImportant(win, 'left', metrics.offsetLeft + 'px');
    setImportant(win, 'width', metrics.width + 'px');
    setImportant(win, 'height', metrics.height + 'px');
    setImportant(win, 'bottom', 'auto');
    setImportant(win, 'right', 'auto');
    setImportant(win, 'max-width', 'none');
    setImportant(win, 'max-height', 'none');
    setImportant(win, 'margin', '0');
    setImportant(win, 'transform', 'none');
    setImportant(win, 'border-radius', '0');
    setImportant(win, 'z-index', '2147483647');
  }

  function applyDesktopOpenWindow(win) {
    var bottom = safeBottom();
    var right = safeRight();
    var bubbleSize = 56;
    var gap = 12;

    setImportant(win, 'position', 'fixed');
    setImportant(win, 'top', 'auto');
    setImportant(win, 'left', 'auto');
    setImportant(win, 'bottom', bubbleSize + gap + bottom + 'px');
    setImportant(win, 'right', right + 'px');
    setImportant(win, 'width', '380px');
    setImportant(win, 'height', '500px');
    setImportant(win, 'max-width', 'calc(100vw - 2rem)');
    setImportant(win, 'max-height', 'calc(100dvh - 6rem)');
    setImportant(win, 'margin', '0');
    setImportant(win, 'transform', 'none');
    setImportant(win, 'border-radius', '1rem');
    setImportant(win, 'z-index', '2147483647');
  }

  function applyLayout() {
    var btn = getButton();
    var win = getWindow();
    var open = isChatOpen();

    applying = true;
    try {
      if (open) {
        lockScroll();
        if (btn) hideButton(btn);
        if (win) {
          if (isMobile()) {
            applyMobileOpenWindow(win);
          } else {
            applyDesktopOpenWindow(win);
          }
        }
      } else {
        unlockScroll();
        if (btn) positionClosedButton(btn);
        if (win) {
          clearLayoutProps(win, [
            'position',
            'top',
            'left',
            'bottom',
            'right',
            'width',
            'height',
            'max-width',
            'max-height',
            'margin',
            'transform',
            'border-radius',
            'z-index',
          ]);
        }
      }
    } finally {
      applying = false;
    }
  }

  function scheduleLayout() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function () {
      rafId = 0;
      applyLayout();
    });
  }

  function syncState() {
    scheduleLayout();
  }

  function bindViewport() {
    if (viewportBound) return;
    viewportBound = true;

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', scheduleLayout);
      window.visualViewport.addEventListener('scroll', scheduleLayout);
    }

    window.addEventListener('resize', scheduleLayout);
    window.addEventListener('orientationchange', scheduleLayout);
    document.addEventListener('focusin', scheduleLayout);
    document.addEventListener('focusout', scheduleLayout);
    MOBILE_MQ.addEventListener('change', syncState);
  }

  function observeChatWindow() {
    var win = getWindow();
    if (!win) return false;

    if (chatObserver) chatObserver.disconnect();
    chatObserver = new MutationObserver(function () {
      if (applying) return;
      scheduleLayout();
    });
    chatObserver.observe(win, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
    syncState();
    return true;
  }

  function waitForChatbot() {
    if (observeChatWindow()) return;

    var bodyObserver = new MutationObserver(function () {
      if (observeChatWindow()) bodyObserver.disconnect();
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener(
    'touchmove',
    function (e) {
      if (!document.documentElement.classList.contains(LOCK_CLASS)) return;

      var win = getWindow();
      var target = e.target;
      if (win && (target === win || win.contains(target))) return;

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
