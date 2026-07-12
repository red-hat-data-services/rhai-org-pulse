const { google } = require('googleapis')
const fs = require('fs')

/**
 * Get service account auth client with full spreadsheets scope
 * @param {string} keyFile - Path to service account key JSON
 * @returns {import('googleapis').Auth.GoogleAuth}
 */
function getServiceAccountAuth(keyFile) {
  const resolvedKeyFile = keyFile || '/etc/secrets/google-sa-key.json'

  if (!fs.existsSync(resolvedKeyFile)) {
    throw new Error(
      `Google service account key not found at ${resolvedKeyFile}. ` +
      'Set GOOGLE_SERVICE_ACCOUNT_KEY_FILE env var to the correct path, or ' +
      'ensure the key file is mounted at /etc/secrets/google-sa-key.json'
    )
  }

  return new google.auth.GoogleAuth({
    keyFile: resolvedKeyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'] // Full read/write access
  })
}

/**
 * Get configured Google Sheets API client with service account auth
 * @param {string} keyFile - Path to service account key JSON
 * @returns {Promise<import('googleapis').sheets_v4.Sheets>}
 */
async function getSheetsApi(keyFile) {
  const auth = getServiceAccountAuth(keyFile)
  return google.sheets({ version: 'v4', auth })
}

/**
 * Read data from a sheet range
 * @param {import('googleapis').sheets_v4.Sheets} sheets - Sheets API client
 * @param {string} spreadsheetId - Google Spreadsheet ID
 * @param {string} range - e.g., "Interactions!A2:Q"
 * @returns {Promise<Array<Array>>}
 */
async function readSheet(sheets, spreadsheetId, range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  })
  return res.data.values || []
}

/**
 * Append rows to a sheet
 * @param {import('googleapis').sheets_v4.Sheets} sheets - Sheets API client
 * @param {string} spreadsheetId - Google Spreadsheet ID
 * @param {string} sheetName - Sheet tab name
 * @param {Array<Array>} rows - Rows to append
 */
async function appendRows(sheets, spreadsheetId, sheetName, rows) {
  if (!rows.length) return

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:A`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  })
}

/**
 * Update a specific row
 * @param {import('googleapis').sheets_v4.Sheets} sheets - Sheets API client
 * @param {string} spreadsheetId - Google Spreadsheet ID
 * @param {string} sheetName - Sheet tab name
 * @param {number} rowNumber - 1-based row number
 * @param {Array} values - Row values
 */
async function updateRow(sheets, spreadsheetId, sheetName, rowNumber, values) {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [values] },
  })
}

/**
 * Delete a row
 * @param {import('googleapis').sheets_v4.Sheets} sheets - Sheets API client
 * @param {string} spreadsheetId - Google Spreadsheet ID
 * @param {string} sheetName - Sheet tab name
 * @param {number} rowNumber - 1-based row number
 */
async function deleteRow(sheets, spreadsheetId, sheetName, rowNumber) {
  const sheetId = await getSheetId(sheets, spreadsheetId, sheetName)

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowNumber - 1,
            endIndex: rowNumber,
          },
        },
      }],
    },
  })
}

/**
 * Clear sheet and write new data
 * @param {import('googleapis').sheets_v4.Sheets} sheets - Sheets API client
 * @param {string} spreadsheetId - Google Spreadsheet ID
 * @param {string} sheetName - Sheet tab name
 * @param {Array} headerRow - Header row
 * @param {Array<Array>} dataRows - Data rows
 */
async function clearAndWrite(sheets, spreadsheetId, sheetName, headerRow, dataRows) {
  // Clear existing data
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${sheetName}!A:ZZ`,
  })

  // Write header + data
  const allRows = [headerRow, ...dataRows]
  if (allRows.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: allRows },
    })
  }
}

/**
 * Get sheet ID from sheet name
 * @param {import('googleapis').sheets_v4.Sheets} sheets - Sheets API client
 * @param {string} spreadsheetId - Google Spreadsheet ID
 * @param {string} sheetName - Sheet tab name
 * @returns {Promise<number>}
 */
async function getSheetId(sheets, spreadsheetId, sheetName) {
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  })

  const sheet = res.data.sheets.find(
    (s) => s.properties.title === sheetName
  )

  if (!sheet) {
    throw new Error(`Sheet tab "${sheetName}" not found in spreadsheet`)
  }

  return sheet.properties.sheetId
}

/**
 * Ensure headers exist in sheet (create if missing)
 * @param {import('googleapis').sheets_v4.Sheets} sheets - Sheets API client
 * @param {string} spreadsheetId - Google Spreadsheet ID
 * @param {string} sheetName - Sheet tab name
 * @param {Array} headerRow - Header row values
 */
async function ensureHeaders(sheets, spreadsheetId, sheetName, headerRow) {
  const existing = await readSheet(sheets, spreadsheetId, `${sheetName}!1:1`)

  if (!existing.length || !existing[0].length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headerRow] },
    })
  }
}

module.exports = {
  getSheetsApi,
  readSheet,
  appendRows,
  updateRow,
  deleteRow,
  clearAndWrite,
  ensureHeaders,
}
