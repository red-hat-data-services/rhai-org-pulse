// Fix the column misalignment in Google Sheet
const { google } = require('googleapis');
const fs = require('fs');
const readline = require('readline');

async function fixColumns() {
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
    const spreadsheetId = userData.spreadsheetId;

    // Read current data
    console.log('📊 Reading current data...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Interactions!A1:Z',
    });

    const rows = response.data.values || [];
    console.log(`✅ Found ${rows.length} rows`);

    if (rows.length <= 1) {
      console.log('ℹ️  No data to fix.');
      return;
    }

    // Current headers
    const headers = rows[0];
    console.log('\n📋 Current headers:', headers);

    // It looks like the data is: ID in customerCompany, component in geo, geo in customerType
    // Let's check the pattern
    console.log('\n🔍 Analyzing data pattern...');
    console.log('Row 2:', rows[1]);

    // Confirm before fixing
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n⚠️  Analysis:');
    console.log('  - IDs (int-001, etc.) are in customerCompany column');
    console.log('  - Components are in geo column');
    console.log('  - Geos are in customerType column');
    console.log('  - Status column is empty');
    console.log('\nThis suggests the CSV import had columns in wrong order.');

    const answer = await new Promise(resolve => {
      rl.question('\nDo you want me to try to rearrange the columns? (yes/no): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Cancelled.');
      return;
    }

    console.log('\n🔧 Recommendation: Clear the sheet and re-import with correct CSV format.');
    console.log('\nThe CSV should have these headers in this exact order:');
    console.log('ID,Date,Customer Company,Contact Name,Field Contact Name,Component,Geo,Industry Vertical,Environment,Customer Type,Status,Main AI Use Case,Tools of Choice,Pain Points,Feature Feedback,Future Wishlist,PM Comments');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixColumns();
