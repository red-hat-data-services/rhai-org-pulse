module.exports = async function okrHubExport(addFile, storage) {
  var cveSla = storage.readFromStorage('okr-hub/cve-sla-data.json')
  if (cveSla) {
    addFile('okr-hub/cve-sla-data.json', {
      year: cveSla.year || 2026,
      products: (cveSla.products || []).map(function() { return 'Product' }),
      months: {}
    })
  }
}
