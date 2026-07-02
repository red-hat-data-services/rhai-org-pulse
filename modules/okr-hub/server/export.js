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

  var trackingConfig = storage.readFromStorage('okr-hub/90day-tracking-config.json')
  if (trackingConfig) {
    addFile('okr-hub/90day-tracking-config.json', {
      releases: (trackingConfig.releases || []).map(function(r) {
        return {
          version: r.version,
          products: (r.products || []).map(function(p) {
            return { name: 'version-name', gaDate: p.gaDate }
          })
        }
      })
    })
  }

  var featureConfig = storage.readFromStorage('okr-hub/feature-delivery-config.json')
  if (featureConfig) {
    addFile('okr-hub/feature-delivery-config.json', {
      releases: (featureConfig.releases || []).map(function(r) {
        return {
          name: 'Release',
          products: (r.products || []).map(function() {
            return { version: 'version-name', freezeDate: '2026-01-01', releaseDate: '2026-06-01' }
          })
        }
      })
    })
  }
}
