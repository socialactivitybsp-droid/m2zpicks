(function(){
  const SUPPORTED = ['Reviews','Comparisons','Rankings','Guides','News & Updates','Alternatives'];
  const segment = decodeURIComponent((window.location.pathname.split('/').pop() || '').trim());
  const category = SUPPORTED.find(c => c.toLowerCase() === segment.toLowerCase()) || 'Guides';
  document.getElementById('categoryTitle').textContent = category;

  window.AppwriteLayer.fetchBlogsByCategory(category, 100).then((posts) => {
    const wrap = document.getElementById('categoryBlogs');
    if (!posts.length) {
      wrap.innerHTML = '<p>No posts found in this category yet.</p>';
      return;
    }
    wrap.innerHTML = posts.map(post => `
      <article class="card" style="padding:16px; border:1px solid rgba(255,255,255,.08); border-radius:10px;">
        <h3><a href="${post.path || (post.slug + '.html')}">${post.title}</a></h3>
        <p>${post.excerpt}</p>
        <small>${post.publishedAt} • ${post.readTime}</small>
      </article>
    `).join('');
  });
})();
