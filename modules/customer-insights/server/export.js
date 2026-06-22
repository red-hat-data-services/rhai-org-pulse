/**
 * Export hook for customer-insights module
 * Generates anonymized test data for CI/fixtures
 */

module.exports = async function exportCustomerInsights() {
  return {
    'customer-insights/interactions.json': [],
    'customer-insights/rfes.json': [],
    'customer-insights/roadmap.json': { initiatives: [] },
    'customer-insights/insights.json': { insights: [] }
  }
}
