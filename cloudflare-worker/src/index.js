const CACHE_KEYS = {
  tools: 'cache:tools',
  categories: 'cache:categories',
  stats: 'cache:stats',
  latest: 'cache:latest',
  blogs: 'cache:blogs',
  blogCategories: 'cache:blog-categories',
  latestBlogs: 'cache:latest-blogs',
  meta: 'cache:meta'
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }));
    }

    const url = new URL(request.url);

    if (url.pathname === '/refresh' && request.method === 'POST') {
      const auth = request.headers.get('x-refresh-token');

      if (!auth || auth !== env.REFRESH_TOKEN) {
        return json({ error: 'Unauthorized' }, 401);
      }

      try {
        const result = await refreshCache(env);
        return json({ ok: true, ...result });
      } catch (err) {
        return json({
          ok: false,
          error: err.message,
          stack: String(err.stack || '')
        }, 500);
      }
    }

    if (url.pathname === '/tools') return serveCached(env, CACHE_KEYS.tools);
    if (url.pathname === '/categories') return serveCached(env, CACHE_KEYS.categories);
    if (url.pathname === '/stats') return serveCached(env, CACHE_KEYS.stats);
    if (url.pathname === '/latest') return serveCached(env, CACHE_KEYS.latest);
    if (url.pathname === '/blogs') return serveCached(env, CACHE_KEYS.blogs);
    if (url.pathname === '/blogs/categories') return serveCached(env, CACHE_KEYS.blogCategories);
    if (url.pathname === '/blogs/latest') return serveCached(env, CACHE_KEYS.latestBlogs);

    if (url.pathname === '/health') {
      try {
        const value = await env.TOOLS_KV.get(CACHE_KEYS.meta);

        if (!value) {
          return json({
            ok: true,
            cache: 'cold',
            message: 'Cache empty. Trigger POST /refresh.'
          });
        }

        return withCors(new Response(value, {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store'
          }
        }));
      } catch (err) {
        return json({
          ok: false,
          error: err.message
        }, 500);
      }
    }

    return json({ error: 'Not found' }, 404);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(refreshCache(env));
  }
};

async function serveCached(env, key) {
  try {
    const value = await env.TOOLS_KV.get(key);

    if (!value) {
      return json({
        error: 'Cache cold. Trigger /refresh.'
      }, 503);
    }

    return withCors(new Response(value, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=86400'
      }
    }));
  } catch (err) {
    return json({
      ok: false,
      error: err.message
    }, 500);
  }
}

async function refreshCache(env) {
  const tools = await fetchAllToolsFromAppwrite(env);
  const categories = buildCategories(tools);
  const blogs = await fetchAllBlogsFromAppwrite(env);
  const blogCategories = buildCategories(blogs, 'Guides');

  const stats = {
    totalTools: tools.length,
    totalCategories: categories.length,
    lastRefreshedAt: new Date().toISOString()
  };

  const latest = [...tools]
    .sort(
      (a, b) =>
        new Date(b.$createdAt || 0) - new Date(a.$createdAt || 0)
    )
    .slice(0, 50);
  const latestBlogs = [...blogs]
    .sort((a, b) => new Date(b.publishedAt || b.$createdAt || 0) - new Date(a.publishedAt || a.$createdAt || 0))
    .slice(0, 50);

  const expirationTtl = Number(env.CACHE_TTL_SECONDS || 259200);

  await Promise.all([
    env.TOOLS_KV.put(
      CACHE_KEYS.tools,
      JSON.stringify({ tools }),
      { expirationTtl }
    ),

    env.TOOLS_KV.put(
      CACHE_KEYS.categories,
      JSON.stringify({ categories }),
      { expirationTtl }
    ),

    env.TOOLS_KV.put(
      CACHE_KEYS.stats,
      JSON.stringify(stats),
      { expirationTtl }
    ),

    env.TOOLS_KV.put(
      CACHE_KEYS.latest,
      JSON.stringify({ latest }),
      { expirationTtl }
    ),
    env.TOOLS_KV.put(
      CACHE_KEYS.blogs,
      JSON.stringify({ blogs }),
      { expirationTtl }
    ),
    env.TOOLS_KV.put(
      CACHE_KEYS.blogCategories,
      JSON.stringify({ categories: blogCategories }),
      { expirationTtl }
    ),
    env.TOOLS_KV.put(
      CACHE_KEYS.latestBlogs,
      JSON.stringify({ latest: latestBlogs }),
      { expirationTtl }
    ),

    env.TOOLS_KV.put(
      CACHE_KEYS.meta,
      JSON.stringify({
        ok: true,
        ...stats
      }),
      { expirationTtl }
    )
  ]);

  return {
    totalTools: tools.length,
    totalCategories: categories.length,
    refreshedAt: stats.lastRefreshedAt
  };
}

async function fetchAllToolsFromAppwrite(env) {
  const endpoint = env.APPWRITE_ENDPOINT;
  const db = env.APPWRITE_DATABASE_ID;
  const col = env.APPWRITE_TOOLS_COLLECTION_ID;

  const headers = {
    'x-appwrite-project': env.APPWRITE_PROJECT_ID,
    'x-appwrite-key': env.APPWRITE_API_KEY,
    'x-appwrite-response-format': '1.0.0',
    'content-type': 'application/json'
  };

  const tools = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const params = new URLSearchParams();
    params.append('queries[]', 'limit(100)');
    params.append('queries[]', `offset(${offset})`);
    params.append('queries[]', 'orderAsc("id")');

    const url = `${endpoint}/databases/${db}/collections/${col}/documents?${params.toString()}`;

    const res = await fetch(url, { headers });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Appwrite fetch failed: ${res.status} | ${text}`);
    }

    const payload = await res.json();

    if (!payload || !Array.isArray(payload.documents)) {
      throw new Error(`Unexpected Appwrite payload: ${JSON.stringify(payload)}`);
    }

    const docs = payload.documents || [];
    total = Number(payload.total || 0);

    tools.push(...docs);

    if (!docs.length) break;

    offset += docs.length;
  }

  const seen = new Set();
  const deduped = [];

  for (const t of tools) {
    const key = t.$id || `id:${t.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(t);
  }

  deduped.sort((a, b) => Number(a.id || 0) - Number(b.id || 0));

  return deduped;
}

function buildCategories(tools) {
  const map = new Map();

  for (const t of tools) {
    const category = String(
      t.category || 'Uncategorized'
    ).trim();

    map.set(
      category,
      (map.get(category) || 0) + 1
    );
  }

  return [...map.entries()]
    .map(([category, count]) => ({
      category,
      count
    }))
    .sort((a, b) => b.count - a.count);
}

async function fetchAllBlogsFromAppwrite(env) {
  const collectionId = env.APPWRITE_BLOGS_COLLECTION_ID || 'blogs';
  const blogs = await fetchAllDocumentsFromAppwrite(env, collectionId, 'publishedAt');
  return blogs.map((b) => ({
    ...b,
    category: String(b.category || 'Guides').trim(),
    path: String(b.path || '').trim(),
    hero: String(b.hero || '').trim()
  }));
}

async function fetchAllDocumentsFromAppwrite(env, collectionId, orderField = 'id') {
  const endpoint = env.APPWRITE_ENDPOINT;
  const db = env.APPWRITE_DATABASE_ID;
  const headers = {
    'x-appwrite-project': env.APPWRITE_PROJECT_ID,
    'x-appwrite-key': env.APPWRITE_API_KEY,
    'x-appwrite-response-format': '1.0.0',
    'content-type': 'application/json'
  };
  const docsOut = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const params = new URLSearchParams();
    params.append('queries[]', 'limit(100)');
    params.append('queries[]', `offset(${offset})`);
    params.append('queries[]', `orderDesc("${orderField}")`);
    const url = `${endpoint}/databases/${db}/collections/${collectionId}/documents?${params.toString()}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Appwrite fetch failed (${collectionId}): ${res.status} | ${await res.text()}`);
    const payload = await res.json();
    const docs = payload.documents || [];
    total = Number(payload.total || 0);
    docsOut.push(...docs);
    if (!docs.length) break;
    offset += docs.length;
  }
  return docsOut;
}

function withCors(response) {
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-allow-methods', 'GET,POST,OPTIONS');
  headers.set('access-control-allow-headers', 'Content-Type,x-refresh-token');
  headers.set('vary', 'Origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(data, status = 200) {
  return withCors(new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  }));
}
