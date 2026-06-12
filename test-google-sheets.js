// Test script to verify Google Sheets API connection
const { google } = require('googleapis');
const fs = require('fs');

async function testGoogleSheets() {
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

    console.log('✅ Found tokens for:', userEmail);
    console.log('📄 Spreadsheet ID:', userData.spreadsheetId);
    console.log('📄 Spreadsheet Name:', userData.spreadsheetName);

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

    // Try to read the Interactions sheet
    console.log('\n📊 Attempting to read Interactions sheet...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: userData.spreadsheetId,
      range: 'Interactions!A1:Z',
    });

    const rows = response.data.values || [];
    console.log(`✅ Successfully read ${rows.length} rows`);

    if (rows.length > 0) {
      console.log('\n📋 Headers:', rows[0]);
      console.log(`📋 Data rows: ${rows.length - 1}`);

      if (rows.length > 1) {
        console.log('\n📝 First data row:');
        console.log(rows[1]);
      }
    } else {
      console.log('⚠️  Sheet is empty');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testGoogleSheets();
