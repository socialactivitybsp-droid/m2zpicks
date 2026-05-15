(() => {
  'use strict';

  const state = {
    data: [],
    activeFilter: 'all',
    sortCol: 'overall',
    sortAsc: false,
    makerFilter: 'all'
  };

  function getHostname(link) {
    try {
      return new URL(link).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  function getLogoUrl(link, size = 96) {
    const host = getHostname(link);
    if (!host) return '';
    return `https://www.google.com/s2/favicons?domain=${host}&sz=${size}`;
  }

  function fmtContext(k) {
    if (k >= 1000) return `${k / 1000}M`;
    return `${k}K`;
  }

  function tagHtml(tags = []) {
    const map = { free: 'free', api: 'api', open: 'open', vision: 'vision', new: 'new', paid: 'paid', 'free/paid': 'free-paid' };
    const label = { free: 'Free', api: 'API', open: 'Open', vision: 'Vision', new: 'NEW', paid: 'Paid', 'free/paid': 'Free/Paid' };
    return tags.map((t) => `<span class="model-tag tag-${map[t] || t}">${label[t] || t}</span>`).join('');
  }

  function changeBadge(c) {
    if (c > 0) return `<span class="rank-change up">▲${c}</span>`;
    if (c < 0) return `<span class="rank-change down">▼${Math.abs(c)}</span>`;
    return '<span class="rank-change same">—</span>';
  }

  function medalOrNum(rank) {
    if (rank === 1) return '<span class="medal">🥇</span>';
    if (rank === 2) return '<span class="medal">🥈</span>';
    if (rank === 3) return '<span class="medal">🥉</span>';
    return `<span class="rank-n">${rank}</span>`;
  }

  function scoreBar(score, isVision) {
    const display = (isVision && score === 0) ? 'N/A' : score;
    const pct = (isVision && score === 0) ? 0 : score;
    return `
      <div class="score-bar-wrap">
        <span class="score-val">${display}</span>
        <div class="score-bar-bg"><div class="score-bar-fill" style="width:${pct}%"></div></div>
      </div>`;
  }

  function renderRows(data) {
    const body = document.getElementById('rankBody');
    if (!data.length) {
      body.innerHTML = `<div class="empty-state"><h2>No tools match this filter</h2><p>Try a different category or sort.</p></div>`;
      return;
    }

    body.innerHTML = data.map((m, i) => {
      const pos = i + 1;
      const isTop = pos <= 3;
      const pct = `${m.overall}%`;
      const logo = getLogoUrl(m.link, 96);

      return `
        <div class="rank-row ${isTop ? 'top-3' : ''} rank-${pos}" role="row">
          <div class="rank-num">
            ${medalOrNum(pos)}
            ${changeBadge(m.change)}
          </div>
          <a class="model-info model-link" href="detailed.html?id=${encodeURIComponent(m.id)}" aria-label="View ${m.title} details">
            <div class="model-avatar">${logo ? `<img src="${logo}" alt="${m.title} logo" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.style.display='none';this.parentNode.textContent='🛠️';">` : '🛠️'}</div>
            <div class="model-text">
              <div class="model-name">${m.title}</div>
              <div class="model-maker">${m.category}</div>
              <div class="model-tags">${tagHtml(m.tags)}</div>${m.creatorPicks?.length ? `<div class="creator-pick-badge">⭐ Picked by <strong>${m.creatorPicks[0].name}</strong>${m.creatorPicks.length > 1 ? ` +${m.creatorPicks.length - 1} more` : ''}</div>` : ''}
            </div>
          </a>
          <div class="overall-cell">
            <div class="overall-ring" style="--pct:${pct}"><span>${m.overall}</span></div>
          </div>
          <div class="score-cell">${scoreBar(m.reasoning, false)}</div>
          <div class="score-cell">${scoreBar(m.coding, false)}</div>
          <div class="score-cell">${scoreBar(m.vision, true)}</div>
          <div class="ctx-cell">${fmtContext(m.context)}</div>
        </div>`;
    }).join('');
  }

  function updateSortHeaders() {
    document.querySelectorAll('.sortable').forEach((el) => {
      const col = el.dataset.col;
      el.classList.toggle('active', col === state.sortCol);
      el.classList.toggle('asc', col === state.sortCol && state.sortAsc);
    });
  }

  function applyFiltersAndSort() {
    let data = [...state.data];

    if (state.activeFilter !== 'all') {
      data = data.filter((m) => (m.categories || []).includes(state.activeFilter));
    }

    if (state.makerFilter !== 'all') {
      data = data.filter((m) => m.category === state.makerFilter);
    }

    data.sort((a, b) => {
      const av = a[state.sortCol];
      const bv = b[state.sortCol];
      return state.sortAsc ? av - bv : bv - av;
    });

    renderRows(data);
    updateSortHeaders();
  }

  function getNextFriday() {
    const now = new Date();
    const day = now.getDay();
    const daysUntil = (5 - day + 7) % 7 || 7;
    const next = new Date(now);
    next.setDate(now.getDate() + daysUntil);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  function updateCountdown() {
    const el = document.getElementById('countdown');
    if (!el) return;
    const diff = getNextFriday() - new Date();
    if (diff <= 0) {
      el.textContent = 'Updating now!';
      return;
    }

    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    el.innerHTML = [[d, 'Days'], [h, 'Hrs'], [m, 'Min'], [s, 'Sec']].map(([n, l]) => `
      <div class="countdown-block">
        <span class="countdown-n">${String(n).padStart(2, '0')}</span>
        <span class="countdown-l">${l}</span>
      </div>
    `).join('<span class="countdown-sep">:</span>');
  }

  function setUpdateBadge(dateText) {
    const badge = document.getElementById('updateBadge');
    if (!badge) return;
    if (dateText) {
      badge.textContent = `Updated ${dateText}`;
      return;
    }

    const now = new Date();
    const day = now.getDay();
    const daysBack = (day - 5 + 7) % 7;
    const lastFri = new Date(now);
    lastFri.setDate(now.getDate() - daysBack);
    badge.textContent = `Updated ${lastFri.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  function buildCategoryFilter() {
    const maker = document.getElementById('makerFilter');
    const categories = [...new Set(state.data.map((item) => item.category))].sort((a, b) => a.localeCompare(b));
    maker.innerHTML = '<option value="all">All Categories</option>' + categories.map((c) => `<option value="${c}">${c}</option>`).join('');
  }

  async function loadData() {
    const merged = await window.AppwriteLayer.fetchRankedTools();
    const creators = await window.AppwriteLayer.getCreatorPickLookup();
    state.data = merged.map((item) => ({
      ...item,
      context: parseInt(item.context, 10) || 0,
      change: parseInt(item.change, 10) || 0,
      creatorPicks: creators.get(Number(item.id)) || []
    }));
    setUpdateBadge();
  }

  function bindEvents() {
    document.getElementById('filterTabs').addEventListener('click', (e) => {
      const tab = e.target.closest('.filter-tab');
      if (!tab) return;
      document.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeFilter = tab.dataset.filter;
      applyFiltersAndSort();
    });

    document.getElementById('sortBy').addEventListener('change', (e) => {
      state.sortCol = e.target.value;
      applyFiltersAndSort();
    });

    document.getElementById('makerFilter').addEventListener('change', (e) => {
      state.makerFilter = e.target.value;
      applyFiltersAndSort();
    });

    document.querySelector('.leaderboard-header').addEventListener('click', (e) => {
      const col = e.target.closest('.sortable')?.dataset.col;
      if (!col) return;
      if (state.sortCol === col) {
        state.sortAsc = !state.sortAsc;
      } else {
        state.sortCol = col;
        state.sortAsc = false;
      }
      document.getElementById('sortBy').value = state.sortCol;
      applyFiltersAndSort();
    });
  }

  async function init() {
    const body = document.getElementById('rankBody');
    if (body) body.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>';
    try {
      await loadData();
      buildCategoryFilter();
      bindEvents();
      applyFiltersAndSort();
      updateCountdown();
      setInterval(updateCountdown, 1000);
    } catch (err) {
      console.error(err);
      const body = document.getElementById('rankBody');
      if (body) {
        body.innerHTML = '<div class="empty-state"><h2>Rankings unavailable</h2><p>Could not load rankings data. Please try again.</p></div>';
      }
      setUpdateBadge();
    }
  }

  init();
})();
