# Aladdin Moore 博客文章管理后台升级

## 本次新增
- 管理后台从 GitHub `main` 读取文章列表
- 在线载入文章并按原文件名更新
- 二次确认删除文章
- 删除时同步更新 `blog.html` 文章卡片与 `index.html` 最新文章入口
- 原有登录、导入、预览、发布流程保留

## 部署方式
1. 先备份 GitHub 仓库 `main` 分支当前版本。
2. 解压本 ZIP。
3. 将 `bolg-main/` 内的文件和目录覆盖到 GitHub 仓库根目录，保留仓库中其他未包含的文件。
4. 本次主要改动文件：
   - `admin.html`
   - `functions/api/blog-admin/[[path]].js`
5. 提交到 `main`，等待 Cloudflare Pages 自动部署。
6. 打开 `/admin`，登录后查看“文章管理”列表。

## 不需要新增 Secret
继续使用现有的 `BLOG_ADMIN_PASSWORD` 与 `GITHUB_TOKEN`。
`GITHUB_TOKEN` 需要对目标仓库具有 Contents: Read and write 权限。
不要把 Token 或管理员密码写入前端文件。

## 使用说明
- 编辑：点击文章列表中的“编辑”，修改正文、标题、摘要等信息，然后点击“确认发布到网站”。文件名保持原文章文件名。
- 删除：点击“删除”，确认后执行。删除会提交博客列表、首页和文章文件的变更。
- GitHub 提交成功不代表 Cloudflare 部署已完成；请等待 Pages 部署结束后再检查正式网站。

## 保护范围
本升级不修改 `functions/api/messages.js`、D1 schema、留言板、Turnstile 配置。
