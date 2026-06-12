// Debug script to see the raw sheet data
const { google } = require('googleapis');
const fs = require('fs');

async function debugSheetData() {
  try {
    const tokenFile = './data/customer-insights/user-tokens.json';
    const tokensData = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'));
    const userEmail = 'local-dev@redhat.com';
    const userData = tokensData[userEmail];

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({
      access_token: userData.access_token,
      refresh_token: userData.refresh_token,
      expiry_date: userData.expiry_date
    });

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: userData.spreadsheetId,
      range: 'Interactions!A1:Z5', // First 5 rows
    });

    const rows = response.data.values || [];

    console.log('📋 Headers (Row 1):');
    console.log(rows[0]);

    console.log('\n📝 Row 2 (first data row):');
    rows[0].forEach((header, idx) => {
      console.log(`  [${idx}] ${header}: "${rows[1] ? rows[1][idx] || '' : ''}"`);
    });

    console.log('\n📝 Row 3 (second data row):');
    rows[0].forEach((header, idx) => {
      console.log(`  [${idx}] ${header}: "${rows[2] ? rows[2][idx] || '' : ''}"`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugSheetData();
