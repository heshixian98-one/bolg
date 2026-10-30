#!/usr/bin/env python3
from pathlib import Path
from html import escape
import re
import yaml
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
POSTS = ROOT / 'cms-content' / 'posts'
OUT = ROOT / 'cms-generated'
CSS = (ROOT / 'blog-theme.css').read_text(encoding='utf-8')
OUT.mkdir(exist_ok=True)


def e(value):
    return escape(str(value or ''), quote=True)


def slugify(value):
    value = str(value or '').strip()
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,79}', value):
        raise ValueError(f'Invalid slug: {value!r}')
    return value


def heading_id(text, number, used):
    # Stable, language-independent IDs; avoids empty IDs for Chinese headings.
    base = re.sub(r'[^A-Za-z0-9_-]+', '-', text).strip('-').lower()
    base = base[:48] or f'section-{number}'
    candidate = base
    suffix = 2
    while candidate in used:
        candidate = f'{base}-{suffix}'
        suffix += 1
    used.add(candidate)
    return candidate


posts = []
for file in sorted(list(POSTS.glob('*.yml')) + list(POSTS.glob('*.yaml'))):
    data = yaml.safe_load(file.read_text(encoding='utf-8')) or {}
    if not isinstance(data, dict):
        raise ValueError(f'{file.name}: YAML root must be an object')

    slug = slugify(data.get('slug') or file.stem)
    title = str(data.get('title') or '').strip()
    if not title:
        raise ValueError(f'{file.name}: missing title')
    summary = str(data.get('summary') or '').strip()
    category = str(data.get('category') or '未分类').strip()
    date = str(data.get('date') or '').strip()
    body = data.get('body') or ''
    if not isinstance(body, str):
        raise ValueError(f'{file.name}: body must be HTML text')

    soup = BeautifulSoup(body, 'html.parser')
    used_ids = {tag.get('id') for tag in soup.select('[id]') if tag.get('id')}
    toc_items = []
    for number, heading in enumerate(soup.find_all(['h2', 'h3']), start=1):
        label = ' '.join(heading.get_text(' ', strip=True).split())
        if not label:
            continue
        anchor = heading.get('id')
        if not anchor:
            anchor = heading_id(label, number, used_ids)
            heading['id'] = anchor
        toc_items.append((heading.name, anchor, label))

    rendered_body = ''.join(str(node) for node in soup.contents)
    toc = ''.join(
        f'<a class="toc-{tag}" href="#{e(anchor)}">{e(label)}</a>'
        for tag, anchor, label in toc_items
    )
    if not toc:
        toc = '<span class="meta">暂无目录</span>'

    page = '''<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#0b1017"><meta name="description" content="''' + e(summary) + '''"><title>''' + e(title) + ''' — Aladdin Moore</title><style>''' + CSS + '''</style></head><body><div class="wrap">
<header class="nav"><a class="brand" href="index.html">Aladdin Moore</a><nav class="article-nav" aria-label="主导航"><a href="index.html">首页</a><a href="index.html" aria-current="page">博客</a></nav><a class="back" href="index.html">← 返回文章列表</a></header>
<header class="hero" id="top"><span class="tag">''' + e(category) + '''</span><h1>''' + e(title) + '''</h1><div class="meta">作者：Aladdin Moore　·　''' + e(date) + '''</div><p class="lede">''' + e(summary) + '''</p></header>
<div class="layout"><main class="article">''' + rendered_body + '''<a class="toplink" href="#top">↑ 返回文章顶部</a></main><aside class="toc" aria-label="文章目录"><h3>文章目录</h3>''' + toc + '''</aside></div>
<footer class="footer"><span>© 2026 Aladdin Moore</span><a href="index.html">返回测试文章列表 ↗</a></footer></div></body></html>'''
    (OUT / f'{slug}.html').write_text(page, encoding='utf-8')
    posts.append((slug, title, summary, category, date))

items = '\n'.join(
    '<article><p class="meta">' + e(category) + '　·　' + e(date) + '</p><h2><a href="' + e(slug) + '.html">' + e(title) + '</a></h2><p class="lede">' + e(summary) + '</p><a href="' + e(slug) + '.html">阅读全文 ↗</a></article>'
    for slug, title, summary, category, date in posts
)
index = '''<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#0b1017"><title>博客文章列表 — Aladdin Moore</title><style>''' + CSS + '''article{padding:22px 0;border-bottom:1px solid var(--line)}article h2{font-size:23px;line-height:1.4;margin:8px 0}article>p{max-width:760px}.list-intro{padding-bottom:20px}</style></head><body><div class="wrap"><header class="nav"><a class="brand" href="index.html">Aladdin Moore</a><nav class="article-nav"><a href="index.html" aria-current="page">文章列表</a></nav><span class="back">CMS 独立测试</span></header><header class="hero list-intro"><h1>博客文章</h1><p class="lede">由 Pages CMS 结构化内容自动生成的测试列表。</p></header><main>''' + (items or '<p class="meta">没有找到 YAML 文章。</p>') + '''</main><footer class="footer"><span>© 2026 Aladdin Moore</span><span>独立测试站点</span></footer></div></body></html>'''
(OUT / 'index.html').write_text(index, encoding='utf-8')
print(f'Generated {len(posts)} article page(s) and index.html; added IDs and TOC entries for headings.')
