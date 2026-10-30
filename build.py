#!/usr/bin/env python3
from pathlib import Path
from html import escape
from html.parser import HTMLParser
import re
try:
    import yaml
except ImportError:
    raise SystemExit('Missing dependency PyYAML. Install with: python -m pip install pyyaml')
ROOT=Path(__file__).resolve().parent
POSTS=ROOT/'cms-content'/'posts'; OUT=ROOT/'cms-generated'
CSS=(ROOT/'blog-theme.css').read_text(encoding='utf-8'); OUT.mkdir(exist_ok=True)
def slugify(v):
    v=str(v or '').strip()
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,79}',v): raise ValueError(f'Invalid slug: {v!r}')
    return v
class HeadingParser(HTMLParser):
    def __init__(self): super().__init__(); self.items=[]; self.current=None; self.buf=[]
    def handle_starttag(self,tag,attrs):
        if tag in ('h2','h3'):
            a=dict(attrs); self.current=(tag,a.get('id','')); self.buf=[]
    def handle_data(self,data):
        if self.current: self.buf.append(data)
    def handle_endtag(self,tag):
        if self.current and tag==self.current[0]:
            label=' '.join(''.join(self.buf).split())
            if self.current[1] and label: self.items.append((self.current[0],self.current[1],label))
            self.current=None; self.buf=[]
def e(v): return escape(str(v or ''),quote=True)
posts=[]
for f in sorted(list(POSTS.glob('*.yml'))+list(POSTS.glob('*.yaml'))):
    d=yaml.safe_load(f.read_text(encoding='utf-8')) or {}
    if not isinstance(d,dict): raise ValueError(f'{f.name}: YAML root must be an object')
    slug=slugify(d.get('slug') or f.stem); title=str(d.get('title') or '').strip()
    if not title: raise ValueError(f'{f.name}: missing title')
    summary=str(d.get('summary') or '').strip(); category=str(d.get('category') or '未分类').strip(); date=str(d.get('date') or '').strip(); body=d.get('body') or ''
    if not isinstance(body,str): raise ValueError(f'{f.name}: body must be HTML text')
    hp=HeadingParser(); hp.feed(body)
    toc=''.join(f'<a class="toc-{tag}" href="#{e(i)}">{e(label)}</a>' for tag,i,label in hp.items)
    page='''<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#0b1017"><meta name="description" content="'''+e(summary)+'''\"><title>'''+e(title)+''' — Aladdin Moore</title><style>'''+CSS+'''</style></head><body><div class="wrap">
<header class="nav"><a class="brand" href="index.html">Aladdin Moore</a><nav class="article-nav" aria-label="主导航"><a href="index.html">首页</a><a href="index.html" aria-current="page">博客</a></nav><a class="back" href="index.html">← 返回文章列表</a></header>
<header class="hero" id="top"><span class="tag">'''+e(category)+'''</span><h1>'''+e(title)+'''</h1><div class="meta">作者：Aladdin Moore　·　'''+e(date)+'''</div><p class="lede">'''+e(summary)+'''</p></header>
<div class="layout"><main class="article">'''+body+'''<a class="toplink" href="#top">↑ 返回文章顶部</a></main><aside class="toc"><h3>文章目录</h3>'''+(toc or '<span class="meta">暂无目录</span>')+'''</aside></div>
<footer class="footer"><span>© 2026 Aladdin Moore</span><a href="index.html">返回测试文章列表 ↗</a></footer></div></body></html>'''
    (OUT/f'{slug}.html').write_text(page,encoding='utf-8'); posts.append((slug,title,summary,category,date))
items='\n'.join('<article><p class="meta">'+e(cat)+'　·　'+e(date)+'</p><h2><a href="'+e(slug)+'.html">'+e(title)+'</a></h2><p class="lede">'+e(summary)+'</p><a href="'+e(slug)+'.html">阅读全文 ↗</a></article>' for slug,title,summary,cat,date in posts)
index='''<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#0b1017"><title>博客文章列表 — Aladdin Moore</title><style>'''+CSS+'''article{padding:22px 0;border-bottom:1px solid var(--line)}article h2{font-size:23px;line-height:1.4;margin:8px 0}article>p{max-width:760px}.list-intro{padding-bottom:20px}</style></head><body><div class="wrap"><header class="nav"><a class="brand" href="index.html">Aladdin Moore</a><nav class="article-nav"><a href="index.html" aria-current="page">文章列表</a></nav><span class="back">CMS 独立测试</span></header><header class="hero list-intro"><h1>博客文章</h1><p class="lede">由 Pages CMS 结构化内容自动生成的测试列表。</p></header><main>'''+(items or '<p class="meta">没有找到 YAML 文章。</p>')+'''</main><footer class="footer"><span>© 2026 Aladdin Moore</span><span>独立测试站点</span></footer></div></body></html>'''
(OUT/'index.html').write_text(index,encoding='utf-8')
print(f'Generated {len(posts)} article page(s) and index.html with original theme CSS.')
