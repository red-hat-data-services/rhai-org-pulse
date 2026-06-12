// Test importing interactions via the API
const fs = require('fs');

async function testImport() {
  try {
    // Read the test CSV
    const csvContent = fs.readFileSync('./test-interactions.csv', 'utf-8');
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',');

    console.log('📋 CSV Headers:', headers);

    // Parse CSV rows
    const interactions = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const interaction = {};

      headers.forEach((header, idx) => {
        const key = header.trim();
        let value = values[idx]?.trim() || '';

        // Handle arrays (separated by semicolons in CSV)
        if (key === 'toolsOfChoice' || key === 'futureWishlist') {
          value = value ? value.split(';').map(v => v.trim()) : [];
        }

        interaction[key] = value;
      });

      interactions.push(interaction);
    }

    console.log(`\n📝 Parsed ${interactions.length} interactions`);
    console.log('\nFirst interaction:');
    console.log(JSON.stringify(interactions[0], null, 2));

    // Send to API
    console.log('\n🚀 Sending to API...');
    const response = await fetch('http://localhost:3001/api/modules/customer-insights/interactions/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        interactions,
        mode: 'create'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log(`✅ Success! Created ${result.created} interactions`);
    console.log('\nFirst created item:');
    console.log(JSON.stringify(result.items[0], null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testImport();
