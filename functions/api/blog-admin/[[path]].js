const OWNER = "heshixian98-one";
const REPO = "bolg";
const BRANCH = "main";
const COOKIE = "blog_admin_session";
const MAX_BODY = 900000;
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers } });
const enc = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const unb64 = s => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")), c => c.charCodeAt(0));
async function sign(value, secret) { const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]); return b64(await crypto.subtle.sign("HMAC",key,enc.encode(value))); }
async function validSession(request, env) {
  const raw=(request.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="))?.slice(COOKIE.length+1)||"";
  const [payload,sig]=raw.split("."); if(!payload||!sig||!env.BLOG_ADMIN_PASSWORD) return false;
  try { const value=new TextDecoder().decode(unb64(payload)); const [exp]=value.split(":"); return Number(exp)>Date.now() && await sign(value,env.BLOG_ADMIN_PASSWORD)===sig; } catch { return false; }
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function safeHtml(input){
  let s=String(input||"");
  s=s.replace(/<!--[\s\S]*?-->/g,"").replace(/<(script|style|iframe|object|embed|form|input|button|meta|link|base)[^>]*>[\s\S]*?<\/\1\s*>/gi,"").replace(/<(script|style|iframe|object|embed|form|input|button|meta|link|base)\b[^>]*\/?>/gi,"");
  s=s.replace(/\s(on\w+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,"").replace(/\s(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi,"");
  return s;
}
function markdown(md){
  const lines=String(md).replace(/\r/g,"").split("\n"); let out=[],para=[],list=null,code=false,codeLines=[];
  const flush=()=>{if(para.length){out.push(`<p>${esc(para.join(" ")).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/`([^`]+)`/g,"<code>$1</code>")}</p>`);para=[];}};
  for(const line of lines){ if(line.startsWith("```")){flush(); if(list){out.push(`</${list}>`);list=null;} if(code){out.push(`<pre class="code"><code>${esc(codeLines.join("\n"))}</code></pre>`);codeLines=[];code=false;}else code=true; continue;} if(code){codeLines.push(line);continue;}
    const h=line.match(/^(#{1,3})\s+(.+)/); const li=line.match(/^\s*[-*+]\s+(.+)/); const oi=line.match(/^\s*\d+\.\s+(.+)/);
    if(h){flush();if(list){out.push(`</${list}>`);list=null;}out.push(`<h${h[1].length}>${esc(h[2])}</h${h[1].length}>`);} else if(li||oi){flush();const type=li?"ul":"ol";if(list!==type){if(list)out.push(`</${list}>`);out.push(`<${type}>`);list=type;}out.push(`<li>${esc((li||oi)[1])}</li>`);} else {if(list){out.push(`</${list}>`);list=null;}if(line.trim())para.push(line.trim());else flush();}
  }
  flush();if(list)out.push(`</${list}>`);if(code)out.push(`<pre class="code"><code>${esc(codeLines.join("\n"))}</code></pre>`);return out.join("\n");
}
async function gh(path, env, trace=()=>{}){
  trace("github-get-start", { path });
  const url=`https://api.github.com/repos/${env.GITHUB_OWNER||OWNER}/${env.GITHUB_REPO||REPO}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(env.GITHUB_BRANCH||BRANCH)}`;
  const r=await fetch(url,{headers:{Authorization:`Bearer ${env.GITHUB_TOKEN}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}});
  trace("github-get-response", { path, status:r.status, requestId:r.headers.get("x-github-request-id") || "" });
  if(r.status===404)return null;
  const raw=await r.text();
  if(!r.ok){let detail="";try{detail=JSON.parse(raw).message||"";}catch{} throw new Error(`GitHub 读取 ${path} 失败 (${r.status})${detail?": "+detail:""}`);}
  let d;try{d=JSON.parse(raw);}catch{throw new Error(`GitHub 读取 ${path} 返回了无法解析的 JSON。`);}
  if(!d.content || !d.sha) throw new Error(`GitHub 文件 ${path} 响应缺少 content 或 sha。`);
  return {sha:d.sha,text:new TextDecoder().decode(Uint8Array.from(atob(d.content.replace(/\n/g,"")),c=>c.charCodeAt(0)))};
}
async function put(path, content, message, env, trace=()=>{}){
  trace("github-put-start", { path, chars:String(content).length });
  const old=await gh(path,env,trace);const bytes=enc.encode(content);let binary="";for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  const body={message,content:btoa(binary),branch:env.GITHUB_BRANCH||BRANCH};if(old?.sha)body.sha=old.sha;
  const url=`https://api.github.com/repos/${env.GITHUB_OWNER||OWNER}/${env.GITHUB_REPO||REPO}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
  const r=await fetch(url,{method:"PUT",headers:{Authorization:`Bearer ${env.GITHUB_TOKEN}`,Accept:"application/vnd.github+json","Content-Type":"application/json","X-GitHub-Api-Version":"2022-11-28"},body:JSON.stringify(body)});
  trace("github-put-response", { path, status:r.status, requestId:r.headers.get("x-github-request-id") || "" });
  const raw=await r.text();
  if(!r.ok){let detail="";try{detail=JSON.parse(raw).message||"";}catch{} throw new Error(`GitHub 提交 ${path} 失败 (${r.status})${detail?": "+detail:""}`);}
  let result;try{result=JSON.parse(raw);}catch{throw new Error(`GitHub 提交 ${path} 返回了无法解析的 JSON。`);}
  trace("github-put-complete", { path, commit:result.commit?.sha || "" });
  return result;
}
function postPage({title,category,summary,html,date,minutes}){return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0b1017"><meta name="description" content="${esc(summary)}"><title>${esc(title)} — Aladdin Moore</title><style>:root{--bg:#0b1017;--card:#111923;--ink:#edf2fa;--muted:#9aa9bc;--line:#202c3a;--accent:#83baff}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Arial,"Microsoft YaHei",sans-serif;line-height:1.85}.wrap{width:min(900px,calc(100% - 32px));margin:auto}.nav{display:flex;justify-content:space-between;gap:14px;padding:22px 0;border-bottom:1px solid var(--line);font-size:13px}.nav a{color:var(--accent);text-decoration:none}.hero{padding:48px 0 28px}.tag{color:var(--accent);border:1px solid #29405a;border-radius:99px;padding:5px 10px;font-size:12px}.hero h1{font-size:clamp(28px,5vw,42px);line-height:1.35}.meta,.lede{color:var(--muted)}.lede{font-size:17px}.article{padding-bottom:64px}.article h2{margin-top:38px;font-size:24px}.article h3{margin-top:26px}.article p,.article li{color:#c2ccda;font-size:15px}.article a{color:var(--accent)}.article img{max-width:100%;height:auto;border-radius:12px}.article pre,.article code{background:#080d13;border-radius:8px;padding:3px 6px;overflow:auto}.article pre{padding:16px}.article table{border-collapse:collapse;max-width:100%}.article td,.article th{border:1px solid var(--line);padding:8px}.footer{border-top:1px solid var(--line);padding:20px 0;color:var(--muted);font-size:12px}</style></head><body><div class="wrap"><header class="nav"><a href="index.html">Aladdin Moore</a><nav><a href="index.html">首页</a>　<a href="blog.html">博客</a>　<a href="guestbook.html">留言板</a></nav><a href="blog.html">← 返回博客</a></header><header class="hero"><span class="tag">${esc(category)}</span><h1>${esc(title)}</h1><div class="meta">作者：Aladdin Moore · ${esc(date)} · 预计阅读 ${minutes} 分钟</div><p class="lede">${esc(summary)}</p></header><main class="article">${html}</main><footer class="footer">© ${new Date().getFullYear()} Aladdin Moore · <a href="blog.html">返回博客</a></footer></div></body></html>`;}
function card({slug,title,category,summary,date,minutes}){return `<article class="post-card"><div><span class="category">${esc(category)}</span><h2><a href="${slug}.html">${esc(title)}</a></h2><p>${esc(summary)}</p><div class="meta">Aladdin Moore　·　${esc(date)}　·　预计阅读 ${minutes} 分钟</div></div><a class="read-link" href="${slug}.html">阅读全文 ↗</a></article>`;}
function previewCard({slug,title,category,summary,date,minutes}){return `<article class="post-preview"><div class="post-preview-copy"><span class="post-category">${esc(category)}</span><h3><a href="${slug}.html">${esc(title)}</a></h3><p>${esc(summary)}</p><div class="post-meta">${esc(date)}　·　预计阅读 ${minutes} 分钟</div></div><a class="post-read" href="${slug}.html">阅读全文 ↗</a></article>`;}
export async function onRequest({request,env}){
 const requestId=request.headers.get("cf-ray")||"unknown";
 const trace=(stage,details={})=>console.log("[blog-admin]",JSON.stringify({requestId,stage,...details}));
 const url=new URL(request.url);const action=url.pathname.split("/").pop();
 if(action==="publish") trace("publish-enter", { method:request.method, hasSession:Boolean(request.headers.get("Cookie")), hasGithubToken:Boolean(env.GITHUB_TOKEN), owner:env.GITHUB_OWNER||OWNER, repo:env.GITHUB_REPO||REPO, branch:env.GITHUB_BRANCH||BRANCH });
 if(request.method==="POST"&&action==="login"){
  if(!env.BLOG_ADMIN_PASSWORD)return json({error:"请先配置 BLOG_ADMIN_PASSWORD。"},503);
  const input=await request.json().catch(()=>({}));if(typeof input.password!=="string"||input.password.length>256||input.password!==env.BLOG_ADMIN_PASSWORD)return json({error:"管理员密码不正确。"},401);
  const value=`${Date.now()+8*60*60*1000}:${crypto.randomUUID()}`;const payload=b64(enc.encode(value));const sig=await sign(value,env.BLOG_ADMIN_PASSWORD);return json({ok:true},200,{"Set-Cookie":`${COOKIE}=${payload}.${sig}; Path=/api/blog-admin; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`});
 }
 if(action==="logout")return json({ok:true},200,{"Set-Cookie":`${COOKIE}=; Path=/api/blog-admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`});
 if(!await validSession(request,env))return json({error:"登录状态已失效，请重新登录。"},401);
 if(action==="session")return json({ok:true});
 if(action==="publish"&&request.method==="POST"){
  if(!env.GITHUB_TOKEN)return json({error:"请先配置 GITHUB_TOKEN。"},503);
  const len=Number(request.headers.get("Content-Length")||0);trace("publish-body", { contentLength:len });if(len>MAX_BODY)return json({error:"提交内容过大。"},413);
  const data=await request.json().catch(()=>null);if(!data)return json({error:"请求内容无效。"},400);
  const title=String(data.title||"").trim(),category=String(data.category||"技术分享").trim(),summary=String(data.summary||"").trim(),slug=String(data.slug||"").trim(),mode=data.mode==="html"?"html":"markdown";
  if(!title||!summary||!slug||!/^[a-z0-9][a-z0-9-]{1,55}$/.test(slug))return json({error:"标题、摘要和英文文件名必填；文件名仅允许小写字母、数字和连字符。"},400);
  const html=safeHtml(mode==="html"?data.content:markdown(data.content));if(!html.trim())return json({error:"文章正文不能为空。"},400);
  const date=new Date().toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric",timeZone:"Asia/Shanghai"});const minutes=Math.max(1,Math.ceil(String(data.content).length/450));const meta={slug,title,category,summary,date,minutes};
  let stage="read-blog-and-home";
  try{
   trace("stage", { name:stage });
   const blog=await gh("blog.html",env,trace),index=await gh("index.html",env,trace);if(!blog||!index)throw new Error("找不到博客列表或首页文件。");
   const page=postPage({...meta,html});
   let blogText=blog.text;if(!blogText.includes("<!-- BLOG_POSTS_START -->")||!blogText.includes("<!-- BLOG_POSTS_END -->"))throw new Error("博客列表缺少文章插入标记，请先部署后台配套版本。");
   const start=blogText.indexOf("<!-- BLOG_POSTS_START -->")+"<!-- BLOG_POSTS_START -->".length,end=blogText.indexOf("<!-- BLOG_POSTS_END -->");let cards=blogText.slice(start,end);const exists=cards.includes(`href="${slug}.html"`);if(exists&&!data.updateExisting)return json({error:"这个文件名已存在。如需覆盖更新，请勾选‘更新已有文章’。"},409);if(data.updateExisting&&!exists)return json({error:"博客列表中没有找到该文件名对应的文章，无法按更新模式发布。"},404);
   if(exists){let replaced=false;cards=cards.replace(/<article class="post-card">[\s\S]*?<\/article>/g,block=>{if(block.includes(`href="${slug}.html"`)){replaced=true;return card(meta);}return block;});if(!replaced)throw new Error("无法安全定位待更新的文章卡片。");}else{cards=`\n      ${card(meta)}\n${cards}`;blogText=blogText.replace(/(\d{4} 年 · )(\d+)( 篇文章)/,(_,a,n,c)=>a+(Number(n)+1)+c).replace(/(\d{4} 年　·　)(\d+)( 篇文章)/,(_,a,n,c)=>a+(Number(n)+1)+c);}blogText=blogText.slice(0,start)+cards+blogText.slice(end);
   let indexText=index.text;if(!indexText.includes("<!-- BLOG_LATEST_START -->")||!indexText.includes("<!-- BLOG_LATEST_END -->"))throw new Error("首页缺少最新文章插入标记，请先部署后台配套版本。");
   const is=indexText.indexOf("<!-- BLOG_LATEST_START -->")+"<!-- BLOG_LATEST_START -->".length,ie=indexText.indexOf("<!-- BLOG_LATEST_END -->");indexText=indexText.slice(0,is)+"\n      "+previewCard(meta)+"\n      "+indexText.slice(ie);
   // Serialize commits to avoid Contents API races. GitHub remains the source of truth.
   stage="write-article";trace("stage", { name:stage, path:`${slug}.html` });
   await put(`${slug}.html`,page,`${data.updateExisting?"Update":"Publish"} blog post: ${title}`,env,trace);
   stage="write-blog-index";trace("stage", { name:stage });
   await put("blog.html",blogText,`Update blog index: ${title}`,env,trace);
   stage="write-homepage";trace("stage", { name:stage });
   await put("index.html",indexText,`Update homepage latest post: ${title}`,env,trace);
   trace("publish-success", { slug });
   return json({ok:true,slug,url:`/${slug}.html`,message:"文章已提交到 GitHub。Cloudflare Pages 将根据 main 分支的 Git 集成自动部署；请稍后检查正式网站。"});
  }catch(e){
   const message=e&&e.message?e.message:String(e);
   console.error("[blog-admin]",JSON.stringify({requestId,stage,errorName:e?.name||"Error",message}));
   return json({error:message||"发布失败。",stage,requestId},502);
  }
 }
 return json({error:"不支持的请求。"},404);
}
