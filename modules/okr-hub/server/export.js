module.exports = async function okrHubExport(addFile, storage) {
  var cveSla = storage.readFromStorage('okr-hub/cve-sla-data.json')
  if (cveSla) {
    addFile('okr-hub/cve-sla-data.json', {
      year: cveSla.year || 2026,
      products: (cveSla.products || []).map(function() { return 'Product' }),
      months: {}
    })
  }

  var supportCases = storage.readFromStorage('okr-hub/support-case-data.json')
  if (supportCases) {
    addFile('okr-hub/support-case-data.json', {
      year: supportCases.year || 2026,
      products: (supportCases.products || []).map(function() { return 'Product' }),
      quarters: {}
    })
  }

  var overrides = storage.readFromStorage('okr-hub/on-time-overrides.json')
  if (overrides) {
    addFile('okr-hub/on-time-overrides.json', {
      releases: (overrides.releases || []).map(function(r) {
        return { id: r.id, displayName: 'Release', plannedGa: r.plannedGa, actualGa: r.actualGa, custom: r.custom || false, removed: r.removed || false }
      })
    })
  }
}
