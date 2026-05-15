(async function () {
  const allPosts = await window.AppwriteLayer.fetchLatestBlogs();
  const latestWrap = document.getElementById('latestBlog');
  const allWrap = document.getElementById('allBlogs');
  const chipsWrap = document.getElementById('categoryChips');
  const searchInput = document.getElementById('blogSearch');

  const fmtDate = (value) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (!allPosts.length) {
    latestWrap.innerHTML = '<p>No blog posts yet. Check back soon.</p>';
    return;
  }

  const categories = ['All', ...new Set(allPosts.map((p) => p.category || 'Guides'))];
  let activeCategory = 'All';
  let query = '';

  function renderChips() {
    chipsWrap.innerHTML = categories.map((c) => `<button class="chip ${c===activeCategory?'active':''}" data-cat="${c}">${c}</button>`).join('');
    chipsWrap.querySelectorAll('button').forEach((btn) => btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      renderChips();
      renderPosts();
    }));
  }

  function getFiltered() {
    return allPosts.filter((p) => {
      const passCat = activeCategory === 'All' || (p.category || 'Guides') === activeCategory;
      const txt = `${p.title} ${p.excerpt}`.toLowerCase();
      const passQ = !query || txt.includes(query);
      return passCat && passQ;
    });
  }

  function renderPosts() {
    const posts = getFiltered();
    const latest = posts[0] || allPosts[0];
    latestWrap.innerHTML = `
      <article class="featured">
        <img src="${latest.hero || 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1400&q=80'}" alt="${latest.title}" />
        <div>
          <p class="meta">Latest post</p>
          <h2><a href="${latest.path || (latest.slug + '.html')}">${latest.title}</a></h2>
          <p>${latest.excerpt}</p>
          <p class="meta">${fmtDate(latest.publishedAt)} • ${latest.readTime} • <a href="/blogs/category/${encodeURIComponent(latest.category || 'Guides')}">${latest.category || 'Guides'}</a></p>
        </div>
      </article>`;

    allWrap.innerHTML = posts.map((post) => `
      <article class="blog-card">
        <img src="${post.hero || 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80'}" alt="${post.title}" style="width:100%;height:150px;object-fit:cover;border-radius:10px;margin-bottom:10px;" />
        <p class="meta">${fmtDate(post.publishedAt)}</p>
        <h3><a href="${post.path || (post.slug + '.html')}">${post.title}</a></h3>
        <p>${post.excerpt}</p>
        <p class="meta">${post.readTime} • <a href="/blogs/category/${encodeURIComponent(post.category || 'Guides')}">${post.category || 'Guides'}</a></p>
      </article>
    `).join('');
  }

  searchInput.addEventListener('input', (e) => {
    query = String(e.target.value || '').trim().toLowerCase();
    renderPosts();
  });

  renderChips();
  renderPosts();
})();
