/**
 * 昇栄塗装 — AIチャットボット UI
 * 設定: chatbot/config.js / API: /api/chat (Cloudflare Pages Function)
 */
(function () {
  'use strict';

  var config = window.CHATBOT_CONFIG || {};
  var apiUrl = config.apiUrl || '/api/chat';
  var botName = config.botName || '昇栄塗装アシスタント';
  var welcomeMessage = config.welcomeMessage || 'こんにちは！ご質問をどうぞ。';
  var quickQuestions = config.quickQuestions || [];
  var contact = config.contact || {};

  var isOpen = false;
  var isLoading = false;
  var history = [];

  var root, panel, messagesEl, form, input, toggleBtn, sendBtn;

  function createEl(tag, className, attrs) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === 'text') el.textContent = attrs[key];
        else if (key === 'html') el.innerHTML = attrs[key];
        else el.setAttribute(key, attrs[key]);
      });
    }
    return el;
  }

  function linkify(text) {
    return String(text || '')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\n/g, '<br>');
  }

  function scrollToBottom() {
    if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  function addMessage(role, content, extraClass) {
    var wrap = createEl('div', 'chatbot-msg chatbot-msg-' + role + (extraClass ? ' ' + extraClass : ''));
    if (role === 'assistant') {
      var avatar = createEl('div', 'chatbot-msg-avatar', { 'aria-hidden': 'true' });
      avatar.textContent = '昇';
      wrap.appendChild(avatar);
    }
    var bubble = createEl('div', 'chatbot-msg-bubble');
    if (role === 'assistant') {
      bubble.innerHTML = linkify(content);
    } else {
      bubble.textContent = content;
    }
    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    scrollToBottom();
    return wrap;
  }

  function showTyping() {
    var el = addMessage('assistant', '', 'chatbot-msg-typing');
    el.querySelector('.chatbot-msg-bubble').innerHTML =
      '<span class="chatbot-typing-dot"></span><span class="chatbot-typing-dot"></span><span class="chatbot-typing-dot"></span>';
    return el;
  }

  function setLoading(loading) {
    isLoading = loading;
    if (input) input.disabled = loading;
    if (sendBtn) sendBtn.disabled = loading;
  }

  function renderQuickQuestions() {
    if (!quickQuestions.length) return;
    var wrap = createEl('div', 'chatbot-quick');
    quickQuestions.forEach(function (q) {
      var btn = createEl('button', 'chatbot-quick-btn', { type: 'button', text: q });
      btn.addEventListener('click', function () {
        input.value = q;
        submitMessage();
      });
      wrap.appendChild(btn);
    });
    messagesEl.appendChild(wrap);
    scrollToBottom();
  }

  function renderContactLinks() {
    var wrap = createEl('div', 'chatbot-contact-links');
    if (contact.lineUrl) {
      wrap.appendChild(createEl('a', 'chatbot-contact-link chatbot-contact-line', {
        href: contact.lineUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
        text: 'LINEで相談',
      }));
    }
    if (contact.phoneHref) {
      wrap.appendChild(createEl('a', 'chatbot-contact-link chatbot-contact-tel', {
        href: contact.phoneHref,
        text: '電話する',
      }));
    }
    panel.querySelector('.chatbot-footer').appendChild(wrap);
  }

  function openPanel() {
    isOpen = true;
    panel.hidden = false;
    toggleBtn.setAttribute('aria-expanded', 'true');
    panel.setAttribute('aria-hidden', 'false');
    input.focus();
  }

  function closePanel() {
    isOpen = false;
    panel.hidden = true;
    toggleBtn.setAttribute('aria-expanded', 'false');
    panel.setAttribute('aria-hidden', 'true');
    toggleBtn.focus();
  }

  function togglePanel() {
    if (isOpen) closePanel();
    else openPanel();
  }

  async function submitMessage() {
    var text = (input.value || '').trim();
    if (!text || isLoading) return;

    input.value = '';
    var quick = panel.querySelector('.chatbot-quick');
    if (quick) quick.remove();

    addMessage('user', text);
    history.push({ role: 'user', content: text });

    setLoading(true);
    var typingEl = showTyping();

    try {
      var res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: history.slice(0, -1) }),
      });

      typingEl.remove();

      if (!res.ok) {
        throw new Error('API error ' + res.status);
      }

      var data = await res.json();
      var reply = data.reply || '申し訳ありません。応答を取得できませんでした。';
      addMessage('assistant', reply);
      history.push({ role: 'assistant', content: reply });
    } catch (err) {
      typingEl.remove();
      var fallback =
        '申し訳ありません、一時的に接続できませんでした。' +
        (contact.phone ? 'お電話（' + contact.phone + '）' : '') +
        (contact.lineUrl ? ' または LINE からお問い合わせください。' : '');
      addMessage('assistant', fallback);
    } finally {
      setLoading(false);
    }
  }

  function buildUI() {
    root = createEl('div', 'chatbot-root');
    root.setAttribute('data-chatbot', '');

    toggleBtn = createEl('button', 'chatbot-toggle', {
      type: 'button',
      'aria-label': 'チャットを開く',
      'aria-expanded': 'false',
    });
    toggleBtn.innerHTML =
      '<svg class="chatbot-toggle-icon chatbot-toggle-icon-open" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
      '<svg class="chatbot-toggle-icon chatbot-toggle-icon-close" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

    panel = createEl('div', 'chatbot-panel');
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', botName);
    panel.setAttribute('aria-hidden', 'true');

    var header = createEl('div', 'chatbot-header');
    var headerText = createEl('div', 'chatbot-header-text');
    headerText.appendChild(createEl('strong', 'chatbot-header-title', { text: botName }));
    headerText.appendChild(createEl('span', 'chatbot-header-sub', { text: '外壁・屋根塗装のご相談' }));
    header.appendChild(headerText);

    var closeBtn = createEl('button', 'chatbot-close', {
      type: 'button',
      'aria-label': 'チャットを閉じる',
    });
    closeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    closeBtn.addEventListener('click', closePanel);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    messagesEl = createEl('div', 'chatbot-messages');
    messagesEl.setAttribute('role', 'log');
    messagesEl.setAttribute('aria-live', 'polite');
    panel.appendChild(messagesEl);

    var footer = createEl('div', 'chatbot-footer');
    form = createEl('form', 'chatbot-form');
    input = createEl('input', 'chatbot-input', {
      type: 'text',
      placeholder: 'メッセージを入力…',
      maxlength: '500',
      'aria-label': 'メッセージ',
      autocomplete: 'off',
    });
    sendBtn = createEl('button', 'chatbot-send', { type: 'submit', 'aria-label': '送信' });
    sendBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
    form.appendChild(input);
    form.appendChild(sendBtn);
    footer.appendChild(form);
    panel.appendChild(footer);

    root.appendChild(panel);
    root.appendChild(toggleBtn);
    document.body.appendChild(root);

    toggleBtn.addEventListener('click', togglePanel);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitMessage();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) closePanel();
    });

    addMessage('assistant', welcomeMessage);
    renderQuickQuestions();
    renderContactLinks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildUI);
  } else {
    buildUI();
  }
})();
