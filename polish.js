(() => {
  'use strict';

  const AVATAR_HOST = 'https://github.com/';
  const processed = new WeakSet();

  function usernameFromPage() {
    const text = document.body?.innerText || '';
    const handle = text.match(/@([A-Za-z0-9-]{1,39})/);
    if (handle) return handle[1];
    const stored = localStorage.getItem('pulse_username') || localStorage.getItem('username');
    return stored && /^[A-Za-z0-9-]{1,39}$/.test(stored) ? stored : null;
  }

  function repairAvatar(img) {
    if (!(img instanceof HTMLImageElement) || processed.has(img)) return;
    const looksLikeAvatar = /avatar|profile/i.test(`${img.alt} ${img.className}`) ||
      /avatars\.githubusercontent\.com|github\.com\/.*\.png/i.test(img.src);
    if (!looksLikeAvatar) return;

    processed.add(img);
    img.referrerPolicy = 'no-referrer';
    img.decoding = 'async';
    img.loading = 'eager';

    const fallback = () => {
      const username = usernameFromPage();
      if (!username || img.dataset.pulseFallback === '1') return;
      img.dataset.pulseFallback = '1';
      img.src = `${AVATAR_HOST}${encodeURIComponent(username)}.png?size=160`;
    };

    img.addEventListener('error', fallback, { once: true });
    if (img.complete && img.naturalWidth === 0) fallback();
  }

  function improveInteractiveElements(root = document) {
    root.querySelectorAll('img').forEach(repairAvatar);
    root.querySelectorAll('button,[role="button"],a').forEach((el) => {
      if (!el.getAttribute('aria-label')) {
        const label = (el.textContent || '').trim().replace(/\s+/g, ' ');
        if (label && label.length <= 80) el.setAttribute('aria-label', label);
      }
    });
  }

  function markLoaded() {
    if (document.querySelector('#app > *')) document.documentElement.classList.add('pulse-ready');
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        improveInteractiveElements(node);
      }
    }
    markLoaded();
  });

  document.addEventListener('DOMContentLoaded', () => {
    improveInteractiveElements();
    markLoaded();
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
