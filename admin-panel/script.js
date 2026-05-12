(() => {
const AUTH={u:'m2z.ahmed',p:'TestKey123'};const S='m2z_admin_logged_in',K='m2z_admin_key';const DEV_KEY_DEFAULT='a26c4df24f7eb1584ff638c5d551cfd55359107aa1c0171d15179892c65bb7682038461c2fb06138928dd0a283962d5ecffcc40544f9dd3c572ddafc84b2f950495376b1b3f16cf74eb15ff535a935182a78cfa67537a40b3b04313026aad74896199cbe1f03e22a869fad2c7cd9f4c231024452859721d85de4e04bad7fbdc1';
const $=id=>document.getElementById(id), qs=s=>document.querySelector(s), qsa=s=>[...document.querySelectorAll(s)];
const st={tools:[],page:1,size:20};
function cfg(){return{e:$('awEndpoint').value.trim(),p:$('awProject').value.trim(),d:$('awDatabase').value.trim(),c:$('awToolsTable').value.trim(),cc:'creators',rc:'ranks'}}
function headers(){const saved=localStorage.getItem(K)||'';const dev=saved||DEV_KEY_DEFAULT;return{'x-appwrite-project':cfg().p,'x-appwrite-dev-key':dev,'content-type':'application/json'}}
async function req(path,m='GET',b){let r;try{r=await fetch(`${cfg().e}${path}`,{method:m,headers:headers(),body:b?JSON.stringify(b):undefined});}catch(err){throw new Error('Browser blocked direct Appwrite call. Ensure Web platform + Dev Keys are enabled and origin matches exactly.');}const t=await r.text();let j;try{j=JSON.parse(t)}catch{j={raw:t}}if(!r.ok){if(r.status===401){const msg=j?.message||'Unauthorized';throw new Error(`${msg}. Dev key/session may be invalid or missing rows.read/rows.write scopes.`);}throw new Error(JSON.stringify(j));}return j}
function path(col){return `/databases/${cfg().d}/tables/${col}/rows`}
function showOut(x){$('output').textContent=typeof x==='string'?x:JSON.stringify(x,null,2)}
function setPage(id){qsa('.page').forEach(p=>p.classList.remove('active'));$(id)?.classList.add('active');qsa('.nav-item[data-page]').forEach(n=>n.classList.toggle('active',n.dataset.page===id));$('pageTitle').textContent=id.replace('-',' ').toUpperCase()}
function updateAccess(){const has=!!(localStorage.getItem(K)||'').trim();const keyStatus=$('keyStatus'); if(keyStatus) keyStatus.textContent=has?'API key saved.':'No API key';const lock=$('lockedNotice'); if(lock) lock.classList.toggle('hidden',has);if(has&&$('awApiKey'))$('awApiKey').value='••••••••••';}
function renderTools(){const s=$('toolSearch').value.toLowerCase(),c=$('toolCategoryFilter').value.toLowerCase();let arr=st.tools.filter(t=>(t.title||'').toLowerCase().includes(s)&&(t.category||'').toLowerCase().includes(c));arr.sort((a,b)=>String(a.title||'').localeCompare(String(b.title||'')));const start=(st.page-1)*st.size,view=arr.slice(start,start+st.size);$('toolsTable').innerHTML=view.map(t=>`<tr><td>${t.title||''}</td><td>${t.category||''}</td><td>${t.id||''}</td><td><button data-edit="${t.$id}">Edit</button></td></tr>`).join('');$('pageLabel').textContent=`Page ${st.page} / ${Math.max(1,Math.ceil(arr.length/st.size))}`;qsa('[data-edit]').forEach(b=>b.onclick=()=>{const t=st.tools.find(x=>x.$id===b.dataset.edit);if(!t)return;setPage('tools-add');$('toolDocId').value=t.$id;$('toolId').value=t.id||'';$('toolTitle').value=t.title||'';$('toolCategory').value=t.category||'';$('toolDescription').value=t.description||'';$('toolLink').value=t.link||'';$('toolFeatured').checked=!!t.featured;});}

async function bridgeTools(){
  const u='https://m2zpicks-cache-bridge.m2zinnovative.workers.dev/tools';
  const r=await fetch(u); if(!r.ok) throw new Error('Cache bridge tools fetch failed');
  const j=await r.json();
  return { total:(j.tools||[]).length, documents:(j.tools||[]) };
}

async function loadTools(){let r;try{r=await req(`${path(cfg().c)}?queries[]=limit(500)`);}catch(e){showOut(String(e)+'\nFalling back to cache bridge read...');r=await bridgeTools();}st.tools=r.documents||[];st.page=1;renderTools();$('mTools').textContent=String(r.total||st.tools.length);const map={};st.tools.forEach(t=>map[t.category||'Uncategorized']=(map[t.category||'Uncategorized']||0)+1);$('categoriesOut').textContent=JSON.stringify(Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([category,count])=>({category,count})),null,2);}

if(sessionStorage.getItem(S)==='1'){$('loginView').classList.add('hidden');$('panelView').classList.remove('hidden');updateAccess();}
$('loginForm').onsubmit=e=>{e.preventDefault();if($('username').value.trim()===AUTH.u&&$('password').value===AUTH.p){sessionStorage.setItem(S,'1');$('loginView').classList.add('hidden');$('panelView').classList.remove('hidden');updateAccess();}else $('loginError').classList.remove('hidden');};
$('logoutBtn').onclick=()=>{sessionStorage.removeItem(S);location.reload()};$('saveKeyBtn').onclick=()=>{const v=$('awApiKey').value.trim();if(v&&!v.includes('•'))localStorage.setItem(K,v);updateAccess();};
$('menuBtn').onclick=()=>document.body.classList.toggle('sidebar-open');
qsa('.nav-item[data-page]').forEach(b=>b.onclick=()=>setPage(b.dataset.page));qsa('[data-page]').forEach(b=>b.onclick=()=>setPage(b.dataset.page));
$('loadStatsBtn').onclick=loadTools;$('reloadToolsBtn').onclick=loadTools;$('toolSearch').oninput=renderTools;$('toolCategoryFilter').oninput=renderTools;$('prevPageBtn').onclick=()=>{st.page=Math.max(1,st.page-1);renderTools()};$('nextPageBtn').onclick=()=>{st.page++;renderTools()};
$('createToolBtn').onclick=async()=>{try{const d={id:Number($('toolId').value),title:$('toolTitle').value,category:$('toolCategory').value,description:$('toolDescription').value,link:$('toolLink').value,tags:$('toolTags').value,pricing:$('toolPricing').value,thumbnail:$('toolThumb').value,featured:$('toolFeatured').checked};showOut(await req(path(cfg().c),'POST',{rowId:'unique()',data:d}));await loadTools();}catch(e){showOut(String(e))}};
$('updateToolBtn').onclick=async()=>{try{const id=$('toolDocId').value.trim();const d={id:Number($('toolId').value),title:$('toolTitle').value,category:$('toolCategory').value,description:$('toolDescription').value,link:$('toolLink').value,tags:$('toolTags').value,pricing:$('toolPricing').value,thumbnail:$('toolThumb').value,featured:$('toolFeatured').checked};showOut(await req(`${path(cfg().c)}/${id}`,'PATCH',{data:d}));await loadTools();}catch(e){showOut(String(e))}};
$('deleteToolBtn').onclick=async()=>{try{const id=$('toolDocId').value.trim();showOut(await req(`${path(cfg().c)}/${id}`,'DELETE'));await loadTools();}catch(e){showOut(String(e))}};
const j=(id)=>{const t=$(id).value.trim();return t?JSON.parse(t):{}};
$('listCreatorsBtn').onclick=async()=>showOut(await req(`${path(cfg().cc)}?queries[]=limit(100)`));
$('createCreatorBtn').onclick=async()=>showOut(await req(path(cfg().cc),'POST',{rowId:'unique()',data:j('creatorPayload')}));
$('updateCreatorBtn').onclick=async()=>showOut(await req(`${path(cfg().cc)}/${$('creatorDocId').value.trim()}`,'PATCH',{data:j('creatorPayload')}));
$('deleteCreatorBtn').onclick=async()=>showOut(await req(`${path(cfg().cc)}/${$('creatorDocId').value.trim()}`,'DELETE'));
$('listRanksBtn').onclick=async()=>showOut(await req(`${path(cfg().rc)}?queries[]=limit(100)`));
$('createRankBtn').onclick=async()=>showOut(await req(path(cfg().rc),'POST',{rowId:'unique()',data:j('rankPayload')}));
$('updateRankBtn').onclick=async()=>showOut(await req(`${path(cfg().rc)}/${$('rankDocId').value.trim()}`,'PATCH',{data:j('rankPayload')}));
$('deleteRankBtn').onclick=async()=>showOut(await req(`${path(cfg().rc)}/${$('rankDocId').value.trim()}`,'DELETE'));
})();
