import { ref, computed, watch } from 'vue'
import { apiRequest } from '@shared/client/services/api'

var OTHER_PILLAR = 'Other Components'

function normalizeComponentName(name) {
  return String(name || '').toLowerCase().replace(/[-_\s]+/g, '')
}

function computeRiskLevel(pct, total, failedOpen, thresholds) {
  var redBelow = (thresholds && thresholds.yellow) || 50
  var greenAt = (thresholds && thresholds.green) || 80
  if (total === 0 && failedOpen > 0) return 'red'
  if (total === 0) return 'green'
  if (pct < redBelow) return 'red'
  if (pct < greenAt) return 'yellow'
  return 'green'
}

function matchComponentToPillar(componentName, pillarMap) {
  var lower = normalizeComponentName(componentName)
  if (!lower) return null
  if (pillarMap[lower]) return pillarMap[lower]
  var keys = Object.keys(pillarMap)
  for (var i = 0; i < keys.length; i++) {
    if (lower.includes(keys[i]) || keys[i].includes(lower)) return pillarMap[keys[i]]
  }
  return null
}

function resolvePillarName(raw) {
  if (!raw || raw === 'Undefined' || raw === 'Unassigned') return OTHER_PILLAR
  return raw
}

function aggregateTfaData(responses) {
  var componentMap = new Map()

  for (var i = 0; i < responses.length; i++) {
    var components = Array.isArray(responses[i].components) ? responses[i].components : []
    for (var j = 0; j < components.length; j++) {
      var component = components[j]
      var current = componentMap.get(component.name)
      if (!current) {
        current = {
          ...component,
          signoffs: { done: 0, inProgress: 0, todo: 0, total: 0, pct: 0 },
          failedOpen: 0,
          issues: [],
          failedIssues: []
        }
        componentMap.set(component.name, current)
      }

      var signoffs = component.signoffs || {}
      current.signoffs.done += signoffs.done || 0
      current.signoffs.inProgress += signoffs.inProgress || 0
      current.signoffs.todo += signoffs.todo || 0
      current.signoffs.total += signoffs.total || 0
      current.failedOpen += component.failedOpen || 0
      current.issues = current.issues.concat(component.issues || [])
      current.failedIssues = current.failedIssues.concat(component.failedIssues || [])
    }
  }

  var componentList = Array.from(componentMap.values())
  var overallDone = 0
  var overallTotal = 0
  var overallFailedOpen = 0
  for (var k = 0; k < componentList.length; k++) {
    var aggregate = componentList[k]
    aggregate.signoffs.pct = aggregate.signoffs.total
      ? Math.round((aggregate.signoffs.done / aggregate.signoffs.total) * 100)
      : 0
    overallDone += aggregate.signoffs.done
    overallTotal += aggregate.signoffs.total
    overallFailedOpen += aggregate.failedOpen
  }

  return {
    releaseNumbers: responses.map(function (response) { return response.releaseNumber }).filter(Boolean),
    overall: {
      signoffDone: overallDone,
      signoffTotal: overallTotal,
      signoffPct: overallTotal ? Math.round((overallDone / overallTotal) * 100) : 0,
      failedOpen: overallFailedOpen
    },
    components: componentList
  }
}

function normalizeVersions(value) {
  var versions = Array.isArray(value) ? value : (value ? [value] : [])
  return [...new Set(versions.filter(Boolean))]
}

export function useTfaRiskAssessment(versionRef, thresholdsRef) {
  var tfaData = ref(null)
  var pillarConfig = ref({ pillars: [] })
  var loading = ref(false)
  var error = ref(null)
  var expandedPillars = ref({})

  var pillarRiskData = computed(function () {
    if (!tfaData.value || !tfaData.value.components || !tfaData.value.components.length) return []

    var pillarMap = {}
    var pillars = (pillarConfig.value && pillarConfig.value.pillars) || []
    for (var pi = 0; pi < pillars.length; pi++) {
      var mappedName = resolvePillarName(pillars[pi].name)
      var comps = pillars[pi].components || []
      for (var ci = 0; ci < comps.length; ci++) {
        var c = comps[ci]
        var name = typeof c === 'object' && c !== null ? c.name : c
        if (name) {
          pillarMap[normalizeComponentName(name)] = mappedName
        }
      }
    }

    var pillarAgg = {}
    var components = tfaData.value.components

    for (var i = 0; i < components.length; i++) {
      var comp = components[i]
      var rawPillar = comp.name === '(No component)'
        ? null
        : matchComponentToPillar(comp.name, pillarMap)
      var pillarName = resolvePillarName(rawPillar)

      if (!pillarAgg[pillarName]) {
        pillarAgg[pillarName] = {
          pillarName: pillarName,
          done: 0,
          total: 0,
          pct: 0,
          failedOpen: 0,
          riskLevel: 'green',
          componentCount: 0,
          components: []
        }
      }

      var p = pillarAgg[pillarName]
      p.done += comp.signoffs.done
      p.total += comp.signoffs.total
      p.failedOpen += comp.failedOpen
      p.componentCount++
      p.components.push(comp)
    }

    var result = []
    var names = Object.keys(pillarAgg)
    for (var j = 0; j < names.length; j++) {
      var pillar = pillarAgg[names[j]]
      pillar.pct = pillar.total > 0 ? Math.round((pillar.done / pillar.total) * 100) : 0
      var t = thresholdsRef ? thresholdsRef.value : null
      pillar.riskLevel = computeRiskLevel(pillar.pct, pillar.total, pillar.failedOpen, t)
      result.push(pillar)
    }

    result.sort(function (a, b) {
      if (a.pillarName === OTHER_PILLAR) return 1
      if (b.pillarName === OTHER_PILLAR) return -1
      var riskOrder = { red: 0, yellow: 1, green: 2 }
      var diff = (riskOrder[a.riskLevel] || 2) - (riskOrder[b.riskLevel] || 2)
      if (diff !== 0) return diff
      return a.pillarName.localeCompare(b.pillarName)
    })

    return result
  })

  var overallStats = computed(function () {
    if (!tfaData.value || !tfaData.value.overall) {
      return { signoffDone: 0, signoffTotal: 0, signoffPct: 0, failedOpen: 0, riskLevel: 'green' }
    }
    var o = tfaData.value.overall
    return {
      signoffDone: o.signoffDone,
      signoffTotal: o.signoffTotal,
      signoffPct: o.signoffPct,
      failedOpen: o.failedOpen,
      riskLevel: computeRiskLevel(o.signoffPct, o.signoffTotal, o.failedOpen, thresholdsRef ? thresholdsRef.value : null)
    }
  })

  var pillarsAtRisk = computed(function () {
    var count = 0
    var data = pillarRiskData.value
    for (var i = 0; i < data.length; i++) {
      if (data[i].riskLevel === 'red' || data[i].riskLevel === 'yellow') count++
    }
    return count
  })

  async function fetchData(value) {
    var versions = normalizeVersions(value)
    if (!versions.length) {
      tfaData.value = null
      return
    }
    loading.value = true
    error.value = null
    expandedPillars.value = {}
    try {
      var results = await Promise.all([
        ...versions.map(async function (version) {
          try {
            return await apiRequest('/modules/releases/delivery/tfa-risk/' + encodeURIComponent(version))
          } catch (err) {
            if (err && err.status === 404) return null
            throw err
          }
        }),
        apiRequest('/modules/releases/pm-hub/pillar-config')
      ])
      var config = results.pop()
      tfaData.value = aggregateTfaData(results.filter(Boolean))
      if (config && Array.isArray(config.pillars)) {
        pillarConfig.value = config
      }
    } catch (err) {
      if (err && err.status === 404) {
        error.value = null
        tfaData.value = null
      } else {
        error.value = (err && err.message) || 'Failed to load TFA risk data'
        tfaData.value = null
      }
    } finally {
      loading.value = false
    }
  }

  watch(versionRef, function (versions) { fetchData(versions) }, { immediate: true })

  return {
    tfaData: tfaData,
    pillarRiskData: pillarRiskData,
    overallStats: overallStats,
    pillarsAtRisk: pillarsAtRisk,
    expandedPillars: expandedPillars,
    loading: loading,
    error: error,
    refresh: function () { fetchData(versionRef.value) }
  }
}
