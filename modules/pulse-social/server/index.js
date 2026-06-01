const path = require('path')
const { initDb } = require('./db')
const { createPost, getPostById, listPosts, updatePost, deletePost, pinPost, resolvePost, getStats, getRecentPosts } = require('./posts')
const { addComment, updateComment, deleteComment } = require('./comments')
const { togglePostReaction, toggleCommentReaction, getPostReactions } = require('./reactions')
const { validateFile, saveAttachment, getAttachmentPath, isImageFile, getAttachmentFilenames, deleteAttachmentFilesByName } = require('./attachments')
const { validatePostBody, validateCommentBody, validateLabel, validateEmoji } = require('./validation')
const { rateLimitMiddleware } = require('./rate-limiter')

const IS_DEMO = process.env.DEMO_MODE === 'true'

function demoGuard(req, res, next) {
  if (IS_DEMO) {
    return res.json({ success: true, demo: true })
  }
  next()
}

/**
 * @param {import('express').Router} router
 * @param {import('../../../shared/server/module-context').ModuleContext} context
 */
module.exports = function registerRoutes(router, context) {
  const { requireAuth, requireAdmin, requireScope } = context
  let blockDuringImpersonation
  try {
    blockDuringImpersonation = require('../../../shared/server/auth').blockDuringImpersonation
  } catch {
    blockDuringImpersonation = function(req, res, next) { next() }
  }

  initDb()

  const readAuth = [requireScope('pulse-social:read')]
  const writeAuth = [requireAuth, blockDuringImpersonation, requireScope('pulse-social:write')]

  // ─── Posts ─────────────────────────────────────────────────────

  /**
   * @openapi
   * /api/modules/pulse-social/posts:
   *   get:
   *     summary: List posts (cursor-paginated feed)
   *     tags: [Pulse Social]
   *     parameters:
   *       - in: query
   *         name: before
   *         schema: { type: string }
   *         description: ISO-8601 cursor for pagination
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 20 }
   *       - in: query
   *         name: label
   *         schema: { type: string }
   *       - in: query
   *         name: team
   *         schema: { type: string }
   *       - in: query
   *         name: author
   *         schema: { type: string }
   *       - in: query
   *         name: mentioning
   *         schema: { type: string }
   *       - in: query
   *         name: search
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Paginated feed with pinned and regular posts
   */
  router.get('/posts', ...readAuth, function(req, res) {
    try {
      const result = listPosts({
        before: req.query.before,
        limit: req.query.limit,
        label: req.query.label,
        team: req.query.team,
        author: req.query.author,
        mentioning: req.query.mentioning,
        search: req.query.search
      })
      res.json(result)
    } catch (err) {
      console.error('[pulse-social] GET /posts error:', err.message)
      res.status(500).json({ error: 'Failed to load feed' })
    }
  })

  /**
   * @openapi
   * /api/modules/pulse-social/posts/recent:
   *   get:
   *     summary: Get 5 most recent posts (for home widget)
   *     tags: [Pulse Social]
   *     responses:
   *       200:
   *         description: Recent posts array
   */
  router.get('/posts/recent', ...readAuth, function(req, res) {
    try {
      const posts = getRecentPosts(5)
      res.json({ posts })
    } catch (err) {
      console.error('[pulse-social] GET /posts/recent error:', err.message)
      res.status(500).json({ error: 'Failed to load recent posts' })
    }
  })

  /**
   * @openapi
   * /api/modules/pulse-social/posts/{id}:
   *   get:
   *     summary: Get a single post with comments and reactions
   *     tags: [Pulse Social]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Full post with comments, reactions, attachments
   *       404:
   *         description: Post not found
   */
  router.get('/posts/:id', ...readAuth, function(req, res) {
    try {
      const post = getPostById(req.params.id)
      if (!post) return res.status(404).json({ error: 'Post not found' })
      res.json(post)
    } catch (err) {
      console.error('[pulse-social] GET /posts/:id error:', err.message)
      res.status(500).json({ error: 'Failed to load post' })
    }
  })

  /**
   * @openapi
   * /api/modules/pulse-social/posts:
   *   post:
   *     summary: Create a new post
   *     tags: [Pulse Social]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [body]
   *             properties:
   *               body: { type: string }
   *               label: { type: string, nullable: true }
   *               mentions: { type: array, items: { type: string } }
   *     responses:
   *       201:
   *         description: Created post
   *       400:
   *         description: Validation error
   *       429:
   *         description: Rate limit exceeded
   */
  router.post('/posts', ...writeAuth, demoGuard, rateLimitMiddleware('post'), function(req, res) {
    try {
      const { body, label, mentions } = req.body

      const bodyErr = validatePostBody(body)
      if (bodyErr) return res.status(400).json({ error: bodyErr })

      const labelErr = validateLabel(label)
      if (labelErr) return res.status(400).json({ error: labelErr })

      const validMentions = Array.isArray(mentions)
        ? mentions.filter(m => typeof m === 'string' && m.length > 0).slice(0, 50)
        : []

      const post = createPost({
        authorUid: req.userUid || req.userEmail,
        authorName: req.userName || req.userEmail || 'Unknown',
        authorTeam: req.userTeam || null,
        label: label || null,
        body,
        mentions: validMentions
      })

      res.status(201).json(post)
    } catch (err) {
      console.error('[pulse-social] POST /posts error:', err.message)
      res.status(500).json({ error: 'Failed to create post' })
    }
  })

  /**
   * @openapi
   * /api/modules/pulse-social/posts/{id}:
   *   put:
   *     summary: Edit own post
   *     tags: [Pulse Social]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [body]
   *             properties:
   *               body: { type: string }
   *               label: { type: string, nullable: true }
   *               mentions: { type: array, items: { type: string } }
   *     responses:
   *       200:
   *         description: Updated post
   *       403:
   *         description: Not the author
   *       404:
   *         description: Post not found
   */
  router.put('/posts/:id', ...writeAuth, demoGuard, function(req, res) {
    try {
      const { body, label, mentions } = req.body

      const bodyErr = validatePostBody(body)
      if (bodyErr) return res.status(400).json({ error: bodyErr })

      const labelErr = validateLabel(label)
      if (labelErr) return res.status(400).json({ error: labelErr })

      const validMentions = Array.isArray(mentions)
        ? mentions.filter(m => typeof m === 'string' && m.length > 0).slice(0, 50)
        : []

      const authorUid = req.userUid || req.userEmail
      const result = updatePost(req.params.id, { body, label, mentions: validMentions }, authorUid)

      if (result.error) return res.status(result.status).json({ error: result.error })
      res.json(result.post)
    } catch (err) {
      console.error('[pulse-social] PUT /posts/:id error:', err.message)
      res.status(500).json({ error: 'Failed to update post' })
    }
  })

  /**
   * @openapi
   * /api/modules/pulse-social/posts/{id}:
   *   delete:
   *     summary: Delete a post (author or admin)
   *     tags: [Pulse Social]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Post deleted
   *       403:
   *         description: Not authorized
   *       404:
   *         description: Post not found
   */
  router.delete('/posts/:id', ...writeAuth, demoGuard, function(req, res) {
    try {
      const userUid = req.userUid || req.userEmail
      const isAdmin = req.isAdmin === true
      const filenames = getAttachmentFilenames(req.params.id)
      const result = deletePost(req.params.id, userUid, isAdmin)

      if (result.error) return res.status(result.status).json({ error: result.error })
      deleteAttachmentFilesByName(filenames)
      res.json(result)
    } catch (err) {
      console.error('[pulse-social] DELETE /posts/:id error:', err.message)
      res.status(500).json({ error: 'Failed to delete post' })
    }
  })

  // ─── Reactions ─────────────────────────────────────────────────

  /**
   * @openapi
   * /api/modules/pulse-social/posts/{id}/reactions:
   *   get:
   *     summary: Get reaction details for a post (for tooltips)
   *     tags: [Pulse Social]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Reactions grouped by emoji with user UIDs
   */
  router.get('/posts/:id/reactions', ...readAuth, function(req, res) {
    try {
      const result = getPostReactions(req.params.id)
      if (result.error) return res.status(result.status).json({ error: result.error })
      res.json(result)
    } catch (err) {
      console.error('[pulse-social] GET /posts/:id/reactions error:', err.message)
      res.status(500).json({ error: 'Failed to load reactions' })
    }
  })

  /**
   * @openapi
   * /api/modules/pulse-social/posts/{id}/reactions:
   *   post:
   *     summary: Toggle a reaction on a post
   *     tags: [Pulse Social]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [emoji]
   *             properties:
   *               emoji: { type: string }
   *     responses:
   *       200:
   *         description: Reaction toggled
   */
  router.post('/posts/:id/reactions', ...writeAuth, demoGuard, rateLimitMiddleware('reaction'), function(req, res) {
    try {
      const emojiErr = validateEmoji(req.body.emoji)
      if (emojiErr) return res.status(400).json({ error: emojiErr })

      const userUid = req.userUid || req.userEmail
      const result = togglePostReaction(req.params.id, { userUid, emoji: req.body.emoji })

      if (result.error) return res.status(result.status).json({ error: result.error })
      res.json(result)
    } catch (err) {
      console.error('[pulse-social] POST /posts/:id/reactions error:', err.message)
      res.status(500).json({ error: 'Failed to toggle reaction' })
    }
  })

  // ─── Comments ──────────────────────────────────────────────────

  /**
   * @openapi
   * /api/modules/pulse-social/posts/{id}/comments:
   *   post:
   *     summary: Add a comment to a post
   *     tags: [Pulse Social]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [body]
   *             properties:
   *               body: { type: string }
   *     responses:
   *       201:
   *         description: Comment created
   */
  router.post('/posts/:id/comments', ...writeAuth, demoGuard, rateLimitMiddleware('comment'), function(req, res) {
    try {
      const bodyErr = validateCommentBody(req.body.body)
      if (bodyErr) return res.status(400).json({ error: bodyErr })

      const result = addComment(req.params.id, {
        authorUid: req.userUid || req.userEmail,
        authorName: req.userName || req.userEmail || 'Unknown',
        body: req.body.body
      })

      if (result.error) return res.status(result.status).json({ error: result.error })
      res.status(201).json(result.comment)
    } catch (err) {
      console.error('[pulse-social] POST /posts/:id/comments error:', err.message)
      res.status(500).json({ error: 'Failed to add comment' })
    }
  })

  /**
   * @openapi
   * /api/modules/pulse-social/posts/{id}/comments/{commentId}:
   *   put:
   *     summary: Edit own comment
   *     tags: [Pulse Social]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *       - in: path
   *         name: commentId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [body]
   *             properties:
   *               body: { type: string }
   *     responses:
   *       200:
   *         description: Updated comment
   */
  router.put('/posts/:id/comments/:commentId', ...writeAuth, demoGuard, function(req, res) {
    try {
      const bodyErr = validateCommentBody(req.body.body)
      if (bodyErr) return res.status(400).json({ error: bodyErr })

      const authorUid = req.userUid || req.userEmail
      const result = updateComment(req.params.id, req.params.commentId, { body: req.body.body }, authorUid)

      if (result.error) return res.status(result.status).json({ error: result.error })
      res.json(result.comment)
    } catch (err) {
      console.error('[pulse-social] PUT /posts/:id/comments/:commentId error:', err.message)
      res.status(500).json({ error: 'Failed to update comment' })
    }
  })

  /**
   * @openapi
   * /api/modules/pulse-social/posts/{id}/comments/{commentId}:
   *   delete:
   *     summary: Delete a comment (author or admin)
   *     tags: [Pulse Social]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *       - in: path
   *         name: commentId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Comment deleted
   */
  router.delete('/posts/:id/comments/:commentId', ...writeAuth, demoGuard, function(req, res) {
    try {
      const userUid = req.userUid || req.userEmail
      const isAdmin = req.isAdmin === true
      const result = deleteComment(req.params.id, req.params.commentId, userUid, isAdmin)

      if (result.error) return res.status(result.status).json({ error: result.error })
      res.json(result)
    } catch (err) {
      console.error('[pulse-social] DELETE comment error:', err.message)
      res.status(500).json({ error: 'Failed to delete comment' })
    }
  })

  /**
   * @openapi
   * /api/modules/pulse-social/posts/{id}/comments/{commentId}/reactions:
   *   post:
   *     summary: Toggle a reaction on a comment
   *     tags: [Pulse Social]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *       - in: path
   *         name: commentId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [emoji]
   *             properties:
   *               emoji: { type: string }
   *     responses:
   *       200:
   *         description: Reaction toggled
   */
  router.post('/posts/:id/comments/:commentId/reactions', ...writeAuth, demoGuard, rateLimitMiddleware('reaction'), function(req, res) {
    try {
      const emojiErr = validateEmoji(req.body.emoji)
      if (emojiErr) return res.status(400).json({ error: emojiErr })

      const userUid = req.userUid || req.userEmail
      const result = toggleCommentReaction(req.params.id, req.params.commentId, { userUid, emoji: req.body.emoji })

      if (result.error) return res.status(result.status).json({ error: result.error })
      res.json(result)
    } catch (err) {
      console.error('[pulse-social] POST comment reaction error:', err.message)
      res.status(500).json({ error: 'Failed to toggle reaction' })
    }
  })

  // ─── Moderation ────────────────────────────────────────────────

  /**
   * @openapi
   * /api/modules/pulse-social/posts/{id}/pin:
   *   post:
   *     summary: Pin or unpin a post (admin only)
   *     tags: [Pulse Social]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Pin toggled
   */
  router.post('/posts/:id/pin', ...writeAuth, demoGuard, requireAdmin, function(req, res) {
    try {
      const result = pinPost(req.params.id, true)
      if (result.error) return res.status(result.status).json({ error: result.error })
      res.json(result)
    } catch (err) {
      console.error('[pulse-social] POST /posts/:id/pin error:', err.message)
      res.status(500).json({ error: 'Failed to toggle pin' })
    }
  })

  /**
   * @openapi
   * /api/modules/pulse-social/posts/{id}/resolve:
   *   post:
   *     summary: Mark a question post as resolved (author only)
   *     tags: [Pulse Social]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Resolved toggled
   */
  router.post('/posts/:id/resolve', ...writeAuth, demoGuard, function(req, res) {
    try {
      const userUid = req.userUid || req.userEmail
      const result = resolvePost(req.params.id, userUid)
      if (result.error) return res.status(result.status).json({ error: result.error })
      res.json(result)
    } catch (err) {
      console.error('[pulse-social] POST /posts/:id/resolve error:', err.message)
      res.status(500).json({ error: 'Failed to toggle resolve' })
    }
  })

  // ─── Stats ─────────────────────────────────────────────────────

  /**
   * @openapi
   * /api/modules/pulse-social/stats:
   *   get:
   *     summary: Get feed usage statistics
   *     tags: [Pulse Social]
   *     responses:
   *       200:
   *         description: Usage metrics for PoC validation
   */
  router.get('/stats', ...readAuth, function(req, res) {
    try {
      const stats = getStats()
      res.json(stats)
    } catch (err) {
      console.error('[pulse-social] GET /stats error:', err.message)
      res.status(500).json({ error: 'Failed to load stats' })
    }
  })

  // ─── Attachments ─────────────────────────────────────────────

  /**
   * @openapi
   * /api/modules/pulse-social/attachments:
   *   post:
   *     summary: Upload a file attachment
   *     tags: [Pulse Social]
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *               postId:
   *                 type: string
   *     responses:
   *       201:
   *         description: Attachment metadata
   *       400:
   *         description: Validation error
   *       507:
   *         description: Storage quota exceeded
   */
  router.post('/attachments', ...writeAuth, demoGuard, rateLimitMiddleware('upload'), function(req, res) {
    const MAX_UPLOAD = 10 * 1024 * 1024 + 1024
    const chunks = []
    let totalSize = 0
    let destroyed = false
    req.on('data', (chunk) => {
      totalSize += chunk.length
      if (totalSize > MAX_UPLOAD) {
        destroyed = true
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('error', (_err) => {
      if (!res.headersSent) {
        res.status(400).json({ error: 'Upload stream error' })
      }
    })
    req.on('end', () => {
      if (destroyed) {
        if (!res.headersSent) {
          return res.status(413).json({ error: 'Upload exceeds maximum size (10MB)' })
        }
        return
      }
      try {
        const buffer = Buffer.concat(chunks)
        const contentType = req.headers['content-type'] || ''
        const filename = decodeURIComponent(req.headers['x-filename'] || 'upload')
        const postId = req.headers['x-post-id']

        if (!postId) return res.status(400).json({ error: 'x-post-id header is required' })
        if (!buffer.length) return res.status(400).json({ error: 'No file data received' })

        const file = {
          originalname: filename,
          mimetype: contentType.split(';')[0].trim(),
          size: buffer.length,
          buffer
        }

      const validationError = validateFile(file)
      if (validationError) return res.status(400).json({ error: validationError })

      const result = saveAttachment(file, postId)
      if (result.error) return res.status(result.status).json({ error: result.error })

        res.status(201).json(result.attachment)
      } catch (err) {
        console.error('[pulse-social] POST /attachments error:', err.message)
        res.status(500).json({ error: 'Failed to upload attachment' })
      }
    })
  })

  /**
   * @openapi
   * /api/modules/pulse-social/attachments/{filename}:
   *   get:
   *     summary: Serve an uploaded attachment
   *     tags: [Pulse Social]
   *     parameters:
   *       - in: path
   *         name: filename
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: File content
   *       404:
   *         description: File not found
   */
  router.get('/attachments/:filename', ...readAuth, function(req, res) {
    try {
      const filePath = getAttachmentPath(req.params.filename)
      if (!filePath) return res.status(404).json({ error: 'Attachment not found' })

      res.setHeader('X-Content-Type-Options', 'nosniff')
      if (!isImageFile(req.params.filename)) {
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`)
      }

      res.sendFile(filePath)
    } catch (err) {
      console.error('[pulse-social] GET /attachments error:', err.message)
      res.status(500).json({ error: 'Failed to serve attachment' })
    }
  })

  // ─── Diagnostics ───────────────────────────────────────────────

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      try {
        const stats = getStats()
        return {
          databaseReady: true,
          demoMode: IS_DEMO,
          ...stats
        }
      } catch (err) {
        return { databaseReady: false, error: err.message }
      }
    })
  }
}
