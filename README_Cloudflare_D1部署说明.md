# Aladdin Moore 网站：Cloudflare Pages + D1 留言板

本包把留言板改为 Cloudflare 原生架构：网页请求 `/api/messages`，Pages Functions 在服务端读写 D1。前端不包含数据库密钥；公开接口只允许读取和新增留言，不提供删除/修改接口；邮箱不会返回给访客。

## 包内文件

- `index.html`、`blog_first_post.html`、`guestbook.html`：网站页面
- `aladdin_moore_portrait.png`：头像图片
- `functions/api/messages.js`：Pages Functions API（GET 读取、POST 新增）
- `schema.sql`：D1 建表 SQL

## 部署步骤

### 1. 创建 D1 数据库

1. 登录 Cloudflare Dashboard。
2. 打开 **Workers & Pages → D1 SQL Database**（控制台菜单名称可能略有变化）。
3. 创建数据库，例如命名为 `aladdin-guestbook`。
4. 进入该数据库的 **Console**，复制并执行本包 `schema.sql` 的全部内容。

### 2. 把数据库绑定到 Pages 项目

1. 打开 **Workers & Pages → 你的 Pages 项目 → Settings → Bindings**。
2. 添加 **D1 database** 类型的绑定。
3. Variable name / Binding name 填写 `DB`（必须与代码一致）。
4. 选择刚创建的 `aladdin-guestbook` 数据库并保存。
5. 重新部署网站，让新的绑定生效。

### 3. 部署 Pages Functions（重要）

仅把静态 HTML 拖入 Cloudflare Pages 的纯静态上传流程，**不会自动部署本包里的 Functions**。需要用以下任一方式部署：

**推荐：连接 Git 仓库**
- 将本包文件放在项目根目录并推送到 GitHub/GitLab 等仓库。
- 在 Cloudflare Pages 中连接该仓库。
- 若这是纯静态站点，可将 Build command 留空，Build output directory 设为项目根目录（`.`），然后部署。
- 确认 `functions/api/messages.js` 与页面文件处于项目根目录下的 `functions/` 文件夹中。

**或者：使用 Wrangler CLI**
- 在电脑安装 Node.js 与 Wrangler，并登录 Cloudflare：`npx wrangler login`
- 在项目根目录执行：`npx wrangler pages deploy . --project-name 你的Pages项目名`
- 确保 Pages 项目已创建，且 D1 binding 已在 Dashboard 配置好；根据 Wrangler 提示完成部署。

如果你当前的网站只通过 Dashboard 的拖放上传发布，请先连接 Git 或改用 Wrangler 发布，否则 `/api/messages` 会不存在。

### 4. 测试

部署完成后：
1. 打开 `https://你的域名/api/messages`，正常时应看到类似 `{"messages":[]}` 的 JSON。
2. 打开 `guestbook.html` 提交一条测试留言。
3. 刷新页面，确认留言还在；再用另一个浏览器/无痕窗口访问，确认其他访客也能看到。

## 安全与维护提示

- 本 API 不提供公开删除或修改接口，访客不能通过此 API 删除他人留言。
- 留言内容通过参数化 SQL 写入，前端使用 `textContent` 展示，避免把留言当 HTML 执行。
- 邮箱保存在数据库中，但不会公开返回或显示。若不需要收集邮箱，可把页面中的邮箱输入框移除并同步调整 API。
- 这是基础版本，尚未接入 Turnstile、人机验证、持久化频率限制或审核队列。正式公开前建议添加 Cloudflare Turnstile 和垃圾留言防护；不要把邮箱等个人信息公开。
- 管理员如需删除违规留言，可在 D1 控制台通过 SQL 手动处理。请先确认目标记录再执行 DELETE。
- 只有部署并正确绑定 D1、执行 `schema.sql` 后，留言板才会真正保存数据；下载文件本身不会自动连接你的 Cloudflare 账户。
