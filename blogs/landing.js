(function () {
  const posts = (window.BLOG_POSTS || []).slice().sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const latestWrap = document.getElementById('latestBlog');
  const allWrap = document.getElementById('allBlogs');

  if (!posts.length) {
    latestWrap.innerHTML = '<p>No blog posts yet. Check back soon.</p>';
    return;
  }

  const latest = posts[0];
  latestWrap.innerHTML = `
    <article class="card" style="padding:20px; border:1px solid rgba(255,255,255,.12); border-radius:12px;">
      <p style="opacity:.8; margin-bottom:8px;">Latest post</p>
      <h2><a href="${latest.slug}.html">${latest.title}</a></h2>
      <p>${latest.excerpt}</p>
      <small>${latest.publishedAt} • ${latest.readTime}</small>
    </article>
  `;

  allWrap.innerHTML = posts.map(post => `
    <article class="card" style="padding:16px; border:1px solid rgba(255,255,255,.08); border-radius:10px;">
      <h3><a href="${post.slug}.html">${post.title}</a></h3>
      <p>${post.excerpt}</p>
      <small>${post.publishedAt} • ${post.readTime}</small>
    </article>
  `).join('');
})();
