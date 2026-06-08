/* =========================================================
   昇栄塗装 たたき台 - script.js
   - ハンバーガーメニュー開閉
   - ヘッダーのスクロール追従スタイル
   - 電話番号の難読化表示（本番と同方式: 文字コードから組み立て）
   ========================================================= */
(function () {
  'use strict';

  /* ---------- ハンバーガーメニュー ---------- */
  const hamburger = document.getElementById('hamburger');
  const nav = document.getElementById('nav');
  const overlay = document.getElementById('navOverlay');

  function openMenu() {
    nav.classList.add('open');
    hamburger.classList.add('active');
    hamburger.setAttribute('aria-expanded', 'true');
    if (overlay) overlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    nav.classList.remove('open');
    hamburger.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
    if (overlay) overlay.hidden = true;
    document.body.style.overflow = '';
  }
  function toggleMenu() {
    nav.classList.contains('open') ? closeMenu() : openMenu();
  }
  if (hamburger && nav) {
    hamburger.addEventListener('click', toggleMenu);
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeMenu);
    });
    if (overlay) overlay.addEventListener('click', closeMenu);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });
  }

  /* ---------- スマホ固定バー: メニューボタン ---------- */
  const mbMenu = document.getElementById('mbMenu');
  if (mbMenu && nav) {
    mbMenu.addEventListener('click', toggleMenu);
  }

  /* ---------- ヘッダー スクロール追従 ---------- */
  const header = document.getElementById('siteHeader');
  if (header) {
    const onScroll = function () {
      header.classList.toggle('scrolled', window.scrollY > 10);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- 電話番号の難読化表示（営業電話対策） ---------- */
  // 数字を文字コードから組み立て、ソース上にベタ書きしない（本番と同方式）
  const str1 = String.fromCharCode(48 + 0) + String.fromCharCode(48 + 7) + String.fromCharCode(48 + 0);
  const str2 = String.fromCharCode(48 + 9) + String.fromCharCode(48 + 1) + String.fromCharCode(48 + 1) + String.fromCharCode(48 + 9);
  const str3 = String.fromCharCode(48 + 9) + String.fromCharCode(48 + 4) + String.fromCharCode(48 + 4) + String.fromCharCode(48 + 0);

  function getPhoneNumber() {
    return str1 + '-' + str2 + '-' + str3;
  }

  function displayPhoneNumber(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const phone = getPhoneNumber();
    const phoneClean = phone.replace(/-/g, '');
    el.innerHTML = '<a href="tel:' + phoneClean + '" style="color:inherit;text-decoration:none;">' + phone + '</a>';
  }

  // tel: リンク（電話ボタン・固定バー等）に発信先を設定し、番号表示も埋める
  function initTelLinks() {
    const phone = getPhoneNumber();
    const phoneClean = phone.replace(/-/g, '');
    document.querySelectorAll('.js-tel-link').forEach(function (el) {
      el.setAttribute('href', 'tel:' + phoneClean);
    });
    document.querySelectorAll('.js-tel-number').forEach(function (el) {
      el.textContent = phone;
    });
  }

  function initPhoneNumbers() {
    ['phone-display-header', 'phone-display-1'].forEach(displayPhoneNumber);
    initTelLinks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPhoneNumbers);
  } else {
    initPhoneNumbers();
  }
})();
