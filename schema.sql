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
