-- Pulse Social initial schema

-- ─── Posts ───────────────────────────────────────────────────────
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  author_uid TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_team TEXT,
  label TEXT CHECK(label IS NULL OR label IN (
    'win', 'customer-success', 'til', 'question', 'milestone'
  )),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 10000),
  pinned INTEGER NOT NULL DEFAULT 0,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  edited_at TEXT
);

CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_posts_author ON posts(author_uid);
CREATE INDEX idx_posts_label ON posts(label) WHERE label IS NOT NULL;
CREATE INDEX idx_posts_team ON posts(author_team) WHERE author_team IS NOT NULL;
CREATE INDEX idx_posts_pinned ON posts(pinned) WHERE pinned = 1;

-- ─── Comments ────────────────────────────────────────────────────
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_uid TEXT NOT NULL,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
  created_at TEXT NOT NULL,
  edited_at TEXT
);

CREATE INDEX idx_comments_post ON comments(post_id, created_at);

-- ─── Reactions ───────────────────────────────────────────────────
CREATE TABLE reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  comment_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
  user_uid TEXT NOT NULL,
  emoji TEXT NOT NULL CHECK(emoji IN (
    'thumbsUp', 'heart', 'celebrate', 'insightful', 'curious', 'rocket'
  )),
  created_at TEXT NOT NULL
);

-- Post-level: one reaction per user per emoji per post
CREATE UNIQUE INDEX idx_reactions_post_unique
  ON reactions(post_id, user_uid, emoji) WHERE comment_id IS NULL;

-- Comment-level: one reaction per user per emoji per comment
CREATE UNIQUE INDEX idx_reactions_comment_unique
  ON reactions(post_id, comment_id, user_uid, emoji) WHERE comment_id IS NOT NULL;

CREATE INDEX idx_reactions_post ON reactions(post_id) WHERE comment_id IS NULL;
CREATE INDEX idx_reactions_comment ON reactions(comment_id) WHERE comment_id IS NOT NULL;

-- ─── Mentions ────────────────────────────────────────────────────
CREATE TABLE mentions (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  mentioned_uid TEXT NOT NULL,
  PRIMARY KEY (post_id, mentioned_uid)
);

CREATE INDEX idx_mentions_uid ON mentions(mentioned_uid);

-- ─── Attachments (metadata only, files stored on disk) ──────────
CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('image', 'file')),
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_attachments_post ON attachments(post_id);

-- ─── Full-text search ────────────────────────────────────────────
CREATE VIRTUAL TABLE posts_fts USING fts5(
  body,
  content='posts',
  content_rowid='rowid',
  tokenize='porter unicode61'
);

CREATE TRIGGER posts_fts_insert AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts(rowid, body) VALUES (new.rowid, new.body);
END;

CREATE TRIGGER posts_fts_delete AFTER DELETE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, body) VALUES ('delete', old.rowid, old.body);
END;

CREATE TRIGGER posts_fts_update AFTER UPDATE OF body ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, body) VALUES ('delete', old.rowid, old.body);
  INSERT INTO posts_fts(rowid, body) VALUES (new.rowid, new.body);
END;
