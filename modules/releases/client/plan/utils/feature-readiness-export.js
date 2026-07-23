import { escapeCsv, triggerDownload } from './health-export.js'

var FPDOR_ITEM_NAMES = [
  'Requirements Clarity',
  'Acceptance Criteria',
  'Scope Defined',
  'RICE Score',
  'Cross-functional Engineering',
  'Documentation',
  'UXD',
  'Architectural Alignment',
  'Risks & Assumptions',
  'Release Type',
  'Target Version',
  'Assignee',
  'PM Assigned'
]

var KNOWN_PRODUCTS = ['RHOAI', 'RHAIIS', 'RHELAI']

function featureMatchesProduct(feature, products) {
  if (!products || products.length === 0) return true
  var versions = (feature.targetVersions || []).slice()
  if (feature.fixVersion) versions.push(feature.fixVersion)
  var haystack = versions.join(' ').toUpperCase()
  for (var i = 0; i < products.length; i++) {
    if (haystack.indexOf(String(products[i]).toUpperCase()) !== -1) return true
  }
  return false
}

function featureFailsSelectedFpdorItems(feature, itemNames) {
  if (!itemNames || itemNames.length === 0) return true
  var items = feature.fpdor && feature.fpdor.items ? feature.fpdor.items : []
  for (var i = 0; i < items.length; i++) {
    if (items[i].pass === false && itemNames.indexOf(items[i].name) !== -1) return true
  }
  return false
}

function failedFpdorNames(feature) {
  var items = feature.fpdor && feature.fpdor.items ? feature.fpdor.items : []
  var failed = []
  for (var i = 0; i < items.length; i++) {
    if (items[i].pass === false) failed.push(items[i].name)
  }
  return failed
}

function exportFeatureReadinessCsv(features) {
  var columns = [
    { label: 'Rank', getter: function(f) { return f.rank != null ? f.rank : '' } },
    { label: 'Key', getter: function(f) { return f.key || '' } },
    { label: 'Title', getter: function(f) { return f.title || '' } },
    { label: 'Score', getter: function(f) { return f.effectivePriorityScore != null ? f.effectivePriorityScore : '' } },
    {
      label: 'FPDoR',
      getter: function(f) {
        if (!f.fpdor) return ''
        return f.fpdor.passedCount + '/' + f.fpdor.totalCount
      }
    },
    { label: 'Failed FPDoR Items', getter: function(f) { return failedFpdorNames(f).join('; ') } },
    { label: 'Outcome', getter: function(f) { return f.bigRock || '' } },
    {
      label: 'Target Versions',
      getter: function(f) { return (f.targetVersions || []).join('; ') }
    },
    { label: 'Fix Version', getter: function(f) { return f.fixVersion || '' } },
    {
      label: 'Components',
      getter: function(f) {
        return Array.isArray(f.components) ? f.components.join('; ') : (f.components || '')
      }
    },
    { label: 'Team', getter: function(f) { return f.team || '' } },
    { label: 'Status', getter: function(f) { return f.status || '' } },
    { label: 'Priority', getter: function(f) { return f.priority || '' } },
    { label: 'Confidence', getter: function(f) { return f.confidence || '' } }
  ]

  var header = columns.map(function(c) { return escapeCsv(c.label) }).join(',')
  var rows = features.map(function(f) {
    return columns.map(function(c) { return escapeCsv(c.getter(f)) }).join(',')
  })
  var csv = header + '\n' + rows.join('\n')
  var blob = new Blob([csv + '\n'], { type: 'text/csv' })
  var today = new Date().toISOString().split('T')[0]
  triggerDownload(blob, 'feature-readiness-' + today + '.csv')
}

function featureMatchesSharedFilters(feature, filterState, selectedVersion, options) {
  var opts = options || {}
  var applyReadiness = opts.applyReadiness !== false
  var f = filterState

  if (f.outcome && f.outcome.length) {
    var featureRocks = feature.bigRock ? feature.bigRock.split(', ') : []
    if (!featureRocks.some(function(r) { return f.outcome.indexOf(r) !== -1 })) return false
  }
  if (f.targetVersion && f.targetVersion.length && !(feature.targetVersions || []).some(function(tv) {
    return f.targetVersion.indexOf(tv) !== -1
  })) return false
  if (f.fixVersion && f.fixVersion.length && f.fixVersion.indexOf(feature.fixVersion) === -1) return false
  if (f.component && f.component.length && !(feature.components || []).some(function(c) {
    return f.component.indexOf(c) !== -1
  })) return false
  if (f.priority && f.priority.length && f.priority.indexOf(feature.priority) === -1) return false
  if (f.team && f.team.length && f.team.indexOf(feature.team) === -1) return false
  if (f.product && f.product.length && !featureMatchesProduct(feature, f.product)) return false
  if (f.fpdorItems && f.fpdorItems.length && !featureFailsSelectedFpdorItems(feature, f.fpdorItems)) return false
  if (applyReadiness) {
    if (f.readiness === 'ready' && feature.confidence === 'not-ready') return false
    if (f.readiness === 'not-ready' && feature.confidence !== 'not-ready') return false
  }
  if (selectedVersion) {
    if (!(feature.targetVersions || []).some(function(tv) {
      return tv === selectedVersion || tv.indexOf(selectedVersion) !== -1 || selectedVersion.indexOf(tv) !== -1
    })) return false
  }
  return true
}

export {
  FPDOR_ITEM_NAMES,
  KNOWN_PRODUCTS,
  featureMatchesProduct,
  featureFailsSelectedFpdorItems,
  failedFpdorNames,
  featureMatchesSharedFilters,
  exportFeatureReadinessCsv
}
