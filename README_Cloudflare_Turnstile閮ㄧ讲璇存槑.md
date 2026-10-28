# Aladdin Moore 留言板：Cloudflare D1 + Turnstile + 频率限制

本版本在原 D1 留言板上增加 Cloudflare Turnstile 人机验证，并使用 D1 对每个网络地址实施频率限制：每 10 分钟最多 3 次提交尝试。原始 IP 不写入数据库，仅保存 SHA-256 哈希及短期事件时间。

## 文件
- `guestbook.html`：含 Turnstile 小组件的留言板
- `functions/api/messages.js`：服务端验证 Turnstile、限制提交频率、写入留言
- `schema.sql`：留言表及频率事件表（可安全重复执行，使用 IF NOT EXISTS）
- 其余网站页面和头像保持原样

## 部署前必须完成的 Cloudflare 配置

### 1. 创建 Turnstile 小组件
1. Cloudflare Dashboard 中打开 **Turnstile**，选择添加 widget。
2. 模式建议选择 **Managed**。
3. 添加你实际网站使用的主机名，例如你的自定义域名和 `项目名.pages.dev` 域名。不要把 `https://` 或路径写进主机名。
4. 创建后复制 **Sitekey** 和 **Secret key**。

### 2. 设置前端 Sitekey
在 `guestbook.html` 中找到：

```html
<div class="cf-turnstile" data-sitekey="REPLACE_WITH_TURNSTILE_SITEKEY" data-action="guestbook" data-theme="dark"></div>
```

把 `REPLACE_WITH_TURNSTILE_SITEKEY` 替换成刚才获得的 **Sitekey**。Sitekey 是公开标识，可以放在 HTML 中；不要把 Secret key 放进 HTML 或 GitHub。

### 3. 将 Secret key 配置为 Pages secret
1. Cloudflare → Workers & Pages → 你的 Pages 项目 → **Settings → Variables and secrets**。
2. 添加变量/Secret，名称必须为 `TURNSTILE_SECRET`，值填入 Turnstile **Secret key**。
3. 选择加密的 Secret 类型（如果界面提供 Type 选择），仅配置在 Production；如果要测试 Preview，也应为 Preview 配置对应 widget 的 Secret。
4. 保存后向 GitHub `main` 分支提交更新过的 `guestbook.html` 和 `functions/api/messages.js`，等待自动部署成功。若只更新了 Pages 绑定/secret，也请触发一次新部署以确保生效。

### 4. 更新 D1 表结构（重要）
本版本的 `schema.sql` 新增了 `guestbook_rate_events` 表。你之前已执行过旧版 SQL，所以需要再次打开 `aladdin-guestbook` → **Console**，执行新版 `schema.sql` 全部内容。原有 `guestbook_messages` 数据不会被删除。

### 5. 测试
1. 打开留言板，确认 Turnstile 验证组件显示。
2. 完成人机验证后提交一条测试留言，确认保存成功。
3. 连续提交达到每 10 分钟 3 次后，后续提交应收到 HTTP 429 提示。注意：为防止反复验证攻击，频率计数按提交尝试计算，验证失败的尝试也会计数。

## 实现细节与限制
- 服务端每次 POST 都调用 `https://challenges.cloudflare.com/turnstile/v0/siteverify` 验证 token，并检查 `success`、`action=guestbook` 和请求主机名；只在验证通过后写入留言。Turnstile token 过期或重复使用会被拒绝。
- 频率限制按 Cloudflare 提供的 `CF-Connecting-IP` 哈希识别客户端，限制为 3 次/10 分钟。共享网络的多名访客可能共同触发限制；这是轻量级基础防护，不是针对大规模分布式攻击的完整方案。
- 不要在前端或 GitHub 中公开 `TURNSTILE_SECRET`。
- 若你的留言板使用多个域名，需将这些主机名都加入 Turnstile widget 的允许域名，并分别测试。

官方文档：
- Turnstile 入门：https://developers.cloudflare.com/turnstile/get-started/
- 服务端验证：https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
