const { getSheetsApi, readSheet, appendRows, updateRow, deleteRow, clearAndWrite, ensureHeaders } = require('./sheetsClient')
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
  'owner',
  'meetingNotes',
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
 * @param {import('googleapis').sheets_v4.Sheets} sheets - Sheets API client
 * @param {string} spreadsheetId - Google Spreadsheet ID
 */
async function getAllFromSheet(sheets, spreadsheetId) {
  const cached = getCached(CACHE_KEY)
  if (cached) return cached

  await ensureHeaders(sheets, spreadsheetId, SHEET_NAME, HEADERS)
  const rows = await readSheet(sheets, spreadsheetId, `${SHEET_NAME}!A2:T`)
  const data = rows.map(deserializeRow)

  setCache(CACHE_KEY, data)
  return data
}

/**
 * Create storage service instance bound to service account client
 * @param {object} context - Module context from route handler
 * @returns {object} Storage instance with CRUD methods
 */
function createStorage(context) {
  const spreadsheetId = context.secrets.GOOGLE_SPREADSHEET_ID
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SPREADSHEET_ID not configured in module secrets')
  }

  const keyFile = context.resolveSecret('GOOGLE_SERVICE_ACCOUNT_KEY_FILE')
  let sheetsApi = null

  // Lazy initialization of sheets API client
  async function getSheets() {
    if (!sheetsApi) {
      sheetsApi = await getSheetsApi(keyFile)
    }
    return sheetsApi
  }

  return {
    /**
     * Get all interactions
     * @param {object} filters - Optional filters { component, status, geo, industryVertical }
     */
    async getAll(filters = {}) {
      const sheets = await getSheets()
      let data = await getAllFromSheet(sheets, spreadsheetId)

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
      const sheets = await getSheets()
      const data = await getAllFromSheet(sheets, spreadsheetId)
      return data.find((item) => item.id === id) || null
    },

    /**
     * Create new interaction
     */
    async create(interaction) {
      const sheets = await getSheets()
      const now = new Date().toISOString()
      const newItem = {
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        ...interaction,
      }

      await ensureHeaders(sheets, spreadsheetId, SHEET_NAME, HEADERS)
      await appendRows(sheets, spreadsheetId, SHEET_NAME, [serializeRow(newItem)])
      invalidate(CACHE_KEY)

      return newItem
    },

    /**
     * Update existing interaction
     */
    async update(id, updates) {
      const sheets = await getSheets()
      const data = await getAllFromSheet(sheets, spreadsheetId)
      const index = data.findIndex((item) => item.id === id)

      if (index === -1) return null

      const merged = {
        ...data[index],
        ...updates,
        id, // Don't allow changing ID
        updatedAt: new Date().toISOString(),
      }

      // Row number in sheet (header is row 1, data starts at row 2)
      await updateRow(sheets, spreadsheetId, SHEET_NAME, index + 2, serializeRow(merged))
      invalidate(CACHE_KEY)

      return merged
    },

    /**
     * Delete interaction
     */
    async delete(id) {
      const sheets = await getSheets()
      const data = await getAllFromSheet(sheets, spreadsheetId)
      const index = data.findIndex((item) => item.id === id)

      if (index === -1) return false

      await deleteRow(sheets, spreadsheetId, SHEET_NAME, index + 2)
      invalidate(CACHE_KEY)

      return true
    },

    /**
     * Batch create multiple interactions
     */
    async createMany(items) {
      if (!items.length) return items

      const sheets = await getSheets()
      const now = new Date().toISOString()
      const newItems = items.map(item => ({
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        ...item,
      }))

      await ensureHeaders(sheets, spreadsheetId, SHEET_NAME, HEADERS)
      await appendRows(sheets, spreadsheetId, SHEET_NAME, newItems.map(serializeRow))
      invalidate(CACHE_KEY)

      return newItems
    },

    /**
     * Upsert many interactions (merge by customerCompany + component)
     */
    async upsertMany(items) {
      const sheets = await getSheets()
      const data = await getAllFromSheet(sheets, spreadsheetId)
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
      await clearAndWrite(sheets, spreadsheetId, SHEET_NAME, HEADERS, data.map(serializeRow))
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
