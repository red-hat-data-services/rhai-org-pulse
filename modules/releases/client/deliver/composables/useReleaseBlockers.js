import { ref, watch } from 'vue'
import { apiRequest } from '@shared/client/services/api'

function uniqueValues(left, right) {
  return [...new Set([...(left || []), ...(right || [])])]
}

function mergeIssues(responses, field) {
  var byKey = new Map()

  for (var i = 0; i < responses.length; i++) {
    var response = responses[i]
    var issues = Array.isArray(response[field]) ? response[field] : []
    for (var j = 0; j < issues.length; j++) {
      var issue = issues[j]
      var existing = byKey.get(issue.key)
      if (!existing) {
        byKey.set(issue.key, {
          ...issue,
          releaseNumbers: [response.releaseNumber]
        })
        continue
      }

      var issueIsNewer = String(issue.updated || '') > String(existing.updated || '')
      var merged = issueIsNewer ? { ...existing, ...issue } : { ...issue, ...existing }
      merged.fixVersions = uniqueValues(existing.fixVersions, issue.fixVersions)
      merged.affectedVersions = uniqueValues(existing.affectedVersions, issue.affectedVersions)
      merged.components = uniqueValues(existing.components, issue.components)
      merged.labels = uniqueValues(existing.labels, issue.labels)
      merged.releaseNumbers = uniqueValues(existing.releaseNumbers, [response.releaseNumber])
      byKey.set(issue.key, merged)
    }
  }

  return Array.from(byKey.values())
}

function emptyStats() {
  return { avg: null, median: null, p90: null, max: null, count: 0 }
}

function buildStats(values) {
  if (!values.length) return emptyStats()
  var sorted = values.slice().sort(function (a, b) { return a - b })
  var middle = Math.floor(sorted.length / 2)
  var median = sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
  var p90Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.9) - 1)
  return {
    avg: Math.round(sorted.reduce(function (sum, value) { return sum + value }, 0) / sorted.length),
    median: median,
    p90: sorted[p90Index],
    max: sorted[sorted.length - 1],
    count: sorted.length
  }
}

function combineStats(responses, accessor) {
  var stats = responses.map(accessor).filter(function (entry) { return entry && entry.count })
  if (!stats.length) return emptyStats()

  var count = stats.reduce(function (sum, entry) { return sum + entry.count }, 0)
  function weighted(field) {
    var entries = stats.filter(function (entry) { return entry[field] !== null && entry[field] !== undefined })
    if (!entries.length) return null
    var totalWeight = entries.reduce(function (sum, entry) { return sum + entry.count }, 0)
    var value = entries.reduce(function (sum, entry) { return sum + (entry[field] * entry.count) }, 0)
    return Math.round(value / totalWeight)
  }

  return {
    avg: weighted('avg'),
    median: weighted('median'),
    p90: weighted('p90'),
    max: Math.max.apply(null, stats.map(function (entry) { return entry.max || 0 })),
    count: count
  }
}

function aggregateResponses(responses) {
  var blockers = mergeIssues(responses, 'blockers')
  var awarenessTrends = mergeIssues(responses, 'awarenessTrends')
  var criticalMonitoring = mergeIssues(responses, 'criticalMonitoring')
  var summary = { proposed: 0, approved: 0, rejected: 0, noStatus: 0, total: blockers.length }
  var timing = { proposedBeforeCodeFreeze: 0, proposedAfterCodeFreeze: 0 }
  var decisionDays = []
  var daysByStatus = { Proposed: [], Approved: [], Rejected: [] }

  for (var i = 0; i < blockers.length; i++) {
    var blocker = blockers[i]
    if (blocker.releaseBlockerStatus === 'Proposed') summary.proposed++
    else if (blocker.releaseBlockerStatus === 'Approved') summary.approved++
    else if (blocker.releaseBlockerStatus === 'Rejected') summary.rejected++
    else summary.noStatus++

    if (blocker.proposedBeforeCodeFreeze) timing.proposedBeforeCodeFreeze++
    else timing.proposedAfterCodeFreeze++
    if (blocker.daysToDecision !== null && blocker.daysToDecision !== undefined) {
      decisionDays.push(blocker.daysToDecision)
    }
    if (daysByStatus[blocker.releaseBlockerStatus] && blocker.daysInCurrentState !== null && blocker.daysInCurrentState !== undefined) {
      daysByStatus[blocker.releaseBlockerStatus].push(blocker.daysInCurrentState)
    }
  }

  var releaseNumbers = responses.map(function (response) { return response.releaseNumber }).filter(Boolean)
  var fetchedDates = responses.map(function (response) { return response.fetchedAt }).filter(Boolean).sort()

  return {
    releaseNumber: releaseNumbers.length === 1 ? releaseNumbers[0] : null,
    releaseNumbers: releaseNumbers,
    fetchedAt: fetchedDates.length ? fetchedDates[fetchedDates.length - 1] : null,
    summary: summary,
    timing: timing,
    aging: {
      proposalToDecision: buildStats(decisionDays),
      approvalToResolution: combineStats(responses, function (response) { return response.aging && response.aging.approvalToResolution }),
      byStatus: {
        proposed: buildStats(daysByStatus.Proposed),
        approved: buildStats(daysByStatus.Approved),
        rejected: buildStats(daysByStatus.Rejected)
      }
    },
    blockers: blockers,
    criticalMonitoring: criticalMonitoring,
    awarenessTrends: awarenessTrends
  }
}

function normalizeRequests(value) {
  var entries = Array.isArray(value) ? value : (value ? [{ releaseNumber: value }] : [])
  var seen = new Set()
  return entries.filter(function (entry) {
    if (!entry || !entry.releaseNumber || seen.has(entry.releaseNumber)) return false
    seen.add(entry.releaseNumber)
    return true
  })
}

export function useReleaseBlockers(releasesRef) {
  const data = ref(null)
  const loading = ref(false)
  const error = ref(null)
  var requestSequence = 0

  async function fetchBlockers(value) {
    var requests = normalizeRequests(value)
    var sequence = ++requestSequence
    if (!requests.length) {
      data.value = null
      error.value = null
      loading.value = false
      return
    }

    loading.value = true
    error.value = null
    try {
      var responses = await Promise.all(requests.map(async function (request) {
        var url = `/modules/releases/delivery/blockers/${encodeURIComponent(request.releaseNumber)}`
        if (request.codeFreezeDate) {
          url += `?codeFreezeDate=${encodeURIComponent(request.codeFreezeDate)}`
        }
        try {
          return await apiRequest(url)
        } catch (err) {
          if (err && err.status === 404) return null
          throw err
        }
      }))
      if (sequence !== requestSequence) return
      data.value = aggregateResponses(responses.filter(Boolean))
    } catch (err) {
      if (sequence !== requestSequence) return
      error.value = err.message || 'Failed to load blocker data.'
      data.value = null
    } finally {
      if (sequence === requestSequence) loading.value = false
    }
  }

  watch(releasesRef, function (requests) { fetchBlockers(requests) }, { immediate: true })

  return {
    data,
    loading,
    error,
    refresh: function () { fetchBlockers(releasesRef.value) }
  }
}
