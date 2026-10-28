# 部署说明

原始 Cloudflare Pages + D1 部署步骤仍适用。此版本请优先阅读 `README_Cloudflare_Turnstile部署说明.md`，按步骤配置 Turnstile Sitekey、Pages Secret `TURNSTILE_SECRET`，并在 D1 Console 执行更新后的 `schema.sql`（不会删除已有留言）。

务必将 `functions/api/messages.js` 放在 Git 仓库根目录下的 `functions/api/messages.js`，并通过 Git 集成部署。
