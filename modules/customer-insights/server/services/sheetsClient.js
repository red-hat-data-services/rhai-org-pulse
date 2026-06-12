const { google } = require('googleapis')
const { getAuthClient } = require('./googleAuth')
const { readFromStorage, writeToStorage } = require('../../../../shared/server')

/**
 * Get configured Google Sheets API client
 * @param {object} secrets - Module secrets
 */
async function getSheetsApi(secrets) {
  const auth = await getAuthClient(secrets, { readFromStorage, writeToStorage })
  return google.sheets({ version: 'v4', auth })
}

/**
 * Get spreadsheet ID from secrets
 * @param {object} secrets - Module secrets
 */
function getSpreadsheetId(secrets) {
  const id = secrets.GOOGLE_SPREADSHEET_ID
  if (!id) throw new Error('Missing GOOGLE_SPREADSHEET_ID in module secrets')
  return id
}

/**
 * Read data from a sheet range
 * @param {object} secrets
 * @param {string} range - e.g., "Interactions!A2:Q"
 */
async function readSheet(secrets, range) {
  const sheets = await getSheetsApi(secrets)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(secrets),
    range,
  })
  return res.data.values || []
}

/**
 * Append rows to a sheet
 * @param {object} secrets
 * @param {string} sheetName
 * @param {Array<Array>} rows
 */
async function appendRows(secrets, sheetName, rows) {
  if (!rows.length) return

  const sheets = await getSheetsApi(secrets)
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(secrets),
    range: `${sheetName}!A:A`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  })
}

/**
 * Update a specific row
 * @param {object} secrets
 * @param {string} sheetName
 * @param {number} rowNumber - 1-based row number
 * @param {Array} values
 */
async function updateRow(secrets, sheetName, rowNumber, values) {
  const sheets = await getSheetsApi(secrets)
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(secrets),
    range: `${sheetName}!A${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [values] },
  })
}

/**
 * Delete a row
 * @param {object} secrets
 * @param {string} sheetName
 * @param {number} rowNumber - 1-based row number
 */
async function deleteRow(secrets, sheetName, rowNumber) {
  const sheets = await getSheetsApi(secrets)
  const sheetId = await getSheetId(secrets, sheetName)

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: getSpreadsheetId(secrets),
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
 * @param {object} secrets
 * @param {string} sheetName
 * @param {Array} headerRow
 * @param {Array<Array>} dataRows
 */
async function clearAndWrite(secrets, sheetName, headerRow, dataRows) {
  const sheets = await getSheetsApi(secrets)
  const spreadsheetId = getSpreadsheetId(secrets)

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
 * @param {object} secrets
 * @param {string} sheetName
 */
async function getSheetId(secrets, sheetName) {
  const sheets = await getSheetsApi(secrets)
  const res = await sheets.spreadsheets.get({
    spreadsheetId: getSpreadsheetId(secrets),
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
 * @param {object} secrets
 * @param {string} sheetName
 * @param {Array} headerRow
 */
async function ensureHeaders(secrets, sheetName, headerRow) {
  const existing = await readSheet(secrets, `${sheetName}!1:1`)

  if (!existing.length || !existing[0].length) {
    const sheets = await getSheetsApi(secrets)
    await sheets.spreadsheets.values.update({
      spreadsheetId: getSpreadsheetId(secrets),
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headerRow] },
    })
  }
}

module.exports = {
  readSheet,
  appendRows,
  updateRow,
  deleteRow,
  clearAndWrite,
  ensureHeaders,
}
