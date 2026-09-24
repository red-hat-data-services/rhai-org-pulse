export function hoverDaysLabel(days) {
  if (days === null) return null
  if (days === 0) return 'today'
  return days > 0 ? 'in ' + days + 'd' : Math.abs(days) + 'd ago'
}

export function clampBadgePosition(x, y, width, height, area) {
  var left = x
  var top = y
  if (left < area.left) left = area.left
  if (left + width > area.right) left = area.right - width
  if (top < area.top) top = area.top
  return { x: left, y: top }
}

export function buildDimensionRowMap(dimGroups, stableCycleRowMap, rowKeyForGroup) {
  var entries = Object.keys(dimGroups).map(function (key) {
    var group = dimGroups[key]
    var cycleRowKey = rowKeyForGroup(group.groupLabel, group.above)
    return {
      key: key,
      above: group.above,
      cycleRow: stableCycleRowMap[cycleRowKey] || 0
    }
  })
  var rowMap = {}
  ;[true, false].forEach(function (above) {
    var sideEntries = entries.filter(function (entry) { return entry.above === above })
    sideEntries.sort(function (a, b) {
      return a.cycleRow - b.cycleRow || a.key.localeCompare(b.key)
    })
    for (var i = 0; i < sideEntries.length; i++) {
      rowMap[sideEntries[i].key] = i
    }
  })
  return rowMap
}
