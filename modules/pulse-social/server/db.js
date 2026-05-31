const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')
const { migrate } = require('./migrate')
const { seed } = require('./seed')

const { DATA_DIR } = require('../../../shared/server/storage')

let _db = null

function getDb() {
  if (_db) return _db
  throw new Error('[pulse-social] Database not initialized. Call initDb() first.')
}

function initDb() {
  if (_db) return _db

  const isDemo = process.env.DEMO_MODE === 'true'

  if (isDemo) {
    const fixturesPath = path.join(__dirname, '..', '..', '..', 'fixtures', 'pulse-social', 'feed.db')
    if (fs.existsSync(fixturesPath)) {
      _db = new Database(fixturesPath, { readonly: true })
      console.log('[pulse-social] Opened fixtures DB in read-only mode (DEMO_MODE)')
    } else {
      _db = new Database(':memory:')
      _db.pragma('foreign_keys = ON')
      migrate(_db)
      seed(_db)
      console.log('[pulse-social] Created in-memory demo DB with seed data')
    }
  } else {
    const dbDir = path.join(DATA_DIR, 'pulse-social')
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }
    const dbPath = path.join(dbDir, 'feed.db')
    _db = new Database(dbPath)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    migrate(_db)

    const postCount = _db.prepare('SELECT COUNT(*) as count FROM posts').get().count
    if (postCount === 0) {
      seed(_db)
      console.log('[pulse-social] Seeded empty database with sample posts')
    }

    console.log(`[pulse-social] Database ready at ${dbPath}`)
  }

  return _db
}

function closeDb() {
  if (_db) {
    _db.close()
    _db = null
  }
}

module.exports = { getDb, initDb, closeDb }
