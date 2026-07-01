module.exports = async function okrHubExport(addFile, storage) {
  var cveSla = storage.readFromStorage('okr-hub/cve-sla-data.json')
  if (cveSla) {
    addFile('okr-hub/cve-sla-data.json', {
      year: cveSla.year || 2026,
      products: (cveSla.products || []).map(function() { return 'Product' }),
      months: {}
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
