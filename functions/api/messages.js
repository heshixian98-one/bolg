const json = (data, status = 200, extraHeaders = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders
  }
});

const RATE_WINDOW_MINUTES = 10;
const RATE_MAX_SUBMISSIONS = 3;

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyTurnstile(token, request, env) {
  if (!env.TURNSTILE_SECRET || !token || typeof token !== "string" || token.length > 2048) return false;
  const form = new URLSearchParams({
    secret: env.TURNSTILE_SECRET,
    response: token,
    remoteip: request.headers.get("CF-Connecting-IP") || ""
  });
  let result;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form
    });
    if (!response.ok) return false;
    result = await response.json();
  } catch {
    return false;
  }
  const expectedHost = new URL(request.url).hostname.toLowerCase();
  return result.success === true && result.action === "guestbook" &&
    typeof result.hostname === "string" && result.hostname.toLowerCase() === expectedHost;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: "数据库未绑定。请在 Pages 项目中将 D1 数据库绑定为 DB。" }, 503);

  // 管理员删除接口：必须配置 GUESTBOOK_ADMIN_TOKEN，并通过 Authorization Bearer 验证。
  if (request.method === "DELETE") {
    const configuredToken = env.GUESTBOOK_ADMIN_TOKEN;
    if (!configuredToken) return json({ error: "管理员功能尚未配置。请在 Pages Secrets 中设置 GUESTBOOK_ADMIN_TOKEN。" }, 503);
    const authorization = request.headers.get("Authorization") || "";
    const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!suppliedToken || suppliedToken.length > 512) return json({ error: "管理员验证失败，请重新登录。" }, 401);
    // Compare SHA-256 digests to avoid a direct early-exit string comparison.
    const [expectedDigest, suppliedDigest] = await Promise.all([sha256Hex(configuredToken), sha256Hex(suppliedToken)]);
    if (expectedDigest !== suppliedDigest) return json({ error: "管理员验证失败，请重新登录。" }, 401);
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!Number.isSafeInteger(id) || id <= 0) return json({ error: "留言编号无效。" }, 400);
    try {
      const result = await env.DB.prepare("DELETE FROM guestbook_messages WHERE id = ?").bind(id).run();
      if (!result.meta || result.meta.changes === 0) return json({ error: "这条留言不存在或已被删除。" }, 404);
      return json({ ok: true, deletedId: id });
    } catch {
      return json({ error: "删除留言失败，请检查 D1 数据库和后端日志。" }, 500);
    }
  }

  if (request.method === "GET") {
    try {
      const result = await env.DB.prepare(
        "SELECT id, name, message, created_at FROM guestbook_messages ORDER BY id DESC LIMIT 100"
      ).all();
      return json({ messages: result.results || [] });
    } catch {
      return json({ error: "读取留言失败。请确认已在 D1 中执行更新后的 schema.sql。" }, 500);
    }
  }

  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "GET, POST, DELETE" } });
  }

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

  if (!env.TURNSTILE_SECRET) {
    return json({ error: "留言验证尚未配置。请管理员在 Pages 中设置 TURNSTILE_SECRET。" }, 503);
  }

  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("application/json")) return json({ error: "请求格式必须为 JSON。" }, 415);
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 12000) return json({ error: "提交内容过大。" }, 413);

  let input;
  try { input = await request.json(); }
  catch { return json({ error: "无法解析提交内容。" }, 400); }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const message = typeof input.message === "string" ? input.message.trim() : "";
  const turnstileToken = typeof input.turnstileToken === "string" ? input.turnstileToken : "";
  if (!name || !message) return json({ error: "昵称和留言内容为必填项。" }, 400);
  if (name.length > 60 || email.length > 120 || message.length > 3000) return json({ error: "昵称、邮箱或留言内容超出长度限制。" }, 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "邮箱格式不正确。" }, 400);

  // Persistent per-IP rate limit in D1. Store only a SHA-256 hash, not the raw IP.
  const clientIp = request.headers.get("CF-Connecting-IP");
  if (!clientIp) return json({ error: "无法确认请求来源，请刷新页面后重试。" }, 403);
  const ipHash = await sha256Hex(clientIp);
  try {
    const countResult = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM guestbook_rate_events WHERE ip_hash = ? AND created_at >= CAST(strftime('%s', 'now', ?) AS INTEGER)"
    ).bind(ipHash, `-${RATE_WINDOW_MINUTES} minutes`).first();
    const count = Number(countResult?.n || 0);
    if (count >= RATE_MAX_SUBMISSIONS) {
      return json({ error: "提交过于频繁。每个网络地址 10 分钟内最多提交 3 条，请稍后再试。" }, 429, { "Retry-After": "600" });
    }
    await env.DB.prepare(
      "INSERT INTO guestbook_rate_events (ip_hash, created_at) VALUES (?, CAST(strftime('%s', 'now') AS INTEGER))"
    ).bind(ipHash).run();
    // Opportunistic cleanup of expired events to keep the rate-limit table small.
    if (Math.random() < 0.02) {
      await env.DB.prepare(
        "DELETE FROM guestbook_rate_events WHERE created_at < CAST(strftime('%s', 'now', '-1 day') AS INTEGER)"
      ).run();
    }
  } catch {
    return json({ error: "频率限制服务暂时不可用，请稍后重试。" }, 503);
  }

  const tokenValid = await verifyTurnstile(turnstileToken, request, env);
  if (!tokenValid) return json({ error: "人机验证未通过或已过期，请重新完成验证后提交。" }, 403);

  try {
    await env.DB.prepare(
      "INSERT INTO guestbook_messages (name, email, message) VALUES (?, ?, ?)"
    ).bind(name, email || null, message).run();
    return json({ ok: true }, 201);
  } catch {
    return json({ error: "留言保存失败，请稍后重试。" }, 500);
  }
}
