import { parseReleaseName, extractCycle } from '../composables/useReleaseFamily.js'
import { parseDate, daysFromNow, getProduct } from '../composables/useScheduleHelpers.js'

var MILESTONE_KEYS = [
  { key: 'planningFreeze', label: 'Planning Freeze' },
  { key: 'featureFreeze', label: 'Feature Freeze' },
  { key: 'codeFreeze', label: 'Code Freeze' },
  { key: 'ga', label: 'Generally Available' }
]

export function groupKey(release) {
  var names = [release.displayName, release.id]
  for (var i = 0; i < names.length; i++) {
    if (!names[i]) continue
    var parsed = parseReleaseName(names[i])
    if (parsed) return parsed.product + '-' + parsed.major + '.' + parsed.minor + '-' + parsed.milestone
  }
  var cycle = extractCycle(release.id) || extractCycle(release.displayName)
  if (cycle) {
    var eaMatch = (release.id || '').match(/ea(\d+)/i)
    var milestone = eaMatch ? 'EA' + eaMatch[1] : 'GA'
    var product = getProduct(release)
    return (product ? product + '-' : '') + cycle + '-' + milestone
  }
  return release.displayName || release.id || 'other'
}

export function cycleFromGroupLabel(label) {
  var m = /^(\d+\.\d+)\s/.exec(label)
  return m ? m[1] : label
}

function groupLabelFromKey(key) {
  var m = /^(?:[a-z]+-)?(\d+\.\d+)-(EA\d+|GA)$/i.exec(key)
  if (m) return m[1] + ' ' + m[2]
  return key
}

function earlierDate(a, b) {
  if (!a) return b
  if (!b) return a
  var da = parseDate(a)
  var db = parseDate(b)
  if (!da) return b
  if (!db) return a
  return da.getTime() <= db.getTime() ? a : b
}

export function buildTimelineNodes(releases) {
  var map = {}
  for (var i = 0; i < releases.length; i++) {
    var r = releases[i]
    var key = groupKey(r)
    if (!map[key]) {
      map[key] = {
        label: groupLabelFromKey(key),
        milestones: { planningFreeze: null, featureFreeze: null, codeFreeze: null, ga: null },
        products: {}
      }
    }
    var g = map[key]
    var ms = r.milestones || {}
    g.milestones.planningFreeze = earlierDate(g.milestones.planningFreeze, ms.planningFreeze)
    g.milestones.featureFreeze = earlierDate(g.milestones.featureFreeze, ms.featureFreeze)
    g.milestones.codeFreeze = earlierDate(g.milestones.codeFreeze, ms.codeFreeze)
    g.milestones.ga = earlierDate(g.milestones.ga, ms.ga)
    var product = getProduct(r)
    if (product) g.products[product] = true
    if (!g.sourceReleases) g.sourceReleases = []
    g.sourceReleases.push(r)
  }

  var list = []
  var keys = Object.keys(map)
  for (var j = 0; j < keys.length; j++) {
    var grp = map[keys[j]]
    var productList = Object.keys(grp.products).sort()
    for (var k = 0; k < MILESTONE_KEYS.length; k++) {
      var msKey = MILESTONE_KEYS[k]
      var date = grp.milestones[msKey.key]
      if (!date) continue
      var days = daysFromNow(date)
      list.push({
        key: keys[j] + '-' + msKey.key,
        groupLabel: grp.label,
        msLabel: msKey.label,
        date: date,
        isPast: days !== null && days < 0,
        isGa: msKey.key === 'ga',
        productList: productList,
        releases: grp.sourceReleases
      })
    }
  }

  var merged = {}
  for (var mi = 0; mi < list.length; mi++) {
    var node = list[mi]
    var mergeKey = node.groupLabel + '|' + node.productList.join(',') + '|' + node.date
    if (!merged[mergeKey]) {
      merged[mergeKey] = node
    } else {
      var existing = merged[mergeKey]
      if (node.isGa && !existing.isGa) {
        node.productList = existing.productList.concat(node.productList)
          .filter(function (v, index, values) { return values.indexOf(v) === index }).sort()
        node.releases = (existing.releases || []).concat(node.releases || [])
        merged[mergeKey] = node
      } else {
        existing.productList = existing.productList.concat(node.productList)
          .filter(function (v, index, values) { return values.indexOf(v) === index }).sort()
        existing.releases = (existing.releases || []).concat(node.releases || [])
      }
    }
  }
  list = Object.keys(merged).map(function (key) { return merged[key] })

  list.sort(function (a, b) {
    var da = parseDate(a.date)
    var db = parseDate(b.date)
    if (!da && !db) return 0
    if (!da) return 1
    if (!db) return -1
    return da.getTime() - db.getTime()
  })

  return list
}
