const { getDb } = require('./db')

function togglePostReaction(postId, { userUid, emoji }) {
  const db = getDb()

  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId)
  if (!post) return { error: 'Post not found', status: 404 }

  return db.transaction(() => {
    const existing = db.prepare(`
      SELECT id FROM reactions
      WHERE post_id = ? AND comment_id IS NULL AND user_uid = ? AND emoji = ?
    `).get(postId, userUid, emoji)

    if (existing) {
      db.prepare('DELETE FROM reactions WHERE id = ?').run(existing.id)
      return { action: 'removed', emoji }
    }

    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO reactions (post_id, comment_id, user_uid, emoji, created_at)
      VALUES (?, NULL, ?, ?, ?)
    `).run(postId, userUid, emoji, now)

    return { action: 'added', emoji }
  })()
}

function toggleCommentReaction(postId, commentId, { userUid, emoji }) {
  const db = getDb()

  const comment = db.prepare('SELECT id FROM comments WHERE id = ? AND post_id = ?').get(commentId, postId)
  if (!comment) return { error: 'Comment not found', status: 404 }

  return db.transaction(() => {
    const existing = db.prepare(`
      SELECT id FROM reactions
      WHERE post_id = ? AND comment_id = ? AND user_uid = ? AND emoji = ?
    `).get(postId, commentId, userUid, emoji)

    if (existing) {
      db.prepare('DELETE FROM reactions WHERE id = ?').run(existing.id)
      return { action: 'removed', emoji }
    }

    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO reactions (post_id, comment_id, user_uid, emoji, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(postId, commentId, userUid, emoji, now)

    return { action: 'added', emoji }
  })()
}

function getPostReactions(postId) {
  const db = getDb()

  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId)
  if (!post) return { error: 'Post not found', status: 404 }

  const reactions = db.prepare(`
    SELECT emoji, user_uid FROM reactions
    WHERE post_id = ? AND comment_id IS NULL
    ORDER BY created_at ASC
  `).all(postId)

  const grouped = {}
  for (const r of reactions) {
    if (!grouped[r.emoji]) grouped[r.emoji] = []
    grouped[r.emoji].push(r.user_uid)
  }

  return { reactions: grouped }
}

module.exports = { togglePostReaction, toggleCommentReaction, getPostReactions }
