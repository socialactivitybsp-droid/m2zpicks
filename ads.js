(function () {
  'use strict';

  /* ── Auto Ads Engine (Like Google Auto Ads) ── */
  const ads = [
    'https://t4.ftcdn.net/jpg/05/69/70/23/360_F_569702329_Ga7h1emcPVNt1ruSLsgHwb4LR0cFnRPA.jpg'
  ];

  const LINK = 'https://www.youtube.com/watch?v=mXwP-qjv6zg&list=RDMVLePz-MX1g&index=10';
  const ALT = 'Ad By M2ZPicks';
  const NO_ZONES = ['form', 'footer', 'nav', '.no-ads', '#comments', '.site-header'];

  function getAdWidth() {
    const w = window.innerWidth;
    if (w < 480) return '300px';
    if (w < 768) return '300px';
    if (w < 1024) return '468px';
    return '728px';
  }

  function createAdElement(src) {
    const wrap = document.createElement('div');
    wrap.setAttribute('data-auto-ad', 'true');
    wrap.style.cssText = 'grid-column: 1 / -1; display:block; margin:2rem auto; text-align:center; padding:1rem 0; width:100%;';

    const link = document.createElement('a');
    link.href = LINK;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.cssText = 'display:inline-block;';

    const img = document.createElement('img');
    img.src = src;
    img.alt = ALT;
    img.style.cssText = `max-width:${getAdWidth()}; height:auto; border-radius:6px; display:block;`;
    img.loading = 'lazy';

    link.appendChild(img);
    wrap.appendChild(link);
    return wrap;
  }

  function isInRestrictedZone(element) {
    return NO_ZONES.some((selector) => {
      try {
        return element.closest(selector);
      } catch (_err) {
        return false;
      }
    });
  }

  function inject() {
    document.querySelectorAll('[data-auto-ad]').forEach((el) => el.remove());

    const targetElements = document.querySelectorAll('.tool-card');
    if (!targetElements.length) return;

    const targetArray = Array.from(targetElements);
    let adCount = 0;

    targetArray.forEach((element, index) => {
      if (isInRestrictedZone(element)) return;
      if ((index + 1) % 20 === 0) {
        const ad = createAdElement(ads[adCount % ads.length]);
        element.after(ad);
        adCount += 1;
      }
    });
  }

  function setupObservers() {
    setTimeout(inject, 1000);

    let injectTimeout;
    const observer = new MutationObserver(() => {
      clearTimeout(injectTimeout);
      injectTimeout = setTimeout(inject, 1500);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: false
    });

    window.addEventListener('resize', () => {
      clearTimeout(injectTimeout);
      injectTimeout = setTimeout(inject, 500);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupObservers);
  } else {
    setupObservers();
  }
})();
