(() => {
  'use strict';

  const CACHE_BRIDGE_BASE = 'https://m2zpicks-cache-bridge.m2zinnovative.workers.dev';
  const ENDPOINT = 'https://sfo.cloud.appwrite.io/v1';
  const PROJECT_ID = 'm2zpicks';
  const DATABASE_ID = 'm2zpicks-db';
  const COLLECTIONS = { tools: 'tools', ranks: 'ranks', creators: 'creators', blogs: 'blogs' };
  const TTL_MS = 10 * 60 * 1000;

  const { Client, Databases, Query } = window.Appwrite;
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
  const db = new Databases(client);

  const readCache = (key) => {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.ts) return null;
      if (Date.now() - parsed.ts > TTL_MS) return null;
      return parsed.data;
    } catch { return null; }
  };

  const writeCache = (key, data) => sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));

  function normalizeTool(tool) {
    return {
      ...tool,
      category: String(tool?.category || 'Uncategorized').trim()
    };
  }

  function uniqTools(tools) {
    const seen = new Set();
    const out = [];
    for (const t of (tools || [])) {
      const normalized = normalizeTool(t);
      const key = normalized.$id || `id:${normalized.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(normalized);
    }
    return out;
  }

  async function fetchBridge(path, cacheKey) {
    const cached = readCache(cacheKey);
    if (cached) return cached;

    const res = await fetch(`${CACHE_BRIDGE_BASE}${path}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Cache bridge failed: ${res.status} ${path}`);

    const json = await res.json();
    writeCache(cacheKey, json);
    return json;
  }


  async function fetchAllToolsDirect() {
    return fetchAllPaginated(COLLECTIONS.tools, 'mz_tools_cache_direct');
  }

  async function fetchBridgeWithFallback(path, cacheKey, fallbackFn) {
    try {
      return await fetchBridge(path, cacheKey);
    } catch (_err) {
      return fallbackFn();
    }
  }

  async function fetchAllPaginated(collectionId, cacheKey) {
    const cached = readCache(cacheKey);
    if (cached) return cached;

    const all = [];
    let offset = 0;
    let total = Infinity;

    while (offset < total) {
      const res = await db.listDocuments(DATABASE_ID, collectionId, [Query.limit(100), Query.offset(offset)]);
      total = res.total;
      all.push(...res.documents);
      offset += res.documents.length;
      if (!res.documents.length) break;
    }

    writeCache(cacheKey, all);
    return all;
  }

  const fetchAllTools = async () => {
    const payload = await fetchBridgeWithFallback('/tools', 'mz_tools_cache_bridge', async () => ({ tools: await fetchAllToolsDirect() }));
    return uniqTools(payload.tools || []);
  };

  const fetchCategories = async () => {
    const tools = await fetchAllTools();
    return buildCategories(tools);
  };

  const fetchBridgeStats = async () => {
    const tools = await fetchAllTools();
    const categories = buildCategories(tools);
    return { totalTools: tools.length, totalCategories: categories.length, lastRefreshedAt: null };
  };

  const fetchLatestTools = async () => {
    const payload = await fetchBridgeWithFallback('/latest', 'mz_latest_cache_bridge', async () => ({
      latest: (await fetchAllToolsDirect()).slice().sort((a, b) => new Date(b.$createdAt) - new Date(a.$createdAt)).slice(0, 50)
    }));
    return uniqTools(payload.latest || []);
  };

  const fetchAllRanks = () => fetchAllPaginated(COLLECTIONS.ranks, 'mz_ranks_cache');
  const fetchAllCreators = () => fetchAllPaginated(COLLECTIONS.creators, 'mz_creators_cache');
  const fetchAllBlogsDirect = () => fetchAllPaginated(COLLECTIONS.blogs, 'mz_blogs_cache_direct');

  const normalizeBlog = (blog) => ({
    ...blog,
    slug: String(blog?.slug || '').trim(),
    title: String(blog?.title || '').trim(),
    excerpt: String(blog?.excerpt || '').trim(),
    readTime: String(blog?.readTime || '').trim(),
    path: String(blog?.path || '').trim(),
    hero: String(blog?.hero || '').trim(),
    category: String(blog?.category || 'Guides').trim(),
    publishedAt: blog?.publishedAt || blog?.$createdAt || null
  });

  const fetchAllBlogs = async () => {
    const payload = await fetchBridgeWithFallback('/blogs', 'mz_blogs_cache_bridge', async () => ({ blogs: await fetchAllBlogsDirect() }));
    return (payload.blogs || []).map(normalizeBlog).sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  };

  const fetchLatestBlogs = async () => {
    const payload = await fetchBridgeWithFallback('/blogs/latest', 'mz_latest_blogs_cache_bridge', async () => ({ latest: await fetchAllBlogs() }));
    return (payload.latest || []).map(normalizeBlog).sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  };

  const fetchBlogCategories = async () => {
    const payload = await fetchBridgeWithFallback('/blogs/categories', 'mz_blog_categories_cache_bridge', async () => ({ categories: buildCategories(await fetchAllBlogs()) }));
    return payload.categories || [];
  };

  const fetchBlogsByCategory = async (category, limit = 6) => {
    const blogs = await fetchAllBlogs();
    return blogs.filter((b) => String(b.category) === String(category).trim()).slice(0, limit);
  };

  function buildCategories(tools) {
    const map = new Map();
    tools.forEach((t) => {
      const category = String(t.category || 'Uncategorized').trim();
      map.set(category, (map.get(category) || 0) + 1);
    });
    return [...map.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
  }

  async function fetchRankedTools() {
    const [tools, ranks] = await Promise.all([fetchAllTools(), fetchAllRanks()]);
    const rankById = new Map(ranks.map(r => [Number(r.id), r]));
    return tools.filter(t => rankById.has(Number(t.id))).map(t => ({ ...t, ...rankById.get(Number(t.id)) })).sort((a, b) => a.rank - b.rank);
  }

  async function fetchToolById(numericId) {
    const tools = await fetchAllTools();
    return tools.find(t => Number(t.id) === Number(numericId)) || null;
  }

  async function fetchToolsByCategory(category, limit = 24) {
    const tools = await fetchAllTools();
    return tools
      .filter((t) => String(t.category) === String(category).trim())
      .sort((a, b) => new Date(b.$createdAt) - new Date(a.$createdAt))
      .slice(0, limit);
  }

  async function fetchToolsPage(limit = 48, cursorAfter = null) {
    const tools = (await fetchAllTools()).slice().sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), undefined, { sensitivity: 'base' }));
    let start = 0;

    if (cursorAfter) {
      const idx = tools.findIndex((t) => t.$id === cursorAfter);
      start = idx >= 0 ? idx + 1 : 0;
    }

    const documents = tools.slice(start, start + limit);
    const nextCursor = documents.length === limit ? documents[documents.length - 1].$id : null;

    return { documents, total: tools.length, nextCursor };
  }

  async function fetchFeaturedTools(limit = 24) {
    const latest = await fetchLatestTools();
    return latest.slice(0, limit);
  }

  async function fetchHomepageStats() {
    const stats = await fetchBridgeStats();
    const categories = await fetchCategories();

    return {
      totalTools: stats.totalTools || 0,
      totalCategories: stats.totalCategories || 0,
      topCategories: categories
    };
  }

  async function fetchToolsByIds(ids) {
    const uniq = [...new Set((ids || []).map((id) => Number(id)).filter(Boolean))];
    if (!uniq.length) return [];
    const tools = await fetchAllTools();
    const idSet = new Set(uniq);
    return tools.filter((t) => idSet.has(Number(t.id)));
  }

  async function getCreatorPickLookup() {
    const creators = await fetchAllCreators();
    const map = new Map();
    creators.forEach((c) => (c.pick_ids || []).forEach((id) => {
      const k = Number(id);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(c);
    }));
    return map;
  }

  window.AppwriteLayer = {
    fetchAllTools,
    fetchCategories,
    fetchAllRanks,
    fetchRankedTools,
    fetchToolById,
    fetchToolsByCategory,
    fetchToolsByIds,
    fetchToolsPage,
    fetchFeaturedTools,
    fetchHomepageStats,
    fetchAllCreators,
    getCreatorPickLookup,
    fetchAllBlogs,
    fetchLatestBlogs,
    fetchBlogCategories,
    fetchBlogsByCategory
  };
})();
