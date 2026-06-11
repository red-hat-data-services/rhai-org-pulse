const { readSheet, appendRows, updateRow, deleteRow, clearAndWrite, ensureHeaders } = require('./sheetsClient')
const { getCached, setCache, invalidate } = require('./sheetsCache')
const crypto = require('crypto')

// Simple UUID v4 generator
function generateId() {
  return crypto.randomBytes(16).toString('hex')
}

const SHEET_NAME = 'Interactions'
const CACHE_KEY = 'interactions'

const HEADERS = [
  'id',
  'component',
  'customerCompany',
  'contactName',
  'fieldContactName',
  'industryVertical',
  'geo',
  'customerType',
  'environment',
  'mainAIUseCase',
  'toolsOfChoice',
  'painPoints',
  'featureFeedback',
  'futureWishlist',
  'pmComments',
  'status',
  'createdAt',
  'updatedAt',
]

const ARRAY_FIELDS = new Set(['toolsOfChoice', 'futureWishlist'])

/**
 * Serialize an interaction object to a spreadsheet row
 */
function serializeRow(item) {
  return HEADERS.map((key) => {
    const val = item[key]
    if (ARRAY_FIELDS.has(key)) {
      return JSON.stringify(Array.isArray(val) ? val : [])
    }
    return val == null ? '' : String(val)
  })
}

/**
 * Deserialize a spreadsheet row to an interaction object
 */
function deserializeRow(row) {
  const obj = {}
  HEADERS.forEach((key, i) => {
    const val = row[i] || ''
    if (ARRAY_FIELDS.has(key)) {
      try {
        obj[key] = JSON.parse(val)
      } catch {
        obj[key] = []
      }
    } else {
      obj[key] = val
    }
  })
  return obj
}

/**
 * Get all interactions from Google Sheets (with caching)
 */
async function getAllFromSheet(secrets) {
  const cached = getCached(CACHE_KEY)
  if (cached) return cached

  await ensureHeaders(secrets, SHEET_NAME, HEADERS)
  const rows = await readSheet(secrets, `${SHEET_NAME}!A2:R`)
  const data = rows.map(deserializeRow)

  setCache(CACHE_KEY, data)
  return data
}

/**
 * Create storage service instance bound to module secrets
 * @param {object} secrets - Module secrets from context
 */
function createStorage(secrets) {
  return {
    /**
     * Get all interactions
     * @param {object} filters - Optional filters { component, status, geo, industry }
     */
    async getAll(filters = {}) {
      let data = await getAllFromSheet(secrets)

      // Apply filters
      if (filters.component && filters.component !== 'all') {
        data = data.filter(item => item.component === filters.component)
      }
      if (filters.status) {
        data = data.filter(item => item.status === filters.status)
      }
      if (filters.geo) {
        data = data.filter(item => item.geo === filters.geo)
      }
      if (filters.industryVertical) {
        data = data.filter(item => item.industryVertical === filters.industryVertical)
      }

      return data
    },

    /**
     * Get interaction by ID
     */
    async getById(id) {
      const data = await getAllFromSheet(secrets)
      return data.find((item) => item.id === id) || null
    },

    /**
     * Create new interaction
     */
    async create(interaction) {
      const now = new Date().toISOString()
      const newItem = {
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        ...interaction,
      }

      await ensureHeaders(secrets, SHEET_NAME, HEADERS)
      await appendRows(secrets, SHEET_NAME, [serializeRow(newItem)])
      invalidate(CACHE_KEY)

      return newItem
    },

    /**
     * Update existing interaction
     */
    async update(id, updates) {
      const data = await getAllFromSheet(secrets)
      const index = data.findIndex((item) => item.id === id)

      if (index === -1) return null

      const merged = {
        ...data[index],
        ...updates,
        id, // Don't allow changing ID
        updatedAt: new Date().toISOString(),
      }

      // Row number in sheet (header is row 1, data starts at row 2)
      await updateRow(secrets, SHEET_NAME, index + 2, serializeRow(merged))
      invalidate(CACHE_KEY)

      return merged
    },

    /**
     * Delete interaction
     */
    async delete(id) {
      const data = await getAllFromSheet(secrets)
      const index = data.findIndex((item) => item.id === id)

      if (index === -1) return false

      await deleteRow(secrets, SHEET_NAME, index + 2)
      invalidate(CACHE_KEY)

      return true
    },

    /**
     * Batch create multiple interactions
     */
    async createMany(items) {
      if (!items.length) return items

      const now = new Date().toISOString()
      const newItems = items.map(item => ({
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        ...item,
      }))

      await ensureHeaders(secrets, SHEET_NAME, HEADERS)
      await appendRows(secrets, SHEET_NAME, newItems.map(serializeRow))
      invalidate(CACHE_KEY)

      return newItems
    },

    /**
     * Upsert many interactions (merge by customerCompany + component)
     */
    async upsertMany(items) {
      const data = await getAllFromSheet(secrets)
      let created = 0
      let updated = 0
      const results = []

      for (const item of items) {
        const matchKey = (item.customerCompany || '').trim().toLowerCase()
        const matchComponent = (item.component || '').trim().toLowerCase()

        const existingIdx = matchKey
          ? data.findIndex((d) =>
              (d.customerCompany || '').trim().toLowerCase() === matchKey &&
              (d.component || '').trim().toLowerCase() === matchComponent
            )
          : -1

        if (existingIdx !== -1) {
          // Merge fields (preserve existing non-empty values, merge arrays)
          const merged = mergeFields(data[existingIdx], item)
          merged.updatedAt = new Date().toISOString()
          data[existingIdx] = merged
          results.push(merged)
          updated++
        } else {
          // Create new
          const now = new Date().toISOString()
          const newItem = {
            id: generateId(),
            createdAt: now,
            updatedAt: now,
            ...item,
          }
          data.push(newItem)
          results.push(newItem)
          created++
        }
      }

      // Rewrite entire sheet
      await clearAndWrite(secrets, SHEET_NAME, HEADERS, data.map(serializeRow))
      invalidate(CACHE_KEY)

      return { created, updated, items: results }
    },
  }
}

/**
 * Merge fields from incoming data into existing record
 * Preserves existing non-empty values, merges arrays
 */
function mergeFields(existing, incoming) {
  const merged = { ...existing }

  for (const [key, val] of Object.entries(incoming)) {
    // Don't overwrite these fields
    if (key === 'id' || key === 'createdAt' || key === 'component') continue

    if (Array.isArray(val)) {
      if (val.length > 0) {
        const existingArr = Array.isArray(existing[key]) ? existing[key] : []
        merged[key] = [...new Set([...existingArr, ...val])]
      }
    } else if (typeof val === 'string' && val.trim()) {
      merged[key] = val
    }
  }

  return merged
}

module.exports = {
  createStorage,
}
