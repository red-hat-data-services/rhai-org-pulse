/**
 * Export hook for customer-insights module
 * Generates anonymized test data for CI/fixtures
 */

module.exports = async function exportCustomerInsights(addFile, _storage, _mapping) {
  addFile('customer-insights/interactions.json', [])
  addFile('customer-insights/rfes.json', [])
  addFile('customer-insights/roadmap.json', { initiatives: [] })
  addFile('customer-insights/insights.json', { insights: [] })
}
