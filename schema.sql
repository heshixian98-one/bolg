-- 在 Cloudflare D1 控制台中执行此文件，创建留言板数据表。
CREATE TABLE IF NOT EXISTS guestbook_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  email TEXT CHECK (email IS NULL OR length(email) <= 120),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 3000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_guestbook_messages_created_at
ON guestbook_messages (created_at DESC);


-- 提交频率限制：每个 IP 的 SHA-256 哈希记录短期提交事件，不存储原始 IP。
CREATE TABLE IF NOT EXISTS guestbook_rate_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guestbook_rate_events_ip_time
ON guestbook_rate_events (ip_hash, created_at);
