/**
 * スマホで Dify チャット開閉時の背景スクロール・レイアウトシフトを抑止
 */
(function () {
  'use strict';

  var MOBILE_MQ = window.matchMedia('(max-width: 480px)');
  var LOCK_CLASS = 'dify-chat-open-lock';
  var scrollY = 0;
  var chatObserver = null;

  function isMobile() {
    return MOBILE_MQ.matches;
  }

  function getChatWindow() {
    return document.getElementById('dify-chatbot-bubble-window');
  }

  function isChatOpen() {
    var win = getChatWindow();
    if (!win) return false;
    return win.style.display !== 'none';
  }

  function lockBody() {
    if (!isMobile() || document.body.classList.contains(LOCK_CLASS)) return;
    scrollY = window.scrollY || window.pageYOffset || 0;
    document.body.classList.add(LOCK_CLASS);
    document.body.style.top = '-' + scrollY + 'px';
  }

  function unlockBody() {
    if (!document.body.classList.contains(LOCK_CLASS)) return;
    document.body.classList.remove(LOCK_CLASS);
    document.body.style.top = '';
    window.scrollTo(0, scrollY);
  }

  function syncLock() {
    if (!isMobile()) {
      unlockBody();
      return;
    }
    if (isChatOpen()) {
      lockBody();
    } else {
      unlockBody();
    }
  }

  function observeChatWindow() {
    var win = getChatWindow();
    if (!win) return false;

    if (chatObserver) chatObserver.disconnect();
    chatObserver = new MutationObserver(syncLock);
    chatObserver.observe(win, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
    syncLock();
    return true;
  }

  function waitForChatbot() {
    if (observeChatWindow()) return;

    var bodyObserver = new MutationObserver(function () {
      if (observeChatWindow()) {
        bodyObserver.disconnect();
      }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }

  MOBILE_MQ.addEventListener('change', syncLock);

  document.addEventListener(
    'touchmove',
    function (e) {
      if (!isMobile() || !document.body.classList.contains(LOCK_CLASS)) return;

      var win = getChatWindow();
      var btn = document.getElementById('dify-chatbot-bubble-button');
      var target = e.target;

      if (win && (target === win || win.contains(target))) return;
      if (btn && (target === btn || btn.contains(target))) return;

      e.preventDefault();
    },
    { passive: false }
  );

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForChatbot);
  } else {
    waitForChatbot();
  }
})();
