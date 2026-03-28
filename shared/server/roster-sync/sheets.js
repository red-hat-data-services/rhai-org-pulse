/**
 * Google Sheets client for fetching team breakdown data.
 * Authenticates via service account key file.
 */

const { google } = require('googleapis');
const { getAuth, discoverSheetNames: sharedDiscoverSheetNames } = require('../google-sheets');
const { getEffectiveColumns, getEffectiveColumnsFromTeamStructure } = require('./constants');

function normalizeNameForMatch(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Discover all sheet names in a spreadsheet.
 * Delegates to shared google-sheets module.
 */
async function discoverSheetNames(sheetId) {
  return sharedDiscoverSheetNames(sheetId);
}

/**
 * Fetch team breakdown data from Google Sheets.
 * Uses customFields (array of { key, columnName }) to dynamically map columns.
 * The first field with key "name" is used for person matching.
 * Returns a Map of normalized name -> enrichment data.
 */
async function fetchSheetData(sheetId, sheetNames, customFields, teamStructure) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const people = new Map();

  // Prefer teamStructure if available, fall back to customFields
  const columnLabels = getEffectiveColumnsFromTeamStructure(teamStructure) || getEffectiveColumns(customFields);

  // Determine the name column label
  const nameColumnLabel = columnLabels.name || null;

  if (!nameColumnLabel) {
    console.warn('[sheets] No "name" field configured in custom fields, skipping sheet data fetch');
    return people;
  }

  if (!sheetNames || sheetNames.length === 0) {
    sheetNames = await discoverSheetNames(sheetId);
    console.log(`[sheets] Auto-discovered ${sheetNames.length} sheets: ${sheetNames.join(', ')}`);
  }

  for (const sheetName of sheetNames) {
    let rows;
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${sheetName}'`,
        valueRenderOption: 'UNFORMATTED_VALUE'
      });
      rows = response.data.values;
    } catch (err) {
      console.warn(`Sheet "${sheetName}" could not be read: ${err.message}`);
      continue;
    }

    if (!rows || rows.length < 2) {
      console.warn(`Sheet "${sheetName}" is empty or has no data rows`);
      continue;
    }

    // First row is headers — trim whitespace for reliable matching
    const headers = rows[0].map(h => typeof h === 'string' ? h.trim() : h);

    // Build column index dynamically from configured fields
    const colIndex = {};
    for (const [field, colName] of Object.entries(columnLabels)) {
      if (!colName) continue;
      const idx = headers.indexOf(colName.trim());
      if (idx !== -1) colIndex[field] = idx;
    }

    if (colIndex.name === undefined) {
      console.warn(`Sheet "${sheetName}" missing "${nameColumnLabel}" column, skipping`);
      continue;
    }

    const dataRows = rows.slice(1);
    console.log(`  Sheet "${sheetName}": ${dataRows.length} rows`);

    for (const row of dataRows) {
      const name = row[colIndex.name];
      if (!name || typeof name !== 'string') continue;

      const normalized = normalizeNameForMatch(name);
      const entry = { originalName: name, sourceSheet: sheetName };

      // Dynamically populate all configured fields (except name)
      for (const [field, idx] of Object.entries(colIndex)) {
        if (field === 'name') continue;
        entry[field] = row[idx] || null;
      }

      const existing = people.get(normalized);
      if (existing) {
        if (!Array.isArray(existing)) {
          people.set(normalized, [existing, entry]);
        } else {
          existing.push(entry);
        }
      } else {
        people.set(normalized, entry);
      }
    }
  }

  return people;
}

module.exports = {
  fetchSheetData,
  discoverSheetNames,
  normalizeNameForMatch
};
