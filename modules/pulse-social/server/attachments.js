const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { getDb } = require('./db')
const { DATA_DIR } = require('../../../shared/server/storage')

const ATTACHMENTS_DIR = path.join(DATA_DIR, 'pulse-social', 'attachments')

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'txt', 'md'])
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain', 'text/markdown'
])

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp'])

const MAGIC_BYTES = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': null,
  'application/pdf': [0x25, 0x50, 0x44, 0x46]
}

const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_TOTAL_STORAGE = 2 * 1024 * 1024 * 1024

function ensureAttachmentsDir() {
  if (!fs.existsSync(ATTACHMENTS_DIR)) {
    fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true })
  }
}

function getExtension(filename) {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : ''
}

function validateFile(file) {
  if (!file || !file.originalname) return 'No file provided'

  const ext = getExtension(file.originalname)
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return `File type .${ext} is not allowed. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return `MIME type ${file.mimetype} is not allowed`
  }

  if (file.size > MAX_FILE_SIZE) {
    return `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds the 10MB limit`
  }

  if (file.buffer && MAGIC_BYTES[file.mimetype]) {
    const expected = MAGIC_BYTES[file.mimetype]
    const actual = [...file.buffer.slice(0, expected.length)]
    const matches = expected.every((byte, i) => actual[i] === byte)
    if (!matches) return 'File content does not match its declared MIME type'
  }

  return null
}

function checkStorageQuota() {
  const db = getDb()
  const result = db.prepare('SELECT COALESCE(SUM(size), 0) as total FROM attachments').get()
  return {
    used: result.total,
    limit: MAX_TOTAL_STORAGE,
    available: MAX_TOTAL_STORAGE - result.total,
    exceeded: result.total >= MAX_TOTAL_STORAGE
  }
}

function saveAttachment(file, postId) {
  ensureAttachmentsDir()

  const quota = checkStorageQuota()
  if (quota.available < file.size) {
    return { error: `Storage quota exceeded. ${(quota.used / 1024 / 1024 / 1024).toFixed(2)}GB of ${(quota.limit / 1024 / 1024 / 1024).toFixed(0)}GB used.`, status: 507 }
  }

  const ext = getExtension(file.originalname)
  const id = crypto.randomUUID()
  const filename = `${id}.${ext}`
  const filePath = path.join(ATTACHMENTS_DIR, filename)

  fs.writeFileSync(filePath, file.buffer)

  const db = getDb()
  const now = new Date().toISOString()
  const type = IMAGE_EXTENSIONS.has(ext) ? 'image' : 'file'

  db.prepare(`
    INSERT INTO attachments (id, post_id, type, filename, original_name, mime_type, size, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, postId, type, filename, file.originalname, file.mimetype, file.size, now)

  return {
    attachment: { id, type, filename, original_name: file.originalname, mime_type: file.mimetype, size: file.size }
  }
}

function getAttachmentPath(filename) {
  const filePath = path.join(ATTACHMENTS_DIR, filename)
  const resolvedDir = path.resolve(ATTACHMENTS_DIR)
  const resolvedFile = path.resolve(filePath)
  if (!resolvedFile.startsWith(resolvedDir + path.sep) && resolvedFile !== resolvedDir) {
    return null
  }
  if (!fs.existsSync(filePath)) return null
  return filePath
}

function isImageFile(filename) {
  return IMAGE_EXTENSIONS.has(getExtension(filename))
}

function getAttachmentFilenames(postId) {
  const db = getDb()
  return db.prepare('SELECT filename FROM attachments WHERE post_id = ?').all(postId).map(a => a.filename)
}

function deleteAttachmentFilesByName(filenames) {
  for (const filename of filenames) {
    const filePath = path.join(ATTACHMENTS_DIR, filename)
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch (err) {
      console.warn(`[pulse-social] Failed to delete attachment file: ${filename}`, err.message)
    }
  }
}

module.exports = {
  validateFile,
  saveAttachment,
  getAttachmentPath,
  isImageFile,
  checkStorageQuota,
  getAttachmentFilenames,
  deleteAttachmentFilesByName,
  ATTACHMENTS_DIR
}
