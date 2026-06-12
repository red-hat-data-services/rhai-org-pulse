// Script to clear all interactions from Google Sheet (keeps header row)
const { google } = require('googleapis');
const fs = require('fs');
const readline = require('readline');

async function clearInteractions() {
  try {
    // Load user tokens
    const tokenFile = './data/customer-insights/user-tokens.json';
    const tokensData = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'));
    const userEmail = 'local-dev@redhat.com';
    const userData = tokensData[userEmail];

    if (!userData) {
      console.error('❌ No tokens found for', userEmail);
      return;
    }

    console.log('📄 Spreadsheet:', userData.spreadsheetName);
    console.log('📄 Spreadsheet ID:', userData.spreadsheetId);

    // Set up OAuth client
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({
      access_token: userData.access_token,
      refresh_token: userData.refresh_token,
      expiry_date: userData.expiry_date
    });

    // Create Sheets API client
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    // Read current data
    console.log('\n📊 Reading current data...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: userData.spreadsheetId,
      range: 'Interactions!A1:Z',
    });

    const rows = response.data.values || [];
    console.log(`✅ Found ${rows.length} total rows (including header)`);

    if (rows.length <= 1) {
      console.log('ℹ️  Sheet only has headers or is empty. Nothing to clear.');
      return;
    }

    const dataRows = rows.length - 1;
    console.log(`📝 Data rows to delete: ${dataRows}`);

    // Confirm deletion
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question(`\n⚠️  Are you sure you want to delete ${dataRows} rows? (yes/no): `, resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Cancelled. No data was deleted.');
      return;
    }

    // Clear all data rows (keep header)
    console.log('\n🗑️  Clearing data rows...');
    await sheets.spreadsheets.values.clear({
      spreadsheetId: userData.spreadsheetId,
      range: 'Interactions!A2:Z',
    });

    console.log('✅ Successfully cleared all interaction data!');
    console.log('✅ Header row preserved.');
    console.log('\n📊 Verification...');

    // Verify
    const verifyResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: userData.spreadsheetId,
      range: 'Interactions!A1:Z',
    });

    const remainingRows = verifyResponse.data.values || [];
    console.log(`✅ Remaining rows: ${remainingRows.length} (should be 1 - just the header)`);

    if (remainingRows.length > 0) {
      console.log('📋 Headers:', remainingRows[0]);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

clearInteractions();
