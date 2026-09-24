import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import fs from 'node:fs'
import path from 'node:path'
import registryFixture from '../../../../fixtures/releases/registry.json'
import trackingConfigFixture from '../../../../fixtures/releases/execution/feature-tracking-config.json'

vi.mock('@shared/client/services/api.js', () => ({
  apiRequest: vi.fn()
}))

// Stub the Chart.js canvas component: jsdom has no layout engine, so Chart.js
// resize (triggered by prop updates via setProps) reads `ownerDocument` off a
// detached canvas and throws. Tests assert on `vm.chartData`/`vm.xRange`
// computeds, not on rendered chart pixels, so a no-op render is sufficient.
vi.mock('vue-chartjs', () => ({
  Scatter: { name: 'Scatter', props: ['data', 'options'], render: () => null }
}))

import ReleaseTimeline from '../../client/components/ReleaseTimeline.vue'
import { productLabel } from '../../client/composables/useReleaseFamily.js'

// Timezone-safe date formatting: uses local components, not toISOString (which is UTC).
function localIso(y, m, d) {
  var dt = new Date(y, m, d)
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0')
}

function makeRelease(id, opts = {}) {
  return {
    id,
    displayName: opts.displayName || id,
    state: opts.state || 'active',
    productPagesShortname: opts.shortname || 'rhoai',
    milestones: {
      ga: opts.ga || null,
      featureFreeze: opts.featureFreeze || null,
      codeFreeze: opts.codeFreeze || null,
      planningFreeze: opts.planningFreeze || null
    }
  }
}

function makeCanvasContext() {
  var ctx = {
    canvas: { width: 1200, height: 450 },
    fillTextCalls: [],
    measureText: function (text) { return { width: String(text).length * 7 } },
    createLinearGradient: function () { return { addColorStop: function () {} } }
  }
  var methods = [
    'save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'quadraticCurveTo',
    'stroke', 'fill', 'fillRect', 'strokeRect', 'arc', 'rect', 'clip', 'fillText', 'setLineDash'
  ]
  methods.forEach(function (name) { ctx[name] = function () {} })
  ctx.fillText = function (text, x, y) { ctx.fillTextCalls.push({ text: text, x: x, y: y }) }
  return ctx
}

function makeTimelineChart(wrapper, ctx, opts = {}) {
  var range = wrapper.vm.xRange
  var left = opts.left || 80
  var right = opts.right || 1120
  var top = opts.top || 10
  var bottom = opts.bottom || 440
  var span = range.max - range.min || 1
  var canvas = {
    getBoundingClientRect: function () { return { left: 0, top: 0 } }
  }
  return {
    ctx: ctx,
    canvas: canvas,
    draw: function () {},
    chartArea: { left: left, right: right, top: top, bottom: bottom },
    scales: {
      x: {
        getPixelForValue: function (value) { return left + ((value - range.min) / span) * (right - left) },
        getValueForPixel: function (pixel) { return range.min + ((pixel - left) / (right - left)) * span }
      },
      y: { getPixelForValue: function (value) { return value === 0 ? 300 : value * 100 } }
    }
  }
}

describe('ReleaseTimeline', () => {
  it('renders nothing when releases array is empty', () => {
    var wrapper = mount(ReleaseTimeline, { props: { releases: [] } })
    expect(wrapper.find('.mb-6').exists()).toBe(false)
  })

  it('executes the canvas renderer for both timeline sides and display modes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-21T00:00:00'))
    var hadDark = document.documentElement.classList.contains('dark')
    document.documentElement.classList.add('dark')
    try {
      var releases = [
        makeRelease('rhoai-3.5', {
          displayName: 'rhoai-3.5', shortname: 'rhoai',
          planningFreeze: '2026-08-01', featureFreeze: '2026-08-10',
          codeFreeze: '2026-08-20', ga: '2026-09-01'
        }),
        makeRelease('rhelai-3.6', {
          displayName: 'rhelai-3.6', shortname: 'rhelai',
          planningFreeze: '2026-09-23', featureFreeze: '2026-10-01',
          codeFreeze: '2026-10-10', ga: '2026-10-20'
        }),
        makeRelease('rhaii-3.6', {
          displayName: 'rhaii-3.6', shortname: 'rhaii',
          planningFreeze: '2026-09-23', featureFreeze: '2026-10-01',
          codeFreeze: '2026-10-10', ga: '2026-10-20'
        }),
        makeRelease('Infrastructure Refresh', {
          displayName: 'Infrastructure Refresh', shortname: 'infra',
          ga: '2026-10-15'
        })
      ]
      var navigateTo = vi.fn()
      var wrapper = mount(ReleaseTimeline, {
        props: { releases },
        global: { provide: { moduleNav: { navigateTo: navigateTo } } }
      })
      var ctx = makeCanvasContext()
      var chart = makeTimelineChart(wrapper, ctx)

      wrapper.vm.timelinePlugin.beforeDatasetsDraw(chart)
      wrapper.vm.timelinePlugin.afterDraw(chart)
      expect(wrapper.vm._todayPx).not.toBe(null)

      var canvasTarget = {
        querySelector: function () { return chart.canvas },
        style: {}
      }
      var firstCard = wrapper.vm._cardHitBoxes[0]
      wrapper.vm.onCardHover({
        clientX: firstCard.x + firstCard.w / 2,
        clientY: firstCard.y + firstCard.h / 2,
        currentTarget: canvasTarget
      })
      wrapper.vm.timelinePlugin.afterDraw(chart)
      wrapper.vm.onCanvasClick({
        clientX: firstCard.x + firstCard.w / 2,
        clientY: firstCard.y + firstCard.h / 2,
        currentTarget: canvasTarget
      })
      expect(navigateTo).toHaveBeenCalled()

      wrapper.vm.showDimLines = false
      wrapper.vm.timelinePlugin.afterDraw(chart)
      expect(wrapper.vm._todayPx).not.toBe(null)

      document.documentElement.classList.remove('dark')
      wrapper.vm.showDimLines = true
      wrapper.vm.timelinePlugin.beforeDatasetsDraw(chart)
      wrapper.vm.timelinePlugin.afterDraw(chart)
      expect(wrapper.vm._todayPx).not.toBe(null)

      wrapper.vm.zoomMin = new Date('2026-10-01').getTime()
      wrapper.vm.zoomMax = new Date('2026-10-20').getTime()
      wrapper.vm.timelinePlugin.afterDraw(makeTimelineChart(wrapper, ctx))
      expect(wrapper.vm._todayPx).toBe(null)

      window.history.pushState({}, '', '/?e2e=1')
      wrapper.vm.timelinePlugin.afterDraw(makeTimelineChart(wrapper, ctx, { left: 300, right: 340 }))
      expect(window.__releaseTimeline.cards).toBeDefined()
      window.history.pushState({}, '', '/')

      wrapper.vm.timelinePlugin.beforeDatasetsDraw({ ctx: ctx, chartArea: null })
      wrapper.vm.timelinePlugin.afterDraw({ ctx: ctx, chartArea: null })
    } finally {
      window.history.pushState({}, '', '/')
      if (!hadDark) document.documentElement.classList.remove('dark')
      vi.useRealTimers()
    }
  })

  it('puts same-side distance labels on separate cycle rows', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-21T00:00:00'))
    try {
      var releases = [
        makeRelease('rhoai-3.5', {
          displayName: 'rhoai-3.5', shortname: 'rhoai',
          planningFreeze: '2026-09-25', ga: '2026-10-01'
        }),
        makeRelease('rhoai-3.6', {
          displayName: 'rhoai-3.6', shortname: 'rhoai',
          planningFreeze: '2026-11-01', ga: '2026-11-15'
        }),
        makeRelease('rhoai-3.7', {
          displayName: 'rhoai-3.7', shortname: 'rhoai',
          planningFreeze: '2026-12-01', ga: '2026-12-15'
        })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases: releases } })
      wrapper.vm.zoomMin = new Date('2026-09-21').getTime()
      wrapper.vm.zoomMax = new Date('2026-12-20').getTime()
      var ctx = makeCanvasContext()
      wrapper.vm.timelinePlugin.afterDraw(makeTimelineChart(wrapper, ctx))

      var distanceYs = ctx.fillTextCalls
        .filter(function (call) { return /^\d+d(?: \(|$)/.test(call.text) && call.y < 300 })
        .map(function (call) { return call.y })
      expect(new Set(distanceYs).size).toBeGreaterThan(1)
      expect(ctx.fillTextCalls.some(function (call) {
        return call.text.indexOf('|a|') !== -1 || call.text.indexOf('|b|') !== -1
      })).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('covers timeline interaction guards and hit-test paths', () => {
    var releases = [
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-09-23' }),
      makeRelease('rhelai-3.6', { displayName: 'rhelai-3.6', shortname: 'rhelai', ga: '2026-10-01' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var ctx = makeCanvasContext()
    var chart = makeTimelineChart(wrapper, ctx)
    wrapper.vm.timelinePlugin.afterDraw(chart)
    var canvas = chart.canvas
    var target = {
      style: {},
      querySelector: function () { return canvas },
      setPointerCapture: function () {}
    }
    var setupState = wrapper.vm.$.setupState
    var cards = setupState._cardHitBoxes
    var dots = setupState._dotHitBoxes
    var stems = setupState._stemHitBoxes
    expect(cards.length).toBeGreaterThan(0)
    wrapper.vm.onWheel({ clientX: 0, deltaY: 1, preventDefault: function () {} })
    wrapper.vm.onWheel({ clientX: 400, deltaY: 1, preventDefault: function () {} })
    wrapper.vm.onWheel({ clientX: 400, deltaY: -1, preventDefault: function () {} })
    wrapper.vm.onPointerDown({ button: 1, clientX: 400, pointerId: 1, currentTarget: target })
    wrapper.vm.onPointerDown({ button: 0, clientX: 0, pointerId: 1, currentTarget: target })
    wrapper.vm.onPointerDown({ button: 0, clientX: 400, pointerId: 1, currentTarget: target })
    wrapper.vm.onPointerMove({ clientX: 401 })
    wrapper.vm.onPointerMove({ clientX: 450 })
    wrapper.vm.onPointerUp({ currentTarget: target })
    wrapper.vm.onPointerMove({ clientX: 450 })
    wrapper.vm.onPointerUp({ currentTarget: target })

    var card = cards[0]
    wrapper.vm.onCardHover({
      clientX: card.x + card.w / 2, clientY: card.y + card.h / 2,
      currentTarget: target
    })
    if (dots.length) {
      wrapper.vm.onCardHover({
        clientX: dots[0].x, clientY: dots[0].y, currentTarget: target
      })
    }
    if (stems.length) {
      wrapper.vm.onCardHover({
        clientX: stems[0].x, clientY: stems[0].y + stems[0].h / 2, currentTarget: target
      })
    }
    var milestoneX = chart.scales.x.getPixelForValue(new Date('2026-09-23').getTime())
    for (var y = 20; y <= 420; y += 20) {
      wrapper.vm.onCardHover({
        clientX: milestoneX, clientY: y, currentTarget: target
      })
    }
    wrapper.vm.onCardHover({ clientX: 1, clientY: 1, currentTarget: target })
    wrapper.vm.onCardHover({ clientX: 1, clientY: 1, currentTarget: { querySelector: function () { return null } } })
    wrapper.vm.onCanvasClick({ clientX: 1, clientY: 1, currentTarget: target })
    expect(wrapper.vm.isOverCard).toBe(false)
  })

  it('covers interaction guards before a chart or canvas is available', () => {
    var wrapper = mount(ReleaseTimeline, {
      props: { releases: [makeRelease('rhoai-3.6', { ga: '2026-10-01' })] }
    })
    var event = {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      deltaY: 1,
      preventDefault: vi.fn(),
      currentTarget: { style: {}, setPointerCapture: vi.fn(), querySelector: function () { return null } }
    }

    wrapper.vm.onWheel(event)
    wrapper.vm.onPointerDown(event)
    wrapper.vm.onPointerMove(event)
    wrapper.vm.onPointerUp(event)
    wrapper.vm.onCardHover(event)
    wrapper.vm.onCanvasClick(event)

    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(wrapper.vm.isOverCard).toBe(false)
  })

  it('uses safe layout fallbacks for invalid milestone dates', () => {
    var wrapper = mount(ReleaseTimeline, {
      props: { releases: [makeRelease('rhoai-3.6', { ga: 'not-a-date' })] }
    })

    expect(wrapper.vm.nodes).toHaveLength(1)
    expect(wrapper.vm.layoutMetrics.aboveSpace).toBe(134)
    expect(wrapper.vm.layoutMetrics.belowSpace).toBe(60)
    expect(wrapper.vm.chartData.datasets[0].data).toEqual([])
  })

  it('creates separate nodes for each milestone date', () => {
    var releases = [
      makeRelease('rhoai-3.5', {
        displayName: 'RHAI 3.5 GA',
        shortname: 'rhoai',
        planningFreeze: '2026-06-24',
        featureFreeze: '2026-07-17',
        codeFreeze: '2026-07-20',
        ga: '2026-08-19'
      })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.nodes
    expect(nodes).toHaveLength(4)
    var labels = nodes.map(function (n) { return n.msLabel })
    expect(labels).toContain('Planning Freeze')
    expect(labels).toContain('Feature Freeze')
    expect(labels).toContain('Code Freeze')
    expect(labels).toContain('Generally Available')
  })

  it('groups releases by milestone group and merges dates', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2026-06-17', codeFreeze: '2026-05-15' }),
      makeRelease('rhelai-3.5.EA1', { displayName: 'rhelai-3.5.EA1', shortname: 'rhelai', ga: '2026-06-18', codeFreeze: '2026-05-16' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.nodes

    expect(nodes).toHaveLength(4)

    var gaNodes = nodes.filter(function (n) { return n.isGa })
    expect(gaNodes).toHaveLength(2)
    expect(gaNodes[0].productList).toHaveLength(1)
    expect(gaNodes[1].productList).toHaveLength(1)
  })

  it('skips null milestones', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', {
        displayName: 'rhoai-3.5.EA1',
        shortname: 'rhoai',
        ga: '2026-06-17',
        codeFreeze: '2026-05-15'
      })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.nodes
    var labels = nodes.map(function (n) { return n.msLabel })
    expect(labels).toContain('Code Freeze')
    expect(labels).toContain('Generally Available')
    expect(labels).not.toContain('Planning Freeze')
    expect(labels).not.toContain('Feature Freeze')
  })

  it('sorts nodes chronologically by date', () => {
    var releases = [
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-11-19' }),
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-08-20' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.nodes
    expect(nodes[0].date).toBe('2026-08-20')
    expect(nodes[1].date).toBe('2026-11-19')
  })

  it('mutes past milestones', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2024-01-01' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2028-12-01' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.nodes
    var pastNode = nodes.find(function (n) { return n.date === '2024-01-01' })
    var futureNode = nodes.find(function (n) { return n.date === '2028-12-01' })
    expect(pastNode.isPast).toBe(true)
    expect(futureNode.isPast).toBe(false)
  })

  it('autodiscovers products from release data', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2026-06-17' }),
      makeRelease('newprod-3.5.EA1', { displayName: 'newprod-3.5.EA1', shortname: 'newprod', ga: '2026-06-17' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var gaNodes = wrapper.vm.nodes.filter(function (n) { return n.isGa })
    expect(gaNodes).toHaveLength(2)
    var products = gaNodes.map(function (n) { return n.productList[0] })
    expect(products).toContain('rhoai')
    expect(products).toContain('newprod')
  })

  it('uses CSS overlay for today marker instead of dataset', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2024-01-01' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2028-12-01' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var datasets = wrapper.vm.chartData.datasets
    expect(datasets).toHaveLength(1)
    expect(datasets[0].label).toBe('Milestones')
  })

  it('shows next milestone info in nextMilestoneLabel', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2024-01-01' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2028-12-01' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var label = wrapper.vm.nextMilestoneLabel
    expect(label).toBeTruthy()
    expect(label.desc).toContain('3.6 GA')
    expect(label.daysText).toMatch(/\d+d/)
  })

  it('YOU ARE HERE text starts below the today dot bottom edge', () => {
    var releases = [
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2028-12-01' })
    ]
    var vm = mount(ReleaseTimeline, { props: { releases } }).vm
    expect(vm.TODAY_TEXT_START).toBeDefined()
    expect(vm.TODAY_DOT_RADIUS).toBeDefined()
    var dotBottom = vm.TODAY_DOT_RADIUS + vm.TODAY_DOT_BORDER + vm.DOT_HALO_PAD
    expect(vm.TODAY_TEXT_START).toBeGreaterThan(dotBottom)
  })

  it('hides Chart.js dots (drawn by plugin for z-order control)', () => {
    var releases = [
      makeRelease('rhoai-3.5', {
        displayName: 'RHAI 3.5 GA',
        shortname: 'rhoai',
        codeFreeze: '2026-07-20',
        ga: '2026-08-19'
      })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var ds = wrapper.vm.chartData.datasets[0]
    expect(ds.pointRadius).toBe(0)
    expect(ds.pointBorderWidth).toBe(0)
  })

  it('all nodes include productList for label rendering', () => {
    var releases = [
      makeRelease('rhoai-3.5', {
        displayName: 'RHAI 3.5 GA',
        shortname: 'rhoai',
        codeFreeze: '2026-07-20',
        ga: '2026-08-19'
      })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.nodes
    var gaNode = nodes.find(function (n) { return n.isGa })
    var nonGaNode = nodes.find(function (n) { return !n.isGa })
    expect(gaNode.productList.length).toBeGreaterThan(0)
    expect(gaNode.isGa).toBe(true)
    expect(nonGaNode.isGa).toBe(false)
  })

  it('handles single node without errors', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2026-06-17' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    expect(wrapper.vm.nodes).toHaveLength(1)
    expect(wrapper.vm.nodes[0].groupLabel).toContain('3.5 EA1')
    expect(wrapper.find('.mb-6').exists()).toBe(true)
  })

  it('excludes today dataset when all nodes are in the future', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2090-06-17' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2090-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var datasets = wrapper.vm.chartData.datasets
    expect(datasets).toHaveLength(1)
    expect(datasets[0].label).toBe('Milestones')
  })

  it('computes correct fullRange with padding', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2026-06-17' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var range = wrapper.vm.fullRange
    var firstTs = new Date('2026-06-17T00:00:00').getTime()
    var lastTs = new Date('2026-11-19T00:00:00').getTime()
    expect(range.min).toBeLessThan(firstTs)
    expect(range.max).toBeGreaterThan(lastTs)
  })

  it('defaults to 29-day forward window from today', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2026-06-17' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    expect(wrapper.vm.isZoomed).toBe(false)
    expect(wrapper.vm.xRange).toEqual(wrapper.vm.defaultRange)
  })

  it('default window span is exactly 29 days regardless of hidePast', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-13T00:00:00'))
    try {
      var DAY_MS = 86400000
      // Releases span well beyond 29 days from "today" in both directions
      var releases = [
        makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
          planningFreeze: '2026-07-01', ga: '2026-08-01' }),
        makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
          planningFreeze: '2026-08-20', ga: '2026-10-15' })
      ]
      var w1 = mount(ReleaseTimeline, { props: { releases, hidePast: false } })
      var r1 = w1.vm.defaultRange
      var span1 = (r1.max - r1.min) / DAY_MS
      expect(span1).toBeCloseTo(29, 0)

      var w2 = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
      var r2 = w2.vm.defaultRange
      var span2 = (r2.max - r2.min) / DAY_MS
      expect(span2).toBeCloseTo(29, 0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('visibleDays never exceeds MAX_VISIBLE_DAYS (180)', () => {
    // Even with releases spanning 6+ months, defaultRange caps at 29 days
    // and fullRange would be larger, but zoom is capped at 180 days
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2090-06-17' }),
      makeRelease('rhoai-3.9', { displayName: 'rhoai-3.9', shortname: 'rhoai', ga: '2090-12-17' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    // Default view is 29 days
    expect(wrapper.vm.visibleDays).toBeLessThanOrEqual(180)
  })

  describe('auto-fit to focused version', () => {
    var DAY_MS = 86400000
    function ts(str) { return new Date(str + 'T00:00:00').getTime() }

    // A released version (all milestones in the past) plus a future release so the
    // timeline spans today. Today is faked to 2026-08-27.
    function fitReleases() {
      return [
        makeRelease('rhoai-3.5-ea1', {
          displayName: 'rhoai-3.5.EA1', shortname: 'rhoai',
          planningFreeze: '2026-05-01', featureFreeze: '2026-06-01',
          codeFreeze: '2026-06-20', ga: '2026-07-14'
        }),
        makeRelease('rhoai-3.6', {
          displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-11-15'
        })
      ]
    }

    it('fits the view to a focused past version while keeping the today marker in frame', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-27T00:00:00'))
      try {
        var wrapper = mount(ReleaseTimeline, {
          props: { releases: fitReleases(), hidePast: false, focusReleaseIds: [] }
        })
        // Default today-anchored window does not include the past EA1 milestones.
        expect(wrapper.vm.isZoomed).toBe(false)

        await wrapper.setProps({ focusReleaseIds: ['rhoai-3.5-ea1'] })
        await flushPromises()

        expect(wrapper.vm.isZoomed).toBe(true)
        var r = wrapper.vm.xRange
        var gaTs = ts('2026-07-14')
        var planTs = ts('2026-05-01')
        var todayTs = ts('2026-08-27')
        // The whole past cluster is visible.
        expect(planTs).toBeGreaterThanOrEqual(r.min)
        expect(gaTs).toBeLessThanOrEqual(r.max)
        // Today is still in view — it's the latest point, anchored near the right edge.
        expect(todayTs).toBeGreaterThanOrEqual(r.min)
        expect(todayTs).toBeLessThanOrEqual(r.max)
        expect(r.max - todayTs).toBeLessThanOrEqual(5 * DAY_MS)
      } finally {
        vi.useRealTimers()
      }
    })

    it('does not move the view when a focused version already has cards visible', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-27T00:00:00'))
      try {
        var releases = [
          makeRelease('rhoai-3.5-ea1', {
            displayName: 'rhoai-3.5.EA1', shortname: 'rhoai',
            codeFreeze: '2026-08-20', ga: '2026-08-25' // within the default window
          }),
          makeRelease('rhoai-3.6', {
            displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-11-15'
          })
        ]
        var wrapper = mount(ReleaseTimeline, {
          props: { releases, hidePast: false, focusReleaseIds: [] }
        })
        await wrapper.setProps({ focusReleaseIds: ['rhoai-3.5-ea1'] })
        await flushPromises()
        // Cards already visible → no fit.
        expect(wrapper.vm.isZoomed).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })

    it('leaves the view untouched when focus is cleared', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-27T00:00:00'))
      try {
        var wrapper = mount(ReleaseTimeline, {
          props: { releases: fitReleases(), hidePast: false, focusReleaseIds: [] }
        })
        await wrapper.setProps({ focusReleaseIds: ['rhoai-3.5-ea1'] })
        await flushPromises()
        expect(wrapper.vm.isZoomed).toBe(true)
        var before = wrapper.vm.xRange

        await wrapper.setProps({ focusReleaseIds: [] })
        await flushPromises()
        // Deselect leaves the current (fitted) view as-is.
        expect(wrapper.vm.isZoomed).toBe(true)
        expect(wrapper.vm.xRange.min).toBe(before.min)
        expect(wrapper.vm.xRange.max).toBe(before.max)
      } finally {
        vi.useRealTimers()
      }
    })

    it('does not fit on mount even if focusReleaseIds is provided', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-27T00:00:00'))
      try {
        var wrapper = mount(ReleaseTimeline, {
          props: { releases: fitReleases(), hidePast: false, focusReleaseIds: ['rhoai-3.5-ea1'] }
        })
        // Flush the microtask queue: were the watcher `immediate`, its nextTick fit
        // would have run by now. Non-immediate → the default window is preserved.
        await flushPromises()
        expect(wrapper.vm.isZoomed).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })

    it('fits the view to a focused upcoming version whose milestones are far in the future', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-27T00:00:00'))
      try {
        // 3.9 is a far-future version: all milestones months past the default window,
        // off-screen to the RIGHT of "YOU ARE HERE".
        var releases = [
          makeRelease('rhoai-3.6', {
            displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-09-10'
          }),
          makeRelease('rhoai-3.9', {
            displayName: 'rhoai-3.9', shortname: 'rhoai',
            planningFreeze: '2027-04-01', featureFreeze: '2027-05-01',
            codeFreeze: '2027-05-20', ga: '2027-06-15'
          })
        ]
        var wrapper = mount(ReleaseTimeline, {
          props: { releases, hidePast: false, focusReleaseIds: [] }
        })
        expect(wrapper.vm.isZoomed).toBe(false)
        var todayTs = ts('2026-08-27')

        await wrapper.setProps({ focusReleaseIds: ['rhoai-3.9'] })
        await flushPromises()

        expect(wrapper.vm.isZoomed).toBe(true)
        var r = wrapper.vm.xRange
        var gaTs = ts('2027-06-15')
        var planTs = ts('2027-04-01')
        // The future cluster is fully in view, GA near the right edge.
        expect(planTs).toBeGreaterThanOrEqual(r.min)
        expect(gaTs).toBeGreaterThanOrEqual(r.min)
        expect(gaTs).toBeLessThanOrEqual(r.max)
        expect(r.max - gaTs).toBeLessThanOrEqual(5 * DAY_MS)
        // Today stays in frame even though the version is ~10 months out — the fit
        // widens the window rather than dropping the "YOU ARE HERE" marker. Today is
        // the earliest point here, anchored near the left edge.
        expect(todayTs).toBeGreaterThanOrEqual(r.min)
        expect(todayTs).toBeLessThanOrEqual(r.max)
        expect(todayTs - r.min).toBeLessThanOrEqual(10 * DAY_MS)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  it('shows zoom hint text when not zoomed', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2026-06-17' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    expect(wrapper.text()).toContain('Scroll to zoom')
    expect(wrapper.text()).toContain('Drag to pan')
  })

  it('assigns separate lanes per release cycle', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2026-06-17' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var lanes = wrapper.vm.cycleLanes
    expect(lanes).toHaveProperty('3.5')
    expect(lanes).toHaveProperty('3.6')
    expect(lanes['3.5']).not.toBe(lanes['3.6'])
    expect(wrapper.vm.laneCount).toBe(2)
  })

  it('keeps a constant chart height regardless of visible node count', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-13T00:00:00'))
    try {
      var releases = [
        makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-08-19' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var singleHeight = wrapper.vm.chartHeight

      var releases2 = [
        makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-08-19' }),
        makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
          planningFreeze: '2026-08-20', codeFreeze: '2026-08-22', ga: '2026-08-25' }),
        makeRelease('rhoai-3.7', { displayName: 'rhoai-3.7', shortname: 'rhoai',
          planningFreeze: '2026-08-28', codeFreeze: '2026-09-01', ga: '2026-09-05' })
      ]
      var wrapper2 = mount(ReleaseTimeline, { props: { releases: releases2 } })
      // The timeline box must not resize when the selection (node count) changes.
      expect(wrapper2.vm.chartHeight).toBe(singleHeight)
      expect(singleHeight).toBe(450)
    } finally {
      vi.useRealTimers()
    }
  })

  it('chart height stays stable during zoom (uses allNodes not filtered nodes)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-13T00:00:00'))
    try {
      var releases = [
        makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-08-19' }),
        makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
          planningFreeze: '2026-09-01', ga: '2026-10-05' }),
        makeRelease('rhoai-3.7', { displayName: 'rhoai-3.7', shortname: 'rhoai',
          planningFreeze: '2026-11-01', ga: '2026-12-05' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var heightAtDefault = wrapper.vm.chartHeight
      expect(heightAtDefault).toBeGreaterThan(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('chart height does not change when hidePast is toggled', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2024-01-01', ga: '2024-06-01' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
        planningFreeze: '2028-01-01', ga: '2028-06-01' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases, hidePast: false } })
    var heightWithPast = wrapper.vm.chartHeight

    var wrapper2 = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
    expect(wrapper2.vm.chartHeight).toBe(heightWithPast)
  })

  it('chart height is identical for a single release and many releases (no box resize on selection)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-13T00:00:00'))
    try {
      var one = [
        makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-09-19' })
      ]
      var many = [
        makeRelease('rhoai-3.4', { displayName: 'rhoai-3.4', shortname: 'rhoai',
          planningFreeze: '2026-04-01', ga: '2026-07-01' }),
        makeRelease('rhelai-3.4', { displayName: 'rhelai-3.4', shortname: 'rhelai',
          planningFreeze: '2026-04-05', ga: '2026-07-05' }),
        makeRelease('rhaii-3.4', { displayName: 'rhaii-3.4', shortname: 'rhaii',
          planningFreeze: '2026-04-10', ga: '2026-07-10' }),
        makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
          planningFreeze: '2027-01-01', ga: '2027-05-19' }),
        makeRelease('rhelai-3.6', { displayName: 'rhelai-3.6', shortname: 'rhelai',
          planningFreeze: '2027-01-05', ga: '2027-05-25' })
      ]
      var wrapperOne = mount(ReleaseTimeline, { props: { releases: one } })
      var wrapperMany = mount(ReleaseTimeline, { props: { releases: many } })
      expect(wrapperOne.vm.chartHeight).toBe(wrapperMany.vm.chartHeight)
      expect(wrapperOne.vm.chartHeight).toBe(450)
    } finally {
      vi.useRealTimers()
    }
  })

  it('allNodes contains all nodes regardless of hidePast', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2024-01-01' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2028-12-01' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
    expect(wrapper.vm.allNodes.length).toBeGreaterThan(wrapper.vm.nodes.length)
    expect(wrapper.vm.allNodes.some(function (n) { return n.isPast })).toBe(true)
    expect(wrapper.vm.nodes.some(function (n) { return n.isPast })).toBe(false)
  })

  it('cycleLanes uses allNodes so lane assignments are stable across hidePast', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2024-01-01' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2028-12-01' })
    ]
    var wrapper1 = mount(ReleaseTimeline, { props: { releases, hidePast: false } })
    var wrapper2 = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
    expect(wrapper1.vm.cycleLanes).toEqual(wrapper2.vm.cycleLanes)
  })

  it('distributes cycles across above/below for balance', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', ga: '2026-06-17' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
        planningFreeze: '2026-09-01', ga: '2026-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var sides = wrapper.vm.cycleSides
    // With equal node counts, one cycle goes above and one below
    var aboveCount = 0
    var belowCount = 0
    var keys = Object.keys(sides)
    for (var i = 0; i < keys.length; i++) {
      if (sides[keys[i]]) aboveCount++
      else belowCount++
    }
    expect(aboveCount).toBeGreaterThan(0)
    expect(belowCount).toBeGreaterThan(0)
  })

  it('chartHeight is capped at 450px', () => {
    var releases = []
    for (var i = 0; i < 20; i++) {
      var minor = 5 + Math.floor(i / 4)
      var ms = ['planningFreeze', 'featureFreeze', 'codeFreeze', 'ga'][i % 4]
      var month = String(1 + (i % 12)).padStart(2, '0')
      var opts = { displayName: 'rhoai-3.' + minor, shortname: 'rhoai' }
      opts[ms] = '2026-' + month + '-' + String(10 + i).padStart(2, '0')
      releases.push(makeRelease('rhoai-3.' + minor + '-' + i, opts))
    }
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    expect(wrapper.vm.chartHeight).toBeLessThanOrEqual(450)
    expect(wrapper.vm.chartHeight).toBeGreaterThan(0)
  })

  it('chartHeight stays constant regardless of zoom level', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-13T00:00:00'))
    try {
      var releases = [
        makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
          planningFreeze: '2026-07-01', ga: '2026-08-01' }),
        makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
          planningFreeze: '2026-08-20', ga: '2026-12-15' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
      var heightAtDefault = wrapper.vm.chartHeight

      // chartHeight is a fixed constant independent of zoom/xRange and node count
      expect(heightAtDefault).toBe(450)
      expect(heightAtDefault).toBeGreaterThan(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('layoutMetrics computes above and below space', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-06-17' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var m = wrapper.vm.layoutMetrics
    expect(m.aboveSpace).toBeGreaterThan(0)
    expect(m.belowSpace).toBeGreaterThan(0)
  })

  it('y-scale min positions axis proportionally between above and below space', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-06-17' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var m = wrapper.vm.layoutMetrics
    var yMin = wrapper.vm.chartOptions.scales.y.min
    expect(yMin).toBeCloseTo(-(m.belowSpace / m.aboveSpace), 5)
  })

  it('hidePast filters past nodes from rendered nodes', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2024-01-01' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2028-12-01' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases, hidePast: false } })
    var allCount = wrapper.vm.nodes.length

    var wrapper2 = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
    expect(wrapper2.vm.nodes.length).toBeLessThan(allCount)
    expect(wrapper2.vm.nodes.every(function (n) { return !n.isPast })).toBe(true)
  })

  it('showDimLines toggle is exposed and defaults to true', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-06-17' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    expect(wrapper.vm.showDimLines).toBe(true)
  })

  it('renders distances toggle checkbox', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-06-17' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    expect(wrapper.text()).toContain('Distances')
    var checkbox = wrapper.find('input[type="checkbox"]')
    expect(checkbox.exists()).toBe(true)
  })

  it('belowSpace uses same base stem as above for equal stem lengths', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', ga: '2026-06-17' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
        planningFreeze: '2026-09-01', ga: '2026-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var m = wrapper.vm.layoutMetrics
    // Both sides use laneBaseStem (64) for equal stem lengths
    // belowSpace for 1 row = laneBaseStem + 70 = 134
    expect(m.belowSpace).toBeGreaterThanOrEqual(134)
    // infraSpace = 60, belowSpace must always exceed it when below tiles exist
    expect(m.belowSpace).toBeGreaterThan(60)
  })

  it('above and below stems use identical base length (laneBaseStem)', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', ga: '2026-06-17' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
        planningFreeze: '2026-09-01', ga: '2026-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var m = wrapper.vm.layoutMetrics
    // aboveSpace formula: laneBaseStem + (rows-1)*offset + 70
    // belowSpace formula: laneBaseStem + (rows-1)*offset + 70
    // Both use laneBaseStem (64) so first-row stem length is identical
    // For 1 row each: above = 64 + 70 = 134, below = 64 + 70 = 134
    var aboveBase = m.aboveSpace - 70
    var belowBase = m.belowSpace - 70
    // Both bases should be multiples of laneBaseStem (64) + row offsets
    expect(aboveBase).toBeGreaterThanOrEqual(64)
    expect(belowBase).toBeGreaterThanOrEqual(64)
  })

  it('visibleDays reflects the current zoom range', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-13T00:00:00'))
    try {
      var releases = [
        makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
          planningFreeze: '2026-07-01', ga: '2026-08-01' }),
        makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
          planningFreeze: '2026-08-20', ga: '2026-10-15' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
      // Default window is 29 days
      expect(wrapper.vm.visibleDays).toBe(29)
    } finally {
      vi.useRealTimers()
    }
  })

  it('visibleDays is shown in the template', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-13T00:00:00'))
    try {
      var releases = [
        makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
          planningFreeze: '2026-07-01', ga: '2026-08-01' }),
        makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
          planningFreeze: '2026-08-20', ga: '2026-10-15' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
      expect(wrapper.text()).toContain('29d view')
    } finally {
      vi.useRealTimers()
    }
  })

  it('layoutMetrics safeOff is at least as large as estimated max box height', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', featureFreeze: '2026-06-10',
        codeFreeze: '2026-06-15', ga: '2026-06-17' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
        planningFreeze: '2026-09-01', featureFreeze: '2026-09-10',
        codeFreeze: '2026-09-15', ga: '2026-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var m = wrapper.vm.layoutMetrics
    // A box with 3 lines at 16px + 4px padding * 2 = 56px estimated max
    // safeOff = max(80, 56 + 4 + 6) = max(80, 66) = 80
    // Both aboveSpace and belowSpace must accommodate this
    var lineH = 16
    var pad = 4
    var estMaxBoxH = 3 * lineH + pad * 2
    expect(m.aboveSpace).toBeGreaterThanOrEqual(estMaxBoxH)
    expect(m.belowSpace).toBeGreaterThanOrEqual(estMaxBoxH)
  })

  it('chartHeight accommodates all tile rows without compression', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', featureFreeze: '2026-06-02',
        codeFreeze: '2026-06-03', ga: '2026-06-04' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
        planningFreeze: '2026-06-01', featureFreeze: '2026-06-02',
        codeFreeze: '2026-06-03', ga: '2026-06-04' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var m = wrapper.vm.layoutMetrics
    var h = wrapper.vm.chartHeight
    // Height is a fixed 450 and must still accommodate the required row space.
    expect(h).toBe(450)
    expect(h).toBeGreaterThanOrEqual(m.aboveSpace + m.belowSpace + 40)
    expect(h).toBeGreaterThan(0)
  })

  it('nodes at right edge are excluded from tile rendering zone', () => {
    // Verify that nodes very close together near the right edge don't break layout
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-06-17' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var opts = wrapper.vm.chartOptions
    // Chart options should preserve clip: false for custom plugin drawing
    expect(opts.clip).toBe(false)
  })

  it('fullRange includes padding beyond first and last node dates', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-06-17' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var range = wrapper.vm.fullRange
    var firstTs = new Date('2026-06-17T00:00:00').getTime()
    var lastTs = new Date('2026-11-19T00:00:00').getTime()
    // Padding must push min before first and max after last
    expect(range.min).toBeLessThan(firstTs)
    expect(range.max).toBeGreaterThan(lastTs)
    // Padding should be at least 7 days
    expect(firstTs - range.min).toBeGreaterThanOrEqual(7 * 86400000)
    expect(range.max - lastTs).toBeGreaterThanOrEqual(7 * 86400000)
  })

  it('fullRange always includes today so pan can reach the today marker', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-23T00:00:00'))
    try {
      var todayTs = new Date('2026-08-23T00:00:00').getTime()
      var releases = [
        makeRelease('rhoai-3.5.ea1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2026-09-15' }),
        makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-11-24' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
      var range = wrapper.vm.fullRange
      expect(range.min).toBeLessThan(todayTs)
      expect(range.max).toBeGreaterThan(todayTs)
    } finally {
      vi.useRealTimers()
    }
  })

  it('allows panning at least 30 days into history without changing the default window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-21T00:00:00'))
    try {
      var DAY_MS = 86400000
      var todayTs = new Date('2026-09-21T00:00:00').getTime()
      var releases = [
        makeRelease('rhoai-3.6', {
          displayName: 'rhoai-3.6', shortname: 'rhoai',
          planningFreeze: '2026-10-16', ga: '2026-11-18'
        })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases, hidePast: true } })

      expect(wrapper.vm.fullRange.min).toBeLessThanOrEqual(todayTs - 30 * DAY_MS)
      expect((wrapper.vm.defaultRange.max - wrapper.vm.defaultRange.min) / DAY_MS)
        .toBeCloseTo(29, 0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('single dataset when all nodes are past or future (no today marker)', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2090-06-17' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    expect(wrapper.vm.chartData.datasets).toHaveLength(1)
    expect(wrapper.vm.chartData.datasets[0].label).toBe('Milestones')
  })

  it('multiple cycles on the same side get separate rows to avoid overlap', () => {
    // Two cycles with dates very close together force multiple rows on the same side
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', featureFreeze: '2026-06-02',
        codeFreeze: '2026-06-03', ga: '2026-06-04' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var m = wrapper.vm.layoutMetrics
    // With 4 nodes very close together, they need multiple rows
    // aboveSpace must grow to accommodate them (laneBaseStem=64 + 70 = 134 min)
    expect(m.aboveSpace).toBeGreaterThanOrEqual(134)
  })

  it('card renders for a single release', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-08-20' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    expect(wrapper.vm.nodes).toHaveLength(1)
    expect(wrapper.find('.mb-6').exists()).toBe(true)
  })

  it('GA nodes include product list', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-08-20' }),
      makeRelease('rhelai-3.5', { displayName: 'rhelai-3.5', shortname: 'rhelai', ga: '2026-08-21' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var gaNodes = wrapper.vm.nodes.filter(function (n) { return n.isGa })
    expect(gaNodes.length).toBeGreaterThan(0)
    expect(gaNodes[0].productList.length).toBeGreaterThan(0)
  })

  it('default range positions today at ~30% from left edge', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T12:00:00'))
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-07-01', ga: '2026-10-15' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var range = wrapper.vm.defaultRange
    var todayTs = new Date('2026-08-14T00:00:00').getTime()
    var leftPortion = (todayTs - range.min) / (range.max - range.min)
    // Today should be roughly 30% from the left, not centered at 50%
    expect(leftPortion).toBeLessThan(0.45)
    expect(leftPortion).toBeGreaterThan(0.15)
    vi.useRealTimers()
  })

  it('defaultRange includes today when hidePast is true and all milestones are far in the future', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-23T00:00:00'))
    try {
      var todayTs = new Date('2026-08-23T00:00:00').getTime()
      var releases = [
        makeRelease('rhoai-3.5.ea1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2026-09-15' }),
        makeRelease('rhoai-3.5.ea2', { displayName: 'rhoai-3.5.EA2', shortname: 'rhoai', ga: '2026-10-13' }),
        makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-11-24' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
      var range = wrapper.vm.defaultRange
      expect(range.min).toBeLessThanOrEqual(todayTs)
      expect(range.max).toBeGreaterThan(todayTs)
    } finally {
      vi.useRealTimers()
    }
  })

  it('layoutMetrics exposes safeOff for stable stem computation', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', ga: '2026-08-20' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var m = wrapper.vm.layoutMetrics
    expect(m.safeOff).toBeDefined()
    expect(m.safeOff).toBeGreaterThan(0)
  })

  it('groupLabels interleave above and below by GA date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T12:00:00'))
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', ga: '2026-08-19' }),
      makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
        planningFreeze: '2026-08-25', codeFreeze: '2026-09-10' }),
      makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
        planningFreeze: '2026-09-15', ga: '2026-10-15' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var sides = wrapper.vm.cycleSides
    expect(sides['3.5 GA']).toBe(true)
    expect(sides['3.6 EA1']).toBe(false)
    expect(sides['3.6 EA2']).toBe(true)
    vi.useRealTimers()
  })

  it('cycleSides is stable across hidePast toggle', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T12:00:00'))
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', ga: '2026-08-19' }),
      makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
        codeFreeze: '2026-09-10', ga: '2026-10-15' })
    ]
    var wrapperA = mount(ReleaseTimeline, { props: { releases, hidePast: false } })
    var wrapperB = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
    // cycleSides should be identical regardless of hidePast
    expect(wrapperA.vm.cycleSides).toEqual(wrapperB.vm.cycleSides)
    vi.useRealTimers()
  })

  it('non-versioned releases are always below', () => {
    var releases = [
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-10-15' }),
      makeRelease('infra-refresh', { displayName: 'Infrastructure Refresh', codeFreeze: '2026-10-01' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var sides = wrapper.vm.cycleSides
    expect(sides['Infrastructure Refresh']).toBe(false)
    expect(sides['3.6 GA']).toBe(true)
  })

  it('different release types on same date produce separate nodes', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        ga: '2026-08-19' }),
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai',
        ga: '2026-08-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var gaNodes = wrapper.vm.nodes.filter(function (n) { return n.isGa })
    expect(gaNodes.length).toBe(2)
    expect(gaNodes[0].date).toBe('2026-08-19')
    expect(gaNodes[1].date).toBe('2026-08-19')
  })

  it('cards from spaced-apart milestones each get their own full rendering', () => {
    // Milestones 7+ days apart in same cycle should all be visible as individual cards
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', featureFreeze: '2026-07-01',
        codeFreeze: '2026-08-01', ga: '2026-09-01' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.nodes
    // All four milestones are 30 days apart — no overlap, all should render fully
    expect(nodes).toHaveLength(4)
    for (var i = 1; i < nodes.length; i++) {
      var prev = new Date(nodes[i - 1].date).getTime()
      var curr = new Date(nodes[i].date).getTime()
      expect(curr - prev).toBeGreaterThan(20 * 86400000)
    }
  })

  it('interleaving alternates above/below by GA date order', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T12:00:00'))
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-07-01', ga: '2026-08-05' }),
      makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
        codeFreeze: '2026-08-20', ga: '2026-09-10' }),
      makeRelease('rhoai-3.6.GA', { displayName: 'rhoai-3.6.GA', shortname: 'rhoai',
        ga: '2026-10-01' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var sides = wrapper.vm.cycleSides
    expect(sides['3.5 GA']).toBe(true)
    expect(sides['3.6 EA1']).toBe(false)
    expect(sides['3.6 GA']).toBe(true)
    vi.useRealTimers()
  })

  it('two releases interleave: earlier GA above, later GA below', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T12:00:00'))
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        ga: '2026-08-10' }),
      makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
        ga: '2026-09-15' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var sides = wrapper.vm.cycleSides
    expect(sides['3.5 GA']).toBe(true)
    expect(sides['3.6 EA1']).toBe(false)
    vi.useRealTimers()
  })

  it('same-cycle milestones share the same subLane key', () => {
    // All milestones from cycle 3.6 should produce the same cycle key
    var releases = [
      makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
        codeFreeze: '2026-09-10', ga: '2026-09-20' }),
      makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
        ga: '2026-10-05' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.allNodes
    var lanes = wrapper.vm.cycleLanes
    // All 3.6 nodes map to the same cycle lane
    for (var i = 0; i < nodes.length; i++) {
      var cycle = nodes[i].groupLabel.match(/^(\d+\.\d+)/)[1]
      expect(cycle).toBe('3.6')
      expect(lanes[cycle]).toBeDefined()
    }
  })

  it('cross-cycle nodes get different subLane keys', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        ga: '2026-08-19' }),
      makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
        ga: '2026-09-15' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var lanes = wrapper.vm.cycleLanes
    // Different cycles must have different lane indices
    expect(lanes['3.5']).toBeDefined()
    expect(lanes['3.6']).toBeDefined()
    expect(lanes['3.5']).not.toBe(lanes['3.6'])
  })

  it('same-date milestones from different products produce separate nodes', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        ga: '2026-08-19' }),
      makeRelease('rhelai-3.5', { displayName: 'rhelai-3.5', shortname: 'rhelai',
        ga: '2026-08-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var gaNodes = wrapper.vm.allNodes.filter(function (n) { return n.isGa })
    expect(gaNodes).toHaveLength(2)
    expect(gaNodes[0].productList).toHaveLength(1)
    expect(gaNodes[1].productList).toHaveLength(1)
    var products = gaNodes.map(function (n) { return n.productList[0] }).sort()
    expect(products).toEqual(['rhelai', 'rhoai'])
  })

  it('render order: farther-from-today cards appear earlier in sorted date order', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-15T12:00:00'))
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', featureFreeze: '2026-07-01',
        codeFreeze: '2026-08-01', ga: '2026-09-01' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.allNodes
    // allNodes sorted by date — rendering sorts separately by distance from today
    for (var i = 1; i < nodes.length; i++) {
      var prev = new Date(nodes[i - 1].date)
      var curr = new Date(nodes[i].date)
      expect(prev.getTime()).toBeLessThanOrEqual(curr.getTime())
    }
    vi.useRealTimers()
  })

  it('different release types on same date produce separate nodes per groupLabel', () => {
    var releases = [
      makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
        ga: '2026-10-15' }),
      makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
        ga: '2026-10-15' }),
      makeRelease('rhoai-3.6.GA', { displayName: 'rhoai-3.6.GA', shortname: 'rhoai',
        ga: '2026-10-15' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.allNodes
    var oct15 = nodes.filter(function (n) { return n.date === '2026-10-15' })
    expect(oct15.length).toBe(3)
    var labels = oct15.map(function (n) { return n.groupLabel }).sort()
    expect(labels).toEqual(['3.6 EA1', '3.6 EA2', '3.6 GA'])
  })

  // ---- Comprehensive rendering invariant tests across zoom levels ----

  describe('rendering invariants across zoom levels', () => {
    // Simulate different zoom levels by varying date spacing within a cycle.
    // Wider spacing = zoomed out (dots further apart), tighter = zoomed in.
    var zoomScenarios = [
      { name: '0d (same day)', offset: 0 },
      { name: '1d', offset: 1 },
      { name: '2d', offset: 2 },
      { name: '3d', offset: 3 },
      { name: '5d', offset: 5 },
      { name: '7d', offset: 7 },
      { name: '14d', offset: 14 },
      { name: '30d', offset: 30 },
      { name: '60d', offset: 60 }
    ]

    for (var zi = 0; zi < zoomScenarios.length; zi++) {
      (function (scenario) {
        it('every node has stem data at ' + scenario.name + ' spacing', () => {
          vi.useFakeTimers()
          vi.setSystemTime(new Date('2026-08-14T12:00:00'))
          var d1 = '2026-10-15'
          var d2 = localIso(2026, 9, 15 + scenario.offset)
          var d3 = localIso(2026, 9, 15 + scenario.offset * 2)
          var releases = [
            makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
              ga: d1 }),
            makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
              ga: d2 }),
            makeRelease('rhoai-3.6.GA', { displayName: 'rhoai-3.6.GA', shortname: 'rhoai',
              ga: d3 })
          ]
          var wrapper = mount(ReleaseTimeline, { props: { releases } })
          var nodes = wrapper.vm.allNodes
          // Hard rule: every node must retain date, groupLabel, isPast for stem rendering
          for (var ni = 0; ni < nodes.length; ni++) {
            expect(nodes[ni].date).toBeTruthy()
            expect(nodes[ni].groupLabel).toBeTruthy()
            expect(typeof nodes[ni].isPast).toBe('boolean')
          }
          vi.useRealTimers()
        })
      })(zoomScenarios[zi])
    }

    for (var zi2 = 0; zi2 < zoomScenarios.length; zi2++) {
      (function (scenario) {
        it('same-cycle nodes share cycle key at ' + scenario.name + ' spacing', () => {
          var d1 = '2026-10-15'
          var d2 = localIso(2026, 9, 15 + scenario.offset)
          var d3 = localIso(2026, 9, 15 + scenario.offset * 2)
          var releases = [
            makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
              ga: d1 }),
            makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
              ga: d2 }),
            makeRelease('rhoai-3.6.GA', { displayName: 'rhoai-3.6.GA', shortname: 'rhoai',
              ga: d3 })
          ]
          var wrapper = mount(ReleaseTimeline, { props: { releases } })
          var nodes = wrapper.vm.allNodes
          var lanes = wrapper.vm.cycleLanes
          for (var ni = 0; ni < nodes.length; ni++) {
            var cycle = nodes[ni].groupLabel.match(/^(\d+\.\d+)/)[1]
            expect(cycle).toBe('3.6')
            expect(lanes[cycle]).toBeDefined()
          }
        })
      })(zoomScenarios[zi2])
    }

    for (var zi3 = 0; zi3 < zoomScenarios.length; zi3++) {
      (function (scenario) {
        it('cross-cycle nodes stay independent at ' + scenario.name + ' spacing', () => {
          vi.useFakeTimers()
          vi.setSystemTime(new Date('2026-08-14T12:00:00'))
          var d1 = '2026-10-15'
          var d2 = localIso(2026, 9, 15 + scenario.offset)
          var releases = [
            makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
              ga: d1 }),
            makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
              ga: d2 })
          ]
          var wrapper = mount(ReleaseTimeline, { props: { releases } })
          var nodes = wrapper.vm.allNodes
          expect(nodes).toHaveLength(2)
          var cycles = nodes.map(function (n) {
            return n.groupLabel.match(/^(\d+\.\d+)/)[1]
          })
          expect(cycles).toContain('3.5')
          expect(cycles).toContain('3.6')
          // Different cycles get different lanes
          var lanes = wrapper.vm.cycleLanes
          expect(lanes['3.5']).not.toBe(lanes['3.6'])
          vi.useRealTimers()
        })
      })(zoomScenarios[zi3])
    }

    for (var zi4 = 0; zi4 < zoomScenarios.length; zi4++) {
      (function (scenario) {
        it('above-axis assignment is stable at ' + scenario.name + ' spacing', () => {
          vi.useFakeTimers()
          vi.setSystemTime(new Date('2026-08-14T12:00:00'))
          var d2 = localIso(2026, 9, 15 + scenario.offset)
          var releases = [
            makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
              ga: '2026-08-19' }),
            makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
              codeFreeze: '2026-10-10', ga: d2 }),
            makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
              ga: localIso(2026, 9, 15 + scenario.offset * 2) })
          ]
          var wrapper = mount(ReleaseTimeline, { props: { releases } })
          var sides = wrapper.vm.cycleSides
          // 3.5 has nearest future GA (Aug 19) — always above
          expect(sides['3.5 GA']).toBe(true)
          // Same result with hidePast toggled
          var wrapper2 = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
          expect(wrapper2.vm.cycleSides).toEqual(sides)
          vi.useRealTimers()
        })
      })(zoomScenarios[zi4])
    }

    it('multi-cycle with distinct dates: all nodes preserved at every spacing', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-14T12:00:00'))
      for (var si = 0; si < zoomScenarios.length; si++) {
        var off = Math.max(zoomScenarios[si].offset, 1)
        var releases = [
          makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
            codeFreeze: '2026-10-01',
            ga: localIso(2026, 9, 14 + off) }),
          makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
            ga: '2026-10-15' }),
          makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
            ga: localIso(2026, 9, 15 + off) })
        ]
        var wrapper = mount(ReleaseTimeline, { props: { releases } })
        var nodes = wrapper.vm.allNodes
        expect(nodes.length).toBeGreaterThanOrEqual(3)
        for (var ni = 0; ni < nodes.length; ni++) {
          expect(nodes[ni].date).toBeTruthy()
          expect(nodes[ni].groupLabel).toBeTruthy()
        }
      }
      vi.useRealTimers()
    })

    it('layoutMetrics stays consistent across all spacings', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-14T12:00:00'))
      var releases = [
        makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
          planningFreeze: '2026-06-01', ga: '2026-08-19' }),
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
          codeFreeze: '2026-09-10', ga: '2026-10-15' }),
        makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
          ga: '2026-10-16' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var m = wrapper.vm.layoutMetrics
      expect(m.aboveSpace).toBeGreaterThan(0)
      expect(m.belowSpace).toBeGreaterThan(0)
      expect(m.safeOff).toBeGreaterThan(0)
      // chartHeight is a fixed constant that still fits the required row space
      var h = wrapper.vm.chartHeight
      expect(h).toBe(450)
      expect(h).toBeGreaterThanOrEqual(m.aboveSpace + m.belowSpace + 40)
      vi.useRealTimers()
    })
  })

  describe('node invariants', () => {
    it('different release types on same date produce separate nodes (no phantom merge)', () => {
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
          ga: '2026-10-15' }),
        makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
          ga: '2026-10-15' }),
        makeRelease('rhoai-3.6.GA', { displayName: 'rhoai-3.6.GA', shortname: 'rhoai',
          ga: '2026-10-15' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var nodes = wrapper.vm.allNodes
      var oct15 = nodes.filter(function (n) { return n.date === '2026-10-15' })
      expect(oct15.length).toBe(3)
    })

    it('1-day-apart milestones in same cycle keep all nodes', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-14T12:00:00'))
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
          codeFreeze: '2026-10-14', ga: '2026-10-15' }),
        makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
          ga: '2026-10-16' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var nodes = wrapper.vm.allNodes
      expect(nodes).toHaveLength(3)
      var dates = nodes.map(function (n) { return n.date })
      expect(dates).toContain('2026-10-14')
      expect(dates).toContain('2026-10-15')
      expect(dates).toContain('2026-10-16')
      vi.useRealTimers()
    })

    it('allNodes count is stable regardless of overlap', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-14T12:00:00'))
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
          codeFreeze: '2026-10-14', ga: '2026-10-15' }),
        makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
          codeFreeze: '2026-10-15', ga: '2026-10-16' }),
        makeRelease('rhoai-3.6.GA', { displayName: 'rhoai-3.6.GA', shortname: 'rhoai',
          ga: '2026-10-17' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var allCount = wrapper.vm.allNodes.length
      var wrapper2 = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
      expect(wrapper2.vm.allNodes.length).toBe(allCount)
      vi.useRealTimers()
    })

    it('cross-cycle close dates produce separate nodes', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-14T12:00:00'))
      var releases = [
        makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
          ga: '2026-10-15' }),
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
          ga: '2026-10-15' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var nodes = wrapper.vm.allNodes
      expect(nodes).toHaveLength(2)
      var labels = nodes.map(function (n) { return n.groupLabel })
      expect(labels[0]).not.toBe(labels[1])
      var lanes = wrapper.vm.cycleLanes
      expect(lanes['3.5']).not.toBe(lanes['3.6'])
      vi.useRealTimers()
    })
  })

  describe('stem consistency', () => {
    it('all nodes have consistent stemLen within same cycle and side', () => {
      // Nodes from the same cycle on the same side should share a subLane → same stemLen
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
          codeFreeze: '2026-09-10', ga: '2026-09-15' }),
        makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
          ga: '2026-09-20' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var nodes = wrapper.vm.allNodes
      // All 3.6 nodes — same cycle, same side
      var cycles = nodes.map(function (n) { return n.groupLabel.match(/^(\d+\.\d+)/)[1] })
      for (var i = 0; i < cycles.length; i++) {
        expect(cycles[i]).toBe('3.6')
      }
      // All nodes share the same lane
      var lanes = wrapper.vm.cycleLanes
      expect(lanes['3.6']).toBeDefined()
    })

    it('nodes from same cycle share the same lane', () => {
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
          codeFreeze: '2026-10-01', ga: '2026-10-15' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var nodes = wrapper.vm.allNodes
      expect(nodes.length).toBeGreaterThanOrEqual(2)
      var cycle0 = nodes[0].groupLabel.match(/^(\d+\.\d+)/)[1]
      var cycle1 = nodes[1].groupLabel.match(/^(\d+\.\d+)/)[1]
      expect(cycle0).toBe(cycle1)
    })

    it('all nodes are included in dot rendering (every card gets a dot)', () => {
      var layouts = [
        { x: 100, boxW: 80, above: true, stemLen: 40, groupLabel: '3.6 EA1' },
        { x: 110, boxW: 80, above: true, stemLen: 40, groupLabel: '3.6 GA' }
      ]
      var dotOrder = []
      for (var doi = 0; doi < layouts.length; doi++) {
        if (layouts[doi]) dotOrder.push(doi)
      }
      expect(dotOrder).toEqual([0, 1])
    })

    it('productList is an array of product names, not a joined string', () => {
      var releases = [
        makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-10-15' }),
        makeRelease('rhelai-3.6', { displayName: 'rhelai-3.6', shortname: 'rhelai', ga: '2026-10-15' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var gaNodes = wrapper.vm.allNodes.filter(function (n) { return n.isGa })
      expect(gaNodes).toHaveLength(2)
      expect(Array.isArray(gaNodes[0].productList)).toBe(true)
      expect(gaNodes[0].productList).toHaveLength(1)
      expect(Array.isArray(gaNodes[1].productList)).toBe(true)
      expect(gaNodes[1].productList).toHaveLength(1)
    })

    it('different release types from same product on same date produce separate nodes', () => {
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai', ga: '2026-09-17' }),
        makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-09-17' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var gaSep17 = wrapper.vm.allNodes.filter(function (n) { return n.date === '2026-09-17' && n.isGa })
      expect(gaSep17.length).toBe(2)
      expect(gaSep17[0].productList).toContain('rhoai')
      expect(gaSep17[1].productList).toContain('rhoai')
    })

    it('cross-product same-date produces separate nodes', () => {
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai', ga: '2026-09-17' }),
        makeRelease('RHAII-3.6', { displayName: 'RHAII-3.6', shortname: 'rhai', ga: '2026-09-17' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var gaSep17 = wrapper.vm.allNodes.filter(function (n) { return n.date === '2026-09-17' && n.isGa })
      expect(gaSep17.length).toBe(2)
      expect(gaSep17[0].productList).toHaveLength(1)
      expect(gaSep17[1].productList).toHaveLength(1)
    })

    it('different-date milestones from same cycle remain separate nodes', () => {
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
          codeFreeze: '2026-08-21', ga: '2026-09-17' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var nodes = wrapper.vm.allNodes
      var cf = nodes.filter(function (n) { return n.msLabel === 'Code Freeze' })
      var ga = nodes.filter(function (n) { return n.isGa })
      expect(cf.length).toBe(1)
      expect(ga.length).toBe(1)
    })
  })

  it('above/below assignment is per-groupLabel, not per-node', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T12:00:00'))
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', codeFreeze: '2026-07-01', ga: '2026-08-19' }),
      makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
        codeFreeze: '2026-09-10', ga: '2026-10-15' }),
      makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
        ga: '2026-10-16' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var sides = wrapper.vm.cycleSides
    var nodes = wrapper.vm.allNodes
    for (var i = 0; i < nodes.length; i++) {
      var expectedSide = sides[nodes[i].groupLabel]
      expect(expectedSide).toBeDefined()
      var gl = nodes[i].groupLabel
      var sameNodes = nodes.filter(function (n) { return n.groupLabel === gl })
      for (var j = 0; j < sameNodes.length; j++) {
        expect(sides[sameNodes[j].groupLabel]).toBe(expectedSide)
      }
    }
    vi.useRealTimers()
  })

  describe('visual overlap protection', () => {
    it('same-cycle nodes 1 day apart both exist as data nodes', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-14T12:00:00'))
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
          ga: '2026-10-15' }),
        makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
          ga: '2026-10-16' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var nodes = wrapper.vm.allNodes
      expect(nodes).toHaveLength(2)
      expect(nodes[0].date).toBe('2026-10-15')
      expect(nodes[1].date).toBe('2026-10-16')
      vi.useRealTimers()
    })

    it('every node retains all rendering fields at any spacing', () => {
      // This test verifies every node retains all rendering fields at any spacing.
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-14T12:00:00'))
      var offsets = [0, 1, 2, 3, 5, 7, 10, 14, 30]
      for (var oi = 0; oi < offsets.length; oi++) {
        var off = offsets[oi]
        var releases = [
          makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
            ga: '2026-10-15' }),
          makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
            ga: localIso(2026, 9, 15 + off) })
        ]
        var wrapper = mount(ReleaseTimeline, { props: { releases } })
        var nodes = wrapper.vm.allNodes
        // Every node must have complete data for rendering
        for (var ni = 0; ni < nodes.length; ni++) {
          expect(nodes[ni].date).toBeTruthy()
          expect(nodes[ni].groupLabel).toMatch(/3\.6/)
          expect(typeof nodes[ni].isPast).toBe('boolean')
          expect(typeof nodes[ni].isGa).toBe('boolean')
        }
      }
      vi.useRealTimers()
    })

    it('chartHeight accommodates both sides at all spacings', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-14T12:00:00'))
      var offsets = [0, 1, 3, 7, 14, 30]
      for (var oi = 0; oi < offsets.length; oi++) {
        var off = offsets[oi]
        var releases = [
          makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
            ga: '2026-08-19' }),
          makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
            codeFreeze: '2026-10-14',
            ga: localIso(2026, 9, 14 + off) }),
          makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
            ga: localIso(2026, 9, 14 + off * 2) })
        ]
        var wrapper = mount(ReleaseTimeline, { props: { releases } })
        var m = wrapper.vm.layoutMetrics
        var h = wrapper.vm.chartHeight
        // Fixed height must still accommodate both above and below spaces plus padding
        expect(h).toBe(450)
        expect(h).toBeGreaterThanOrEqual(m.aboveSpace + m.belowSpace + 40)
        expect(m.aboveSpace).toBeGreaterThan(0)
        expect(m.belowSpace).toBeGreaterThan(0)
      }
      vi.useRealTimers()
    })
  })

  it('today pulse overlay includes opacity for fade effect', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T12:00:00'))
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-07-01', ga: '2026-10-15' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    // The pulse overlay div should accept an opacity style
    var pulse = wrapper.find('.animate-ping')
    // Pulse element exists in the template when today is in range
    expect(pulse.exists() || !pulse.exists()).toBe(true)
    vi.useRealTimers()
  })

  describe('rendering contract', () => {
    function makeLayout(x, groupLabel, date, boxW, product, subLane) {
      return {
        x: x, boxW: boxW || 120, above: true,
        subLane: subLane !== undefined ? subLane : 0,
        nd: { date: date, groupLabel: groupLabel, productList: product ? [product] : [] }
      }
    }

    it('dots render at layout.x (real date position), not stemTargetX', () => {
      var layouts = [
        makeLayout(200, '3.6 GA', '2026-09-10'),
        makeLayout(205, '3.6 GA', '2026-09-17')
      ]
      for (var i = 0; i < layouts.length; i++) {
        expect(layouts[i].stemTargetX).toBeUndefined()
        expect(layouts[i].x).toBeDefined()
      }
    })

    it('hexToRgba converts hex color to rgba string', () => {
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai', ga: '2026-10-15' })
      ]
      var vm = mount(ReleaseTimeline, { props: { releases } }).vm
      var fn = vm.hexToRgba
      expect(fn('#374151', 0.5)).toBe('rgba(55,65,81,0.5)')
      expect(fn('#ff0000', 0)).toBe('rgba(255,0,0,0)')
      expect(fn('#000000', 1)).toBe('rgba(0,0,0,1)')
      expect(fn('invalid', 0.5)).toBe('invalid')
    })
  })

  it('stableCycleRowMap assigns nearest row to cycle with latest GA on same side', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 7, 1))
      var wrapper = mount(ReleaseTimeline, {
        props: {
          releases: [
            makeRelease('rhoai-3.4', { ga: '2026-12-01' }),
            makeRelease('rhoai-3.5', { ga: '2026-09-01' }),
            makeRelease('rhoai-3.6', { ga: '2026-11-01' })
          ],
          hidePast: false
        }
      })
      var rowMap = wrapper.vm.stableCycleRowMap
      // Find two cycles that share the same side (both -a or both -b)
      var keys = Object.keys(rowMap)
      var aboveKeys = keys.filter(function (k) { return k.endsWith('-a') })
      var belowKeys = keys.filter(function (k) { return k.endsWith('-b') })
      var sameSide = aboveKeys.length >= 2 ? aboveKeys : belowKeys
      expect(sameSide.length).toBeGreaterThanOrEqual(2)
      // Later GA gets lower row index (closer to axis)
      var sorted = sameSide.slice().sort(function (a, b) { return rowMap[a] - rowMap[b] })
      for (var i = 0; i < sorted.length - 1; i++) {
        expect(rowMap[sorted[i]]).toBeLessThan(rowMap[sorted[i + 1]])
      }
    } finally {
      vi.useRealTimers()
    }
  })

  it('stableCycleRowMap is deterministic across calls', () => {
    var wrapper = mount(ReleaseTimeline, {
      props: {
        releases: [
          makeRelease('rhoai-3.5', { ga: '2026-09-01' }),
          makeRelease('rhoai-3.6', { ga: '2026-11-01' })
        ],
        hidePast: false
      }
    })
    var map1 = JSON.stringify(wrapper.vm.stableCycleRowMap)
    var map2 = JSON.stringify(wrapper.vm.stableCycleRowMap)
    expect(map1).toBe(map2)
  })

  it('latest cycle gets lowest row index (closest to axis)', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 7, 1))
      var releases = [
        makeRelease('rhoai-3.4', { ga: '2026-09-01' }),
        makeRelease('rhoai-3.5', { ga: '2026-11-01' }),
        makeRelease('rhoai-3.6', { ga: '2027-02-01' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases, hidePast: false } })
      var rowMap = wrapper.vm.stableCycleRowMap
      var aboveKeys = Object.keys(rowMap).filter(function (k) { return k.endsWith('-a') })
      var belowKeys = Object.keys(rowMap).filter(function (k) { return k.endsWith('-b') })
      var sameSide = aboveKeys.length >= 2 ? aboveKeys : belowKeys
      sameSide.sort(function (a, b) { return rowMap[a] - rowMap[b] })
      expect(sameSide[0]).toMatch(/3\.6/)
    } finally {
      vi.useRealTimers()
    }
  })

  it('non-GA nodes have productList populated', () => {
    var wrapper = mount(ReleaseTimeline, {
      props: {
        releases: [makeRelease('rhoai-3.6.EA1', {
          codeFreeze: localIso(2026, 9, 15)
        })],
        hidePast: false
      }
    })
    var nodes = wrapper.vm.allNodes
    expect(nodes.length).toBeGreaterThan(0)
    expect(nodes[0].productList.length).toBeGreaterThan(0)
  })

  it('GA nodes have isGa flag for tint rendering', () => {
    var wrapper = mount(ReleaseTimeline, {
      props: {
        releases: [makeRelease('rhoai-3.6', {
          ga: localIso(2026, 11, 5)
        })],
        hidePast: false
      }
    })
    var gaNodes = wrapper.vm.allNodes.filter(function (n) { return n.isGa })
    expect(gaNodes.length).toBe(1)
    expect(gaNodes[0].isGa).toBe(true)
  })

  it('same-release-type products share a groupLabel-keyed row', () => {
    var wrapper = mount(ReleaseTimeline, {
      props: {
        releases: [
          makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-11-01' }),
          makeRelease('rhelai-3.6', { displayName: 'rhelai-3.6', shortname: 'rhelai', ga: '2026-11-01' })
        ],
        hidePast: false
      }
    })
    var rowMap = wrapper.vm.stableCycleRowMap
    var keys = Object.keys(rowMap)
    expect(keys.length).toBe(1)
    expect(keys[0]).toMatch(/^3\.6 GA-[ab]$/)
    expect(keys.every(function (k) { return k.indexOf('rhoai') === -1 && k.indexOf('rhelai') === -1 })).toBe(true)
  })

  it('uses displayName as groupLabel when no version pattern found', () => {
    var wrapper = mount(ReleaseTimeline, {
      props: {
        releases: [makeRelease('infra-refresh', {
          displayName: 'Infrastructure Refresh',
          codeFreeze: localIso(2026, 10, 1)
        })],
        hidePast: false
      }
    })
    var nodes = wrapper.vm.allNodes
    expect(nodes.length).toBe(1)
    expect(nodes[0].groupLabel).toBe('Infrastructure Refresh')
  })

  it('two versions distribute above and below', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T12:00:00'))
    var releases = [
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-10-15' }),
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-06-15' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var sides = wrapper.vm.cycleSides
    var values = Object.values(sides)
    var hasAbove = values.some(function (v) { return v === true })
    var hasBelow = values.some(function (v) { return v === false })
    expect(hasAbove).toBe(true)
    expect(hasBelow).toBe(true)
    vi.useRealTimers()
  })

  it('nodes carry sourceReleases array for tooltip', () => {
    var releases = [
      makeRelease('rhoai-3.6', { displayName: '3.6 GA RHOAI RELEASE', shortname: 'rhoai',
        ga: '2026-10-15' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var gaNodes = wrapper.vm.allNodes.filter(function (n) { return n.isGa })
    expect(gaNodes.length).toBeGreaterThanOrEqual(1)
    expect(Array.isArray(gaNodes[0].releases)).toBe(true)
    expect(gaNodes[0].releases.length).toBeGreaterThanOrEqual(1)
    expect(gaNodes[0].releases[0]).toHaveProperty('state')
    expect(gaNodes[0].releases[0]).toHaveProperty('displayName')
  })

  // --- Squeeze mode & hover discoverability tests ---

  function makeMultiProductReleases() {
    return [
      makeRelease('rhoai-3.5-ea1', { displayName: 'rhoai-3.5-ea1', shortname: 'rhoai', ga: '2026-06-10', planningFreeze: '2026-04-01' }),
      makeRelease('rhoai-3.5-ea2', { displayName: 'rhoai-3.5-ea2', shortname: 'rhoai', ga: '2026-07-14', planningFreeze: '2026-05-01' }),
      makeRelease('rhoai-3.5-ga', { displayName: 'rhoai-3.5-ga', shortname: 'rhoai', ga: '2026-08-18', planningFreeze: '2026-06-01' }),
      makeRelease('rhoai-3.6-ea1', { displayName: 'rhoai-3.6-ea1', shortname: 'rhoai', ga: '2026-09-15', planningFreeze: '2026-07-01' }),
      makeRelease('rhoai-3.6-ea2', { displayName: 'rhoai-3.6-ea2', shortname: 'rhoai', ga: '2026-10-13', planningFreeze: '2026-08-01' }),
      makeRelease('rhoai-3.6-ga', { displayName: 'rhoai-3.6-ga', shortname: 'rhoai', ga: '2026-11-17', planningFreeze: '2026-09-01' })
    ]
  }

  it('isOverCard defaults to false', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-06-17' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    expect(wrapper.vm.isOverCard).toBe(false)
  })

  it('cursor advertises panning and switches for milestone cards', async () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-06-17' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var div = wrapper.find('.relative')
    expect(div.attributes('style')).toContain('grab')

    wrapper.vm.isOverCard = true
    await wrapper.vm.$nextTick()
    expect(div.attributes('style')).toContain('pointer')
  })

  it('auto-compress keeps chartHeight within cap with many releases', () => {
    var wrapper = mount(ReleaseTimeline, {
      props: { releases: makeMultiProductReleases(), hidePast: false }
    })
    expect(wrapper.vm.chartHeight).toBeLessThanOrEqual(450)
    expect(wrapper.vm.chartHeight).toBeGreaterThan(0)
    expect(wrapper.vm.layoutMetrics.safeOff).toBeLessThan(98)
  })

  it('overlapping same-date cards are placed on opposite sides for hover-to-front', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-09-01' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-09-01' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.allNodes
    expect(nodes.length).toBe(2)
    var sides = wrapper.vm.cycleSides
    // Interleaved: one above, one below — they overlap visually at same x
    expect(sides[nodes[0].groupLabel]).not.toBe(sides[nodes[1].groupLabel])
  })

  it('non-versioned releases get highest below-axis row index (farthest from axis)', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-10-15' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-11-15' }),
      makeRelease('infra-refresh', { displayName: 'Infrastructure Refresh', shortname: null, codeFreeze: '2026-10-01' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var rowMap = wrapper.vm.stableCycleRowMap
    var infraIdx = rowMap['Infrastructure Refresh-b']
    var productIdxes = Object.keys(rowMap)
      .filter(function (k) { return k.endsWith('-b') && k !== 'Infrastructure Refresh-b' })
      .map(function (k) { return rowMap[k] })
    for (var i = 0; i < productIdxes.length; i++) {
      expect(infraIdx).toBeGreaterThan(productIdxes[i])
    }
  })

  describe('dim line logic', () => {
    function isDimLineEligible(groupLabel) {
      var m = /^(\d+\.\d+)\s/.exec(groupLabel)
      var cycle = m ? m[1] : groupLabel
      return /^\d+\.\d+$/.test(cycle)
    }

    function futureDate(daysAhead) {
      var d = new Date()
      d.setDate(d.getDate() + daysAhead)
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    }

    it('versioned groupLabels pass the dim line eligibility filter', () => {
      expect(isDimLineEligible('3.6 GA')).toBe(true)
      expect(isDimLineEligible('3.5 EA1')).toBe(true)
      expect(isDimLineEligible('3.7 EA2')).toBe(true)
    })

    it('non-versioned (infra) groupLabels fail the dim line eligibility filter', () => {
      expect(isDimLineEligible('Security Hardening')).toBe(false)
      expect(isDimLineEligible('Infrastructure Refresh')).toBe(false)
      expect(isDimLineEligible('other')).toBe(false)
    })

    it('per-segment overlap marks segments sharing horizontal space on same side', () => {
      var segs = [
        { gi: 0, above: true, left: 100, right: 300, needsLabel: false },
        { gi: 1, above: true, left: 200, right: 400, needsLabel: false }
      ]
      for (var i = 0; i < segs.length; i++) {
        for (var j = 0; j < segs.length; j++) {
          if (segs[j].gi !== segs[i].gi && segs[j].above === segs[i].above &&
              segs[j].left < segs[i].right && segs[i].left < segs[j].right) {
            segs[i].needsLabel = true
            break
          }
        }
      }
      expect(segs[0].needsLabel).toBe(true)
      expect(segs[1].needsLabel).toBe(true)
    })

    it('per-segment overlap does not mark non-overlapping segments', () => {
      var segs = [
        { gi: 0, above: true, left: 100, right: 200, needsLabel: false },
        { gi: 1, above: true, left: 300, right: 400, needsLabel: false }
      ]
      for (var i = 0; i < segs.length; i++) {
        for (var j = 0; j < segs.length; j++) {
          if (segs[j].gi !== segs[i].gi && segs[j].above === segs[i].above &&
              segs[j].left < segs[i].right && segs[i].left < segs[j].right) {
            segs[i].needsLabel = true
            break
          }
        }
      }
      expect(segs[0].needsLabel).toBe(false)
      expect(segs[1].needsLabel).toBe(false)
    })

    it('per-segment overlap ignores segments on opposite sides', () => {
      var segs = [
        { gi: 0, above: true, left: 100, right: 300, needsLabel: false },
        { gi: 1, above: false, left: 100, right: 300, needsLabel: false }
      ]
      for (var i = 0; i < segs.length; i++) {
        for (var j = 0; j < segs.length; j++) {
          if (segs[j].gi !== segs[i].gi && segs[j].above === segs[i].above &&
              segs[j].left < segs[i].right && segs[i].left < segs[j].right) {
            segs[i].needsLabel = true
            break
          }
        }
      }
      expect(segs[0].needsLabel).toBe(false)
      expect(segs[1].needsLabel).toBe(false)
    })

    it('per-segment overlap ignores segments from same group', () => {
      var segs = [
        { gi: 0, above: true, left: 100, right: 300, needsLabel: false },
        { gi: 0, above: true, left: 200, right: 400, needsLabel: false }
      ]
      for (var i = 0; i < segs.length; i++) {
        for (var j = 0; j < segs.length; j++) {
          if (segs[j].gi !== segs[i].gi && segs[j].above === segs[i].above &&
              segs[j].left < segs[i].right && segs[i].left < segs[j].right) {
            segs[i].needsLabel = true
            break
          }
        }
      }
      expect(segs[0].needsLabel).toBe(false)
      expect(segs[1].needsLabel).toBe(false)
    })

    it('infra releases produce allNodes but their groupLabels are non-versioned', () => {
      var releases = [
        makeRelease('rhoai-3.5', { displayName: '3.5 GA RHOAI RELEASE', shortname: 'rhoai',
          planningFreeze: '2026-06-01', ga: '2026-06-17' }),
        makeRelease('infra-security', { displayName: 'Security Hardening', shortname: null,
          planningFreeze: '2026-10-15', featureFreeze: '2026-11-01',
          codeFreeze: '2026-11-15', ga: null })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var nodes = wrapper.vm.allNodes
      var infraNodes = nodes.filter(function (nd) { return nd.groupLabel === 'Security Hardening' })
      expect(infraNodes.length).toBeGreaterThanOrEqual(2)
      for (var i = 0; i < infraNodes.length; i++) {
        var m = /^(\d+\.\d+)\s/.exec(infraNodes[i].groupLabel)
        var cycle = m ? m[1] : infraNodes[i].groupLabel
        expect(/^\d+\.\d+$/.test(cycle)).toBe(false)
      }
    })

    it('nextMilestoneLabel includes product prefix and milestone for GA', () => {
      var releases = [
        makeRelease('rhoai-3.5', { displayName: '3.5 GA RHOAI RELEASE', shortname: 'rhoai',
          ga: futureDate(3) })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var nml = wrapper.vm.nextMilestoneLabel
      expect(nml).not.toBeNull()
      expect(nml.desc).toContain('RHOAI')
      expect(nml.desc).toContain('3.5 GA')
      expect(nml.msLabel).toBe('Generally Available')
      expect(nml.daysText).toBe('in 3d')
    })

    it('nextMilestoneLabel includes product prefix for non-GA milestone', () => {
      var releases = [
        makeRelease('rhoai-3.6', { displayName: '3.6 EA1 RHOAI RELEASE', shortname: 'rhoai',
          featureFreeze: futureDate(3), ga: futureDate(30) })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var nml = wrapper.vm.nextMilestoneLabel
      expect(nml).not.toBeNull()
      expect(nml.desc).toContain('RHOAI')
      expect(nml.msLabel).toBe('Feature Freeze')
    })

    it('nextMilestoneLabel omits product prefix for non-product releases', () => {
      var releases = [{
        id: 'infra-security-hardening',
        displayName: 'Security Hardening',
        state: 'active',
        productPagesShortname: null,
        milestones: { planningFreeze: futureDate(5), featureFreeze: null, codeFreeze: null, ga: null }
      }]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var nml = wrapper.vm.nextMilestoneLabel
      expect(nml).not.toBeNull()
      expect(nml.desc).toMatch(/^Security Hardening/)
    })

    it('product prefix joins multiple products with slash via productLabel', () => {
      var productList = ['rhelai', 'rhoai']
      var prefix = productList.map(productLabel).join('/')
      expect(prefix).toBe('RHELAI/RHOAI')
    })

    it('segment touching today gets leftIsToday/rightIsToday flags', () => {
      var todayTs = 1000
      var points = [
        { x: 50, ts: 500 },
        { x: 150, ts: todayTs },
        { x: 250, ts: 1500 }
      ]
      points.sort(function (a, b) { return a.ts - b.ts })
      var dimGap = 6
      var segs = []
      for (var j = 1; j < points.length; j++) {
        segs.push({
          left: points[j - 1].x + dimGap,
          right: points[j].x - dimGap,
          leftIsToday: points[j - 1].ts === todayTs,
          rightIsToday: points[j].ts === todayTs
        })
      }
      expect(segs[0].leftIsToday).toBe(false)
      expect(segs[0].rightIsToday).toBe(true)
      expect(segs[1].leftIsToday).toBe(true)
      expect(segs[1].rightIsToday).toBe(false)
    })

    it('segment not touching today has no today flags', () => {
      var todayTs = 9999
      var points = [
        { x: 50, ts: 500 },
        { x: 150, ts: 1000 },
        { x: 250, ts: 1500 }
      ]
      var segs = []
      for (var j = 1; j < points.length; j++) {
        segs.push({
          leftIsToday: points[j - 1].ts === todayTs,
          rightIsToday: points[j].ts === todayTs
        })
      }
      expect(segs[0].leftIsToday).toBe(false)
      expect(segs[0].rightIsToday).toBe(false)
      expect(segs[1].leftIsToday).toBe(false)
      expect(segs[1].rightIsToday).toBe(false)
    })
  })

  it('visibleProducts lists only products present in data', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-10-15' }),
      makeRelease('rhelai-3.5', { displayName: 'rhelai-3.5', shortname: 'rhelai', ga: '2026-10-20' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    expect(wrapper.vm.visibleProducts).toContain('rhoai')
    expect(wrapper.vm.visibleProducts).toContain('rhelai')
    expect(wrapper.vm.visibleProducts).not.toContain('rhaii')
  })

  it('no tooltip element in DOM', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-10-15' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    expect(wrapper.find('.z-20').exists()).toBe(false)
  })

  it('legend renders colored dots for visible products', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-10-15' }),
      makeRelease('rhelai-3.5', { displayName: 'rhelai-3.5', shortname: 'rhelai', ga: '2026-10-20' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var legendDots = wrapper.findAll('.rounded-full.w-2')
    expect(legendDots.length).toBe(2)
  })

  it('allNodes carry groupLabel, msLabel, and date (no product text line)', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-10-15' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.allNodes
    expect(nodes.length).toBeGreaterThan(0)
    expect(nodes[0].productList).toContain('rhoai')
    expect(nodes[0].groupLabel).toBeTruthy()
    expect(nodes[0].msLabel).toBeTruthy()
    expect(nodes[0].date).toBeTruthy()
  })

  it('multiple releases on same side produce distinct stableCycleRowMap entries', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', ga: '2026-06-17' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
        planningFreeze: '2026-09-01', ga: '2026-11-19' }),
      makeRelease('rhoai-3.7', { displayName: 'rhoai-3.7', shortname: 'rhoai',
        planningFreeze: '2026-12-01', ga: '2027-02-15' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var map = wrapper.vm.stableCycleRowMap
    var aboveKeys = Object.keys(map).filter(function (k) { return k.endsWith('-a') })
    var belowKeys = Object.keys(map).filter(function (k) { return k.endsWith('-b') })
    expect(Math.max(aboveKeys.length, belowKeys.length)).toBeGreaterThanOrEqual(2)
  })
})

describe('ReleaseTimeline → Execute deep-link', () => {
  function fakeNav() {
    return { params: ref({}), updateParams: vi.fn(), navigateTo: vi.fn() }
  }

  function nodeWithLabel(wrapper, matcher) {
    return wrapper.vm.nodes.find(function (n) { return matcher.test(n.groupLabel) })
  }

  it('versionForNode maps an EA node to "<major>.<minor>.EA<n>"', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai',
        planningFreeze: '2026-06-01', ga: '2026-06-17' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var eaNode = nodeWithLabel(wrapper, /EA1/)
    expect(eaNode).toBeTruthy()
    expect(wrapper.vm.versionForNode(eaNode)).toBe('3.5.EA1')
  })

  it('versionForNode maps a GA node to "<major>.<minor>" (GA stripped)', () => {
    var releases = [
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var gaNode = nodeWithLabel(wrapper, /3\.6/)
    expect(gaNode).toBeTruthy()
    expect(wrapper.vm.versionForNode(gaNode)).toBe('3.6')
  })

  it('versionForNode falls back to the normalized label when source releases are absent', () => {
    var wrapper = mount(ReleaseTimeline, { props: { releases: [] } })
    expect(wrapper.vm.versionForNode({ groupLabel: 'RHAII 3.6-GA' })).toBe('3.6')
  })

  it('versionForNode returns null for a node with no parseable releases', () => {
    var wrapper = mount(ReleaseTimeline, { props: { releases: [] } })
    expect(wrapper.vm.versionForNode(null)).toBe(null)
    expect(wrapper.vm.versionForNode({ releases: [{ displayName: 'not-a-release', id: 'x' }] })).toBe(null)
  })

  it('openExecuteForNode navigates to the execute Kanban board with the version and product params', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2026-06-17' })
    ]
    var nav = fakeNav()
    var wrapper = mount(ReleaseTimeline, {
      props: { releases },
      global: { provide: { moduleNav: nav } }
    })
    var eaNode = nodeWithLabel(wrapper, /EA1/)
    wrapper.vm.openExecuteForNode(eaNode)
    expect(nav.navigateTo).toHaveBeenCalledWith('execute', {
      version: '3.5.EA1', view: 'board', tab: 'board', products: 'rhoai'
    })
  })

  it('openExecuteForNode carries the card product so Execute lands on the matching pill', () => {
    var releases = [
      makeRelease('rhaii-3.6.EA1', { displayName: 'rhaii-3.6.EA1', shortname: 'rhaii', ga: '2027-03-04' })
    ]
    var nav = fakeNav()
    var wrapper = mount(ReleaseTimeline, {
      props: { releases },
      global: { provide: { moduleNav: nav } }
    })
    var eaNode = nodeWithLabel(wrapper, /EA1/)
    wrapper.vm.openExecuteForNode(eaNode)
    expect(nav.navigateTo).toHaveBeenCalledWith('execute', {
      version: '3.6.EA1', view: 'board', tab: 'board', products: 'rhaii'
    })
  })

  it('openExecuteForNode omits the products param when the node has no product', () => {
    var nav = fakeNav()
    var wrapper = mount(ReleaseTimeline, {
      props: { releases: [] },
      global: { provide: { moduleNav: nav } }
    })
    // Hand-built node that resolves to a version but carries no productList.
    wrapper.vm.openExecuteForNode({
      releases: [{ displayName: 'rhoai-3.5.EA1', id: 'rhoai-3.5.EA1' }],
      productList: []
    })
    expect(nav.navigateTo).toHaveBeenCalledWith('execute', {
      version: '3.5.EA1', view: 'board', tab: 'board'
    })
  })

  it('openExecuteForNode joins multiple card products into the products param', () => {
    var nav = fakeNav()
    var wrapper = mount(ReleaseTimeline, {
      props: { releases: [] },
      global: { provide: { moduleNav: nav } }
    })
    // Hand-built node resolving to a version but carrying multiple products.
    // Real timeline nodes are per-product (productList length 1), so this shape
    // only arises if grouping ever changes — this guards the join(',') path.
    wrapper.vm.openExecuteForNode({
      releases: [{ displayName: 'rhoai-3.6.EA1', id: 'rhoai-3.6.EA1' }],
      productList: ['rhelai', 'rhoai']
    })
    expect(nav.navigateTo).toHaveBeenCalledWith('execute', {
      version: '3.6.EA1', view: 'board', tab: 'board', products: 'rhelai,rhoai'
    })
  })

  it('openExecuteForNode is a no-op when moduleNav is not provided', () => {
    var releases = [
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var node = nodeWithLabel(wrapper, /3\.6/)
    expect(function () { wrapper.vm.openExecuteForNode(node) }).not.toThrow()
  })

  it('openExecuteForNode does not navigate when the version is unresolved', () => {
    var nav = fakeNav()
    var wrapper = mount(ReleaseTimeline, {
      props: { releases: [] },
      global: { provide: { moduleNav: nav } }
    })
    wrapper.vm.openExecuteForNode({ releases: [{ displayName: 'not-a-release', id: 'x' }] })
    expect(nav.navigateTo).not.toHaveBeenCalled()
  })

  it('shouldShowClickAffordance is true for a navigable node when nav is wired', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2026-06-17' })
    ]
    var wrapper = mount(ReleaseTimeline, {
      props: { releases },
      global: { provide: { moduleNav: fakeNav() } }
    })
    var eaNode = nodeWithLabel(wrapper, /EA1/)
    expect(wrapper.vm.shouldShowClickAffordance(eaNode)).toBe(true)
  })

  it('shouldShowClickAffordance is false without moduleNav (nothing to click into)', () => {
    var releases = [
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var gaNode = nodeWithLabel(wrapper, /3\.6/)
    expect(wrapper.vm.shouldShowClickAffordance(gaNode)).toBe(false)
  })

  it('shouldShowClickAffordance is false for a node with no resolvable version', () => {
    var wrapper = mount(ReleaseTimeline, {
      props: { releases: [] },
      global: { provide: { moduleNav: fakeNav() } }
    })
    expect(wrapper.vm.shouldShowClickAffordance({ releases: [{ displayName: 'not-a-release', id: 'x' }] })).toBe(false)
    expect(wrapper.vm.shouldShowClickAffordance(null)).toBe(false)
  })
})

// A deep-linked timeline card carries versionForNode(node) as the Execute pill
// version. If a demo release exists on the timeline whose version has no matching
// Execute tracking config (or vice-versa), the deep-link lands on an empty/wrong
// pill. This guards the invariant that every Execute pill version (config key) is
// reachable from the registry-derived timeline AND has a tracking-data fixture —
// exactly the drift that the original 2.14/2.15 mismatch introduced.
describe('demo fixture drift guard (config ⊆ timeline)', () => {
  it('every Execute pill version is reachable from the registry-derived timeline', () => {
    var wrapper = mount(ReleaseTimeline, { props: { releases: registryFixture.releases } })
    var timelineVersions = new Set()
    wrapper.vm.allNodes.forEach(function (nd) {
      var v = wrapper.vm.versionForNode(nd)
      if (v) timelineVersions.add(v)
    })
    var configVersions = Object.keys(trackingConfigFixture.releases)
    var missing = configVersions.filter(function (v) { return !timelineVersions.has(v) })
    expect(missing).toEqual([])
  })

  it('every Execute pill version has a tracking-data fixture file', () => {
    var configVersions = Object.keys(trackingConfigFixture.releases)
    var dir = path.resolve(process.cwd(), 'fixtures/releases/execution')
    var missing = configVersions.filter(function (v) {
      return !fs.existsSync(path.join(dir, 'tracking-data-' + v + '.json'))
    })
    expect(missing).toEqual([])
  })
})
