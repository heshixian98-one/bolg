# Pages CMS 安全试用说明

本试用包只新增：
- `.pages.yml`：仅将 `cms-test/test-article.html` 暴露给 Pages CMS。
- `cms-test/test-article.html`：独立测试文章。

## 建议操作
1. 将本包内容提交到 GitHub 的 `cms-test` 分支，不要提交到 `main`。
2. 在 Pages CMS 中登录 GitHub，并打开 `heshixian98-one/bolg` 的 `cms-test` 分支。
3. Pages CMS 读取仓库根目录 `.pages.yml` 后，应只显示“CMS 测试文章（安全试用）”。
4. 修改测试页中的标题或正文，保存时确认目标分支是 `cms-test`。
5. 在 GitHub 检查提交只改动 `cms-test/test-article.html`（首次配置另有 `.pages.yml`）。
6. 不要把测试分支合并到 `main`，直到确认编辑和预览效果。

## 当前试用范围
- 这是 HTML 原始文件编辑试验（`format: raw`），不是将完整 HTML 页面解析成分离的标题、摘要和富文本正文表单。
- 不会配置或暴露正式文章、首页、留言板、Cloudflare Functions、D1 或 Turnstile。
- 通过 Pages CMS 保存会写入所选 GitHub 分支。若选择 `main`，可能触发生产部署，因此务必选 `cms-test`。
