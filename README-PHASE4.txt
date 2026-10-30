第四阶段：YAML → 独立 HTML 自动生成测试

安全范围
- 仅供 cms-test 分支试验。
- 输入：cms-content/posts/*.yml 或 *.yaml
- 输出：cms-generated/ 目录
- 不覆盖 blog.html、index.html、blog-fourth-post.html 或任何现有页面。
- 不修改 functions、guestbook、D1、Turnstile、Secrets、管理后台或 .pages.yml。
- 本包不配置 Cloudflare build command，也不触发部署。

文件
- build.py：生成脚本（Python 3，依赖 PyYAML）
- cms-content/posts/blog-fourth-post-migration-test.yml：第四篇迁移测试文章样本

本地运行
1. 解压本包。
2. 在解压目录打开终端。
3. 安装依赖：python -m pip install pyyaml
4. 运行：python build.py
5. 打开 cms-generated/index.html 检查文章列表，再打开生成的文章 HTML。

在 GitHub cms-test 分支测试
1. 先确认第四篇 YAML 已经由 Pages CMS 保存并提交。
2. 将 build.py 和 README-PHASE4.txt 放到仓库根目录；将本包 cms-content/posts/ 下的样本 YAML 与仓库现有文件比较，若同名已存在，不要覆盖，保留 Pages CMS 中已保存的版本。
3. 不要把本地生成的 cms-generated 输出提交到 main；本阶段先本地 smoke test。
4. 如需将脚本提交到 cms-test，commit message 可用 Add isolated CMS HTML generator test。

验证重点
- 标题、摘要、分类、日期各只显示一次。
- 正文的 h2/h3、段落、列表、.quote、.note 等 HTML 结构保留。
- 输出仅位于 cms-generated/。
- 列表链接能打开对应文章。

注意
- body 字段按 HTML 原样输出，适用于本项目当前 Pages CMS 的 HTML 正文配置；只处理可信任的自有内容。
- 此脚本是本地生成演练，不等于 Cloudflare Pages 已启用构建，也不会自动发布。
- 不要配置生产分支 main 的 build command；先完成本地验证，再单独评估 Cloudflare Preview。
