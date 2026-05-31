const crypto = require('crypto')
const { getDb } = require('./db')

function addComment(postId, { authorUid, authorName, body }) {
  const db = getDb()

  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId)
  if (!post) return { error: 'Post not found', status: 404 }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO comments (id, post_id, author_uid, author_name, body, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, postId, authorUid, authorName, body.trim(), now)

  return {
    comment: db.prepare('SELECT * FROM comments WHERE id = ?').get(id)
  }
}

function updateComment(postId, commentId, { body }, authorUid) {
  const db = getDb()

  const comment = db.prepare('SELECT * FROM comments WHERE id = ? AND post_id = ?').get(commentId, postId)
  if (!comment) return { error: 'Comment not found', status: 404 }
  if (comment.author_uid !== authorUid) return { error: 'You can only edit your own comments', status: 403 }

  const now = new Date().toISOString()
  db.prepare('UPDATE comments SET body = ?, edited_at = ? WHERE id = ?').run(body.trim(), now, commentId)

  return {
    comment: db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId)
  }
}

function deleteComment(postId, commentId, userUid, isAdmin) {
  const db = getDb()

  const comment = db.prepare('SELECT author_uid FROM comments WHERE id = ? AND post_id = ?').get(commentId, postId)
  if (!comment) return { error: 'Comment not found', status: 404 }
  if (comment.author_uid !== userUid && !isAdmin) return { error: 'You can only delete your own comments', status: 403 }

  db.prepare('DELETE FROM comments WHERE id = ?').run(commentId)
  return { success: true }
}

module.exports = { addComment, updateComment, deleteComment }
