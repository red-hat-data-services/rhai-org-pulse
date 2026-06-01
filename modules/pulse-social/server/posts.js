const crypto = require('crypto')
const { getDb } = require('./db')

function createPost({ authorUid, authorName, authorTeam, label, body, mentions }) {
  const db = getDb()
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  const result = db.transaction(() => {
    db.prepare(`
      INSERT INTO posts (id, author_uid, author_name, author_team, label, body, pinned, resolved, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    `).run(id, authorUid, authorName, authorTeam || null, label || null, body.trim(), now, now)

    if (mentions && mentions.length > 0) {
      const insertMention = db.prepare('INSERT OR IGNORE INTO mentions (post_id, mentioned_uid) VALUES (?, ?)')
      for (const uid of mentions) {
        insertMention.run(id, uid)
      }
    }

    return getPostById(id)
  })()

  return result
}

function getPostById(id) {
  const db = getDb()

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id)
  if (!post) return null

  const comments = db.prepare(`
    SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC
  `).all(id)

  const reactions = db.prepare(`
    SELECT emoji, user_uid FROM reactions WHERE post_id = ? AND comment_id IS NULL
  `).all(id)

  const commentReactions = db.prepare(`
    SELECT comment_id, emoji, user_uid FROM reactions WHERE post_id = ? AND comment_id IS NOT NULL
  `).all(id)

  const attachments = db.prepare(`
    SELECT * FROM attachments WHERE post_id = ? ORDER BY created_at ASC
  `).all(id)

  const mentions = db.prepare(`
    SELECT mentioned_uid FROM mentions WHERE post_id = ?
  `).all(id).map(r => r.mentioned_uid)

  const reactionMap = {}
  for (const r of reactions) {
    if (!reactionMap[r.emoji]) reactionMap[r.emoji] = []
    reactionMap[r.emoji].push(r.user_uid)
  }

  const commentReactionMap = {}
  for (const r of commentReactions) {
    if (!commentReactionMap[r.comment_id]) commentReactionMap[r.comment_id] = {}
    if (!commentReactionMap[r.comment_id][r.emoji]) commentReactionMap[r.comment_id][r.emoji] = []
    commentReactionMap[r.comment_id][r.emoji].push(r.user_uid)
  }

  const enrichedComments = comments.map(c => ({
    ...c,
    reactions: commentReactionMap[c.id] || {}
  }))

  return {
    ...post,
    reactions: reactionMap,
    comments: enrichedComments,
    attachments,
    mentions
  }
}

function listPosts({ before, limit = 20, label, team, author, mentioning, search }) {
  limit = Math.min(Math.max(1, parseInt(limit) || 20), 50)

  const pinnedPosts = buildPinnedQuery({ label, team, author, mentioning, search })
  const { posts, nextCursor } = buildFeedQuery({ before, limit, label, team, author, mentioning, search })

  return { pinned: pinnedPosts, posts, nextCursor }
}

function buildPinnedQuery({ label, team, author, mentioning, search }) {
  const db = getDb()
  const conditions = ['p.pinned = 1']
  const params = []

  appendFilterConditions(conditions, params, { label, team, author, mentioning, search })

  const sql = `
    SELECT p.*,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
      (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id AND r.comment_id IS NULL) AS reaction_count
    FROM posts p
    ${mentioning ? 'JOIN mentions m ON p.id = m.post_id' : ''}
    ${search ? '' : ''}
    WHERE ${conditions.join(' AND ')}
    ORDER BY p.created_at DESC
  `

  const posts = db.prepare(sql).all(...params)
  return posts.map(enrichListPost)
}

function buildFeedQuery({ before, limit, label, team, author, mentioning, search }) {
  const db = getDb()
  const conditions = ['p.pinned = 0']
  const params = []

  if (before) {
    conditions.push('p.created_at < ?')
    params.push(before)
  }

  appendFilterConditions(conditions, params, { label, team, author, mentioning, search })

  const sql = `
    SELECT p.*,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
      (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id AND r.comment_id IS NULL) AS reaction_count
    FROM posts p
    ${mentioning ? 'JOIN mentions m ON p.id = m.post_id' : ''}
    WHERE ${conditions.join(' AND ')}
    ORDER BY p.created_at DESC
    LIMIT ?
  `
  params.push(limit + 1)

  const rows = db.prepare(sql).all(...params)
  const hasMore = rows.length > limit
  const posts = (hasMore ? rows.slice(0, limit) : rows).map(enrichListPost)
  const nextCursor = hasMore ? posts[posts.length - 1].created_at : null

  return { posts, nextCursor }
}

function appendFilterConditions(conditions, params, { label, team, author, mentioning, search }) {
  if (label) {
    conditions.push('p.label = ?')
    params.push(label)
  }
  if (team) {
    conditions.push('p.author_team = ?')
    params.push(team)
  }
  if (author) {
    conditions.push('p.author_uid = ?')
    params.push(author)
  }
  if (mentioning) {
    conditions.push('m.mentioned_uid = ?')
    params.push(mentioning)
  }
  if (search) {
    const FTS_KEYWORDS = new Set(['AND', 'OR', 'NOT', 'NEAR'])
    const sanitized = search.replace(/['"]/g, '').split(/\s+/).filter(t => t && !FTS_KEYWORDS.has(t.toUpperCase())).map(t => `"${t}"`).join(' ')
    if (sanitized) {
      conditions.push('p.rowid IN (SELECT rowid FROM posts_fts WHERE posts_fts MATCH ?)')
      params.push(sanitized)
    }
  }
}

function enrichListPost(row) {
  const db = getDb()
  const reactions = db.prepare(`
    SELECT emoji, COUNT(*) as count FROM reactions
    WHERE post_id = ? AND comment_id IS NULL GROUP BY emoji
  `).all(row.id)

  const reactionSummary = {}
  for (const r of reactions) {
    reactionSummary[r.emoji] = r.count
  }

  const recentComments = db.prepare(`
    SELECT * FROM comments WHERE post_id = ? ORDER BY created_at DESC LIMIT 2
  `).all(row.id).reverse()

  const attachments = db.prepare(`
    SELECT * FROM attachments WHERE post_id = ? ORDER BY created_at ASC
  `).all(row.id)

  return {
    id: row.id,
    author_uid: row.author_uid,
    author_name: row.author_name,
    author_team: row.author_team,
    label: row.label,
    body: row.body,
    pinned: row.pinned,
    resolved: row.resolved,
    created_at: row.created_at,
    updated_at: row.updated_at,
    edited_at: row.edited_at,
    comment_count: row.comment_count,
    reaction_count: row.reaction_count,
    reactions: reactionSummary,
    recent_comments: recentComments,
    attachments
  }
}

function updatePost(id, { body, label, mentions }, authorUid) {
  const db = getDb()
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id)
  if (!post) return { error: 'Post not found', status: 404 }
  if (post.author_uid !== authorUid) return { error: 'You can only edit your own posts', status: 403 }

  const now = new Date().toISOString()

  db.transaction(() => {
    db.prepare(`
      UPDATE posts SET body = ?, label = ?, updated_at = ?, edited_at = ?
      WHERE id = ?
    `).run(body.trim(), label || null, now, now, id)

    db.prepare('DELETE FROM mentions WHERE post_id = ?').run(id)
    if (mentions && mentions.length > 0) {
      const insertMention = db.prepare('INSERT OR IGNORE INTO mentions (post_id, mentioned_uid) VALUES (?, ?)')
      for (const uid of mentions) {
        insertMention.run(id, uid)
      }
    }
  })()

  return { post: getPostById(id) }
}

function deletePost(id, userUid, isAdmin) {
  const db = getDb()
  const post = db.prepare('SELECT author_uid FROM posts WHERE id = ?').get(id)
  if (!post) return { error: 'Post not found', status: 404 }
  if (post.author_uid !== userUid && !isAdmin) return { error: 'You can only delete your own posts', status: 403 }

  db.prepare('DELETE FROM posts WHERE id = ?').run(id)
  return { success: true }
}

function pinPost(id, isAdmin) {
  if (!isAdmin) return { error: 'Only admins can pin posts', status: 403 }
  const db = getDb()
  const post = db.prepare('SELECT pinned FROM posts WHERE id = ?').get(id)
  if (!post) return { error: 'Post not found', status: 404 }

  const newPinned = post.pinned ? 0 : 1
  db.prepare('UPDATE posts SET pinned = ?, updated_at = ? WHERE id = ?').run(newPinned, new Date().toISOString(), id)
  return { pinned: !!newPinned }
}

function resolvePost(id, userUid) {
  const db = getDb()
  const post = db.prepare('SELECT author_uid, label, resolved FROM posts WHERE id = ?').get(id)
  if (!post) return { error: 'Post not found', status: 404 }
  if (post.author_uid !== userUid) return { error: 'Only the post author can resolve it', status: 403 }
  if (post.label !== 'question') return { error: 'Only question posts can be resolved', status: 400 }

  const newResolved = post.resolved ? 0 : 1
  db.prepare('UPDATE posts SET resolved = ?, updated_at = ? WHERE id = ?').run(newResolved, new Date().toISOString(), id)
  return { resolved: !!newResolved }
}

function getStats() {
  const db = getDb()
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const totals = db.prepare(`
    SELECT
      COUNT(*) as total_posts,
      COUNT(DISTINCT author_uid) as unique_posters
    FROM posts
  `).get()

  const thisWeek = db.prepare(`
    SELECT
      COUNT(*) as posts,
      COUNT(DISTINCT author_uid) as posters
    FROM posts WHERE created_at > ?
  `).get(weekAgo)

  const thisMonth = db.prepare(`
    SELECT COUNT(*) as posts FROM posts WHERE created_at > ?
  `).get(monthAgo)

  const labels = db.prepare(`
    SELECT label, COUNT(*) as count FROM posts
    WHERE label IS NOT NULL GROUP BY label ORDER BY count DESC
  `).all()

  const totalReactions = db.prepare('SELECT COUNT(*) as count FROM reactions').get().count
  const totalComments = db.prepare('SELECT COUNT(*) as count FROM comments').get().count

  return {
    total_posts: totals.total_posts,
    unique_posters: totals.unique_posters,
    posts_this_week: thisWeek.posts,
    posters_this_week: thisWeek.posters,
    posts_this_month: thisMonth.posts,
    total_reactions: totalReactions,
    total_comments: totalComments,
    label_distribution: labels
  }
}

function getRecentPosts(limit = 5) {
  const db = getDb()
  const posts = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
      (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id AND r.comment_id IS NULL) AS reaction_count
    FROM posts p
    ORDER BY p.created_at DESC
    LIMIT ?
  `).all(limit)

  return posts.map(enrichListPost)
}

module.exports = {
  createPost,
  getPostById,
  listPosts,
  updatePost,
  deletePost,
  pinPost,
  resolvePost,
  getStats,
  getRecentPosts
}
