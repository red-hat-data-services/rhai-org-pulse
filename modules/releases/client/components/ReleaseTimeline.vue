<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { Scatter } from 'vue-chartjs'
import { Chart as ChartJS, LinearScale, PointElement, Tooltip } from 'chart.js'
import { parseReleaseName, extractCycle, productLabel } from '../composables/useReleaseFamily.js'
import { parseDate, daysFromNow, formatShort, getProduct } from '../composables/useScheduleHelpers.js'
import { PRODUCT_HEX, DEFAULT_HEX } from '../composables/useProductColors.js'

ChartJS.register(LinearScale, PointElement, Tooltip)

var FONT = 'Inter var, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif'

const props = defineProps({
  releases: { type: Array, required: true },
  hidePast: { type: Boolean, default: false }
})

var MILESTONE_KEYS = [
  { key: 'planningFreeze', label: 'Planning Freeze' },
  { key: 'featureFreeze', label: 'Feature Freeze' },
  { key: 'codeFreeze', label: 'Code Freeze' },
  { key: 'ga', label: 'Generally Available' }
]

function groupKey(release) {
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

function cycleFromGroupLabel(label) {
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

var allNodes = computed(function () {
  var map = {}
  for (var i = 0; i < props.releases.length; i++) {
    var r = props.releases[i]
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

  // Merge nodes from the same release that share a date.
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
          .filter(function (v, i, a) { return a.indexOf(v) === i }).sort()
        node.releases = (existing.releases || []).concat(node.releases || [])
        merged[mergeKey] = node
      } else {
        existing.productList = existing.productList.concat(node.productList)
          .filter(function (v, i, a) { return a.indexOf(v) === i }).sort()
        existing.releases = (existing.releases || []).concat(node.releases || [])
      }
    }
  }
  list = Object.keys(merged).map(function (k) { return merged[k] })

  list.sort(function (a, b) {
    var da = parseDate(a.date)
    var db = parseDate(b.date)
    if (!da && !db) return 0
    if (!da) return 1
    if (!db) return -1
    return da.getTime() - db.getTime()
  })

  return list
})

var nodes = computed(function () {
  if (props.hidePast) {
    return allNodes.value.filter(function (n) { return !n.isPast })
  }
  return allNodes.value
})

var cycleLanes = computed(function () {
  var seen = {}
  var order = []
  var n = allNodes.value
  for (var i = 0; i < n.length; i++) {
    var cycle = cycleFromGroupLabel(n[i].groupLabel)
    if (!seen[cycle]) {
      seen[cycle] = true
      order.push(cycle)
    }
  }
  order.sort(function (a, b) { return parseFloat(a) - parseFloat(b) })
  var lanes = {}
  for (var j = 0; j < order.length; j++) {
    lanes[order[j]] = j
  }
  return lanes
})

// eslint-disable-next-line no-unused-vars
var laneCount = computed(function () {
  return Object.keys(cycleLanes.value).length
})

// Layout constants (shared between chartHeight and plugin)
var laneBaseStem = 64
var subLaneOffset = 80
var infraSpace = 60
var lineHeight = 16
var boxPad = 4
var MILESTONE_DOT_RADIUS = 4
var MILESTONE_DOT_BORDER = 2
var TODAY_DOT_RADIUS = 8
var TODAY_DOT_BORDER = 2
var DOT_HALO_PAD = 1.5
var PEEK_W = 10
var CHART_MAX_HEIGHT = 450

function hexToRgba(hex, alpha) {
  if (!hex || hex.charAt(0) !== '#' || hex.length < 7) return hex
  var r = parseInt(hex.slice(1, 3), 16)
  var g = parseInt(hex.slice(3, 5), 16)
  var b = parseInt(hex.slice(5, 7), 16)
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')'
}

var cycleSides = computed(function () {
  var n = allNodes.value
  var glMeta = {}
  for (var i = 0; i < n.length; i++) {
    var gl = n[i].groupLabel
    if (!glMeta[gl]) glMeta[gl] = { ga: Infinity, earliest: Infinity, versioned: false }
    var ver = cycleFromGroupLabel(gl)
    if (/^\d+\.\d+$/.test(ver)) glMeta[gl].versioned = true
    var d = parseDate(n[i].date)
    if (!d) continue
    var ts = d.getTime()
    if (ts < glMeta[gl].earliest) glMeta[gl].earliest = ts
    if (n[i].isGa && ts < glMeta[gl].ga) glMeta[gl].ga = ts
  }
  function sortVal(gl) {
    var m = glMeta[gl]
    return m.ga < Infinity ? m.ga : m.earliest
  }
  var versioned = Object.keys(glMeta).filter(function (gl) { return glMeta[gl].versioned })
  versioned.sort(function (a, b) { return sortVal(a) - sortVal(b) })
  var sides = {}
  for (var vi = 0; vi < versioned.length; vi++) {
    sides[versioned[vi]] = vi % 2 === 0
  }
  var nonVersioned = Object.keys(glMeta).filter(function (gl) { return !glMeta[gl].versioned })
  for (var nvi = 0; nvi < nonVersioned.length; nvi++) {
    sides[nonVersioned[nvi]] = false
  }
  return sides
})

var visibleProducts = computed(function () {
  var seen = {}
  var n = allNodes.value
  for (var i = 0; i < n.length; i++) {
    for (var j = 0; j < n[i].productList.length; j++) {
      seen[n[i].productList[j]] = true
    }
  }
  return Object.keys(seen).sort()
})

function productHex(p) { return PRODUCT_HEX[p] || DEFAULT_HEX }

function cycleIsAbove(groupLabel) {
  if (cycleSides.value[groupLabel] !== undefined) return cycleSides.value[groupLabel] !== false
  return true
}


var stableCycleRowMap = computed(function () {
  var n = allNodes.value
  var cycleMeta = {}
  for (var i = 0; i < n.length; i++) {
    var above = cycleIsAbove(n[i].groupLabel)
    var suffix = above ? '-a' : '-b'
    var rowKey = n[i].groupLabel + suffix
    var d = parseDate(n[i].date)
    if (!d) continue
    var ts = d.getTime()
    if (!cycleMeta[rowKey]) {
      cycleMeta[rowKey] = { earliestGa: Infinity, earliest: Infinity }
    }
    if (n[i].isGa && ts < cycleMeta[rowKey].earliestGa) {
      cycleMeta[rowKey].earliestGa = ts
    }
    if (ts < cycleMeta[rowKey].earliest) {
      cycleMeta[rowKey].earliest = ts
    }
  }
  function sortKey(k) {
    var m = cycleMeta[k]
    return m.earliestGa < Infinity ? m.earliestGa : m.earliest
  }
  var aboveKeys = []
  var versionedBelow = []
  var nonVersionedBelow = []
  var keys = Object.keys(cycleMeta)
  for (var ki = 0; ki < keys.length; ki++) {
    if (keys[ki].endsWith('-a')) {
      aboveKeys.push(keys[ki])
    } else {
      var gl = keys[ki].slice(0, -2)
      var ver = cycleFromGroupLabel(gl)
      if (/^\d+\.\d+$/.test(ver)) versionedBelow.push(keys[ki])
      else nonVersionedBelow.push(keys[ki])
    }
  }
  aboveKeys.sort(function (a, b) { return sortKey(a) - sortKey(b) })
  versionedBelow.sort(function (a, b) { return sortKey(a) - sortKey(b) })
  nonVersionedBelow.sort(function (a, b) { return sortKey(a) - sortKey(b) })
  var belowKeys = versionedBelow.concat(nonVersionedBelow)
  var map = {}
  for (var ai = 0; ai < aboveKeys.length; ai++) map[aboveKeys[ai]] = ai
  for (var bi = 0; bi < belowKeys.length; bi++) map[belowKeys[bi]] = bi
  return map
})

var layoutMetrics = computed(function () {
  var n = allNodes.value
  var defaultAbove = laneBaseStem + 70
  var defaultBelow = infraSpace
  if (n.length === 0) return { aboveSpace: defaultAbove, belowSpace: defaultBelow }
  var first = parseDate(n[0].date)
  var last = parseDate(n[n.length - 1].date)
  if (!first || !last) return { aboveSpace: defaultAbove, belowSpace: defaultBelow }
  var range = last.getTime() - first.getTime()
  var pad = Math.max(range * 0.05, 86400000 * 7)
  var rangeMin = first.getTime() - pad
  var rangeMax = last.getTime() + pad
  var rangeSpan = rangeMax - rangeMin
  if (rangeSpan <= 0) return { aboveSpace: defaultAbove, belowSpace: defaultBelow }

  var rowMap = stableCycleRowMap.value
  var aboveRows = 0
  var belowRows = 0
  var rmKeys = Object.keys(rowMap)
  for (var rmi = 0; rmi < rmKeys.length; rmi++) {
    if (rmKeys[rmi].endsWith('-a')) aboveRows++
    else belowRows++
  }
  aboveRows = Math.max(aboveRows, 1)
  var estMaxBoxH = 3 * lineHeight + boxPad * 2
  var safeOff = Math.max(subLaneOffset, estMaxBoxH + 4 + 6)
  var aboveSpace = laneBaseStem + (aboveRows - 1) * safeOff + 70
  var belowSpace = belowRows > 0
    ? (laneBaseStem + (belowRows - 1) * safeOff + 70)
    : 0
  var totalRequired = aboveSpace + (belowSpace > infraSpace ? belowSpace : infraSpace) + 40
  if (totalRequired > CHART_MAX_HEIGHT) {
    var extraRows = Math.max(0, aboveRows - 1) + Math.max(0, belowRows > 0 ? belowRows - 1 : 0)
    if (extraRows > 0) {
      var fixedSpace = 40 + laneBaseStem + 70 + (belowRows > 0 ? laneBaseStem + 70 : infraSpace)
      safeOff = Math.max(20, (CHART_MAX_HEIGHT - fixedSpace) / extraRows)
    }
    aboveSpace = laneBaseStem + Math.max(0, aboveRows - 1) * safeOff + 70
    belowSpace = belowRows > 0
      ? laneBaseStem + Math.max(0, belowRows - 1) * safeOff + 70
      : 0
  }
  return { aboveSpace: aboveSpace, belowSpace: Math.max(belowSpace, infraSpace), safeOff: safeOff }
})

var chartHeight = computed(function () {
  var m = layoutMetrics.value
  return Math.min(m.aboveSpace + m.belowSpace + 40, CHART_MAX_HEIGHT)
})

function fmtDate(dateStr) {
  return formatShort(dateStr, { year: true })
}



// Pure stacking logic — extracted for testability.
// Takes an array of layout objects [{x, boxW, nd: {date, groupLabel}, above}]
// and todayTs. Mutates layouts in-place: sets stackLevel, stackTopIdx.
function applyStacking(nodeLayouts, todayTs, peekThreshold) {
  if (peekThreshold === undefined) peekThreshold = PEEK_W
  var cycleStacks = {}
  for (var i = 0; i < nodeLayouts.length; i++) {
    if (!nodeLayouts[i]) continue
    var ckey = nodeLayouts[i].subLane + (nodeLayouts[i].above ? '-a' : '-b')
    if (!cycleStacks[ckey]) cycleStacks[ckey] = []
    cycleStacks[ckey].push(i)
  }
  var stackKeys = Object.keys(cycleStacks)
  for (var ski = 0; ski < stackKeys.length; ski++) {
    var sideGroup = cycleStacks[stackKeys[ski]]
    if (sideGroup.length <= 1) continue
    sideGroup.sort(function (a, b) {
      var dA = parseDate(nodeLayouts[a].nd.date)
      var dB = parseDate(nodeLayouts[b].nd.date)
      var distA = dA ? Math.abs(dA.getTime() - todayTs) : Infinity
      var distB = dB ? Math.abs(dB.getTime() - todayTs) : Infinity
      return distA - distB
    })
    var topCards = []
    for (var sgi = 0; sgi < sideGroup.length; sgi++) {
      var idx = sideGroup[sgi]
      var lay = nodeLayouts[idx]
      var myLeft = lay.x - lay.boxW / 2
      var myRight = lay.x + lay.boxW / 2
      var bestTop = -1
      var bestDist = Infinity
      for (var tci = 0; tci < topCards.length; tci++) {
        var tc = topCards[tci]
        var frontX = nodeLayouts[tc.idx].x
        var dotDist = Math.abs(lay.x - frontX)
        var shouldStack = false
        if (myLeft < tc.right && myRight > tc.left) {
          var visible
          if (lay.x > frontX) {
            visible = myRight - tc.right
          } else {
            visible = tc.left - myLeft
          }
          if (visible <= peekThreshold) {
            shouldStack = true
          }
        }
        if (shouldStack && dotDist < bestDist) {
          bestDist = dotDist; bestTop = tci
        }
      }
      if (bestTop >= 0) {
        var front = topCards[bestTop]
        front.stackCount++
        lay.stackLevel = front.stackCount
        lay.stackTopIdx = front.idx
      } else {
        topCards.push({ idx: idx, left: myLeft, right: myRight, stackCount: 0 })
      }
    }
  }
}

// eslint-disable-next-line no-unused-vars
function countPeekStrips(nodeLayouts) {
  var count = 0
  for (var i = 0; i < nodeLayouts.length; i++) {
    var lay = nodeLayouts[i]
    if (!lay || (lay.stackLevel || 0) === 0) continue
    var topLayout = nodeLayouts[lay.stackTopIdx]
    if (!topLayout) continue
    count++
  }
  return count
}


var MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

var nextMilestoneLabel = computed(function () {
  var n = nodes.value
  for (var i = 0; i < n.length; i++) {
    var days = daysFromNow(n[i].date)
    if (days !== null && days >= 0) {
      var knownProducts = n[i].productList.filter(function (p) { return productLabel(p) !== p })
      var productPrefix = knownProducts.length
        ? knownProducts.map(productLabel).join('/') + ' ' : ''
      var desc = productPrefix + n[i].groupLabel + ' ' + n[i].msLabel
      if (days === 0) return { desc: desc, daysText: 'today' }
      return { desc: desc, daysText: 'in ' + days + 'd' }
    }
  }
  return null
})

var showDimLines = ref(true)
var isOverCard = ref(false)
var isDark = ref(false)
var _observer
onMounted(function () {
  isDark.value = document.documentElement.classList.contains('dark')
  _observer = new MutationObserver(function () {
    isDark.value = document.documentElement.classList.contains('dark')
  })
  _observer.observe(document.documentElement, {
    attributes: true, attributeFilter: ['class']
  })
})
onUnmounted(function () { if (_observer) _observer.disconnect() })

// Zoom & pan state
var zoomMin = ref(null)
var zoomMax = ref(null)

// Today pulse overlay position (set by afterDraw)
var _todayPx = ref(null)

var fullRange = computed(function () {
  var n = nodes.value
  if (n.length === 0) return { min: 0, max: 1 }
  var first = parseDate(n[0].date)
  var last = parseDate(n[n.length - 1].date)
  if (!first || !last) return { min: 0, max: 1 }
  var range = last.getTime() - first.getTime()
  var pad = Math.max(range * 0.05, 86400000 * 7)
  return { min: first.getTime() - pad, max: last.getTime() + pad }
})

var DAY_MS = 86400000
var DEFAULT_WINDOW_DAYS = 29
var MAX_VISIBLE_DAYS = 90

function capRange(range, full) {
  var maxSpan = MAX_VISIBLE_DAYS * DAY_MS
  var span = range.max - range.min
  if (span <= maxSpan) return range
  var center = (range.min + range.max) / 2
  var min = Math.max(center - maxSpan / 2, full.min)
  var max = min + maxSpan
  if (max > full.max) { max = full.max; min = max - maxSpan }
  if (min < full.min) min = full.min
  return { min: min, max: max }
}

var defaultRange = computed(function () {
  var today = new Date()
  today.setHours(0, 0, 0, 0)
  var todayTs = today.getTime()
  var full = fullRange.value
  var _halfWindow = DEFAULT_WINDOW_DAYS / 2 * DAY_MS

  if (props.hidePast) {
    var padLeft = 1.5 * DAY_MS
    var windowSpan = DEFAULT_WINDOW_DAYS * DAY_MS
    var min = todayTs - padLeft
    var max = min + windowSpan
    if (min < full.min) { min = full.min; max = min + windowSpan }
    if (max > full.max) { max = full.max; min = max - windowSpan }
    if (min < full.min) min = full.min
    if (max <= min) return capRange(full, full)
    return { min: min, max: max }
  }

  // Position today ~1/3 from left (more space for upcoming milestones on the right)
  var leftDays = Math.round(DEFAULT_WINDOW_DAYS * 0.3) * DAY_MS
  var rightDays = DEFAULT_WINDOW_DAYS * DAY_MS - leftDays
  var centeredMin = Math.max(todayTs - leftDays, full.min)
  var centeredMax = Math.min(todayTs + rightDays, full.max)
  if (centeredMax <= centeredMin) return capRange(full, full)
  return { min: centeredMin, max: centeredMax }
})

var xRange = computed(function () {
  if (zoomMin.value !== null && zoomMax.value !== null) {
    return { min: zoomMin.value, max: zoomMax.value }
  }
  return defaultRange.value
})

var visibleDays = computed(function () {
  var r = xRange.value
  return Math.round((r.max - r.min) / DAY_MS)
})

var _visibleNodeCount = computed(function () {
  var r = xRange.value
  var count = 0
  var n = nodes.value
  for (var i = 0; i < n.length; i++) {
    var d = parseDate(n[i].date)
    if (d) {
      var ts = d.getTime()
      if (ts >= r.min && ts <= r.max) count++
    }
  }
  return count
})

var isZoomed = computed(function () {
  return zoomMin.value !== null && zoomMax.value !== null
})

function resetZoom() {
  zoomMin.value = null
  zoomMax.value = null
}

watch(function () { return props.hidePast }, resetZoom)

var _chartInstance = null

function onWheel(event) {
  if (!_chartInstance) return
  var chart = _chartInstance
  var area = chart.chartArea
  if (!area) return

  var rect = chart.canvas.getBoundingClientRect()
  var mouseX = event.clientX - rect.left
  if (mouseX < area.left || mouseX > area.right) return

  event.preventDefault()
  var xScale = chart.scales.x
  var pivot = xScale.getValueForPixel(mouseX)
  var curMin = xRange.value.min
  var curMax = xRange.value.max
  var range = curMax - curMin

  var zoomFactor = event.deltaY > 0 ? 1.15 : 0.87
  var newRange = range * zoomFactor
  var full = fullRange.value
  var maxRange = Math.min(full.max - full.min, MAX_VISIBLE_DAYS * DAY_MS)

  if (newRange >= maxRange) {
    var center = (curMin + curMax) / 2
    zoomMin.value = Math.max(center - maxRange / 2, full.min)
    zoomMax.value = Math.min(center + maxRange / 2, full.max)
    return
  }

  var minRange = maxRange * 0.01
  if (newRange < minRange) newRange = minRange

  var ratio = (pivot - curMin) / range
  var newMin = pivot - newRange * ratio
  var newMax = pivot - newRange * ratio + newRange

  if (newMin < full.min) { newMin = full.min; newMax = newMin + newRange }
  if (newMax > full.max) { newMax = full.max; newMin = newMax - newRange }

  zoomMin.value = newMin
  zoomMax.value = newMax
}

// Drag-to-pan
var _dragStart = null

function onPointerDown(event) {
  if (event.button !== 0) return
  if (!_chartInstance) return
  var area = _chartInstance.chartArea
  if (!area) return
  var rect = _chartInstance.canvas.getBoundingClientRect()
  var mouseX = event.clientX - rect.left
  if (mouseX < area.left || mouseX > area.right) return

  _dragStart = { clientX: event.clientX, min: xRange.value.min, max: xRange.value.max }
  event.currentTarget.style.cursor = 'grabbing'
  event.currentTarget.setPointerCapture(event.pointerId)
}

function onPointerMove(event) {
  if (!_dragStart || !_chartInstance) return
  var area = _chartInstance.chartArea
  if (!area) return
  var dx = event.clientX - _dragStart.clientX
  var pxRange = area.right - area.left
  var dataRange = _dragStart.max - _dragStart.min
  var shift = -(dx / pxRange) * dataRange

  var full = fullRange.value
  var newMin = _dragStart.min + shift
  var newMax = _dragStart.max + shift

  if (newMin < full.min) { newMin = full.min; newMax = newMin + dataRange }
  if (newMax > full.max) { newMax = full.max; newMin = newMax - dataRange }

  zoomMin.value = newMin
  zoomMax.value = newMax
}

function onPointerUp(event) {
  if (_dragStart) {
    _dragStart = null
    event.currentTarget.style.cursor = ''
  }
}

function onCardHover(e) {
  if (_dragStart) return
  var canvas = e.currentTarget.querySelector('canvas')
  if (!canvas) { isOverCard.value = false; return }
  var canvasRect = canvas.getBoundingClientRect()
  var cx = e.clientX - canvasRect.left
  var cy = e.clientY - canvasRect.top
  for (var i = _cardHitBoxes.length - 1; i >= 0; i--) {
    var box = _cardHitBoxes[i]
    if (cx >= box.x && cx <= box.x + box.w && cy >= box.y && cy <= box.y + box.h) {
      isOverCard.value = true
      var prevHovered = _hoveredBox
      _hoveredBox = box
      if (prevHovered !== _hoveredBox) {
        if (!prevHovered) _frontNodes.clear()
        _frontNodes.add(box.nd)
        if (prevHovered && prevHovered.nd !== box.nd) {
          _frontNodes.delete(prevHovered.nd)
        }
        if (_chartInstance) _chartInstance.draw()
      }
      return
    }
  }
  isOverCard.value = false
  if (_hoveredBox) {
    _hoveredBox = null
    if (_chartInstance) _chartInstance.draw()
  }
}

var chartData = computed(function () {
  var milestonePoints = []
  var _radii = []
  var bgColors = []
  var n = nodes.value
  var dark = isDark.value
  for (var i = 0; i < n.length; i++) {
    var d = parseDate(n[i].date)
    if (!d) continue
    milestonePoints.push({ x: d.getTime(), y: 0 })
    bgColors.push(
      n[i].isPast
        ? (dark ? '#34d399' : '#10b981')
        : (dark ? '#60a5fa' : '#3b82f6')
    )
  }

  var datasets = [{
    label: 'Milestones',
    data: milestonePoints,
    pointRadius: 0,
    pointBackgroundColor: bgColors,
    pointBorderWidth: 0,
    showLine: false
  }]

  return { datasets: datasets }
})

var chartOptions = computed(function () {
  var r = xRange.value
  var m = layoutMetrics.value
  return {
    responsive: true,
    maintainAspectRatio: false,
    clip: false,
    layout: {
      padding: { top: 20, bottom: 20, left: 70, right: 40 }
    },
    scales: {
      x: {
        type: 'linear',
        min: r.min,
        max: r.max,
        display: false
      },
      y: {
        type: 'linear',
        display: false,
        min: -(m.belowSpace / m.aboveSpace),
        max: 1
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false
      }
    },
    animation: false,
    _dimLines: showDimLines.value
  }
})

function drawRoundedRect(ctx, x, y, w, h, radius) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function _pluginSetup(chart) {
  var ctx = chart.ctx
  var area = chart.chartArea
  if (!area) return null
  var xScale = chart.scales.x
  var yMid = chart.scales.y.getPixelForValue(0)
  var dark = isDark.value
  return { ctx: ctx, area: area, xScale: xScale, yMid: yMid, dark: dark, r: xRange.value }
}

var _cardHitBoxes = []
var _hoveredBox = null
var _frontNodes = new Set()

var timelinePlugin = {
  id: 'releaseTimeline',
  beforeDatasetsDraw: function (chart) {
    if (!nodes.value.length) return
    var s = _pluginSetup(chart)
    if (!s) return
    var ctx = s.ctx
    var area = s.area
    var xScale = s.xScale
    var yMid = s.yMid
    var dark = s.dark
    var r = s.r

    ctx.save()

    // Horizontal axis line
    var axisColor = dark ? '#9ca3af' : '#6b7280'
    ctx.beginPath()
    ctx.strokeStyle = axisColor
    ctx.lineWidth = 1.5
    ctx.setLineDash([])
    ctx.moveTo(area.left - 60, yMid)
    ctx.lineTo(area.right - 12, yMid)
    ctx.stroke()

    // Arrowhead (filled triangle)
    ctx.beginPath()
    ctx.fillStyle = axisColor
    ctx.moveTo(area.right, yMid)
    ctx.lineTo(area.right - 10, yMid - 4)
    ctx.lineTo(area.right - 10, yMid + 4)
    ctx.closePath()
    ctx.fill()

    // Compute exclusion zones for markers: today + all node positions
    var todayForMarkers = new Date()
    todayForMarkers.setHours(0, 0, 0, 0)
    var todayTsMarkers = todayForMarkers.getTime()
    var todayPxMarkers = (todayTsMarkers >= r.min && todayTsMarkers <= r.max)
      ? xScale.getPixelForValue(todayTsMarkers) : null
    var todayClearance = 60
    var nodeClearance = 40
    var nodePxList = []
    var nList = nodes.value
    for (var ni = 0; ni < nList.length; ni++) {
      var ndt = parseDate(nList[ni].date)
      if (!ndt) continue
      var nts = ndt.getTime()
      if (nts >= r.min && nts <= r.max) nodePxList.push(xScale.getPixelForValue(nts))
    }

    // Adaptive markers: weeks when zoomed in, month names only when zoomed out
    var firstDate = new Date(r.min)
    var lastDate = new Date(r.max)
    var visibleDays = (r.max - r.min) / DAY_MS
    var showWeeks = visibleDays < 30
    var spansYears = firstDate.getFullYear() !== lastDate.getFullYear()

    var wMonth = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1)
    while (wMonth.getTime() < r.max) {
      var maxWk = showWeeks ? 4 : 0
      for (var wk = 0; wk <= maxWk; wk++) {
        var wDay = new Date(wMonth.getFullYear(), wMonth.getMonth(), 1 + wk * 7)
        if (wDay.getTime() < r.min || wDay.getTime() > r.max) continue
        var wpx = xScale.getPixelForValue(wDay.getTime())
        if (todayPxMarkers !== null && Math.abs(wpx - todayPxMarkers) < todayClearance) continue
        var tooCloseToNode = false
        for (var nci = 0; nci < nodePxList.length; nci++) {
          if (Math.abs(wpx - nodePxList[nci]) < nodeClearance) { tooCloseToNode = true; break }
        }
        if (tooCloseToNode) {
          if (wk > 0) continue
          var monthTooClose = false
          for (var mci = 0; mci < nodePxList.length; mci++) {
            if (Math.abs(wpx - nodePxList[mci]) < 15) { monthTooClose = true; break }
          }
          if (monthTooClose) continue
        }
        if (wpx > area.left - 60 && wpx < area.right - 15) {
          ctx.globalAlpha = 1.0
          var halfH = (area.bottom - area.top) / 4
          ctx.beginPath()
          ctx.strokeStyle = dark ? 'rgba(75,85,99,0.4)' : 'rgba(209,213,219,0.8)'
          ctx.lineWidth = 1
          ctx.setLineDash([2, 4])
          ctx.moveTo(wpx, yMid - halfH)
          ctx.lineTo(wpx, yMid + halfH)
          ctx.stroke()

          ctx.fillStyle = dark ? '#6b7280' : '#9ca3af'
          ctx.font = '11px ' + FONT
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.setLineDash([])
          var wMonthName = MONTH_NAMES[wMonth.getMonth()]
          if (spansYears && wMonth.getMonth() === 0 && wk === 0) wMonthName += ' ' + wMonth.getFullYear()
          ctx.fillText(wMonthName, wpx, yMid + 10)
          if (showWeeks) {
            ctx.fillText('Week ' + (wk + 1), wpx, yMid + 23)
          }
          ctx.globalAlpha = 1.0
        }
      }
      wMonth = new Date(wMonth.getFullYear(), wMonth.getMonth() + 1, 1)
    }

    ctx.restore()
  },
  afterDraw: function (chart) {
    _chartInstance = chart
    var n = nodes.value
    if (!n.length) return
    var s = _pluginSetup(chart)
    if (!s) return
    var ctx = s.ctx
    var area = s.area
    var xScale = s.xScale
    var yMid = s.yMid
    var dark = s.dark
    var r = s.r
    var futureColor = dark ? '#60a5fa' : '#3b82f6'
    var pastColor = dark ? '#34d399' : '#10b981'
    var mutedTextColor = dark ? '#6b7280' : '#9ca3af'
    var _haloPad = 3

    ctx.save()
    _cardHitBoxes = []

    // Redraw arrowhead zone to cover any Chart.js dots near the right edge
    var bgColor = dark ? '#1f2937' : '#ffffff'
    ctx.fillStyle = bgColor
    ctx.fillRect(area.right - 16, yMid - 14, 32, 28)
    var arrowAxisColor = dark ? '#9ca3af' : '#6b7280'
    ctx.beginPath()
    ctx.fillStyle = arrowAxisColor
    ctx.moveTo(area.right, yMid)
    ctx.lineTo(area.right - 10, yMid - 4)
    ctx.lineTo(area.right - 10, yMid + 4)
    ctx.closePath()
    ctx.fill()

    // First pass: compute box dimensions and assign rows by cycle
    var nodeLayouts = []
    var todayForStack = new Date()
    todayForStack.setHours(0, 0, 0, 0)
    var todayTsStack = todayForStack.getTime()

    for (var i = 0; i < n.length; i++) {
      var nd = n[i]
      var dt = parseDate(nd.date)
      if (!dt) { nodeLayouts.push(null); continue }
      var x = xScale.getPixelForValue(dt.getTime())
      if (x < area.left - 80 || x > area.right - 15) { nodeLayouts.push(null); continue }

      var lines = []
      ctx.font = 'bold 13px ' + FONT
      lines.push({ text: nd.groupLabel, font: 'bold 13px ' + FONT, color: null, w: ctx.measureText(nd.groupLabel).width })
      ctx.font = '13px ' + FONT
      lines.push({ text: nd.msLabel, font: '13px ' + FONT, color: null, w: ctx.measureText(nd.msLabel).width })
      ctx.font = '12px ' + FONT
      lines.push({ text: fmtDate(nd.date), font: '12px ' + FONT, color: null, w: ctx.measureText(fmtDate(nd.date)).width })

      var sideLabel = null
      var sideLabelW = 0

      var maxW = 0
      for (var li = 0; li < lines.length; li++) {
        if (lines[li].w > maxW) maxW = lines[li].w
      }
      var boxW = maxW + boxPad * 2 + sideLabelW
      var boxH = lines.length * lineHeight + boxPad * 2

      var above = cycleIsAbove(nd.groupLabel)
      var sideKey = nd.groupLabel + (above ? '-a' : '-b')
      var subLane = stableCycleRowMap.value[sideKey]
      if (subLane === undefined) subLane = 0

      nodeLayouts.push({
        nd: nd, x: x, lines: lines,
        boxW: boxW, boxH: boxH, subLane: subLane, above: above,
        stackLevel: 0,
        sideLabel: sideLabel, sideLabelW: sideLabelW
      })
    }

    var curVisibleDays = (r.max - r.min) / DAY_MS
    var peekThreshold = PEEK_W * Math.max(1, curVisibleDays / DEFAULT_WINDOW_DAYS)
    applyStacking(nodeLayouts, todayTsStack, peekThreshold)

    // Use stable offset from layoutMetrics (computed from ALL nodes, not just visible)
    var stableOff = layoutMetrics.value.safeOff || subLaneOffset

    for (var sli = 0; sli < nodeLayouts.length; sli++) {
      if (!nodeLayouts[sli]) continue
      nodeLayouts[sli].stemLen = laneBaseStem + nodeLayouts[sli].subLane * stableOff
    }

    // Second pass: draw stems BEFORE cards so card halos cover cross-row overlap
    for (var ssj = 0; ssj < nodeLayouts.length; ssj++) {
      var ssLay = nodeLayouts[ssj]
      if (!ssLay) continue
      var ssPrimary = ssLay.nd.productList.length
        ? (PRODUCT_HEX[ssLay.nd.productList[0]] || DEFAULT_HEX)
        : (ssLay.nd.isPast ? pastColor : futureColor)
      var stemX = ssLay.x
      ctx.beginPath()
      ctx.strokeStyle = ssPrimary
      ctx.lineWidth = 1
      ctx.setLineDash([])
      if (ssLay.above) {
        ctx.moveTo(stemX, yMid - 6)
        ctx.lineTo(stemX, yMid - ssLay.stemLen - 8)
      } else {
        ctx.moveTo(stemX, yMid + 6)
        ctx.lineTo(stemX, yMid + ssLay.stemLen + 8)
      }
      ctx.stroke()
    }

    // Third pass: draw boxes as card stacks
    // Sort: behind full-cards first (highest stackLevel), top cards last
    // Peek edges are collected and drawn in a separate pass AFTER all cards
    var boxRenderOrder = []
    for (var boi = 0; boi < nodeLayouts.length; boi++) {
      if (nodeLayouts[boi]) boxRenderOrder.push(boi)
    }
    boxRenderOrder.sort(function (a, b) {
      var aFront = _frontNodes.has(nodeLayouts[a].nd) ? 1 : 0
      var bFront = _frontNodes.has(nodeLayouts[b].nd) ? 1 : 0
      if (aFront !== bFront) return aFront - bFront
      var sl = (nodeLayouts[b].stackLevel || 0) - (nodeLayouts[a].stackLevel || 0)
      if (sl !== 0) return sl
      // Same stackLevel: draw farther-from-today first so closer cards paint on top
      var dA = parseDate(nodeLayouts[a].nd.date)
      var dB = parseDate(nodeLayouts[b].nd.date)
      var distA = dA ? Math.abs(dA.getTime() - todayTsStack) : Infinity
      var distB = dB ? Math.abs(dB.getTime() - todayTsStack) : Infinity
      return distB - distA
    })
    var deferredPeeks = []

    for (var bri = 0; bri < boxRenderOrder.length; bri++) {
      var j2 = boxRenderOrder[bri]
      var layout2 = nodeLayouts[j2]
      var nd2 = layout2.nd
      var stackLevel = layout2.stackLevel || 0
      var basePrimary2 = nd2.isPast ? pastColor : futureColor
      var boxX = layout2.x - layout2.boxW / 2
      var boxY
      if (layout2.above) {
        boxY = yMid - layout2.stemLen - 4 - layout2.boxH
      } else {
        boxY = yMid + layout2.stemLen + 4
      }

      if (stackLevel === 0) {
        // Clip at front card boundary if overlapping (front cards render later)
        var clipApplied = false
        for (var cli = bri + 1; cli < boxRenderOrder.length; cli++) {
          var clipIdx = boxRenderOrder[cli]
          var clipLay = nodeLayouts[clipIdx]
          if (!clipLay || (clipLay.stackLevel || 0) > 0) continue
          if (clipLay.subLane !== layout2.subLane || clipLay.above !== layout2.above) continue
          var clipBoxL = clipLay.x - clipLay.boxW / 2
          var clipBoxR = clipLay.x + clipLay.boxW / 2
          if (clipBoxL < boxX + layout2.boxW && clipBoxR > boxX) {
            ctx.save()
            ctx.beginPath()
            if (clipLay.x > layout2.x) {
              ctx.rect(0, 0, clipBoxL - 1, ctx.canvas.height)
            } else {
              ctx.rect(clipBoxR + 1, 0, ctx.canvas.width, ctx.canvas.height)
            }
            ctx.clip()
            clipApplied = true
            break
          }
        }

        var fadeOuterX = null
        var fadeInnerX = null
        var visibleWidth = layout2.boxW
        if (clipApplied) {
          if (clipLay.x > layout2.x) {
            visibleWidth = clipBoxL - 1 - boxX
            fadeOuterX = boxX
            fadeInnerX = clipBoxL - 1
          } else {
            visibleWidth = (boxX + layout2.boxW) - (clipBoxR + 1)
            fadeOuterX = boxX + layout2.boxW
            fadeInnerX = clipBoxR + 1
          }
        }

        // Top card: card-like appearance with shadow + glassy fill
        var dateColor = nd2.isPast ? mutedTextColor : (dark ? '#9ca3af' : '#6b7280')
        for (var ci = 0; ci < layout2.lines.length; ci++) {
          if (layout2.lines[ci].text === nd2.groupLabel) {
            layout2.lines[ci].color = dark ? '#d1d5db' : '#374151'
          } else if (layout2.lines[ci].text === nd2.msLabel) {
            layout2.lines[ci].color = basePrimary2
          } else {
            layout2.lines[ci].color = dateColor
          }
        }

        // Opaque halo: wider on right to cover 2nd card overlap
        var cardPad = 2
        var cardPadRight = 2
        ctx.fillStyle = dark ? '#1f2937' : '#ffffff'
        ctx.fillRect(boxX - cardPad, boxY - cardPad, layout2.boxW + cardPad + cardPadRight, layout2.boxH + cardPad * 2)

        // Drop shadow
        ctx.save()
        ctx.shadowColor = dark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.15)'
        ctx.shadowBlur = 8
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 3
        drawRoundedRect(ctx, boxX, boxY, layout2.boxW, layout2.boxH, 4)
        ctx.fillStyle = dark ? '#1f2937' : '#ffffff'
        ctx.fill()
        ctx.restore()


        // Glassy gradient fill
        drawRoundedRect(ctx, boxX, boxY, layout2.boxW, layout2.boxH, 4)
        var glassGrad = ctx.createLinearGradient(boxX, boxY, boxX, boxY + layout2.boxH)
        if (dark) {
          glassGrad.addColorStop(0, 'rgba(55,65,81,0.97)')
          glassGrad.addColorStop(0.35, 'rgba(40,50,65,0.92)')
          glassGrad.addColorStop(1, 'rgba(17,24,39,0.95)')
        } else {
          glassGrad.addColorStop(0, 'rgba(255,255,255,0.99)')
          glassGrad.addColorStop(0.35, 'rgba(248,250,252,0.95)')
          glassGrad.addColorStop(1, 'rgba(241,245,249,0.97)')
        }
        ctx.fillStyle = glassGrad
        ctx.fill()

        // Top highlight line (gloss)
        ctx.beginPath()
        ctx.moveTo(boxX + 4, boxY + 1)
        ctx.lineTo(boxX + layout2.boxW - 4, boxY + 1)
        ctx.strokeStyle = dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)'
        ctx.lineWidth = 1
        ctx.stroke()

        // Border
        drawRoundedRect(ctx, boxX, boxY, layout2.boxW, layout2.boxH, 4)
        var borderHex = nd2.productList.length ? (PRODUCT_HEX[nd2.productList[0]] || DEFAULT_HEX) : null
        ctx.strokeStyle = borderHex
          ? hexToRgba(borderHex, dark ? 0.6 : 0.5)
          : (dark ? 'rgba(75,85,99,0.6)' : 'rgba(203,213,225,0.8)')
        ctx.lineWidth = 1
        ctx.stroke()

        var textOffsetX = 0
        if (nd2.productList.length) {
          var tintHex = PRODUCT_HEX[nd2.productList[0]] || DEFAULT_HEX
          drawRoundedRect(ctx, boxX, boxY, layout2.boxW, layout2.boxH, 4)
          ctx.fillStyle = hexToRgba(tintHex, 0.08)
          ctx.fill()
        }

        var textX = boxX + textOffsetX + (layout2.boxW - textOffsetX) / 2
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        var applyFade = clipApplied && visibleWidth < layout2.boxW * 0.7
        for (var ti = 0; ti < layout2.lines.length; ti++) {
          ctx.font = layout2.lines[ti].font
          var lineY = boxY + boxPad + ti * lineHeight
          if (applyFade && fadeOuterX !== null) {
              var fadeGrad = ctx.createLinearGradient(fadeOuterX, 0, fadeInnerX, 0)
              fadeGrad.addColorStop(0, layout2.lines[ti].color)
              fadeGrad.addColorStop(0.7, layout2.lines[ti].color)
              fadeGrad.addColorStop(1, hexToRgba(layout2.lines[ti].color, 0.4))
              ctx.fillStyle = fadeGrad
            } else {
              ctx.fillStyle = layout2.lines[ti].color
            }
            ctx.fillText(layout2.lines[ti].text, textX, lineY)
        }
        ctx.globalAlpha = 1.0
        if (clipApplied) ctx.restore()
        _cardHitBoxes.push({ x: boxX, y: boxY, w: layout2.boxW, h: layout2.boxH, nd: nd2 })
      } else {
        // Behind card: render as peek strip — one per stacked card.
        var topLayout = nodeLayouts[layout2.stackTopIdx]
        if (!topLayout) continue

        var behindIsLeft = layout2.x < topLayout.x
        var peekStripY
        if (topLayout.above) {
          peekStripY = yMid - topLayout.stemLen - 4 - topLayout.boxH
        } else {
          peekStripY = yMid + topLayout.stemLen + 4
        }
        var peekStripH = topLayout.boxH

        var peekStripX
        if (behindIsLeft) {
          var topLeftPk = topLayout.x - topLayout.boxW / 2 - 2
          peekStripX = topLeftPk - PEEK_W * stackLevel
        } else {
          var topRightPk = topLayout.x + topLayout.boxW / 2 + 2
          peekStripX = topRightPk + PEEK_W * (stackLevel - 1)
        }

        deferredPeeks.push({
          x: peekStripX, y: peekStripY, w: PEEK_W, h: peekStripH,
          isLeft: behindIsLeft, frontIdx: layout2.stackTopIdx, dotX: layout2.x,
          nd: nd2
        })
      }
    }

    // Fourth pass: draw deferred peek strips ON TOP of all cards
    for (var dpi = 0; dpi < deferredPeeks.length; dpi++) {
      var pk = deferredPeeks[dpi]
      var peekR = 4
      // Draw a thin standalone card strip with rounded outer corners
      ctx.save()
      ctx.shadowColor = dark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.10)'
      ctx.shadowBlur = 3
      ctx.shadowOffsetX = pk.isLeft ? 1 : -1
      ctx.shadowOffsetY = 1
      ctx.beginPath()
      if (pk.isLeft) {
        // Rounded on left side, flat on right
        ctx.moveTo(pk.x + peekR, pk.y)
        ctx.lineTo(pk.x + pk.w, pk.y)
        ctx.lineTo(pk.x + pk.w, pk.y + pk.h)
        ctx.lineTo(pk.x + peekR, pk.y + pk.h)
        ctx.arcTo(pk.x, pk.y + pk.h, pk.x, pk.y + pk.h - peekR, peekR)
        ctx.lineTo(pk.x, pk.y + peekR)
        ctx.arcTo(pk.x, pk.y, pk.x + peekR, pk.y, peekR)
      } else {
        // Rounded on right side, flat on left
        ctx.moveTo(pk.x, pk.y)
        ctx.lineTo(pk.x + pk.w - peekR, pk.y)
        ctx.arcTo(pk.x + pk.w, pk.y, pk.x + pk.w, pk.y + peekR, peekR)
        ctx.lineTo(pk.x + pk.w, pk.y + pk.h - peekR)
        ctx.arcTo(pk.x + pk.w, pk.y + pk.h, pk.x + pk.w - peekR, pk.y + pk.h, peekR)
        ctx.lineTo(pk.x, pk.y + pk.h)
      }
      ctx.closePath()
      var peekGrad = ctx.createLinearGradient(pk.x, pk.y, pk.x, pk.y + pk.h)
      if (dark) {
        peekGrad.addColorStop(0, 'rgba(55,65,81,0.97)')
        peekGrad.addColorStop(1, 'rgba(17,24,39,0.95)')
      } else {
        peekGrad.addColorStop(0, 'rgba(255,255,255,0.99)')
        peekGrad.addColorStop(1, 'rgba(248,250,252,0.95)')
      }
      ctx.fillStyle = peekGrad
      ctx.fill()
      if (pk.nd.productList.length) {
        ctx.fillStyle = hexToRgba(PRODUCT_HEX[pk.nd.productList[0]] || DEFAULT_HEX, 0.08)
        ctx.fill()
      }
      ctx.restore()
      // Border — open path, skip inner flat edge so it looks like a card edge
      ctx.beginPath()
      if (pk.isLeft) {
        // Draw: top → left arc → left edge → bottom arc → bottom (skip right edge)
        ctx.moveTo(pk.x + pk.w, pk.y)
        ctx.lineTo(pk.x + peekR, pk.y)
        ctx.arcTo(pk.x, pk.y, pk.x, pk.y + peekR, peekR)
        ctx.lineTo(pk.x, pk.y + pk.h - peekR)
        ctx.arcTo(pk.x, pk.y + pk.h, pk.x + peekR, pk.y + pk.h, peekR)
        ctx.lineTo(pk.x + pk.w, pk.y + pk.h)
      } else {
        // Draw: bottom → right arc → right edge → top arc → top (skip left edge)
        ctx.moveTo(pk.x, pk.y + pk.h)
        ctx.lineTo(pk.x + pk.w - peekR, pk.y + pk.h)
        ctx.arcTo(pk.x + pk.w, pk.y + pk.h, pk.x + pk.w, pk.y + pk.h - peekR, peekR)
        ctx.lineTo(pk.x + pk.w, pk.y + peekR)
        ctx.arcTo(pk.x + pk.w, pk.y, pk.x + pk.w - peekR, pk.y, peekR)
        ctx.lineTo(pk.x, pk.y)
      }
      var peekBorderHex = pk.nd.productList.length ? (PRODUCT_HEX[pk.nd.productList[0]] || DEFAULT_HEX) : null
      ctx.strokeStyle = peekBorderHex
        ? hexToRgba(peekBorderHex, dark ? 0.6 : 0.5)
        : (dark ? 'rgba(75,85,99,0.6)' : 'rgba(203,213,225,0.8)')
      ctx.lineWidth = 1
      ctx.stroke()
      _cardHitBoxes.push({ x: pk.x, y: pk.y, w: pk.w, h: pk.h, nd: pk.nd })
    }

    // Draw milestone dots
    var dotBorderColor = dark ? '#1f2937' : '#ffffff'
    var milestoneHaloR = MILESTONE_DOT_RADIUS + MILESTONE_DOT_BORDER + DOT_HALO_PAD
    var dotOrder = []
    for (var doi = 0; doi < nodeLayouts.length; doi++) {
      if (nodeLayouts[doi]) dotOrder.push(doi)
    }
    var todayTsDots = todayTsStack
    dotOrder.sort(function (a, b) {
      var distA = Math.abs(nodeLayouts[a].x - xScale.getPixelForValue(todayTsDots))
      var distB = Math.abs(nodeLayouts[b].x - xScale.getPixelForValue(todayTsDots))
      if (distA !== distB) return distB - distA
      var subDiff = nodeLayouts[b].subLane - nodeLayouts[a].subLane
      if (subDiff !== 0) return subDiff
      return (nodeLayouts[b].stackLevel || 0) - (nodeLayouts[a].stackLevel || 0)
    })
    var dotPxPositions = []
    for (var dpj = 0; dpj < dotOrder.length; dpj++) {
      dotPxPositions.push(nodeLayouts[dotOrder[dpj]].x)
    }

    for (var dri = 0; dri < dotOrder.length; dri++) {
      var dLayout = nodeLayouts[dotOrder[dri]]
      var dIdx = dotOrder[dri]
      var dotColor = n[dIdx].productList.length
        ? (PRODUCT_HEX[n[dIdx].productList[0]] || DEFAULT_HEX)
        : (n[dIdx].isPast ? pastColor : futureColor)
      var dotDrawX = dLayout.x
      ctx.globalAlpha = 1.0

      // Check if any other dot is within halo distance
      var hasNeighbor = false
      for (var dni = 0; dni < dotPxPositions.length; dni++) {
        if (dni === dri) continue
        if (Math.abs(dotPxPositions[dni] - dotDrawX) < milestoneHaloR * 2) {
          hasNeighbor = true
          break
        }
      }

      if (hasNeighbor) {
        // Skip halo — border circle covers the axis line under the dot
      } else {
        ctx.beginPath()
        ctx.arc(dotDrawX, yMid, milestoneHaloR, 0, Math.PI * 2)
        ctx.fillStyle = bgColor
        ctx.fill()
      }
      ctx.beginPath()
      ctx.arc(dotDrawX, yMid, MILESTONE_DOT_RADIUS + MILESTONE_DOT_BORDER, 0, Math.PI * 2)
      ctx.fillStyle = dotBorderColor
      ctx.fill()
      ctx.beginPath()
      ctx.arc(dotDrawX, yMid, MILESTONE_DOT_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = dotColor
      ctx.fill()
      ctx.globalAlpha = 1.0
    }

    // Dimension lines
    if (showDimLines.value) {
      var dimGap = 6
      var arrowSize = 2
      var dimColor = dark ? 'rgba(107,114,128,0.35)' : 'rgba(156,163,175,0.35)'
      var dimTextColor = dark ? 'rgba(107,114,128,0.55)' : 'rgba(156,163,175,0.65)'

      var todayDim = new Date()
      todayDim.setHours(0, 0, 0, 0)
      var todayTsDim = todayDim.getTime()
      var todayInView = todayTsDim >= r.min && todayTsDim <= r.max
      var todayPxDim = todayInView ? xScale.getPixelForValue(todayTsDim) : null

      var dimGroups = {}
      for (var di = 0; di < nodeLayouts.length; di++) {
        var dl = nodeLayouts[di]
        if (!dl) continue
        if (!/^\d+\.\d+$/.test(cycleFromGroupLabel(dl.nd.groupLabel))) continue
        var dDate = parseDate(dl.nd.date)
        if (!dDate) continue
        var dimKey = dl.nd.groupLabel + (dl.above ? '-a' : '-b')
        if (!dimGroups[dimKey]) dimGroups[dimKey] = { points: [], above: dl.above, productList: dl.nd.productList || [] }
        dimGroups[dimKey].points.push({ x: dl.x, ts: dDate.getTime() })
      }

      if (todayInView) {
        var dgKeys = Object.keys(dimGroups)
        for (var tdi = 0; tdi < dgKeys.length; tdi++) {
          dimGroups[dgKeys[tdi]].points.push({ x: todayPxDim, ts: todayTsDim })
        }
      }

      var dimGroupKeys = Object.keys(dimGroups)

      // Build all segments from viewport-filtered dim groups
      var allDimSegs = []
      for (var dgi = 0; dgi < dimGroupKeys.length; dgi++) {
        var dg = dimGroups[dimGroupKeys[dgi]]
        if (dg.points.length < 2) continue
        dg.points.sort(function (a, b) { return a.ts - b.ts })
        for (var dj = 1; dj < dg.points.length; dj++) {
          var segDiffDays = Math.round((dg.points[dj].ts - dg.points[dj - 1].ts) / DAY_MS)
          if (segDiffDays <= 0) continue
          var segLeftX = dg.points[dj - 1].x + dimGap
          var segRightX = dg.points[dj].x - dimGap
          if (segRightX - segLeftX <= 20) continue
          allDimSegs.push({
            gi: dgi, above: dg.above,
            left: segLeftX, right: segRightX,
            diffDays: segDiffDays,
            needsLabel: false,
            leftIsToday: dg.points[dj - 1].ts === todayTsDim,
            rightIsToday: dg.points[dj].ts === todayTsDim
          })
        }
      }

      // Per-segment overlap: mark segments that share horizontal space with a different group on same side
      for (var osi = 0; osi < allDimSegs.length; osi++) {
        for (var osj = 0; osj < allDimSegs.length; osj++) {
          if (allDimSegs[osj].gi !== allDimSegs[osi].gi &&
              allDimSegs[osj].above === allDimSegs[osi].above &&
              allDimSegs[osj].left < allDimSegs[osi].right &&
              allDimSegs[osi].left < allDimSegs[osj].right) {
            allDimSegs[osi].needsLabel = true
            break
          }
        }
      }

      // Render segments
      for (var sri = 0; sri < allDimSegs.length; sri++) {
        var seg = allDimSegs[sri]
        var srDgKey = dimGroupKeys[seg.gi]
        var srRowIdx = stableCycleRowMap.value[srDgKey] || 0
        var srYOff = 36 + srRowIdx * 14
        var srLineY = seg.above ? yMid - srYOff : yMid + srYOff
        ctx.globalAlpha = 1.0
        ctx.strokeStyle = dimColor
        ctx.fillStyle = dimColor
        ctx.lineWidth = 0.5
        ctx.setLineDash([])

        ctx.font = '10px ' + FONT
        var srLabel = seg.diffDays + 'd'
        if (seg.needsLabel) {
          var srProducts = dimGroups[srDgKey].productList.filter(function (p) { return productLabel(p) !== p })
          var srProductPrefix = srProducts.length ? srProducts.map(productLabel).join('/') + ' ' : ''
          srLabel += ' (' + srProductPrefix + srDgKey.replace(/-[ab]$/, '') + ')'
        }
        var srLabelW = ctx.measureText(srLabel).width
        var srLabelX = (seg.left + seg.right) / 2
        var srGapHalf = srLabelW / 2 + 4

        ctx.beginPath()
        ctx.moveTo(seg.left, srLineY)
        ctx.lineTo(srLabelX - srGapHalf, srLineY)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(srLabelX + srGapHalf, srLineY)
        ctx.lineTo(seg.right, srLineY)
        ctx.stroke()

        if (seg.leftIsToday) {
          ctx.beginPath()
          ctx.arc(seg.left, srLineY, arrowSize + 1, 0, Math.PI * 2)
          ctx.fillStyle = dark ? '#f87171' : '#ef4444'
          ctx.fill()
        } else {
          ctx.beginPath()
          ctx.moveTo(seg.left + arrowSize * 2, srLineY - arrowSize)
          ctx.lineTo(seg.left, srLineY)
          ctx.lineTo(seg.left + arrowSize * 2, srLineY + arrowSize)
          ctx.stroke()
        }
        if (seg.rightIsToday) {
          ctx.beginPath()
          ctx.arc(seg.right, srLineY, arrowSize + 1, 0, Math.PI * 2)
          ctx.fillStyle = dark ? '#f87171' : '#ef4444'
          ctx.fill()
        } else {
          ctx.beginPath()
          ctx.moveTo(seg.right - arrowSize * 2, srLineY - arrowSize)
          ctx.lineTo(seg.right, srLineY)
          ctx.lineTo(seg.right - arrowSize * 2, srLineY + arrowSize)
          ctx.stroke()
        }

        ctx.fillStyle = dimTextColor
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(srLabel, srLabelX, srLineY)
        ctx.globalAlpha = 1.0
      }
    }


    // Today marker (rendered last so it's always on top)
    var today = new Date()
    today.setHours(0, 0, 0, 0)
    var todayTs = today.getTime()
    var todayX = xScale.getPixelForValue(todayTs)
    var todayFade = (todayX < area.left - 20 || todayX > area.right + 20) ? 0 : 1
    if (todayFade > 0) {
      var redColor = dark ? '#f87171' : '#ef4444'

      ctx.globalAlpha = todayFade
      var todayHaloR = TODAY_DOT_RADIUS + TODAY_DOT_BORDER + DOT_HALO_PAD
      ctx.beginPath()
      ctx.arc(todayX, yMid, todayHaloR, 0, Math.PI * 2)
      ctx.fillStyle = bgColor
      ctx.fill()

      _todayPx.value = todayFade > 0.05 ? { x: todayX, y: yMid, opacity: todayFade } : null

      var youText = 'YOU ARE HERE'
      ctx.font = 'bold 11px ' + FONT
      var youW = ctx.measureText(youText).width
      var nml = nextMilestoneLabel.value
      var nmlText = nml ? (nml.desc + ' ' + nml.daysText) : null
      var nmlW = 0
      if (nmlText) {
        ctx.font = '10px ' + FONT
        nmlW = ctx.measureText(nmlText).width
      }
      var haloW = Math.max(youW, nmlW) + 12
      var haloH = nmlText ? 30 : 16
      var haloX = todayX - haloW / 2
      var haloY = yMid + 5
      ctx.fillStyle = dark ? '#1f2937' : '#ffffff'
      ctx.fillRect(haloX, haloY, haloW, haloH)

      ctx.font = 'bold 11px ' + FONT
      ctx.fillStyle = redColor
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(youText, todayX, yMid + 10)

      if (nmlText) {
        ctx.font = '10px ' + FONT
        ctx.fillStyle = dark ? '#fca5a5' : '#dc2626'
        ctx.fillText(nmlText, todayX, yMid + 23)
      }
      ctx.globalAlpha = 1.0
    } else {
      _todayPx.value = null
    }

    if (_hoveredBox) {
      ctx.save()
      ctx.strokeStyle = dark ? 'rgba(96,165,250,0.5)' : 'rgba(59,130,246,0.4)'
      ctx.lineWidth = 2
      drawRoundedRect(ctx, _hoveredBox.x - 1, _hoveredBox.y - 1,
                      _hoveredBox.w + 2, _hoveredBox.h + 2, 5)
      ctx.stroke()
      ctx.restore()
    }

    ctx.restore()
  }
}
</script>

<template>
  <div v-if="nodes.length" class="mb-6">
    <div class="bg-white dark:bg-gray-800 border border-gray-200
                dark:border-gray-700 rounded-lg shadow-sm p-4">
      <div class="flex items-center justify-end gap-3 mb-1">
        <label class="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500 cursor-pointer select-none">
          <input type="checkbox" v-model="showDimLines" class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 w-3 h-3" />
          Distances
        </label>
        <span class="text-[10px] text-gray-400 dark:text-gray-500">
          Scroll to zoom · Drag to pan
        </span>
        <button
          v-if="isZoomed"
          @click="resetZoom"
          class="text-xs text-primary-600 dark:text-primary-400 hover:underline transition-colors"
        >Reset zoom</button>
      </div>
      <div
        class="relative"
        :style="{ height: chartHeight + 'px', cursor: isOverCard ? 'pointer' : (isZoomed ? 'grab' : 'default') }"
        @wheel="onWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @mousemove="onCardHover"
        @mouseleave="isOverCard = false"
      >
        <Scatter :data="chartData" :options="chartOptions"
                 :plugins="[timelinePlugin]" />
        <!-- Heartbeat pulse overlay -->
        <div
          v-if="_todayPx"
          class="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center"
          :style="{ left: _todayPx.x + 'px', top: _todayPx.y + 'px', opacity: _todayPx.opacity }"
        >
          <span class="absolute w-5 h-5 rounded-full bg-red-500/30 dark:bg-red-400/30 animate-ping"></span>
          <span class="w-4 h-4 rounded-full bg-red-500 dark:bg-red-400 border-2 border-white dark:border-gray-800 shadow-[0_0_6px_2px_rgba(239,68,68,0.4)]"></span>
        </div>
        <!-- Days view indicator -->
        <span class="absolute bottom-1 right-2 text-[10px] text-gray-400 dark:text-gray-500 tabular-nums pointer-events-none">
          {{ visibleDays }}d view
        </span>
      </div>
      <div v-if="visibleProducts.length" class="flex items-center justify-center gap-4 mt-1.5 text-[10px] text-gray-500 dark:text-gray-400">
        <span v-for="p in visibleProducts" :key="p" class="flex items-center gap-1">
          <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: productHex(p) }"></span>
          {{ productLabel(p) }}
        </span>
      </div>
    </div>
  </div>
</template>
