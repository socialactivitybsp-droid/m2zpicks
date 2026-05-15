import fs from 'fs/promises';
import path from 'path';

const ROOT = process.cwd();
const TEMPLATE_PATH = path.join(ROOT, 'detailed.html');
const OUT_DIR = path.join(ROOT, 'tools');
const BRIDGE_BASE = 'https://m2zpicks-cache-bridge.m2zinnovative.workers.dev';

const esc = (v='') => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const slugify = (s='') => String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/-{2,}/g,'-') || 'tool';
const logo = (link,size=128)=>{try{return `https://www.google.com/s2/favicons?domain=${new URL(link).hostname.replace(/^www\./,'')}&sz=${size}`;}catch{return '../fallback.png';}};
const score = (v)=>Math.max(0,Math.min(100,parseInt(v,10)||0));
const contextFmt=(v)=>{const n=parseInt(v,10)||0;return n?`${n}K`:'0K';};

async function tryJson(url){try{const r=await fetch(url,{cache:'no-store'});if(r.ok)return await r.json();}catch{}return null;}

async function loadAll() {
  const [toolsPayload, ranksPayload] = await Promise.all([
    tryJson(`${BRIDGE_BASE}/tools`),
    tryJson(`${BRIDGE_BASE}/ranks`) // may not exist
  ]);

  const tools = Array.isArray(toolsPayload?.tools) ? toolsPayload.tools : [];
  let ranks = Array.isArray(ranksPayload?.ranks) ? ranksPayload.ranks : [];

  // fallback for ranks from Appwrite public read
  if (!ranks.length) {
    try {
      const endpoint = 'https://sfo.cloud.appwrite.io/v1';
      const db = 'm2zpicks-db';
      const project = 'm2zpicks';
      const col = 'ranks';
      const q = new URLSearchParams(); q.append('queries[]','limit(500)');
      const r = await fetch(`${endpoint}/databases/${db}/collections/${col}/documents?${q.toString()}`,{headers:{'x-appwrite-project':project}});
      if (r.ok) ranks = (await r.json()).documents || [];
    } catch {}
  }

  // creators from AppwriteLayer-like public endpoint
  let creators = [];
  try {
    const endpoint = 'https://sfo.cloud.appwrite.io/v1';
    const db = 'm2zpicks-db';
    const project = 'm2zpicks';
    const col = 'creators';
    const q = new URLSearchParams(); q.append('queries[]','limit(500)');
    const r = await fetch(`${endpoint}/databases/${db}/collections/${col}/documents?${q.toString()}`,{headers:{'x-appwrite-project':project}});
    if (r.ok) creators = (await r.json()).documents || [];
  } catch {}

  if (!tools.length) throw new Error('No tools data available from cache bridge');
  return { tools, ranks, creators };
}

function parsePickIds(v){if(Array.isArray(v)) return v.map(Number).filter(Boolean);if(typeof v==='string'){try{return JSON.parse(v).map(Number).filter(Boolean);}catch{return [];}}return [];}

function buildPage(template, tool, ctx) {
  const { tools, rankById, creatorByToolId, slugById } = ctx;
  const slug = slugById.get(Number(tool.id)) || slugify(tool.slug || tool.title);
  const title = `${esc(tool.title)} | M2ZPicks`;
  const category = tool.category || 'Uncategorized';
  const desc = esc(tool.description || '');

  const idx = tools.findIndex((t)=>Number(t.id)===Number(tool.id));
  const prev = idx>0 ? tools[idx-1] : null;
  const next = idx>=0 && idx<tools.length-1 ? tools[idx+1] : null;
  const rank = rankById.get(Number(tool.id));
  const creators = creatorByToolId.get(Number(tool.id)) || [];
  const related = tools.filter((t)=>String(t.category)===String(category) && Number(t.id)!==Number(tool.id)).slice(0,4);

  const details = `<div class="detail-head"><img class="tool-logo tool-logo-lg" src="${logo(tool.link,128)}" alt="${esc(tool.title)} logo"><div><h1>${esc(tool.title)}</h1><a class="badge badge-link" href="../category.html?name=${encodeURIComponent(category)}">${esc(category)}</a></div></div><p>${desc}</p><div class="card-actions"><button class="btn btn-secondary">☆</button><a class="btn btn-primary" href="${esc(tool.link||'#')}" target="_blank" rel="noopener noreferrer">Visit Tool</a><a class="btn btn-secondary" href="../list.html">Back to list</a></div><div class="tool-nav">${prev?`<a class="btn btn-secondary" href="./${slugById.get(Number(prev.id))}.html">← ${esc(prev.title)}</a>`:''}${next?`<a class="btn btn-secondary" href="./${slugById.get(Number(next.id))}.html">${esc(next.title)} →</a>`:''}</div>${rank?`<div class="detail-rank-card"><div class="rank-card-head"><div><span class="rank-eyebrow">AI Benchmark</span><h3>📊 Rankings Score</h3></div><a href="../rankings.html" class="text-link rank-link">See full rankings →</a></div><div class="rank-scores-row"><div class="rank-score-item"><span class="score-num">${score(rank.overall)}</span><span class="score-lbl">Overall</span><span class="score-bar"><span style="width:${score(rank.overall)}%"></span></span></div><div class="rank-score-item"><span class="score-num">${score(rank.reasoning)}</span><span class="score-lbl">Reasoning</span><span class="score-bar"><span style="width:${score(rank.reasoning)}%"></span></span></div><div class="rank-score-item"><span class="score-num">${score(rank.coding)}</span><span class="score-lbl">Coding</span><span class="score-bar"><span style="width:${score(rank.coding)}%"></span></span></div><div class="rank-score-item"><span class="score-num">${score(rank.vision)}</span><span class="score-lbl">Vision</span><span class="score-bar"><span style="width:${score(rank.vision)}%"></span></span></div><div class="rank-score-item rank-context-item"><span class="score-num context-num">${contextFmt(rank.context)}</span><span class="score-lbl">Context</span><span class="score-note">window</span></div></div></div>`:''}${creators.length?`<div class="creator-endorsements"><h3>🎬 Creator Endorsed</h3>${creators.map(c=>`<a class="creator-chip" href="../creators.html?slug=${esc(c.slug||'')}"><img src="${esc(c.avatar_url||'../fallback.png')}">${esc(c.name||'Creator')}</a>`).join('')}</div>`:''}`;

  const relatedHtml = related.map((t)=>`<article class="tool-card"><div class="tool-card-top"><img class="tool-logo" src="${logo(t.link,96)}" alt="${esc(t.title)} logo"><div class="tool-card-meta"><a class="badge badge-link" href="../category.html?name=${encodeURIComponent(t.category||'Uncategorized')}">${esc(t.category||'Uncategorized')}</a></div></div><h3>${esc(t.title)}</h3><p class="description-2">${esc(t.description||'')}</p><div class="card-actions"><a class="btn btn-secondary" href="./${slugById.get(Number(t.id))}.html">View Details</a></div></article>`).join('');

  let out = template
    .replace('<title>AI Tool Details | M2ZPicks</title>', `<title>${title}</title>`)
    .replace('<meta name="description" content="Detailed AI tool profile including category, overview, related tools, and official link." />', `<meta name="description" content="${esc((tool.description||'').slice(0,155))}" />`)
    .replace('<nav class="breadcrumb" id="breadcrumb" aria-label="Breadcrumb"></nav>', `<nav class="breadcrumb" aria-label="Breadcrumb"><a href="../index.html">Home</a> &gt; <a href="../category.html?name=${encodeURIComponent(category)}">${esc(category)}</a> &gt; <span>${esc(tool.title)}</span></nav>`)
    .replace('<article id="toolDetails" class="tool-article"></article>', `<article class="tool-article">${details}</article>`)
    .replace('<div class="grid" id="relatedTools"></div>', `<div class="grid">${relatedHtml || '<p class="muted">No related tools available.</p>'}</div>`)
    .replace('href="index.html"','href="../index.html"')
    .replace('href="list.html"','href="../list.html"')
    .replace('href="creators.html"','href="../creators.html"')
    .replace('href="rankings.html"','href="../rankings.html"')
    .replace('href="blogs/index.html"','href="../blogs/index.html"')
    .replace('href="about.html"','href="../about.html"')
    .replace('href="privacy.html"','href="../privacy.html"')
    .replace('href="contact.html"','href="../contact.html"')
    .replace('src="style.css"','src="../style.css"')
    .replace('href="style.css"','href="../style.css"')
    .replace('<body data-page="detailed">','<body data-page="detailed-static">')
    .replace(/<script src="https:\/\/cdn\.jsdelivr[\s\S]*?<\/script>\n\s*<script src="appwrite\.js"[\s\S]*?<\/script>\n\s*<script src="script\.js[\s\S]*?<\/script>/,'');

  return out;
}

const template = await fs.readFile(TEMPLATE_PATH,'utf8');
const { tools, ranks, creators } = await loadAll();
await fs.mkdir(OUT_DIR, { recursive: true });

const sortedTools = tools.slice().sort((a,b)=>Number(a.id)-Number(b.id));
const slugById = new Map();
const used = new Set();
for (const t of sortedTools){
  let s = slugify(t.slug || t.title);
  if (used.has(s)) s = `${s}-${t.id}`;
  used.add(s);
  slugById.set(Number(t.id), s);
}

const rankById = new Map((ranks||[]).map(r=>[Number(r.id),r]));
const creatorByToolId = new Map();
for (const c of creators || []) {
  for (const id of parsePickIds(c.pick_ids || c.picks_ids)) {
    if (!creatorByToolId.has(id)) creatorByToolId.set(id, []);
    creatorByToolId.get(id).push(c);
  }
}

for (const t of sortedTools) {
  const html = buildPage(template, t, { tools: sortedTools, rankById, creatorByToolId, slugById });
  await fs.writeFile(path.join(OUT_DIR, `${slugById.get(Number(t.id))}.html`), html, 'utf8');
}

console.log(`Generated ${sortedTools.length} static tool pages into /tools`);
