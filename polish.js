(() => {
  'use strict';

  const processed = new WeakSet();

  function usernameFromPage() {
    const text = document.body?.innerText || '';
    const handle = text.match(/@([A-Za-z0-9-]{1,39})/);
    if (handle) return handle[1];
    const stored = localStorage.getItem('pulse_username') || localStorage.getItem('username');
    return stored && /^[A-Za-z0-9-]{1,39}$/.test(stored) ? stored : null;
  }

  function avatarUrl(username) {
    return `https://github.com/${encodeURIComponent(username)}.png?size=160`;
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
      img.src = avatarUrl(username);
    };

    img.addEventListener('error', fallback, { once: true });
    if (!img.getAttribute('src') || (img.complete && img.naturalWidth === 0)) fallback();
  }

  function injectMissingAvatar(root = document) {
    const username = usernameFromPage();
    if (!username) return;

    const profileText = Array.from(root.querySelectorAll('h1,h2,h3,div,span'))
      .find((el) => (el.textContent || '').trim() === 'Profile');
    if (!profileText) return;

    const region = profileText.closest('main,section,article,div') || document;
    const handleNode = Array.from(region.querySelectorAll('*'))
      .find((el) => (el.textContent || '').trim() === `@${username}`);
    if (!handleNode) return;

    const row = handleNode.parentElement?.parentElement || handleNode.parentElement;
    if (!row || row.querySelector('img[data-pulse-avatar="1"]')) return;

    const candidates = Array.from(row.children).filter((el) => el !== handleNode.parentElement);
    const slot = candidates.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width >= 56 && r.width <= 140 && r.height >= 56 && r.height <= 140;
    });
    if (!slot) return;

    slot.textContent = '';
    slot.style.overflow = 'hidden';
    const img = document.createElement('img');
    img.dataset.pulseAvatar = '1';
    img.alt = `${username} avatar`;
    img.src = avatarUrl(username);
    img.referrerPolicy = 'no-referrer';
    img.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;border-radius:inherit';
    slot.appendChild(img);
    repairAvatar(img);
  }

  function improveInteractiveElements(root = document) {
    root.querySelectorAll?.('img').forEach(repairAvatar);
    root.querySelectorAll?.('button,[role="button"],a').forEach((el) => {
      if (!el.getAttribute('aria-label')) {
        const label = (el.textContent || '').trim().replace(/\s+/g, ' ');
        if (label && label.length <= 80) el.setAttribute('aria-label', label);
      }
    });
    injectMissingAvatar(document);
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
    setTimeout(() => injectMissingAvatar(document), 500);
    setTimeout(() => injectMissingAvatar(document), 1500);
  });
})();
