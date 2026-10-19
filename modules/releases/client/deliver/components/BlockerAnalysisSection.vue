<template>
  <section data-testid="blocker-analysis" class="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div class="border-b border-gray-200 px-5 py-5 dark:border-gray-700">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 class="text-base font-semibold text-gray-800 dark:text-gray-100">Release Blocker Continuous Improvement</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Analysis of every Approved and Rejected issue represented in the historical Release Blocker Trends chart.</p>
        </div>
        <div class="text-right text-xs text-gray-400 dark:text-gray-500">
          <p v-if="data && data.fetchedAt">Jira data fetched {{ formatDate(data.fetchedAt) }}</p>
          <p v-if="data && data.model">Source: {{ data.model }}</p>
        </div>
      </div>
      <div v-if="isStale" class="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
        The Jira data is more than 48 hours old. Refresh the Release Blockers view to update this section.
      </div>
      <div v-if="data && data.partial" class="mt-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-300">
        This snapshot is partial. {{ (data.errors || []).length }} issue{{ (data.errors || []).length === 1 ? '' : 's' }} could not be analyzed and are shown as Unknown.
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="h-7 w-7 animate-spin rounded-full border-b-2 border-orange-500"></div>
    </div>
    <div v-else-if="error" class="px-5 py-12 text-center">
      <p class="text-sm text-gray-500 dark:text-gray-400">{{ error }}</p>
    </div>
    <template v-else-if="data">
      <div class="grid grid-cols-2 gap-3 border-b border-gray-100 p-5 sm:grid-cols-4 xl:grid-cols-8 dark:border-gray-700">
        <div v-for="card in kpiCards" :key="card.key" class="rounded-lg border p-3" :class="card.className">
          <p class="text-[10px] font-semibold uppercase tracking-wide" :class="card.labelClass">{{ card.label }}</p>
          <p class="mt-1 text-2xl font-bold" :class="card.valueClass">{{ card.value }}</p>
        </div>
      </div>

      <div class="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
        <div class="flex flex-wrap items-end gap-3">
          <label class="min-w-[220px] flex-1">
            <span class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Search</span>
            <input v-model="search" type="search" placeholder="Key or summary" class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
          </label>
          <label>
            <span class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Release</span>
            <select v-model="releaseFilter" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
              <option value="">All releases</option>
              <option v-for="value in releaseOptions" :key="value" :value="value">{{ value }}</option>
            </select>
          </label>
          <label>
            <span class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Component</span>
            <select v-model="componentFilter" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
              <option value="">All components</option>
              <option v-for="value in componentOptions" :key="value" :value="value">{{ value }}</option>
            </select>
          </label>
          <label>
            <span class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Outcome</span>
            <select v-model="outcomeFilter" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
              <option value="">Approved or rejected</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </label>
          <button type="button" class="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700" @click="clearFilters">Clear</button>
        </div>
        <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span class="text-xs text-gray-400 dark:text-gray-500">{{ filteredIssues.length }} of {{ issues.length }} analyzed issues</span>
          <div class="inline-flex rounded-xl bg-gray-100 p-1 shadow-inner dark:bg-gray-900/70" role="group" aria-label="Blocker analysis grouping">
            <button type="button" :aria-pressed="view === 'release'" class="rounded-lg px-4 py-2 text-xs font-semibold transition-colors" :class="view === 'release' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'" @click="view = 'release'">By Release</button>
            <button type="button" :aria-pressed="view === 'component'" class="rounded-lg px-4 py-2 text-xs font-semibold transition-colors" :class="view === 'component' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'" @click="view = 'component'">By Component</button>
          </div>
        </div>
      </div>

      <div v-if="filteredIssues.length" class="overflow-x-auto">
        <table class="w-full min-w-[1180px] text-sm">
          <thead class="bg-gray-50 dark:bg-gray-900">
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th v-for="column in columns" :key="column.key" class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ column.label }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <template v-for="issue in pagedIssues" :key="issue.key">
              <tr class="cursor-pointer align-top hover:bg-gray-50 dark:hover:bg-gray-700/40" @click="toggleExpanded(issue.key)">
                <td class="whitespace-nowrap px-4 py-3"><a :href="issue.link" target="_blank" rel="noopener" class="font-mono text-xs font-medium text-blue-600 hover:underline dark:text-blue-400" @click.stop>{{ issue.key }}</a></td>
                <td class="max-w-xs px-4 py-3 text-xs text-gray-700 dark:text-gray-300"><span class="line-clamp-2" :title="issue.summary">{{ issue.summary || '—' }}</span></td>
                <td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{{ issue.components.join(', ') || '—' }}</td>
                <td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{{ issue.fixVersions.join(', ') || '—' }}</td>
                <td class="whitespace-nowrap px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{{ formatDateOnly(issue.proposedDate) }}</td>
                <td class="px-4 py-3"><span class="rounded-full px-2 py-1 text-xs font-semibold" :class="decisionClass(issue.regression)">{{ issue.regression }}</span></td>
                <td class="px-4 py-3"><span class="rounded-full px-2 py-1 text-xs font-semibold" :class="decisionClass(issue.couldIdentifyEarlier)">{{ issue.couldIdentifyEarlier }}</span></td>
                <td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{{ issue.earlyDetectionCategory }}</td>
                <td class="px-4 py-3"><span class="rounded-full px-2 py-1 text-xs font-semibold" :class="issue.releaseBlocker === 'Approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'">{{ issue.releaseBlocker }}</span></td>
              </tr>
              <tr v-if="isExpanded(issue.key)" class="bg-gray-50/80 dark:bg-gray-900/40">
                <td colspan="9" class="px-5 py-4">
                  <div class="grid gap-4 lg:grid-cols-3">
                    <div>
                      <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Early-identification response</p>
                      <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">{{ issue.earlyDetectionResponse || 'Unknown — no qualifying comment response was found.' }}</p>
                    </div>
                    <div>
                      <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Prevention recommendation</p>
                      <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">{{ issue.prevention || 'Unknown — no recommendation was generated.' }}</p>
                      <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">{{ issue.preventionCategory }}</p>
                    </div>
                    <div>
                      <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Jira evidence</p>
                      <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">Regression: {{ issue.regressionEvidence || 'Unknown' }}</p>
                      <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">Confidence: {{ issue.analysisConfidence || 'Unknown' }}</p>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <div v-else class="px-5 py-10 text-center text-sm text-gray-400 dark:text-gray-500">No analyzed issues match the local filters.</div>

      <div v-if="pageCount > 1" class="flex items-center justify-between border-t border-gray-200 px-5 py-3 text-xs dark:border-gray-700">
        <span class="text-gray-400 dark:text-gray-500">Page {{ page }} of {{ pageCount }}</span>
        <div class="flex gap-2">
          <button type="button" class="rounded border border-gray-200 px-3 py-1.5 text-gray-600 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300" :disabled="page === 1" @click="page--">Previous</button>
          <button type="button" class="rounded border border-gray-200 px-3 py-1.5 text-gray-600 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300" :disabled="page === pageCount" @click="page++">Next</button>
        </div>
      </div>

      <div class="border-t border-gray-200 p-5 dark:border-gray-700">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Blocker analysis insights</h4>
            <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">Historical patterns grouped {{ view === 'release' ? 'by release' : 'by component' }}.</p>
          </div>
        </div>
        <div class="grid gap-4 lg:grid-cols-2">
          <div class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <h5 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Regression and early-identification signals</h5>
            <div v-if="activeGroups.length" class="mt-4 space-y-4">
              <div v-for="group in activeGroups" :key="group.label + '-signals'">
                <div class="mb-1 flex justify-between gap-2 text-xs text-gray-600 dark:text-gray-300"><span class="truncate" :title="group.label">{{ group.label }}</span><span>{{ group.regression.yes }} regression / {{ group.earlierIdentification.yes }} earlier</span></div>
                <div class="grid grid-cols-2 gap-2"><div class="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"><span class="block h-full bg-orange-500" :style="{ width: groupWidth(group.regression.yes, group.total) }"></span></div><div class="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"><span class="block h-full bg-blue-500" :style="{ width: groupWidth(group.earlierIdentification.yes, group.total) }"></span></div></div>
              </div>
            </div>
            <p v-else class="mt-4 text-xs text-gray-400">No signal data available.</p>
          </div>
          <div class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <h5 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Top early-detection categories</h5>
            <div class="mt-4 space-y-2"><div v-for="entry in topDetectionCategories" :key="entry.label" class="flex items-center gap-3 text-xs"><span class="w-44 truncate text-gray-600 dark:text-gray-300" :title="entry.label">{{ entry.label }}</span><span class="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"><span class="block h-full bg-blue-500" :style="{ width: categoryWidth(entry.count, topDetectionMax) }"></span></span><span class="w-6 text-right font-semibold text-gray-500">{{ entry.count }}</span></div></div>
          </div>
          <div class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <h5 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Top prevention actions</h5>
            <div class="mt-4 space-y-2"><div v-for="entry in topPreventionActions" :key="entry.label" class="flex items-center gap-3 text-xs"><span class="w-44 truncate text-gray-600 dark:text-gray-300" :title="entry.label">{{ entry.label }}</span><span class="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"><span class="block h-full bg-emerald-500" :style="{ width: categoryWidth(entry.count, topPreventionMax) }"></span></span><span class="w-6 text-right font-semibold text-gray-500">{{ entry.count }}</span></div></div>
          </div>
        </div>

        <div v-if="data.insights && data.insights.length" class="mt-4 rounded-xl border border-orange-100 bg-orange-50/60 p-4 dark:border-orange-900/40 dark:bg-orange-900/10">
          <h5 class="text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">Additional data-driven insights</h5>
          <ul class="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li v-for="insight in data.insights" :key="insight.text" class="flex gap-2"><span class="text-orange-500">•</span><span>{{ insight.text }} <span class="text-xs text-gray-400">({{ insight.evidenceCount }} issue{{ insight.evidenceCount === 1 ? '' : 's' }})</span><span v-if="insight.issueKeys && insight.issueKeys.length" class="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs"><a v-for="key in insight.issueKeys" :key="key" :href="issueLink(key)" target="_blank" rel="noopener" class="text-blue-600 hover:underline dark:text-blue-400">{{ key }}</a></span></span></li>
          </ul>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

var props = defineProps({
  data: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' }
})

var columns = [
  { key: 'key', label: 'Jira Key' },
  { key: 'summary', label: 'Summary' },
  { key: 'components', label: 'Component' },
  { key: 'fixVersions', label: 'Fix version' },
  { key: 'proposedDate', label: 'Proposed date' },
  { key: 'regression', label: 'Regression' },
  { key: 'couldIdentifyEarlier', label: 'Identified earlier' },
  { key: 'earlyDetectionCategory', label: 'Early detection' },
  { key: 'releaseBlocker', label: 'Outcome' }
]
var view = ref('release')
var search = ref('')
var releaseFilter = ref('')
var componentFilter = ref('')
var outcomeFilter = ref('')
var page = ref(1)
var expanded = ref(new Set())
var pageSize = 8

var issues = computed(function () { return props.data && Array.isArray(props.data.issues) ? props.data.issues : [] })
var aggregates = computed(function () { return (props.data && props.data.aggregates) || {} })
var overall = computed(function () { return aggregates.value.overall || { totalAnalyzed: issues.value.length, regression: { yes: 0, no: 0, unknown: issues.value.length }, earlierIdentification: { yes: 0, no: 0, unknown: issues.value.length }, prereleaseCveRemediation: 0 } })

var kpiCards = computed(function () {
  var regression = overall.value.regression || {}
  var earlier = overall.value.earlierIdentification || {}
  return [
    { key: 'total', label: 'Total analyzed', value: overall.value.totalAnalyzed || 0, className: 'border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-900/10', labelClass: 'text-blue-600 dark:text-blue-300', valueClass: 'text-blue-800 dark:text-blue-100' },
    { key: 'regression-yes', label: 'Regression yes', value: regression.yes || 0, className: 'border-orange-200 bg-orange-50/60 dark:border-orange-800 dark:bg-orange-900/10', labelClass: 'text-orange-600 dark:text-orange-300', valueClass: 'text-orange-800 dark:text-orange-100' },
    { key: 'regression-no', label: 'Regression no', value: regression.no || 0, className: 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-900/10', labelClass: 'text-emerald-600 dark:text-emerald-300', valueClass: 'text-emerald-800 dark:text-emerald-100' },
    { key: 'regression-unknown', label: 'Regression unknown', value: regression.unknown || 0, className: 'border-gray-200 bg-gray-50/60 dark:border-gray-700 dark:bg-gray-900/30', labelClass: 'text-gray-500 dark:text-gray-400', valueClass: 'text-gray-700 dark:text-gray-200' },
    { key: 'earlier-yes', label: 'Could be earlier', value: earlier.yes || 0, className: 'border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-900/10', labelClass: 'text-blue-600 dark:text-blue-300', valueClass: 'text-blue-800 dark:text-blue-100' },
    { key: 'earlier-no', label: 'Could not be earlier', value: earlier.no || 0, className: 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-900/10', labelClass: 'text-emerald-600 dark:text-emerald-300', valueClass: 'text-emerald-800 dark:text-emerald-100' },
    { key: 'earlier-unknown', label: 'Earlier unknown', value: earlier.unknown || 0, className: 'border-gray-200 bg-gray-50/60 dark:border-gray-700 dark:bg-gray-900/30', labelClass: 'text-gray-500 dark:text-gray-400', valueClass: 'text-gray-700 dark:text-gray-200' },
    { key: 'cve', label: 'Pre-release CVE', value: overall.value.prereleaseCveRemediation || 0, className: 'border-red-200 bg-red-50/60 dark:border-red-800 dark:bg-red-900/10', labelClass: 'text-red-600 dark:text-red-300', valueClass: 'text-red-800 dark:text-red-100' }
  ]
})

function uniqueValues(field) {
  var values = new Set()
  issues.value.forEach(function (issue) { (issue[field] || []).forEach(function (value) { if (value) values.add(value) }) })
  return Array.from(values).sort(function (a, b) { return String(a).localeCompare(String(b)) })
}
var releaseOptions = computed(function () {
  var values = new Set()
  issues.value.forEach(function (issue) {
    var releases = issue.trendReleases && issue.trendReleases.length ? issue.trendReleases : issue.fixVersions
    ;(releases || []).forEach(function (value) { if (value) values.add(value) })
  })
  return Array.from(values).sort(function (a, b) { return String(a).localeCompare(String(b)) })
})
var componentOptions = computed(function () { return uniqueValues('components') })

var filteredIssues = computed(function () {
  var query = search.value.trim().toLowerCase()
  return issues.value.filter(function (issue) {
    if (query && !(String(issue.key || '').toLowerCase().includes(query) || String(issue.summary || '').toLowerCase().includes(query))) return false
    var releases = issue.trendReleases && issue.trendReleases.length ? issue.trendReleases : issue.fixVersions
    if (releaseFilter.value && !(releases || []).includes(releaseFilter.value)) return false
    if (componentFilter.value && !(issue.components || []).includes(componentFilter.value)) return false
    if (outcomeFilter.value && issue.releaseBlocker !== outcomeFilter.value) return false
    return true
  })
})
var pageCount = computed(function () { return Math.max(1, Math.ceil(filteredIssues.value.length / pageSize)) })
var pagedIssues = computed(function () { return filteredIssues.value.slice((page.value - 1) * pageSize, page.value * pageSize) })

var activeGroups = computed(function () { return view.value === 'release' ? (aggregates.value.byRelease || []) : (aggregates.value.byComponent || []) })
function aggregateCategoryRows(field) {
  var totals = {}
  activeGroups.value.forEach(function (group) { Object.entries(group[field] || {}).forEach(function (entry) { totals[entry[0]] = (totals[entry[0]] || 0) + entry[1] }) })
  return Object.entries(totals).map(function (entry) { return { label: entry[0], count: entry[1] } }).sort(function (a, b) { return b.count - a.count || a.label.localeCompare(b.label) }).slice(0, 8)
}
var topDetectionCategories = computed(function () { return aggregateCategoryRows('earlyDetectionCategories') })
var topPreventionActions = computed(function () { return aggregateCategoryRows('preventionCategories') })
var topDetectionMax = computed(function () { return Math.max.apply(null, topDetectionCategories.value.map(function (entry) { return entry.count }).concat([1])) })
var topPreventionMax = computed(function () { return Math.max.apply(null, topPreventionActions.value.map(function (entry) { return entry.count }).concat([1])) })
var issueLinks = computed(function () {
  return issues.value.reduce(function (links, issue) {
    if (issue.key && issue.link) links[issue.key] = issue.link
    return links
  }, {})
})

var isStale = computed(function () { return Boolean(props.data && props.data.generatedAt && Date.now() - new Date(props.data.generatedAt).getTime() > 48 * 60 * 60 * 1000) })

watch([search, releaseFilter, componentFilter, outcomeFilter], function () { page.value = 1 })
watch(pageCount, function (count) { if (page.value > count) page.value = count })

function clearFilters() {
  search.value = ''
  releaseFilter.value = ''
  componentFilter.value = ''
  outcomeFilter.value = ''
}
function toggleExpanded(key) {
  var next = new Set(expanded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expanded.value = next
}
function isExpanded(key) { return expanded.value.has(key) }
function decisionClass(value) {
  if (value === 'Yes') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
  if (value === 'No') return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
}
function groupWidth(value, total) { return total ? Math.max(value ? 2 : 0, Math.round(value / total * 100)) + '%' : '0%' }
function categoryWidth(value, max) { return max ? Math.max(value ? 3 : 0, Math.round(value / max * 100)) + '%' : '0%' }
function formatDate(value) { return value ? new Date(value).toLocaleString() : '—' }
function formatDateOnly(value) { return value ? new Date(value).toLocaleDateString() : 'Unknown' }
function issueLink(key) { return issueLinks.value[key] || '#' }
</script>
