/**
 * Shared Google Sheets auth and raw data fetching.
 * Extracted from team-tracker's roster-sync/sheets.js for reuse by multiple modules.
 */

const { google } = require('googleapis');
const fs = require('fs');

let cachedAuth = null;

/** @deprecated Use createGoogleSheetsClient() instead */
function getAuth() {
  if (cachedAuth) return cachedAuth;

  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || '/etc/secrets/google-sa-key.json';
  if (!fs.existsSync(keyFile)) {
    throw new Error(
      `Google service account key not found at ${keyFile}. ` +
      'Set GOOGLE_SERVICE_ACCOUNT_KEY_FILE env var to the correct path.'
    );
  }

  cachedAuth = new google.auth.GoogleAuth({
    keyFile: keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  return cachedAuth;
}

/**
 * Discover all sheet/tab names in a spreadsheet.
 * @deprecated Use createGoogleSheetsClient() instead
 * @param {string} sheetId - Google Spreadsheet ID
 * @returns {Promise<string[]>} Array of sheet title strings
 */
async function discoverSheetNames(sheetId) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: 'sheets.properties.title'
  });
  return (response.data.sheets || []).map(s => s.properties.title);
}

/**
 * Fetch raw data from a single sheet tab.
 * @deprecated Use createGoogleSheetsClient() instead
 * @param {string} sheetId - Google Spreadsheet ID
 * @param {string} sheetName - Tab name
 * @returns {Promise<{ headers: string[], rows: any[][] }>}
 */
async function fetchRawSheet(sheetId, sheetName) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${sheetName}'`,
    valueRenderOption: 'UNFORMATTED_VALUE'
  });
  const values = response.data.values || [];
  if (values.length === 0) return { headers: [], rows: [] };
  const headers = values[0].map(h => typeof h === 'string' ? h.trim() : String(h || ''));
  return { headers, rows: values.slice(1) };
}

/**
 * Create a Google Sheets client with bound credentials.
 * @param {{ keyFile?: string }} config
 * @returns {{ discoverSheetNames: Function, fetchRawSheet: Function }}
 */
function createGoogleSheetsClient({ keyFile } = {}) {
  const resolvedKeyFile = keyFile || '/etc/secrets/google-sa-key.json';
  let instanceAuth = null;

  function getInstanceAuth() {
    if (instanceAuth) return instanceAuth;
    if (!fs.existsSync(resolvedKeyFile)) {
      throw new Error(
        `Google service account key not found at ${resolvedKeyFile}. ` +
        'Set GOOGLE_SERVICE_ACCOUNT_KEY_FILE env var to the correct path.'
      );
    }
    instanceAuth = new google.auth.GoogleAuth({
      keyFile: resolvedKeyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    return instanceAuth;
  }

  async function boundDiscoverSheetNames(sheetId) {
    const auth = getInstanceAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      fields: 'sheets.properties.title'
    });
    return (response.data.sheets || []).map(s => s.properties.title);
  }

  async function boundFetchRawSheet(sheetId, sheetName) {
    const auth = getInstanceAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${sheetName}'`,
      valueRenderOption: 'UNFORMATTED_VALUE'
    });
    const values = response.data.values || [];
    if (values.length === 0) return { headers: [], rows: [] };
    const headers = values[0].map(h => typeof h === 'string' ? h.trim() : String(h || ''));
    return { headers, rows: values.slice(1) };
  }

  return { discoverSheetNames: boundDiscoverSheetNames, fetchRawSheet: boundFetchRawSheet };
}

module.exports = {
  getAuth,
  discoverSheetNames,
  fetchRawSheet,
  createGoogleSheetsClient
};
