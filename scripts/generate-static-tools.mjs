import fs from 'fs/promises';
import path from 'path';

const ROOT = process.cwd();
const TEMPLATE_PATH = path.join(ROOT, 'detailed.html');
const OUT_DIR = path.join(ROOT, 'tools');
const FALLBACK_JSON = path.join(ROOT, 'homepage.json');
const BRIDGE = 'https://m2zpicks-cache-bridge.m2zinnovative.workers.dev/tools';

const esc = (v='') => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const slugify = (s='') => String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/-{2,}/g,'-') || 'tool';
const logo = (link,size=128)=>{try{return `https://www.google.com/s2/favicons?domain=${new URL(link).hostname.replace(/^www\./,'')}&sz=${size}`;}catch{return './fallback.png';}};

async function loadTools(){
  try {
    const res = await fetch(BRIDGE, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.tools) && json.tools.length) return json.tools;
    }
  } catch {}
  try {
    const endpoint = 'https://sfo.cloud.appwrite.io/v1';
    const project = 'm2zpicks';
    const db = 'm2zpicks-db';
    const col = 'tools';
    const all = [];
    let offset = 0;
    let total = Infinity;
    while (offset < total) {
      const q = new URLSearchParams();
      q.append('queries[]', 'limit(100)');
      q.append('queries[]', `offset(${offset})`);
      const res = await fetch(`${endpoint}/databases/${db}/collections/${col}/documents?${q.toString()}`, { headers: { 'x-appwrite-project': project } });
      if (!res.ok) break;
      const json = await res.json();
      const docs = json.documents || [];
      total = Number(json.total || 0);
      all.push(...docs);
      if (!docs.length) break;
      offset += docs.length;
    }
    if (all.length) return all;
  } catch {}
  const raw = await fs.readFile(FALLBACK_JSON,'utf8');
  const json = JSON.parse(raw);
  if (Array.isArray(json.featuredTools) && json.featuredTools.length) return json.featuredTools;
  throw new Error('No tools found from bridge/appwrite/homepage.json');
}

function injectStatic(html, tool){
  const title = `${esc(tool.title)} | M2ZPicks`;
  let out = html
    .replace('<title>AI Tool Details | M2ZPicks</title>', `<title>${title}</title>`)
    .replace('<meta name="description" content="Detailed AI tool profile including category, overview, related tools, and official link." />', `<meta name="description" content="${esc((tool.description||'').slice(0,155))}" />`);

  const article = `<div class="detail-head"><img class="tool-logo tool-logo-lg" src="${logo(tool.link,128)}" alt="${esc(tool.title)} logo"><div><h1>${esc(tool.title)}</h1><a class="badge badge-link" href="../category.html?name=${encodeURIComponent(tool.category||'Uncategorized')}">${esc(tool.category||'Uncategorized')}</a></div></div><p>${esc(tool.description||'')}</p><div class="card-actions"><a class="btn btn-primary" href="${esc(tool.link||'#')}" target="_blank" rel="noopener noreferrer">Visit Tool</a><a class="btn btn-secondary" href="../list.html">Back to list</a><a class="btn btn-secondary" href="../detailed.html?id=${tool.id}">Dynamic Fallback</a></div>`;
  out = out.replace('<nav class="breadcrumb" id="breadcrumb" aria-label="Breadcrumb"></nav>', `<nav class="breadcrumb" aria-label="Breadcrumb"><a href="../index.html">Home</a> &gt; <a href="../category.html?name=${encodeURIComponent(tool.category||'Uncategorized')}">${esc(tool.category||'Uncategorized')}</a> &gt; <span>${esc(tool.title)}</span></nav>`);
  out = out.replace('<article id="toolDetails" class="tool-article"></article>', `<article class="tool-article">${article}</article>`);
  out = out.replace('<div class="grid" id="relatedTools"></div>', '<div class="grid"><p class="muted">Explore more tools from this category on the category page.</p></div>');
  out = out.replace(/<script src="https:\/\/cdn\.jsdelivr[\s\S]*?<\/script>\n\s*<script src="appwrite\.js"[\s\S]*?<\/script>\n\s*<script src="script\.js[\s\S]*?<\/script>/,'');
  out = out.replace('<body data-page="detailed">','<body data-page="detailed-static">');
  return out;
}

const tpl = await fs.readFile(TEMPLATE_PATH,'utf8');
const tools = await loadTools();
await fs.mkdir(OUT_DIR,{recursive:true});
const used = new Set();
for (const t of tools){
  let slug = slugify(t.slug || t.title);
  if (used.has(slug)) slug = `${slug}-${t.id || Math.random().toString(36).slice(2,6)}`;
  used.add(slug);
  const page = injectStatic(tpl,t);
  await fs.writeFile(path.join(OUT_DIR, `${slug}.html`), page);
}
console.log(`Generated ${tools.length} static tool pages in /tools`);
