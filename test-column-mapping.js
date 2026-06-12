// Test the column mapping logic
const headers = [
  'customerCompany',
  'contactName',
  'fieldContactName',
  'component',
  'industryVertical',
  'geo',
  'customerType',
  'environment',
  'mainAIUseCase',
  'toolsOfChoice',
  'painPoints',
  'futureWishlist',
  'featureFeedback',
  'pmComments',
  'status'
];

const normalizedHeaders = headers.map(h => {
  const normalized = String(h).trim()
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
  return { original: h, normalized }
});

console.log('Normalized headers:');
normalizedHeaders.forEach((h, idx) => {
  console.log(`  [${idx}] ${h.original} → ${h.normalized}`);
});

// Test the getColIndex function
const getColIndex = (fieldNames) => {
  for (const name of fieldNames) {
    const idx = normalizedHeaders.findIndex(h => h.normalized === name.toLowerCase())
    if (idx !== -1) return idx
  }
  return -1
}

const colMap = {
  id: getColIndex(['id', 'ID']),
  date: getColIndex(['date', 'Date']),
  customerCompany: getColIndex(['customercompany', 'customerCompany', 'Customer Company']),
  contactName: getColIndex(['contactname', 'contactName', 'Contact Name']),
  fieldContactName: getColIndex(['fieldcontactname', 'fieldContactName', 'Field Contact Name']),
  component: getColIndex(['component', 'Component']),
  geo: getColIndex(['geo', 'Geo', 'Geography']),
  industryVertical: getColIndex(['industryvertical', 'industryVertical', 'Industry Vertical']),
  environment: getColIndex(['environment', 'Environment']),
  customerType: getColIndex(['customertype', 'customerType', 'Customer Type']),
  status: getColIndex(['status', 'Status']),
  mainAIUseCase: getColIndex(['mainaiusecase', 'mainAIUseCase', 'Main AI Use Case']),
  toolsOfChoice: getColIndex(['toolsofchoice', 'toolsOfChoice', 'Tools of Choice']),
  painPoints: getColIndex(['painpoints', 'painPoints', 'Pain Points']),
  featureFeedback: getColIndex(['featurefeedback', 'featureFeedback', 'Feature Feedback']),
  futureWishlist: getColIndex(['futurewishlist', 'futureWishlist', 'Future Wishlist']),
  pmComments: getColIndex(['pmcomments', 'pmComments', 'PM Comments']),
};

console.log('\nColumn mapping:');
Object.entries(colMap).forEach(([field, idx]) => {
  const status = idx === -1 ? '❌ NOT FOUND' : `✅ Column ${idx}`;
  console.log(`  ${field}: ${status}`);
});

// Test with sample row
const sampleRow = [
  'Verizon',
  '',
  'Ravi Sharma',
  'Project Navigator',
  'Telco',
  'NA',
  'SSA',
  'Customer Managed (GCP)',
  'Model recommendation\nModel deployment',
  '[]',
  '',
  '[]',
  '',
  '',
  'Discovery'
];

console.log('\nMapped data:');
const mapped = {
  id: (colMap.id !== -1 ? sampleRow[colMap.id] : null) || `int-1`,
  customerCompany: (colMap.customerCompany !== -1 ? sampleRow[colMap.customerCompany] : null) || '',
  component: (colMap.component !== -1 ? sampleRow[colMap.component] : null) || '',
  status: (colMap.status !== -1 ? sampleRow[colMap.status] : null) || '',
};

console.log(JSON.stringify(mapped, null, 2));
