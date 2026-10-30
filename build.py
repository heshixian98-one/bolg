#!/usr/bin/env python3
"""Build isolated HTML previews from Pages CMS YAML posts. Requires PyYAML."""
from pathlib import Path
from html import escape
import re, sys
try:
    import yaml
except ImportError:
    raise SystemExit('Missing dependency PyYAML. Install with: python -m pip install pyyaml')
ROOT = Path(__file__).resolve().parent
POSTS = ROOT / 'cms-content' / 'posts'
OUT = ROOT / 'cms-generated'
OUT.mkdir(exist_ok=True)
CSS = '''
:root{--bg:#0b1017;--card:#111923;--ink:#edf2fa;--muted:#9aa9bc;--line:#202c3a;--accent:#83baff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Arial,"Microsoft YaHei",sans-serif;line-height:1.85}
.wrap{width:min(900px,calc(100% - 32px));margin:auto}.nav{display:flex;justify-content:space-between;gap:14px;padding:22px 0;border-bottom:1px solid var(--line);font-size:13px}.nav a{color:var(--accent);text-decoration:none}.hero{padding:48px 0 28px}.tag{color:var(--accent);border:1px solid #29405a;border-radius:99px;padding:5px 10px;font-size:12px}.hero h1{font-size:clamp(28px,5vw,42px);line-height:1.35}.meta,.lede{color:var(--muted)}.lede{font-size:17px}.article{padding-bottom:64px}.article h2{margin-top:38px;font-size:24px}.article h3{margin-top:26px}.article p,.article li{color:#c2ccda;font-size:15px}.article a{color:var(--accent)}.article img{max-width:100%;height:auto;border-radius:12px}.article pre,.article code{background:#080d13;border-radius:8px;padding:3px 6px;overflow:auto}.article pre{padding:16px}.article table{border-collapse:collapse;max-width:100%}.article td,.article th{border:1px solid var(--line);padding:8px}.quote{margin:24px 0;padding:18px 22px;border-left:3px solid var(--accent);background:var(--card);border-radius:8px}.note{padding:14px 18px;background:var(--card);border:1px solid var(--line);border-radius:10px;color:var(--muted)}.footer{border-top:1px solid var(--line);padding:22px 0;color:var(--muted);font-size:13px}.footer a{color:var(--accent)}
'''
def safe_slug(value):
    value = str(value or '').strip()
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}', value):
        raise ValueError(f'Invalid slug: {value!r}')
    return value
posts=[]
for file in sorted(POSTS.glob('*.yml')) + sorted(POSTS.glob('*.yaml')):
    data=yaml.safe_load(file.read_text(encoding='utf-8')) or {}
    if not isinstance(data, dict): raise ValueError(f'{file.name}: YAML root must be an object')
    slug=safe_slug(data.get('slug') or file.stem)
    title=str(data.get('title') or '').strip()
    if not title: raise ValueError(f'{file.name}: missing title')
    summary=str(data.get('summary') or '').strip()
    category=str(data.get('category') or '未分类').strip()
    date=str(data.get('date') or '').strip()
    body=data.get('body') or ''
    if not isinstance(body,str): raise ValueError(f'{file.name}: body must be HTML text')
    page=f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0b1017"><meta name="description" content="{escape(summary, quote=True)}"><title>{escape(title)} — Aladdin Moore</title><style>{CSS}</style></head><body><div class="wrap"><nav class="nav"><a href="index.html">Aladdin Moore</a><a href="index.html">文章列表</a></nav><header class="hero"><span class="tag">{escape(category)}</span><h1>{escape(title)}</h1><div class="meta">{escape(date)}</div><p class="lede">{escape(summary)}</p></header><main class="article">{body}</main><footer class="footer">© 2026 Aladdin Moore · <a href="index.html">返回测试文章列表</a></footer></div></body></html>'''
    (OUT/f'{slug}.html').write_text(page,encoding='utf-8')
    posts.append((slug,title,summary,category,date))
items='\n'.join(f'<article><p class="meta">{escape(cat)} · {escape(date)}</p><h2><a href="{escape(slug)}.html">{escape(title)}</a></h2><p>{escape(summary)}</p></article>' for slug,title,summary,cat,date in posts)
index=f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CMS 自动生成测试列表</title><style>{CSS}article{{padding:18px 0;border-bottom:1px solid var(--line)}}h1,h2{{line-height:1.4}}a{{color:var(--accent)}}</style></head><body><div class="wrap"><nav class="nav"><strong>Aladdin Moore · CMS TEST</strong><span>独立生成预览</span></nav><header class="hero"><h1>结构化文章测试列表</h1><p class="lede">此页面由 cms-content/posts 中的 YAML 文件自动生成，不会修改正式 blog.html 或 index.html。</p></header><main>{items or '<p>没有找到 YAML 文章。</p>'}</main></div></body></html>'''
(OUT/'index.html').write_text(index,encoding='utf-8')
print(f'Generated {len(posts)} article page(s) and cms-generated/index.html')
