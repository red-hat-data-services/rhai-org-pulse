import { parseDate } from '../composables/useScheduleHelpers.js'

export function computeFullRange(nodes, todayTs, dayMs) {
  if (!nodes.length) return { min: 0, max: 1 }
  var first = parseDate(nodes[0].date)
  var last = parseDate(nodes[nodes.length - 1].date)
  if (!first || !last) return { min: 0, max: 1 }
  var minTs = Math.min(first.getTime(), todayTs)
  var maxTs = Math.max(last.getTime(), todayTs)
  var range = maxTs - minTs
  var pad = Math.max(range * 0.05, dayMs * 7)
  return { min: minTs - pad, max: maxTs + pad }
}

export function capRange(range, full, maxVisibleDays, dayMs) {
  var maxSpan = maxVisibleDays * dayMs
  var span = range.max - range.min
  if (span <= maxSpan) return range
  var center = (range.min + range.max) / 2
  var min = Math.max(center - maxSpan / 2, full.min)
  var max = min + maxSpan
  if (max > full.max) { max = full.max; min = max - maxSpan }
  if (min < full.min) min = full.min
  return { min: min, max: max }
}

export function computeDefaultRange(full, todayTs, hidePast, defaults, dayMs) {
  if (hidePast) {
    var padLeft = 1.5 * dayMs
    var windowSpan = defaults.windowDays * dayMs
    var min = todayTs - padLeft
    var max = min + windowSpan
    if (max > full.max) { max = full.max; min = max - windowSpan }
    if (min > todayTs - padLeft) min = todayTs - padLeft
    if (max <= min) return capRange(full, full, defaults.maxVisibleDays, dayMs)
    return { min: min, max: max }
  }
  var leftDays = Math.round(defaults.windowDays * 0.3) * dayMs
  var rightDays = defaults.windowDays * dayMs - leftDays
  var centeredMin = Math.max(todayTs - leftDays, full.min)
  var centeredMax = Math.min(todayTs + rightDays, full.max)
  if (centeredMax <= centeredMin) return capRange(full, full, defaults.maxVisibleDays, dayMs)
  return { min: centeredMin, max: centeredMax }
}

export function focusTimestamps(nodes, ids) {
  if (!ids || !ids.length) return []
  var idSet = {}
  for (var i = 0; i < ids.length; i++) idSet[ids[i]] = true
  var out = []
  for (var j = 0; j < nodes.length; j++) {
    var rels = nodes[j].releases || []
    var match = false
    for (var k = 0; k < rels.length; k++) {
      if (rels[k] && idSet[rels[k].id]) { match = true; break }
    }
    if (!match) continue
    var d = parseDate(nodes[j].date)
    if (d) out.push(d.getTime())
  }
  return out
}

export function focusVisibleCount(nodes, range) {
  var count = 0
  for (var i = 0; i < nodes.length; i++) {
    var d = parseDate(nodes[i].date)
    if (d) {
      var ts = d.getTime()
      if (ts >= range.min && ts <= range.max) count++
    }
  }
  return count
}

export function computeFocusRange(timestamps, todayTs, full, pads, dayMs) {
  if (!timestamps.length) return null
  var sorted = timestamps.slice().sort(function (a, b) { return a - b })
  var lo = Math.min(sorted[0], todayTs)
  var hi = Math.max(sorted[sorted.length - 1], todayTs)
  var min = lo - pads.left * dayMs
  var max = hi + pads.right * dayMs
  if (max > full.max) max = full.max
  if (min < full.min) min = full.min
  if (max <= min) return null
  return { min: min, max: max }
}
