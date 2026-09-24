<script setup>
import { computed, ref, watch, nextTick, onMounted, onUnmounted, inject } from 'vue'
import { Scatter } from 'vue-chartjs'
import { Chart as ChartJS, LinearScale, PointElement, Tooltip } from 'chart.js'
import { parseReleaseName, productLabel } from '../composables/useReleaseFamily.js'
import { parseDate, daysFromNow, formatShort } from '../composables/useScheduleHelpers.js'
import { PRODUCT_HEX, DEFAULT_HEX } from '../composables/useProductColors.js'
import { clampStemToCard, pointInCircle, timelineDimensionGroupKey, timelineDimensionRowKey } from './timeline-geometry.js'
import { buildTimelineNodes, cycleFromGroupLabel } from './timeline-model.js'
import { computeFullRange, computeDefaultRange, focusTimestamps as getFocusTimestamps, computeFocusRange } from './timeline-range.js'
import { computeWheelRange, computePanRange } from './timeline-interactions.js'
import { hoverDaysLabel, clampBadgePosition, buildDimensionRowMap } from './timeline-rendering.js'

ChartJS.register(LinearScale, PointElement, Tooltip)

var FONT = 'Inter var, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif'

const props = defineProps({
  releases: { type: Array, required: true },
  hidePast: { type: Boolean, default: false },
  // IDs of the release(s) the user just focused (newest selected version, released or upcoming).
  // When set and none of their milestones are in the current view, the timeline
  // fits the view to them (GA near the right edge). Empty = no focus.
  focusReleaseIds: { type: Array, default: function () { return [] } }
})

const nav = inject('moduleNav', null)

var allNodes = computed(function () { return buildTimelineNodes(props.releases) })

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
var TODAY_TEXT_START = Math.ceil(TODAY_DOT_RADIUS + TODAY_DOT_BORDER + DOT_HALO_PAD) + 4
var CHART_MAX_HEIGHT = 450
var STEM_HIT_TOL = 6
var DOT_HIT_TOL = 4

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
  var map = {}
  for (var ai = 0; ai < aboveKeys.length; ai++) map[aboveKeys[ai]] = aboveKeys.length - 1 - ai
  for (var bi = 0; bi < versionedBelow.length; bi++) map[versionedBelow[bi]] = versionedBelow.length - 1 - bi
  for (var nbi = 0; nbi < nonVersionedBelow.length; nbi++) map[nonVersionedBelow[nbi]] = versionedBelow.length + nbi
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
  var estMaxBoxH = 4 * lineHeight + boxPad * 2
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

// Fixed chart height so the timeline box never resizes when the release
// selection changes (e.g. picking an older EA version). Row layout is always
// shrunk to fit within CHART_MAX_HEIGHT (see layoutMetrics), so a constant
// height never overflows — it only removes the vertical "jumping" between
// selections. The axis position within the box stays proportional via the
// y-scale (belowSpace/aboveSpace ratio in chartOptions).
var chartHeight = computed(function () {
  return CHART_MAX_HEIGHT
})

function fmtDate(dateStr) {
  return formatShort(dateStr, { year: true })
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
      var desc = productPrefix + n[i].groupLabel
      var msLabel = n[i].msLabel
      if (days === 0) return { desc: desc, msLabel: msLabel, daysText: 'today' }
      return { desc: desc, msLabel: msLabel, daysText: 'in ' + days + 'd' }
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

var DAY_MS = 86400000
var HISTORICAL_SCROLL_DAYS = 30
var DEFAULT_WINDOW_DAYS = 29

// Today pulse overlay position (set by afterDraw)
var _todayPx = ref(null)

var fullRange = computed(function () {
  var today = new Date()
  today.setHours(0, 0, 0, 0)
  var range = computeFullRange(nodes.value, today.getTime(), DAY_MS)
  var historicalMin = today.getTime() - HISTORICAL_SCROLL_DAYS * DAY_MS
  return { min: Math.min(range.min, historicalMin), max: range.max }
})

// Max manual zoom-out window (scroll wheel / pinch). Wide enough to comfortably
// take in a whole release cluster (planning freeze through GA) at once. The
// auto-fit is deliberately NOT bound by this — it must be free to widen the view
// far enough to keep both the focused version and the today marker on screen.
var MAX_VISIBLE_DAYS = 180
// Padding for the auto-fit-to-focused-version window: GA sits FOCUS_FIT_RIGHT_PAD_DAYS
// from the right edge; earlier milestones get FOCUS_FIT_LEFT_PAD_DAYS of breathing room.
var FOCUS_FIT_RIGHT_PAD_DAYS = 3
var FOCUS_FIT_LEFT_PAD_DAYS = 7

var defaultRange = computed(function () {
  var today = new Date()
  today.setHours(0, 0, 0, 0)
  return computeDefaultRange(fullRange.value, today.getTime(), props.hidePast, {
    windowDays: DEFAULT_WINDOW_DAYS,
    maxVisibleDays: MAX_VISIBLE_DAYS
  }, DAY_MS)
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

var isZoomed = computed(function () {
  return zoomMin.value !== null && zoomMax.value !== null
})

function resetZoom() {
  zoomMin.value = null
  zoomMax.value = null
}

watch(function () { return props.hidePast }, resetZoom)

// ── Auto-fit to a focused (newest selected) version ──
// Milestone timestamps of the currently-rendered nodes that belong to a focused release.
function focusTimestamps() {
  return getFocusTimestamps(nodes.value, props.focusReleaseIds)
}

// How many of the focused version's milestone cards fall inside the current view.
function focusVisibleCount() {
  var timestamps = focusTimestamps()
  var range = xRange.value
  var count = 0
  for (var i = 0; i < timestamps.length; i++) {
    if (timestamps[i] >= range.min && timestamps[i] <= range.max) count++
  }
  return count
}

// Fit the view to the focused version's milestones while ALWAYS keeping the
// "YOU ARE HERE" (today) marker in frame, so the user never loses their bearings.
// The window spans both the focused cluster and today: for a future version today
// anchors the left side and GA sits near the right edge; for an already-released
// version the cluster sits on the left and today anchors the right edge. Because
// today and a far-off cluster can be more than MAX_VISIBLE_DAYS apart, this fit is
// NOT width-capped — capping would drop either the version or the today marker.
function fitToFocus() {
  var ts = focusTimestamps()
  var today = new Date()
  today.setHours(0, 0, 0, 0)
  var range = computeFocusRange(ts, today.getTime(), fullRange.value, {
    left: FOCUS_FIT_LEFT_PAD_DAYS,
    right: FOCUS_FIT_RIGHT_PAD_DAYS
  }, DAY_MS)
  if (!range) return
  zoomMin.value = range.min
  zoomMax.value = range.max
}

// When the user focuses a version (released or upcoming) and none of its cards are
// visible in the current view (default or manually zoomed/panned), fit the view to it.
// Clearing the focus leaves the current view untouched. Runs after the reactive flush
// so hidePast / nodes / xRange reflect the new selection first.
watch(function () { return props.focusReleaseIds.slice().join(',') }, function (val) {
  if (!val) return
  nextTick(function () {
    if (!props.focusReleaseIds.length) return
    if (focusVisibleCount() === 0) fitToFocus()
  })
})

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
  var nextRange = computeWheelRange(xRange.value, fullRange.value, pivot,
    event.deltaY <= 0, MAX_VISIBLE_DAYS, DAY_MS)
  zoomMin.value = nextRange.min
  zoomMax.value = nextRange.max
}

// Drag-to-pan
var _dragStart = null
// Distinguishes a click from a drag-to-pan gesture (guards onCanvasClick).
var _moved = false

function onPointerDown(event) {
  _moved = false
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
  if (Math.abs(dx) > 4) _moved = true
  var nextRange = computePanRange(_dragStart, dx, area.right - area.left, fullRange.value)
  zoomMin.value = nextRange.min
  zoomMax.value = nextRange.max
}

function onPointerUp(event) {
  if (_dragStart) {
    _dragStart = null
    event.currentTarget.style.cursor = ''
  }
}

function _setHoveredBox(box) {
  if (!box) {
    isOverCard.value = false
    if (_hoveredBox) {
      _hoveredBox = null
      if (_chartInstance) _chartInstance.draw()
    }
    return
  }
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
}

function _cardBoxForNode(nd) {
  for (var i = 0; i < _cardHitBoxes.length; i++) {
    if (_cardHitBoxes[i].nd === nd) return _cardHitBoxes[i]
  }
  return null
}

function onCardHover(e) {
  if (_dragStart) return
  var canvas = e.currentTarget.querySelector('canvas')
  if (!canvas) { _setHoveredBox(null); return }
  var canvasRect = canvas.getBoundingClientRect()
  var cx = e.clientX - canvasRect.left
  var cy = e.clientY - canvasRect.top

  // Cards take priority (they render on top of stems)
  for (var i = _cardHitBoxes.length - 1; i >= 0; i--) {
    var box = _cardHitBoxes[i]
    if (cx >= box.x && cx <= box.x + box.w && cy >= box.y && cy <= box.y + box.h) {
      _setHoveredBox(box)
      return
    }
  }

  // Then milestone dots on the axis — resolve to the same node's card
  for (var di = _dotHitBoxes.length - 1; di >= 0; di--) {
    var dbox = _dotHitBoxes[di]
    if (pointInCircle(cx, cy, dbox.x, dbox.y, dbox.r)) {
      var dotCardBox = _cardBoxForNode(dbox.nd)
      if (dotCardBox) { _setHoveredBox(dotCardBox); return }
    }
  }

  // Fall back to stems — resolve to the same node's card so the tip matches
  for (var si = _stemHitBoxes.length - 1; si >= 0; si--) {
    var sbox = _stemHitBoxes[si]
    if (cx >= sbox.x && cx <= sbox.x + sbox.w && cy >= sbox.y && cy <= sbox.y + sbox.h) {
      var cardBox = _cardBoxForNode(sbox.nd)
      if (cardBox) { _setHoveredBox(cardBox); return }
    }
  }

  _setHoveredBox(null)
}

// Map a timeline node to the Execute-page version pill (e.g. "3.5.EA1" / "3.5").
// Server pill format = version + (phase ? '.' + phase : ''); GA is stripped.
function versionForNode(nd) {
  if (!nd) return null
  var releases = nd.releases || []
  for (var i = 0; i < releases.length; i++) {
    var parsed = parseReleaseName(releases[i].displayName) || parseReleaseName(releases[i].id)
    if (parsed) {
      var base = parsed.major + '.' + parsed.minor
      return (parsed.milestone && parsed.milestone !== 'GA') ? base + '.' + parsed.milestone : base
    }
  }
  // Some registry entries use product-family names that do not match the
  // source release parser. The timeline has already normalized those entries
  // into a stable cycle/milestone label, which is sufficient for Execute.
  var labelMatch = /(\d+\.\d+)(?:[.\s-]+(EA\d+|GA))?/i.exec(nd.groupLabel || '')
  if (labelMatch) {
    return labelMatch[1] + (labelMatch[2] && labelMatch[2] !== 'GA' ? '.' + labelMatch[2] : '')
  }
  return null
}

function openExecuteForNode(nd) {
  if (!nav) return
  var version = versionForNode(nd)
  if (!version) return
  // Land on the Kanban board (view=board&tab=board) with the version pre-selected.
  var params = { version: version, view: 'board', tab: 'board' }
  // Carry the card's product(s) so the Execute page lands on the matching
  // product(s) rather than defaulting to the first one. Invalid products are
  // dropped by reconcileSelection on the Execute side.
  if (nd.productList && nd.productList.length) params.products = nd.productList.join(',')
  nav.navigateTo('execute', params)
}

// A card shows the click affordance (↗) only when a click would actually
// navigate: nav is wired and the node resolves to an Execute-page version.
function shouldShowClickAffordance(nd) {
  return !!(nav && versionForNode(nd))
}

// Card-only hit test (dots/stems stay hover-only). Internal — not exposed.
function cardNodeAtPoint(cx, cy) {
  for (var i = _cardHitBoxes.length - 1; i >= 0; i--) {
    var b = _cardHitBoxes[i]
    if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) return b.nd
  }
  return null
}

function onCanvasClick(e) {
  if (_moved) return
  var canvas = e.currentTarget.querySelector('canvas')
  if (!canvas) return
  var rect = canvas.getBoundingClientRect()
  var nd = cardNodeAtPoint(e.clientX - rect.left, e.clientY - rect.top)
  if (nd) openExecuteForNode(nd)
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
var _stemHitBoxes = []
var _dotHitBoxes = []
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
    // Keep the hit-box arrays stable across redraws so event handlers and
    // test consumers always observe the current geometry.
    _cardHitBoxes.length = 0
    _stemHitBoxes.length = 0
    _dotHitBoxes.length = 0

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
    var todayTs = todayTsStack
    var todayX = xScale.getPixelForValue(todayTs)
    var todayFade = (todayX < area.left - 20 || todayX > area.right + 20) ? 0 : 1

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
      if (nd.productList.length) {
        ctx.font = 'bold 11px ' + FONT
        var prodText = nd.productList.map(function (p) { return productLabel(p) }).join(' · ')
        lines.push({ text: prodText, font: 'bold 11px ' + FONT, color: null, w: ctx.measureText(prodText).width, isProductLabel: true })
      }

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
        sideLabel: sideLabel, sideLabelW: sideLabelW
      })
    }

    // Use stable offset from layoutMetrics (computed from ALL nodes, not just visible)
    var stableOff = layoutMetrics.value.safeOff || subLaneOffset

    for (var sli = 0; sli < nodeLayouts.length; sli++) {
      if (!nodeLayouts[sli]) continue
      nodeLayouts[sli].stemLen = laneBaseStem + nodeLayouts[sli].subLane * stableOff
    }

    // Second pass: draw stems BEFORE cards so cards paint on top
    for (var ssj = 0; ssj < nodeLayouts.length; ssj++) {
      var ssLay = nodeLayouts[ssj]
      if (!ssLay) continue
      var ssPrimary = ssLay.nd.productList.length
        ? (PRODUCT_HEX[ssLay.nd.productList[0]] || DEFAULT_HEX)
        : (ssLay.nd.isPast ? pastColor : futureColor)
      var stemX = ssLay.x
      var stemTop, stemBottom
      ctx.beginPath()
      ctx.strokeStyle = ssPrimary
      ctx.lineWidth = 1
      ctx.setLineDash([])
      if (ssLay.above) {
        stemTop = yMid - ssLay.stemLen - 8
        stemBottom = yMid - 6
        ctx.moveTo(stemX, stemBottom)
        ctx.lineTo(stemX, stemTop)
      } else {
        stemTop = yMid + 6
        stemBottom = yMid + ssLay.stemLen + 8
        ctx.moveTo(stemX, stemTop)
        ctx.lineTo(stemX, stemBottom)
      }
      ctx.stroke()
      _stemHitBoxes.push({
        x: stemX - STEM_HIT_TOL, y: stemTop,
        w: STEM_HIT_TOL * 2, h: stemBottom - stemTop,
        above: ssLay.above, nd: ssLay.nd
      })
    }

    // Today dashed line (drawn before cards so cards render on top)
    if (todayFade > 0) {
      var m = layoutMetrics.value
      var lineHalfH = Math.max(m.aboveSpace, m.belowSpace) * 0.5
      var todayGapR = TODAY_DOT_RADIUS + TODAY_DOT_BORDER + DOT_HALO_PAD + 6
      ctx.save()
      ctx.globalAlpha = todayFade
      ctx.setLineDash([4, 6])
      ctx.strokeStyle = dark ? 'rgba(248,113,113,0.3)' : 'rgba(239,68,68,0.25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(todayX, yMid - lineHalfH)
      ctx.lineTo(todayX, yMid - todayGapR)
      ctx.moveTo(todayX, yMid + todayGapR)
      ctx.lineTo(todayX, yMid + lineHalfH)
      ctx.stroke()
      ctx.restore()
    }

    // Third pass: draw cards
    var boxRenderOrder = []
    for (var boi = 0; boi < nodeLayouts.length; boi++) {
      if (nodeLayouts[boi]) boxRenderOrder.push(boi)
    }
    boxRenderOrder.sort(function (a, b) {
      var aFront = _frontNodes.has(nodeLayouts[a].nd) ? 1 : 0
      var bFront = _frontNodes.has(nodeLayouts[b].nd) ? 1 : 0
      if (aFront !== bFront) return aFront - bFront
      // Draw farther-from-today first so closer cards paint on top
      var dA = parseDate(nodeLayouts[a].nd.date)
      var dB = parseDate(nodeLayouts[b].nd.date)
      var distA = dA ? Math.abs(dA.getTime() - todayTsStack) : Infinity
      var distB = dB ? Math.abs(dB.getTime() - todayTsStack) : Infinity
      return distB - distA
    })

    for (var bri = 0; bri < boxRenderOrder.length; bri++) {
      var j2 = boxRenderOrder[bri]
      var layout2 = nodeLayouts[j2]
      var nd2 = layout2.nd
      var basePrimary2 = nd2.isPast ? pastColor : futureColor
      var boxX = layout2.x - layout2.boxW / 2
      var boxY
      if (layout2.above) {
        boxY = yMid - layout2.stemLen - 4 - layout2.boxH
      } else {
        boxY = yMid + layout2.stemLen + 4
      }

      // Clip at front card boundary if overlapping (front cards render later)
      var clipApplied = false
      for (var cli = bri + 1; cli < boxRenderOrder.length; cli++) {
        var clipIdx = boxRenderOrder[cli]
        var clipLay = nodeLayouts[clipIdx]
        if (!clipLay) continue
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

      // Card text colours
      var dateColor = nd2.isPast ? mutedTextColor : (dark ? '#9ca3af' : '#6b7280')
      for (var ci = 0; ci < layout2.lines.length; ci++) {
        if (layout2.lines[ci].text === nd2.groupLabel) {
          layout2.lines[ci].color = dark ? '#d1d5db' : '#374151'
        } else if (layout2.lines[ci].text === nd2.msLabel) {
          layout2.lines[ci].color = basePrimary2
        } else if (layout2.lines[ci].isProductLabel) {
          layout2.lines[ci].color = nd2.productList.length === 1
            ? (PRODUCT_HEX[nd2.productList[0]] || DEFAULT_HEX)
            : (dark ? '#9ca3af' : '#6b7280')
        } else {
          layout2.lines[ci].color = dateColor
        }
      }

      // Card fill
      drawRoundedRect(ctx, boxX, boxY, layout2.boxW, layout2.boxH, 4)
      ctx.fillStyle = dark ? '#1f2937' : '#ffffff'
      ctx.fill()

      // Card border
      drawRoundedRect(ctx, boxX, boxY, layout2.boxW, layout2.boxH, 4)
      ctx.strokeStyle = dark ? 'rgba(55,65,81,0.6)' : 'rgba(226,232,240,0.9)'
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
      return 0
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

      _dotHitBoxes.push({
        x: dotDrawX, y: yMid,
        r: MILESTONE_DOT_RADIUS + MILESTONE_DOT_BORDER + DOT_HIT_TOL,
        color: dotColor, nd: n[dIdx]
      })
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
        var dimKey = timelineDimensionGroupKey(dl.nd, dl.above)
        if (!dimGroups[dimKey]) {
          dimGroups[dimKey] = {
            points: [],
            above: dl.above,
            groupLabel: dl.nd.groupLabel,
            productList: dl.nd.productList || []
          }
        }
        dimGroups[dimKey].points.push({ x: dl.x, ts: dDate.getTime() })
      }

      if (todayInView) {
        var dgKeys = Object.keys(dimGroups)
        for (var tdi = 0; tdi < dgKeys.length; tdi++) {
          dimGroups[dgKeys[tdi]].points.push({ x: todayPxDim, ts: todayTsDim })
        }
      }

      var dimGroupKeys = Object.keys(dimGroups)
      var dimensionRowMap = buildDimensionRowMap(
        dimGroups,
        stableCycleRowMap.value,
        timelineDimensionRowKey
      )

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
            needsLabel: false
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
        var srDg = dimGroups[srDgKey]
        // Dimension groups include product in their identity, while the stable
        // row map intentionally assigns one row per cycle and side. Use the
        // row-map key shape here instead of the product-specific group key.
        var srRowIdx = dimensionRowMap[srDgKey] || 0
        var srYOff = 36 + srRowIdx * 14
        var srLineY = seg.above ? yMid - srYOff : yMid + srYOff
        ctx.globalAlpha = 1.0
        ctx.strokeStyle = dimColor
        ctx.fillStyle = dimColor
        ctx.lineWidth = 0.5
        ctx.setLineDash([])

        ctx.font = '10px ' + FONT
        var srShortLabel = seg.diffDays + 'd'
        var srFullLabel = srShortLabel
        if (seg.needsLabel) {
          var srProducts = srDg.productList.filter(function (p) { return productLabel(p) !== p })
          var srProductPrefix = srProducts.length ? srProducts.map(productLabel).join('/') + ' ' : ''
          srFullLabel += ' (' + srProductPrefix + srDg.groupLabel + ')'
        }
        var srLabelX = (seg.left + seg.right) / 2
        var segWidth = seg.right - seg.left

        var srFullW = ctx.measureText(srFullLabel).width
        var srShortW = ctx.measureText(srShortLabel).width
        var srLabel = srFullW + 8 <= segWidth ? srFullLabel : srShortLabel
        var srLabelW = srLabel === srFullLabel ? srFullW : srShortW
        var srGapHalf = srLabelW / 2 + 4
        var srFits = srLabelW + 8 <= segWidth

        if (srFits) {
          ctx.beginPath()
          ctx.moveTo(seg.left, srLineY)
          ctx.lineTo(srLabelX - srGapHalf, srLineY)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(srLabelX + srGapHalf, srLineY)
          ctx.lineTo(seg.right, srLineY)
          ctx.stroke()
        } else {
          ctx.beginPath()
          ctx.moveTo(seg.left, srLineY)
          ctx.lineTo(seg.right, srLineY)
          ctx.stroke()
        }

        ctx.beginPath()
        ctx.moveTo(seg.left + arrowSize * 2, srLineY - arrowSize)
        ctx.lineTo(seg.left, srLineY)
        ctx.lineTo(seg.left + arrowSize * 2, srLineY + arrowSize)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(seg.right - arrowSize * 2, srLineY - arrowSize)
        ctx.lineTo(seg.right, srLineY)
        ctx.lineTo(seg.right - arrowSize * 2, srLineY + arrowSize)
        ctx.stroke()

        if (srFits) {
          ctx.fillStyle = dimTextColor
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(srLabel, srLabelX, srLineY)
        }
        ctx.globalAlpha = 1.0
      }
    }


    // Today marker label (rendered last so text stays on top)
    if (todayFade > 0) {
      var redColor = dark ? '#f87171' : '#ef4444'

      ctx.globalAlpha = todayFade

      _todayPx.value = todayFade > 0.05 ? { x: todayX, y: yMid, opacity: todayFade } : null

      var youText = 'YOU ARE HERE'
      ctx.font = 'bold 11px ' + FONT
      var youW = ctx.measureText(youText).width
      var nml = nextMilestoneLabel.value
      var nmlLine1 = nml ? nml.desc : null
      var nmlLine2 = nml ? (nml.msLabel + ' ' + nml.daysText) : null
      var nmlW1 = 0
      var nmlW2 = 0
      if (nmlLine1) {
        ctx.font = '10px ' + FONT
        nmlW1 = ctx.measureText(nmlLine1).width
        nmlW2 = ctx.measureText(nmlLine2).width
      }
      var haloW = Math.max(youW, nmlW1, nmlW2) + 12
      var haloH = nmlLine1 ? 42 : 16
      var haloX = todayX - haloW / 2
      var haloY = yMid + TODAY_TEXT_START
      ctx.fillStyle = dark ? '#1f2937' : '#ffffff'
      ctx.fillRect(haloX, haloY, haloW, haloH)

      ctx.font = 'bold 11px ' + FONT
      ctx.fillStyle = redColor
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(youText, todayX, yMid + TODAY_TEXT_START + 5)

      if (nmlLine1) {
        ctx.font = '10px ' + FONT
        ctx.fillStyle = dark ? '#fca5a5' : '#dc2626'
        ctx.fillText(nmlLine1, todayX, yMid + TODAY_TEXT_START + 18)
        ctx.fillText(nmlLine2, todayX, yMid + TODAY_TEXT_START + 30)
      }
      ctx.globalAlpha = 1.0
    } else {
      _todayPx.value = null
    }

    if (_hoveredBox) {
      var hoverHex = _hoveredBox.nd.productList.length
        ? (PRODUCT_HEX[_hoveredBox.nd.productList[0]] || DEFAULT_HEX)
        : null
      ctx.save()
      ctx.strokeStyle = hoverHex
        ? hexToRgba(hoverHex, dark ? 0.7 : 0.6)
        : (dark ? 'rgba(96,165,250,0.5)' : 'rgba(59,130,246,0.4)')
      ctx.lineWidth = 2
      ctx.setLineDash([])
      drawRoundedRect(ctx, _hoveredBox.x - 1, _hoveredBox.y - 1,
                      _hoveredBox.w + 2, _hoveredBox.h + 2, 5)
      ctx.stroke()
      // Highlight the connecting stem with the same stroke as the card border
      for (var shi = 0; shi < _stemHitBoxes.length; shi++) {
        var shBox = _stemHitBoxes[shi]
        if (shBox.nd !== _hoveredBox.nd) continue
        var shX = shBox.x + STEM_HIT_TOL
        var shEnds = clampStemToCard(
          { top: shBox.y, bottom: shBox.y + shBox.h },
          { y: _hoveredBox.y, h: _hoveredBox.h },
          shBox.above
        )
        ctx.beginPath()
        ctx.moveTo(shX, shEnds.top)
        ctx.lineTo(shX, shEnds.bottom)
        ctx.stroke()
        break
      }
      // Highlight the milestone dot: a solid (non-transparent) backing fills the
      // gap between the dot and the ring, then the dot and ring are drawn on top.
      var dotRingR = MILESTONE_DOT_RADIUS + MILESTONE_DOT_BORDER + DOT_HALO_PAD + 1
      for (var dhi = 0; dhi < _dotHitBoxes.length; dhi++) {
        var dhBox = _dotHitBoxes[dhi]
        if (dhBox.nd !== _hoveredBox.nd) continue
        // Solid backing (white in light mode, dark surface in dark mode)
        ctx.beginPath()
        ctx.arc(dhBox.x, dhBox.y, dotRingR, 0, Math.PI * 2)
        ctx.fillStyle = bgColor
        ctx.fill()
        // Redraw the dot on top of the backing
        ctx.beginPath()
        ctx.arc(dhBox.x, dhBox.y, MILESTONE_DOT_RADIUS + MILESTONE_DOT_BORDER, 0, Math.PI * 2)
        ctx.fillStyle = dotBorderColor
        ctx.fill()
        ctx.beginPath()
        ctx.arc(dhBox.x, dhBox.y, MILESTONE_DOT_RADIUS, 0, Math.PI * 2)
        ctx.fillStyle = dhBox.color
        ctx.fill()
        // Ring in the same stroke as the card border
        ctx.beginPath()
        ctx.arc(dhBox.x, dhBox.y, dotRingR, 0, Math.PI * 2)
        ctx.stroke()
        break
      }
      ctx.restore()

      // Click affordance (RHOAIENG-82037): an external-link glyph in the hovered
      // card's top-right corner signals it deep-links into the Execute page. Only
      // drawn when the card resolves to a version (i.e. onCanvasClick will actually
      // navigate) so the cue never appears on a non-navigable card.
      if (shouldShowClickAffordance(_hoveredBox.nd)) {
        ctx.save()
        ctx.font = 'bold 12px ' + FONT
        ctx.textAlign = 'right'
        ctx.textBaseline = 'top'
        ctx.fillStyle = hoverHex || (dark ? '#60a5fa' : '#3b82f6')
        ctx.fillText('↗', _hoveredBox.x + _hoveredBox.w - 4, _hoveredBox.y + 3)
        ctx.restore()
      }

      var hoverDays = daysFromNow(_hoveredBox.nd.date)
      var hoverDaysText = hoverDaysLabel(hoverDays)
      if (hoverDaysText) {
        ctx.save()
        ctx.font = 'bold 10px ' + FONT
        var badgeW = ctx.measureText(hoverDaysText).width + 8
        var badgeH = 16
        var badgePosition = clampBadgePosition(
          _hoveredBox.x - badgeW / 2,
          _hoveredBox.y - badgeH / 2,
          badgeW,
          badgeH,
          area
        )
        var badgeX = badgePosition.x
        var badgeY = badgePosition.y
        var badgeColor = hoverHex || (dark ? '#60a5fa' : '#3b82f6')
        drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 8)
        ctx.fillStyle = badgeColor
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(hoverDaysText, badgeX + badgeW / 2, badgeY + badgeH / 2)
        ctx.restore()
      }
    }

    ctx.restore()

    // Test-only: expose card hit-boxes (canvas-relative centres) so Playwright
    // can deterministically click a card and read its version. Inert in normal
    // production use — activates only under demo builds OR an explicit ?e2e=1
    // opt-in in the URL (the integration image is not a VITE_DEMO_MODE build).
    if (typeof window !== 'undefined' &&
        (import.meta.env.VITE_DEMO_MODE === 'true' ||
         /[?&]e2e=1\b/.test(window.location.hash + window.location.search))) {
      window.__releaseTimeline = {
        range: { min: xRange.value.min, max: xRange.value.max },
        fullRange: { min: fullRange.value.min, max: fullRange.value.max },
        cards: _cardHitBoxes.map(function (b) {
          return {
            version: versionForNode(b.nd),
            products: (b.nd && b.nd.productList) || [],
            cx: b.x + b.w / 2,
            cy: b.y + b.h / 2
          }
        })
      }
    }
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
          Scroll to zoom · Drag to pan · 30-day history
        </span>
        <button
          v-if="isZoomed"
          @click="resetZoom"
          class="text-xs text-primary-600 dark:text-primary-400 hover:underline transition-colors"
        >Reset zoom</button>
      </div>
      <div
        class="relative"
        :style="{ height: chartHeight + 'px', cursor: isOverCard ? 'pointer' : 'grab' }"
        @wheel="onWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @mousemove="onCardHover"
        @mouseleave="isOverCard = false"
        @click="onCanvasClick"
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
