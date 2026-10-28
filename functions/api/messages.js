const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }
});

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: "数据库未绑定。请在 Pages 项目中将 D1 数据库绑定为 DB。" }, 503);

  if (request.method === "GET") {
    try {
      const result = await env.DB.prepare(
        "SELECT id, name, message, created_at FROM guestbook_messages ORDER BY id DESC LIMIT 100"
      ).all();
      return json({ messages: result.results || [] });
    } catch (error) {
      return json({ error: "读取留言失败。请确认已在 D1 中执行 schema.sql。" }, 500);
    }
  }

  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
  }

  // 浏览器同源请求检查；无 Origin 的非浏览器请求仍由下方校验和部署层防护处理。
  const origin = request.headers.get("Origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return json({ error: "请求来源无效。请从本站提交留言。" }, 403);
      }
    } catch {
      return json({ error: "请求来源无效。" }, 403);
    }
  }

  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ error: "请求格式必须为 JSON。" }, 415);
  }
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 12000) return json({ error: "提交内容过大。" }, 413);

  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: "无法解析提交内容。" }, 400);
  }
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (!name || !message) return json({ error: "昵称和留言内容为必填项。" }, 400);
  if (name.length > 60 || email.length > 120 || message.length > 3000) {
    return json({ error: "昵称、邮箱或留言内容超出长度限制。" }, 400);
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "邮箱格式不正确。" }, 400);
  }

  try {
    await env.DB.prepare(
      "INSERT INTO guestbook_messages (name, email, message) VALUES (?, ?, ?)"
    ).bind(name, email || null, message).run();
    return json({ ok: true }, 201);
  } catch (error) {
    return json({ error: "留言保存失败，请稍后重试。" }, 500);
  }
}
