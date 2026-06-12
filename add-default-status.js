// Add default "Discovery" status to all rows that have empty status
const { google } = require('googleapis');
const fs = require('fs');

async function addDefaultStatus() {
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
      range: 'Interactions!A1:O',
    });

    const rows = response.data.values || [];
    console.log(`✅ Found ${rows.length} rows (including header)`);

    if (rows.length <= 1) {
      console.log('ℹ️  No data rows to update.');
      return;
    }

    // Status is column O (index 14)
    const statusColumnIndex = 14;
    let emptyCount = 0;

    // Count empty statuses
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[statusColumnIndex] || row[statusColumnIndex].trim() === '') {
        emptyCount++;
      }
    }

    console.log(`\n📝 Found ${emptyCount} rows with empty status`);

    if (emptyCount === 0) {
      console.log('✅ All rows already have status!');
      return;
    }

    console.log('🔧 Setting all empty statuses to "Discovery"...');

    // Update each row with empty status
    const updates = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[statusColumnIndex] || row[statusColumnIndex].trim() === '') {
        // Row number in sheet (1-indexed, +1 for header row)
        const rowNum = i + 1;
        updates.push({
          range: `Interactions!O${rowNum}`,
          values: [['Discovery']]
        });
      }
    }

    // Batch update
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates
      }
    });

    console.log(`✅ Successfully updated ${updates.length} rows with status "Discovery"`);
    console.log('\n🎉 Done! Your interactions should now appear in the Kanban board.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

addDefaultStatus();
