<script setup>
import { ref, computed, inject, watch } from 'vue'
import {
  Layers, AlertCircle, Users, CheckCircle2,
  ChevronRight, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown,
  X, Filter, RefreshCw, Search, FileDown, Code2,
} from 'lucide-vue-next'
import { usePoHubBacklogData } from '../composables/usePoHubBacklogData'

const { data, loading, error, load, refresh } = usePoHubBacklogData()

const triggerRefresh = inject('triggerRefresh', ref(0))
const onDataLoaded = inject('onDataLoaded', () => {})
const onDataError = inject('onDataError', () => {})
const moduleNav = inject('moduleNav', null)

watch(triggerRefresh, (val) => { if (val > 0) refresh() })
watch(data, (val) => { if (val?.lastUpdated) onDataLoaded(val.lastUpdated) }, { immediate: true })
watch(error, (val) => { if (val) onDataError() })

const selectedReleases = ref([])
const showJql = ref(false)
const activeFilter = ref(null)
const searchQuery = ref('')
const sortState = ref({ key: null, dir: 'asc' })
const expandedFeatures = ref(new Set())
const expandedLanes = ref(new Set(['rhoai-3.5.EA2', 'rhoai-3.6.EA2', 'rhoai-3.6.GA', 'Other releases', 'Unversioned / Cross-Release', 'ready-packages-rhoai-3.6.EA2']))

const JIRA = 'https://redhat.atlassian.net/browse/'
const RELEASE_ORDER = ['rhoai-3.5.EA2', 'rhoai-3.6.EA2', 'rhoai-3.6.GA', 'Other releases', 'Unversioned / Cross-Release']
const RELEASE_DISPLAY = { 'rhoai-3.5.EA2': 'RHOAI 3.5 EA2', 'rhoai-3.6.EA2': 'Red Hat AI 3.6 EA2', 'rhoai-3.6.GA': 'Red Hat AI 3.6 GA', 'Other releases': 'Other releases', 'Unversioned / Cross-Release': 'Unversioned' }
const RELEASE_HEADER = { 'rhoai-3.5.EA2': 'bg-blue-600', 'rhoai-3.6.EA2': 'bg-orange-600', 'rhoai-3.6.GA': 'bg-teal-700', 'Other releases': 'bg-purple-700', 'Unversioned / Cross-Release': 'bg-gray-600' }
const RELEASE_BADGE = { 'rhoai-3.5.EA2': 'bg-blue-100 text-blue-800', 'rhoai-3.6.EA2': 'bg-orange-100 text-orange-800', 'rhoai-3.6.GA': 'bg-teal-100 text-teal-800', 'Other releases': 'bg-purple-100 text-purple-800', 'Unversioned / Cross-Release': 'bg-gray-100 text-gray-600' }
const STATUS_STYLE = { 'New': 'bg-gray-100 text-gray-600', 'To Do': 'bg-gray-100 text-gray-600', 'In Progress': 'bg-blue-100 text-blue-700', 'Approved': 'bg-teal-100 text-teal-700', 'Review': 'bg-cyan-100 text-cyan-700', 'Refinement': 'bg-amber-100 text-amber-700', 'Closed': 'bg-green-100 text-green-700', 'Blocked': 'bg-red-100 text-red-700' }
const STATUS_ORDER = { 'Blocked': 0, 'In Progress': 1, 'Review': 2, 'Refinement': 3, 'To Do': 4, 'New': 5, 'Closed': 6 }
const PIPELINE_STYLE = { 'build-failed': 'bg-red-600 text-white', 'security-blocked': 'bg-red-600 text-white', 'autoqa-passed': 'bg-green-600 text-white', 'in-test-repo': 'bg-teal-600 text-white', 'autoqa-tested': 'bg-green-600 text-white', 'automation-onboarded': 'bg-blue-600 text-white' }

const TYPE_STYLE = {
  initiative: 'bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800',
  feature: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
  package: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
  rfe: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
  strategy: 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800',
  epic: 'bg-gray-50 text-gray-600 border border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600',
}

const ROW_BORDER = {
  initiative: 'border-l-violet-500',
  feature: 'border-l-blue-500',
  package: 'border-l-amber-400',
  rfe: 'border-l-emerald-500',
  strategy: 'border-l-indigo-500',
  epic: 'border-l-gray-300',
}

const PRIORITY_ORDER = { 'Critical': 0, 'Major': 1, 'Normal': 2, 'Minor': 3, 'Undefined': 4 }
const PRIORITY_STYLE = {
  'Critical': 'bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  'Major': 'bg-orange-100 text-orange-800 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  'Normal': 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
  'Minor': 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600',
  'Undefined': 'bg-gray-50 text-gray-500 border border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600',
}

const PRODUCT_STYLE = {
  'RHAII': 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  'RHOAI': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  'RHELAI': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  'combined': 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
}
const PROJECT_STYLE = {
  AIPCC: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  RHAI: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300',
}

const SQUAD_PATHS = {
  'NVIDIA CUDA': 'cuda',
  'Google TPU': 'tpu',
  'AMD ROCm': 'rocm',
  'Intel Gaudi': 'gaudi',
  'IBM Spyre': 'spyre',
  'AWS Neuron': 'neuron',
  'CPU': 'cpu',
  'Delivery': 'delivery',
  'Tooling': 'tooling',
  '__no_squad__': 'no-squad',
}
const SQUADS_BY_PATH = Object.fromEntries(Object.entries(SQUAD_PATHS).map(([squad, path]) => [path, squad]))

function squadLabel(squad) {
  return squad === '__no_squad__' ? 'No Squad' : squad
}

function normalizeRfe(rfe) {
  return { key: rfe.key, summary: rfe.summary, status: rfe.status, priority: rfe.priority || 'Undefined', assignee: rfe.assignee, products: rfe.products || [], squad: rfe.squad || null, _isRfe: true, progress: { total: 0, closed: 0 }, children: rfe.children || [] }
}

function normalizeStrategy(strategy) {
  return { key: strategy.key, summary: strategy.summary, status: strategy.status, priority: strategy.priority || 'Undefined', assignee: strategy.assignee, order: strategy.order, targetVersions: strategy.targetVersions || [], fixVersions: strategy.fixVersions || [], products: strategy.products || [], squad: strategy.squad || null, _isStrategy: true, progress: { total: 0, closed: 0 }, children: strategy.children || [] }
}

function isPackageEpic(epic) {
  return Boolean(epic.isPackage) ||
    (epic.labels || []).includes('package') ||
    /\bpackages?\b/i.test(epic.summary || '')
}

function normalizeEpic(epic) {
  return { key: epic.key, summary: epic.summary, status: epic.status, priority: epic.priority || 'Undefined', assignee: epic.assignee, order: epic.order, project: epic.project, parent: epic.parent || null, labels: epic.labels || [], targetVersions: epic.targetVersions || [], fixVersions: epic.fixVersions || [], squad: epic.squad || null, isPackage: isPackageEpic(epic), _isEpic: true, progress: { total: 0, closed: 0 }, children: [] }
}

function normalizePackage(pkg) {
  return { key: pkg.key, summary: pkg.summary || pkg.name, status: pkg.status, priority: pkg.priority || 'Undefined', assignee: pkg.assignee, duedate: pkg.duedate || null, targetVersions: pkg.targetVersions || [], progress: pkg.progress || { total: 0, closed: 0 }, children: pkg.children || [], _isPackage: true, _pipelineStage: pkg.pipelineStage || [], squad: pkg.squad || null }
}

function urgencyScore(item) {
  let score = 0
  score += (PRIORITY_ORDER[item.priority] ?? 4) * 100
  const d = formatDueDate(item.duedate)
  if (d?.isPast) score -= 500
  else if (d?.isSoon) score -= 200
  else if (d) score -= 50
  score += (STATUS_ORDER[item.status] ?? 5) * 10
  if (!item.assignee) score -= 30
  return score
}

function normalizeInitiative(ini) {
  return { key: ini.key, summary: ini.summary, status: ini.status, priority: ini.priority || 'Undefined', assignee: ini.assignee, duedate: ini.duedate || null, rank: ini.rank || null, progress: ini.progress || { total: 0, closed: 0 }, children: ini.children || [], _isInitiative: true, squad: ini.squad || null, flags: ini.flags }
}

function itemType(item) { return item._isInitiative ? 'initiative' : item._isStrategy ? 'strategy' : item._isRfe ? 'rfe' : item._isPackage ? 'package' : item._isEpic ? 'epic' : 'feature' }

function matchesFilter(item, filter) {
  if (!filter) return true
  if (filter === 'unassigned') return !item.assignee
  if (filter === 'blocked') {
    if (item._isPackage) return (item._pipelineStage || []).some(s => s === 'build-failed' || s === 'security-blocked')
    if (item._isStrategy || item._isRfe || item._isEpic) return item.status === 'Blocked'
    return (item.flags?.blocked || 0) > 0
  }
  if (filter === 'review') return item.status === 'Review'
  return true
}

function matchesSearch(item, q) {
  if (!q) return true
  const lq = q.toLowerCase()
  return item.key.toLowerCase().includes(lq) ||
    item.summary.toLowerCase().includes(lq) ||
    (item.assignee || '').toLowerCase().includes(lq) ||
    (item.project || '').toLowerCase().includes(lq) ||
    (item.parent || '').toLowerCase().includes(lq) ||
    (item.labels || []).some(label => label.toLowerCase().includes(lq)) ||
    (item.targetVersions || []).some(version => version.toLowerCase().includes(lq)) ||
    (item.fixVersions || []).some(version => version.toLowerCase().includes(lq))
}

function formatDueDate(d) {
  if (!d) return null
  const date = new Date(d + 'T00:00:00')
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const diff = Math.ceil((date - now) / 86400000)
  const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return { formatted, diff, isPast: diff < 0, isSoon: diff >= 0 && diff <= 7 }
}

function sortItems(items) {
  const { key, dir } = sortState.value
  if (!key) {
    return [...items].sort((a, b) => urgencyScore(a) - urgencyScore(b))
  }
  return [...items].sort((a, b) => {
    let va, vb
    switch (key) {
      case 'order': va = a.order || 9999; vb = b.order || 9999; break
      case 'rank': va = a.rank || 9999; vb = b.rank || 9999; break
      case 'key': va = a.key; vb = b.key; break
      case 'summary': va = a.summary?.toLowerCase(); vb = b.summary?.toLowerCase(); break
      case 'project': va = a.project || 'zzz'; vb = b.project || 'zzz'; break
      case 'parent': va = a.parent || 'zzz'; vb = b.parent || 'zzz'; break
      case 'priority': va = PRIORITY_ORDER[a.priority] ?? 99; vb = PRIORITY_ORDER[b.priority] ?? 99; break
      case 'status': va = STATUS_ORDER[a.status] ?? 99; vb = STATUS_ORDER[b.status] ?? 99; break
      case 'assignee': va = a.assignee || 'zzz'; vb = b.assignee || 'zzz'; break
      case 'targetVersions': va = (a.targetVersions || []).join(', ').toLowerCase() || 'zzz'; vb = (b.targetVersions || []).join(', ').toLowerCase() || 'zzz'; break
      case 'fixVersions': va = (a.fixVersions || []).join(', ').toLowerCase() || 'zzz'; vb = (b.fixVersions || []).join(', ').toLowerCase() || 'zzz'; break
      case 'stories': va = a.progress?.closed || 0; vb = b.progress?.closed || 0; break
      case 'duedate': va = a.duedate || '9999'; vb = b.duedate || '9999'; break
      default: return 0
    }
    if (va < vb) return dir === 'asc' ? -1 : 1
    if (va > vb) return dir === 'asc' ? 1 : -1
    return 0
  })
}

function toggleSort(key) {
  sortState.value = sortState.value.key === key
    ? { key, dir: sortState.value.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: 'asc' }
}

function squadFromUrl() {
  const path = moduleNav?.params?.value?.squad || ''
  return SQUADS_BY_PATH[path] || ''
}

function syncSquadUrl(squad) {
  if (!moduleNav?.updateParams) return
  const path = SQUAD_PATHS[squad] || null
  if ((moduleNav.params?.value?.squad || null) === path) return
  moduleNav.updateParams({ squad: path }, { push: false })
}

const selectedAssignee = ref('')
const selectedSquad = ref(squadFromUrl())

function isReleaseSelected(release) {
  return selectedReleases.value.includes(release)
}

function toggleRelease(release) {
  const selected = new Set(selectedReleases.value)
  selected.has(release) ? selected.delete(release) : selected.add(release)
  selectedReleases.value = RELEASE_ORDER.filter(candidate => selected.has(candidate))
}

watch(selectedSquad, syncSquadUrl)
if (moduleNav?.params) {
  watch(moduleNav.params, () => {
    const squad = squadFromUrl()
    if (squad !== selectedSquad.value) selectedSquad.value = squad
  })
}

function toggleFilter(key) { activeFilter.value = activeFilter.value === key ? null : key }
function toggleLane(name) { const s = new Set(expandedLanes.value); s.has(name) ? s.delete(name) : s.add(name); expandedLanes.value = s }
function toggleExpand(key) { const s = new Set(expandedFeatures.value); s.has(key) ? s.delete(key) : s.add(key); expandedFeatures.value = s }
function openChildren(item) { return (item.children || []).filter(c => c.status !== 'Closed') }
function clearFilters() { activeFilter.value = null; searchQuery.value = ''; selectedAssignee.value = ''; selectedSquad.value = '' }

function markdownCell(value) {
  return String(value || '—').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|')
}

function jiraLink(key) {
  return `[${key}](${JIRA}${key})`
}

function formatVersions(versions) {
  return (versions || []).join(', ') || '—'
}

function generateReleaseReport(relName) {
  const release = data.value?.releases.find(r => r.name === relName)
  if (!release) return

  const releaseName = RELEASE_DISPLAY[relName] || relName
  const strategies = release.strategies || []
  const lines = [
    `# ${releaseName} — RHAISTRAT Report`,
    '',
    `Generated: ${new Date().toLocaleString()}`,
    data.value?.lastUpdated ? `Backlog data refreshed: ${new Date(data.value.lastUpdated).toLocaleString()}` : '',
    '',
    '## RHAISTRAT Tickets',
    '',
  ]

  if (strategies.length === 0) {
    lines.push('No RHAISTRAT tickets are currently included in this release.', '')
  } else {
    lines.push('| Type | Ticket | Summary | Target Version | Fix Version | Priority | Status | Assignee | Squad |')
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |')
    for (const strategy of strategies) {
      lines.push(`| RHAISTRAT | ${jiraLink(strategy.key)} | ${markdownCell(strategy.summary)} | ${markdownCell(formatVersions(strategy.targetVersions))} | ${markdownCell(formatVersions(strategy.fixVersions))} | ${markdownCell(strategy.priority)} | ${markdownCell(strategy.status)} | ${markdownCell(strategy.assignee)} | ${markdownCell(strategy.squad)} |`)
    }
    lines.push('')
  }

  lines.push('## RHAISTRAT Tickets and Related Epics', '')
  if (strategies.length === 0) {
    lines.push('No RHAISTRAT tickets are currently included in this release.', '')
  }

  for (const strategy of strategies) {
    lines.push(`### ${jiraLink(strategy.key)} — ${markdownCell(strategy.summary)}`, '')
    lines.push(`- Status: ${markdownCell(strategy.status)}`)
    lines.push(`- Priority: ${markdownCell(strategy.priority)}`)
    lines.push(`- Assignee: ${markdownCell(strategy.assignee)}`)
    lines.push(`- Target Version: ${markdownCell(formatVersions(strategy.targetVersions))}`)
    lines.push(`- Fix Version: ${markdownCell(formatVersions(strategy.fixVersions))}`)
    lines.push('')

    const epics = strategy.children || []
    if (epics.length === 0) {
      lines.push('No related Epics.', '')
      continue
    }

    lines.push('| Epic | Summary | Status | Assignee |')
    lines.push('| --- | --- | --- | --- |')
    for (const epic of epics) {
      lines.push(`| ${jiraLink(epic.key)} | ${markdownCell(epic.summary)} | ${markdownCell(epic.status)} | ${markdownCell(epic.assignee)} |`)
    }
    lines.push('')
  }

  const markdown = `${lines.join('\n').trimEnd()}\n`
  const fileName = `${relName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}-rhaistrat-report.md`
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const hasActiveFilters = computed(() => activeFilter.value || searchQuery.value || selectedAssignee.value || selectedSquad.value)

const uniqueAssignees = computed(() => {
  const scopedItems = allItems.value.filter(item => selectedReleases.value.includes(item._release))
  if (!scopedItems.length) return []
  const set = new Set()
  let hasUnassigned = false
  for (const item of scopedItems) {
    if (item.assignee) set.add(item.assignee)
    else hasUnassigned = true
    for (const child of (item.children || [])) {
      if (child.assignee) set.add(child.assignee)
      else hasUnassigned = true
    }
  }
  const sorted = [...set].sort()
  if (hasUnassigned) sorted.unshift('__unassigned__')
  return sorted
})

const uniqueSquads = computed(() => {
  const scopedItems = allItems.value.filter(item => selectedReleases.value.includes(item._release))
  if (!scopedItems.length) return []
  const set = new Set()
  let hasNoSquad = false
  for (const item of scopedItems) {
    if (item.squad) set.add(item.squad)
    else hasNoSquad = true
  }
  const sorted = [...set].sort()
  if (hasNoSquad) sorted.push('__no_squad__')
  return sorted
})

const allItems = computed(() => {
  if (!data.value) return []
  return data.value.releases.flatMap(r => [
    ...(r.initiatives || []).map(i => ({ ...normalizeInitiative(i), _release: r.name })),
    ...r.features.map(f => ({ ...f, _release: r.name })),
    ...(r.packages || []).map(p => ({ ...normalizePackage(p), _release: r.name })),
    ...(r.strategies || []).map(strategy => ({ ...normalizeStrategy(strategy), _release: r.name })),
    ...(r.epics || []).map(epic => ({ ...normalizeEpic(epic), _release: r.name })),
    ...(r.rfes || []).map(rfe => ({ ...normalizeRfe(rfe), _release: r.name })),
  ])
})

function applyFilters(items, preserveJiraOrder = false) {
  let filtered = items
  if (activeFilter.value) filtered = filtered.filter(i => matchesFilter(i, activeFilter.value))
  if (searchQuery.value) filtered = filtered.filter(i => matchesSearch(i, searchQuery.value))
  if (selectedAssignee.value === '__unassigned__') filtered = filtered.filter(i => !i.assignee)
  else if (selectedAssignee.value) filtered = filtered.filter(i => i.assignee === selectedAssignee.value)
  if (selectedSquad.value === '__no_squad__') filtered = filtered.filter(i => !i.squad)
  else if (selectedSquad.value) filtered = filtered.filter(i => i.squad === selectedSquad.value)
  if (preserveJiraOrder && !sortState.value.key) return [...filtered].sort((a, b) => (a.order || 9999) - (b.order || 9999))
  return sortItems(filtered)
}

function laneItems(release) {
  const items = [
    ...(release.initiatives || []).map(normalizeInitiative),
    ...(release.features || []),
    ...(release.packages || []).map(normalizePackage),
    ...(release.strategies || []).map(normalizeStrategy),
    ...(release.epics || []).map(normalizeEpic),
    ...(release.rfes || []).map(normalizeRfe),
  ]
  return applyFilters(items)
}

function laneInitiatives(release) {
  return applyFilters((release.initiatives || []).map(normalizeInitiative))
}

function laneWorkItems(release) {
  return applyFilters([...(release.features || []), ...(release.packages || []).map(normalizePackage)])
}

function laneReviewReadyPackages(release) {
  return applyFilters((release.reviewReadyPackages || []).map(normalizePackage))
}

function laneRfes(release) {
  return applyFilters((release.rfes || []).map(normalizeRfe))
}

function laneStrategies(release) {
  return applyFilters((release.strategies || []).map(normalizeStrategy), true)
}

function laneEpics(release) {
  return applyFilters((release.epics || []).map(normalizeEpic), true)
}

const RFE_PRODUCTS = ['combined']
const RFE_PRODUCT_LABELS = { 'combined': 'All Products' }

function rfesByProduct(rfes) {
  return { combined: rfes }
}

function laneStats(release) {
  const items = [
    ...(release.initiatives || []).map(normalizeInitiative),
    ...(release.features || []),
    ...(release.packages || []).map(normalizePackage),
  ]
  const t = items.reduce((s, f) => s + (f.progress?.total || 0), 0)
  const c = items.reduce((s, f) => s + (f.progress?.closed || 0), 0)
  const initiativeCount = items.filter(i => i._isInitiative).length
  const featureCount = items.filter(i => !i._isPackage && !i._isInitiative).length
  const packageKeys = new Set(items.filter(i => i._isPackage).map(item => item.key))
  for (const epic of (release.epics || [])) {
    if (isPackageEpic(epic)) packageKeys.add(epic.key)
  }
  const packageCount = packageKeys.size
  const strategyCount = (release.strategies || []).length
  const epicCount = (release.epics || []).filter(epic => !isPackageEpic(epic)).length
  const rfeCount = (release.rfes || []).length
  return { initiativeCount, featureCount, packageCount, strategyCount, epicCount, rfeCount, totalEpics: t, closedEpics: c, pct: t > 0 ? Math.round((c / t) * 100) : 0 }
}

function countLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function laneCountSummary(release) {
  const counts = laneStats(release)
  const parts = []
  if (counts.initiativeCount) parts.push(countLabel(counts.initiativeCount, 'Initiative'))
  parts.push(countLabel(counts.featureCount, 'Feature'))
  parts.push(countLabel(counts.packageCount, 'Package'))
  if (counts.strategyCount) parts.push(countLabel(counts.strategyCount, 'Strategy', 'Strategies'))
  if (counts.epicCount) parts.push(countLabel(counts.epicCount, 'Epic'))
  if (counts.rfeCount) parts.push(countLabel(counts.rfeCount, 'RFE', 'RFEs'))
  return parts.join(' · ')
}

// Resizable columns
const colWidths = ref({})
function startResize(colKey, event) {
  event.preventDefault()
  const th = event.target.closest('th')
  if (!th) return
  const startX = event.clientX
  const startW = th.offsetWidth
  const onMove = (e) => { colWidths.value = { ...colWidths.value, [colKey]: Math.max(60, startW + e.clientX - startX) } }
  const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; document.body.style.userSelect = '' }
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}
function colStyle(key) { const w = colWidths.value[key]; return w ? { width: w + 'px', minWidth: '60px' } : {} }

const COLS = [
  { key: 'rank', label: 'Priority Rank' },
  { key: 'key', label: 'Key' },
  { key: 'summary', label: 'Summary' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'duedate', label: 'Due Date' },
]
const STRATEGY_COLS = [
  { key: 'order', label: 'Order' },
  { key: 'key', label: 'Key' },
  { key: 'summary', label: 'Summary' },
  { key: 'targetVersions', label: 'Target Version' },
  { key: 'fixVersions', label: 'Fix Version' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Assignee' },
]
const EPIC_COLS = [
  { key: 'order', label: 'Order' },
  { key: 'key', label: 'Key' },
  { key: 'summary', label: 'Summary' },
  { key: 'project', label: 'Project' },
  { key: 'targetVersions', label: 'Target Version' },
  { key: 'fixVersions', label: 'Fix Version' },
  { key: 'parent', label: 'Parent' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Assignee' },
]
const REVIEW_READY_PACKAGE_COLS = [
  { key: 'key', label: 'Key' },
  { key: 'summary', label: 'Package request' },
  { key: 'targetVersions', label: 'Target Version' },
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'stories', label: 'Stories Closed' },
]
</script>

<template>
  <div v-if="loading && !data" class="flex flex-col items-center justify-center py-20 gap-4">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    <p class="text-sm text-gray-500 dark:text-gray-400">Loading data from JIRA — this may take up to 2 minutes on first load</p>
  </div>

  <div v-else-if="error && !data" class="text-center py-20">
    <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Failed to load</h2>
    <p class="text-gray-500 dark:text-gray-400">{{ error }}</p>
    <button type="button" class="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700" @click="load">Try again</button>
  </div>

  <div v-else-if="data" class="space-y-5">
    <section class="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-800" aria-labelledby="release-selector-title">
      <div class="flex flex-wrap items-center gap-3">
        <div class="mr-2">
          <h2 id="release-selector-title" class="text-sm font-semibold text-gray-900 dark:text-gray-100">Select releases</h2>
          <p class="text-xs text-gray-400">Choose one or more releases to view their RHAISTRAT and AIPCC lists.</p>
        </div>
        <div class="flex flex-wrap gap-2" role="group" aria-label="Releases">
          <button v-for="release in RELEASE_ORDER" :key="release" type="button"
                  :aria-pressed="isReleaseSelected(release)"
                  class="rounded-full border px-4 py-2 text-sm font-semibold transition-all"
                  :class="isReleaseSelected(release)
                    ? `${RELEASE_BADGE[release]} border-current ring-2 ring-blue-500/30`
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-blue-600'"
                  @click="toggleRelease(release)">
            {{ RELEASE_DISPLAY[release] || release }}
          </button>
        </div>
        <button type="button"
                :aria-expanded="showJql"
                aria-controls="release-jql-panel"
                class="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-blue-600 dark:hover:bg-gray-600"
                @click="showJql = !showJql">
          <Code2 :size="14" />
          {{ showJql ? 'Hide JQL' : 'Show JQL' }}
        </button>
      </div>
    </section>

    <section v-if="showJql" id="release-jql-panel" class="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/40" aria-labelledby="release-jql-title">
      <div class="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 id="release-jql-title" class="text-sm font-semibold text-gray-900 dark:text-gray-100">JQL used for the release lists</h2>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">The server runs these queries, then the selected pills match Target Version, falling back to Fix Version.</p>
        </div>
        <button type="button" class="rounded p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200" aria-label="Hide JQL" @click="showJql = false">
          <X :size="16" />
        </button>
      </div>
      <div class="grid gap-4 xl:grid-cols-2">
        <article>
          <h3 class="mb-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">RHAISTRAT Strategies</h3>
          <pre class="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"><code>{{ data.jql?.strategies || 'JQL unavailable until the next data refresh.' }}</code></pre>
        </article>
        <article>
          <h3 class="mb-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">AIPCC Epics</h3>
          <pre class="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"><code>{{ data.jql?.epics || data.epicJql || 'JQL unavailable until the next data refresh.' }}</code></pre>
        </article>
        <article v-if="data.jql?.reviewReadyPackages" class="xl:col-span-2">
          <h3 class="mb-1.5 text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-300">3.6 EA2 packages ready to close</h3>
          <pre class="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"><code>{{ data.jql.reviewReadyPackages }}</code></pre>
        </article>
      </div>
    </section>

    <div v-if="selectedReleases.length === 0" class="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center dark:border-gray-600 dark:bg-gray-800/60">
      <Layers :size="30" class="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
      <p class="text-base font-semibold text-gray-700 dark:text-gray-200">No releases are selected.</p>
      <p class="mt-1 text-sm text-gray-400">Please select one or more releases to view their lists.</p>
    </div>

    <template v-else>

    <!-- Search and filters -->
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm px-5 py-4 flex flex-wrap items-center gap-x-5 gap-y-3">

      <!-- Search -->
      <div class="relative w-72">
        <Search :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search key, summary, assignee..."
          class="w-full h-10 pl-10 pr-9 text-sm bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all"
        />
        <button v-if="searchQuery" @click="searchQuery = ''" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <X :size="14" />
        </button>
      </div>

      <!-- Divider -->
      <div class="w-px h-8 bg-gray-200 dark:bg-gray-600 hidden md:block" />

      <!-- Assignee -->
      <div class="flex items-center gap-2">
        <Users :size="14" class="text-gray-400" />
        <select v-model="selectedAssignee"
                class="h-10 pl-3 pr-8 text-sm bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 min-w-[150px] appearance-none transition-all"
                style="background-image: url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%239ca3af%27 stroke-width=%272%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E'); background-repeat: no-repeat; background-position: right 10px center;">
          <option value="">Assignee: All</option>
          <option v-for="a in uniqueAssignees" :key="a" :value="a">{{ a === '__unassigned__' ? '— Unassigned —' : a }}</option>
        </select>
      </div>

      <!-- Team -->
      <div v-if="uniqueSquads.length > 0" class="flex items-center gap-2">
        <select v-model="selectedSquad"
                class="h-10 pl-3 pr-8 text-sm bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 min-w-[360px] appearance-none transition-all"
                style="background-image: url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%239ca3af%27 stroke-width=%272%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E'); background-repeat: no-repeat; background-position: right 10px center;">
          <option value="">Squad: All</option>
          <option v-for="t in uniqueSquads" :key="t" :value="t">{{ squadLabel(t) }}</option>
        </select>
      </div>

      <!-- Quick filters -->
      <div class="flex items-center gap-1.5">
        <button
          v-for="chip in [
            { key: 'blocked', label: 'Blocked', icon: AlertCircle, color: 'red' },
            { key: 'review', label: 'In Review', icon: CheckCircle2, color: 'green' },
            { key: 'unassigned', label: 'Unassigned', icon: Users, color: 'amber' },
          ]"
          :key="chip.key"
          class="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-xs font-semibold transition-all border"
          :class="[
            activeFilter === chip.key
              ? (chip.color === 'red' ? 'bg-red-50 text-red-700 border-red-300 ring-1 ring-red-200' : chip.color === 'green' ? 'bg-green-50 text-green-700 border-green-300 ring-1 ring-green-200' : 'bg-amber-50 text-amber-700 border-amber-300 ring-1 ring-amber-200')
              : 'bg-gray-50 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer'
          ]"
          @click="toggleFilter(chip.key)"
        >
          <component :is="chip.icon" :size="13" />
          {{ chip.label }}
        </button>
      </div>

      <!-- Spacer -->
      <div class="flex-1" />

      <!-- Refresh -->
      <button @click="refresh()" :disabled="loading" class="h-10 w-10 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors" title="Refresh data">
        <RefreshCw :size="16" :class="{ 'animate-spin': loading }" />
      </button>
    </div>

    <!-- Active filters pills -->
    <div v-if="hasActiveFilters" class="flex items-center gap-2 px-1 flex-wrap">
      <Filter :size="14" class="text-blue-600 flex-shrink-0" />
      <span v-if="activeFilter" class="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
        {{ activeFilter }} <button @click="activeFilter = null" class="hover:text-blue-900"><X :size="11" /></button>
      </span>
      <span v-if="selectedAssignee" class="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
        {{ selectedAssignee === '__unassigned__' ? 'Unassigned' : selectedAssignee }} <button @click="selectedAssignee = ''" class="hover:text-purple-900"><X :size="11" /></button>
      </span>
      <span v-if="selectedSquad" class="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-full text-xs font-medium">
        squad: {{ squadLabel(selectedSquad) }} <button @click="selectedSquad = ''" class="hover:text-teal-900"><X :size="11" /></button>
      </span>
      <span v-if="searchQuery" class="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-xs font-medium">
        "{{ searchQuery }}" <button @click="searchQuery = ''" class="hover:text-gray-900"><X :size="11" /></button>
      </span>
      <button @click="clearFilters()" class="text-[11px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded-full transition-colors">Clear all</button>
      <div class="flex-1" />
      <span class="text-[11px] text-gray-400">{{ data.lastUpdated ? 'Updated ' + new Date(data.lastUpdated).toLocaleString() : '' }}</span>
    </div>

      <template v-for="relName in RELEASE_ORDER.filter(release => selectedReleases.includes(release))" :key="relName">
        <template v-if="data.releases.find(r => r.name === relName)">
          <div v-if="laneItems(data.releases.find(r => r.name === relName)).length > 0"
               class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <!-- Lane header -->
            <div class="w-full px-5 py-3.5 flex items-center justify-between gap-4 text-white"
                 :class="RELEASE_HEADER[relName] || 'bg-gray-600'">
              <button type="button" class="min-w-0 flex flex-1 items-center gap-3 text-left hover:opacity-90 transition-opacity"
                      @click="toggleLane(relName)">
                <component :is="expandedLanes.has(relName) ? ChevronDown : ChevronRight" :size="18" class="opacity-70" />
                <h2 class="text-base font-semibold">{{ RELEASE_DISPLAY[relName] || relName }}</h2>
                <span class="text-xs opacity-70">{{ laneCountSummary(data.releases.find(r => r.name === relName)) }}</span>
              </button>
              <div class="flex items-center gap-3 flex-shrink-0">
                <div v-if="laneStats(data.releases.find(r => r.name === relName)).totalEpics > 0" class="flex items-center gap-3">
                  <div class="w-28 h-2 bg-white/25 rounded-full overflow-hidden">
                    <div class="h-full rounded-full bg-white/90 transition-all duration-300" :style="{ width: laneStats(data.releases.find(r => r.name === relName)).pct + '%' }" />
                  </div>
                  <span class="text-sm font-semibold tabular-nums">{{ laneStats(data.releases.find(r => r.name === relName)).pct }}%</span>
                  <span class="text-xs opacity-70 tabular-nums">{{ laneStats(data.releases.find(r => r.name === relName)).closedEpics }}/{{ laneStats(data.releases.find(r => r.name === relName)).totalEpics }}</span>
                </div>
                <button type="button" @click="generateReleaseReport(relName)"
                        class="inline-flex items-center gap-1.5 rounded-md border border-white/40 bg-white/10 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/20 transition-colors"
                        :aria-label="`Download ${RELEASE_DISPLAY[relName] || relName} report`">
                  <FileDown :size="14" />
                  Generate Report
                </button>
              </div>
            </div>

            <!-- Lane body -->
            <template v-if="expandedLanes.has(relName)">

              <!-- ── Package requests ready to close ── -->
              <div v-if="(data.releases.find(r => r.name === relName).reviewReadyPackages || []).length > 0">
                <button class="flex w-full cursor-pointer items-center gap-2 border-b border-green-200 bg-green-50 px-5 py-2 transition-colors hover:bg-green-100 dark:border-green-800/30 dark:bg-green-900/10 dark:hover:bg-green-900/20"
                        @click="toggleLane('ready-packages-' + relName)">
                  <component :is="expandedLanes.has('ready-packages-' + relName) ? ChevronDown : ChevronRight" :size="14" class="text-green-500" />
                  <CheckCircle2 :size="15" class="text-green-600 dark:text-green-400" />
                  <span class="text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-300">AIPCC package requests ready to close</span>
                  <span class="text-[11px] text-green-600 dark:text-green-400">({{ laneReviewReadyPackages(data.releases.find(r => r.name === relName)).length }})</span>
                  <span class="ml-2 text-[11px] font-normal normal-case tracking-normal text-green-600/80 dark:text-green-400/80">Status Review · all child Stories Closed</span>
                </button>
                <div v-if="expandedLanes.has('ready-packages-' + relName)" class="overflow-x-auto bg-green-50/20 dark:bg-green-900/5">
                  <table class="min-w-full">
                    <thead class="border-b border-green-200 bg-green-50/80 dark:border-green-800/40 dark:bg-green-900/10">
                      <tr>
                        <th v-for="column in REVIEW_READY_PACKAGE_COLS" :key="column.key"
                            class="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-green-700 dark:text-green-300">
                          <button type="button" class="flex items-center gap-1 hover:text-green-950 dark:hover:text-green-100" @click="toggleSort(column.key)">
                            {{ column.label }}
                            <component :is="sortState.key === column.key ? (sortState.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown"
                                       :size="11" :class="sortState.key === column.key ? 'text-blue-600' : 'text-green-300 dark:text-green-600'" />
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="item in laneReviewReadyPackages(data.releases.find(r => r.name === relName))" :key="item.key + '-ready'"
                          class="border-b border-green-100 transition-colors last:border-0 hover:bg-green-50/60 dark:border-green-900/20 dark:hover:bg-green-900/10">
                        <td class="whitespace-nowrap px-4 py-3">
                          <div class="flex items-center gap-2">
                            <span :class="TYPE_STYLE.package" class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase">Package</span>
                            <a :href="JIRA + item.key" target="_blank" rel="noreferrer" class="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">{{ item.key }}</a>
                          </div>
                        </td>
                        <td class="min-w-[320px] px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{{ item.summary }}</td>
                        <td class="min-w-[190px] px-4 py-3 text-xs text-gray-600 dark:text-gray-300"><span v-if="item.targetVersions.length">{{ item.targetVersions.join(', ') }}</span><span v-else class="text-gray-300 dark:text-gray-600">—</span></td>
                        <td class="whitespace-nowrap px-4 py-3"><span :class="STATUS_STYLE[item.status] || 'bg-gray-100 text-gray-600'" class="rounded px-2 py-0.5 text-xs font-medium">{{ item.status }}</span></td>
                        <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300"><span v-if="item.assignee">{{ item.assignee }}</span><span v-else class="text-xs font-medium text-red-500">— unassigned</span></td>
                        <td class="whitespace-nowrap px-4 py-3">
                          <span class="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                            <CheckCircle2 :size="13" /> {{ item.progress.closed }}/{{ item.progress.total }}
                          </span>
                        </td>
                      </tr>
                      <tr v-if="laneReviewReadyPackages(data.releases.find(r => r.name === relName)).length === 0">
                        <td :colspan="REVIEW_READY_PACKAGE_COLS.length" class="px-6 py-8 text-center text-sm text-gray-400">No ready-to-close package requests match the current filters.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- ── Initiatives subsection (collapsible) ── -->
              <div v-if="laneInitiatives(data.releases.find(r => r.name === relName)).length > 0">
                <button class="w-full px-5 py-2 bg-violet-50 dark:bg-violet-900/10 border-b border-violet-200 dark:border-violet-800/30 flex items-center gap-2 hover:bg-violet-100 dark:hover:bg-violet-900/20 transition-colors cursor-pointer"
                        @click="toggleLane('ini-' + relName)">
                  <component :is="expandedLanes.has('ini-' + relName) ? ChevronDown : ChevronRight" :size="14" class="text-violet-400" />
                  <div class="w-1.5 h-4 rounded-full bg-violet-500" />
                  <span class="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wider">Initiatives</span>
                  <span class="text-[11px] text-violet-500 dark:text-violet-400">({{ laneInitiatives(data.releases.find(r => r.name === relName)).length }})</span>
                </button>
                <div v-if="expandedLanes.has('ini-' + relName)" class="overflow-x-auto bg-violet-50/30 dark:bg-violet-900/5">
                  <table class="min-w-full">
                    <tbody>
                      <template v-for="item in laneInitiatives(data.releases.find(r => r.name === relName))" :key="item.key">
                        <tr class="border-b border-violet-100 dark:border-violet-800/20 transition-colors hover:bg-violet-50 dark:hover:bg-violet-900/10 border-l-[3px] border-l-violet-500">
                          <td class="w-10 px-2 py-3 text-center">
                            <button v-if="openChildren(item).length > 0" @click="toggleExpand(item.key)"
                                    class="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors rounded">
                              <component :is="expandedFeatures.has(item.key) ? ChevronDown : ChevronRight" :size="15" />
                            </button>
                          </td>
                          <td class="px-3 py-3 text-center whitespace-nowrap">
                            <span v-if="item.rank" class="text-xs font-bold text-gray-500 dark:text-gray-400">#{{ item.rank }}</span>
                            <span v-else class="text-gray-300">—</span>
                          </td>
                          <td class="px-4 py-3 whitespace-nowrap">
                            <div class="flex items-center gap-2.5">
                              <span :class="TYPE_STYLE.initiative" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide leading-none">Initiative</span>
                              <a :href="JIRA + item.key" target="_blank" rel="noreferrer" class="text-blue-600 hover:underline text-sm font-semibold">{{ item.key }}</a>
                            </div>
                          </td>
                          <td class="px-4 py-3"><span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ item.summary }}</span> <span v-if="openChildren(item).length > 0" class="text-[11px] text-gray-400 ml-1.5">({{ openChildren(item).length }} children)</span></td>
                          <td class="px-4 py-3 whitespace-nowrap"><span :class="PRIORITY_STYLE[item.priority] || PRIORITY_STYLE['Undefined']" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium">{{ item.priority }}</span></td>
                          <td class="px-4 py-3 whitespace-nowrap"><span :class="STATUS_STYLE[item.status] || 'bg-gray-100 text-gray-600'" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium">{{ item.status }}</span></td>
                          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300"><span v-if="item.assignee">{{ item.assignee }}</span><span v-else class="text-red-500 font-medium text-xs">—  unassigned</span></td>
                          <td class="px-4 py-3 whitespace-nowrap">
                            <template v-if="formatDueDate(item.duedate)"><span v-if="formatDueDate(item.duedate).isPast" class="text-red-700 font-semibold text-xs">{{ formatDueDate(item.duedate).formatted }} <span class="bg-red-600 text-white px-1 py-0.5 rounded text-[10px] font-bold uppercase">overdue</span></span><span v-else-if="formatDueDate(item.duedate).isSoon" class="text-amber-600 font-medium text-xs">{{ formatDueDate(item.duedate).formatted }}</span><span v-else class="text-gray-600 text-xs">{{ formatDueDate(item.duedate).formatted }}</span></template>
                            <span v-else class="text-gray-300 text-sm">—</span>
                          </td>
                        </tr>
                        <template v-if="expandedFeatures.has(item.key)">
                          <tr v-for="(child, ci) in openChildren(item)" :key="child.key"
                              class="border-b border-violet-50 dark:border-violet-900/10 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 bg-white/60 dark:bg-gray-800/60 border-l-[3px] border-l-violet-200 dark:border-l-violet-800">
                            <td class="w-10" />
                            <td class="py-2.5 whitespace-nowrap">
                              <div class="flex items-center gap-2 pl-4">
                                <span class="text-violet-300 dark:text-violet-700 text-xs font-mono select-none w-4 text-right">{{ ci < openChildren(item).length - 1 ? '├─' : '└─' }}</span>
                                <span :class="TYPE_STYLE.epic" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide leading-none">{{ child.type || 'Epic' }}</span>
                                <a :href="JIRA + child.key" target="_blank" rel="noreferrer" class="text-blue-500 hover:underline text-xs font-medium">{{ child.key }}</a>
                              </div>
                            </td>
                            <td class="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400">{{ child.summary }}</td>
                            <td class="px-4 py-2.5" />
                            <td class="px-4 py-2.5"><span :class="STATUS_STYLE[child.status] || 'bg-gray-100 text-gray-600'" class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium">{{ child.status }}</span></td>
                            <td class="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400"><span v-if="child.assignee">{{ child.assignee }}</span><span v-else class="text-red-500 font-medium">—</span></td>
                            <td class="px-4 py-2.5" />
                          </tr>
                        </template>
                      </template>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- ── Features & Packages subsection ── -->
              <div v-if="laneWorkItems(data.releases.find(r => r.name === relName)).length > 0" class="overflow-x-auto">
                <table class="min-w-full">
                  <thead class="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                    <tr>
                      <th class="w-10 px-2 py-3" />
                      <th v-for="(col, ci) in COLS" :key="col.key" :style="colStyle(col.key)"
                          class="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider select-none relative">
                        <button class="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100 transition-colors" @click="toggleSort(col.key)">
                          {{ col.label }}
                          <component :is="sortState.key === col.key ? (sortState.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown"
                                     :size="11" :class="sortState.key === col.key ? 'text-blue-600' : 'text-gray-300 dark:text-gray-500'" />
                        </button>
                        <span v-if="ci < COLS.length - 1"
                              class="absolute top-0 -right-px w-[5px] h-full cursor-col-resize flex items-center justify-center before:content-[''] before:block before:w-px before:h-3/5 before:bg-gray-200 before:dark:bg-gray-600 before:rounded-full hover:before:bg-blue-500 hover:before:w-[3px] active:before:bg-blue-600"
                              @mousedown="startResize(col.key, $event)" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <template v-for="item in laneWorkItems(data.releases.find(r => r.name === relName))" :key="item.key">
                      <tr class="border-b border-gray-100 dark:border-gray-700/50 transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-700/30 border-l-[3px]"
                          :class="ROW_BORDER[itemType(item)]">
                        <td class="w-10 px-2 py-3 text-center">
                          <button v-if="openChildren(item).length > 0" @click="toggleExpand(item.key)"
                                  class="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors rounded">
                            <component :is="expandedFeatures.has(item.key) ? ChevronDown : ChevronRight" :size="15" />
                          </button>
                        </td>
                        <td class="px-3 py-3 text-center whitespace-nowrap">
                          <span v-if="item.rank" class="text-xs font-bold text-gray-500 dark:text-gray-400">#{{ item.rank }}</span>
                          <span v-else class="text-gray-300">—</span>
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap">
                          <div class="flex items-center gap-2.5">
                            <span :class="TYPE_STYLE[itemType(item)]" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide leading-none">
                              {{ item._isPackage ? 'Package' : 'Feature' }}
                            </span>
                            <a :href="JIRA + item.key" target="_blank" rel="noreferrer" class="text-blue-600 hover:underline text-sm font-semibold">{{ item.key }}</a>
                          </div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="min-w-0">
                            <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ item.summary }}</span>
                            <span v-if="openChildren(item).length > 0" class="text-[11px] text-gray-400 ml-1.5">({{ openChildren(item).length }} open)</span>
                            <span v-if="item._isPackage && item._pipelineStage?.length" class="inline-flex gap-1 ml-2">
                              <span v-for="s in item._pipelineStage" :key="s" :class="PIPELINE_STYLE[s] || 'bg-gray-200 text-gray-700'" class="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase">{{ s }}</span>
                            </span>
                          </div>
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap"><span :class="PRIORITY_STYLE[item.priority] || PRIORITY_STYLE['Undefined']" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium">{{ item.priority }}</span></td>
                        <td class="px-4 py-3 whitespace-nowrap"><span :class="STATUS_STYLE[item.status] || 'bg-gray-100 text-gray-600'" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium">{{ item.status }}</span></td>
                        <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300"><span v-if="item.assignee">{{ item.assignee }}</span><span v-else class="text-red-500 font-medium text-xs">—  unassigned</span></td>
                        <td class="px-4 py-3 whitespace-nowrap">
                          <template v-if="formatDueDate(item.duedate)"><span v-if="formatDueDate(item.duedate).isPast" class="text-red-700 dark:text-red-400 font-semibold text-xs flex items-center gap-1">{{ formatDueDate(item.duedate).formatted }} <span class="bg-red-600 text-white px-1 py-0.5 rounded text-[10px] font-bold uppercase">overdue</span></span><span v-else-if="formatDueDate(item.duedate).isSoon" class="text-amber-600 dark:text-amber-400 font-medium text-xs flex items-center gap-1">{{ formatDueDate(item.duedate).formatted }} <span class="bg-amber-100 text-amber-700 px-1 py-0.5 rounded text-[10px] font-semibold">{{ formatDueDate(item.duedate).diff }}d</span></span><span v-else class="text-gray-600 dark:text-gray-300 text-xs">{{ formatDueDate(item.duedate).formatted }}</span></template>
                          <span v-else class="text-gray-300 text-sm">—</span>
                        </td>
                      </tr>
                      <!-- Child rows -->
                      <template v-if="expandedFeatures.has(item.key)">
                        <template v-for="(child, ci) in openChildren(item)" :key="child.key">
                          <tr class="border-b border-gray-50 dark:border-gray-700/30 transition-colors hover:bg-blue-50/40 dark:hover:bg-gray-700/40 bg-gray-50/60 dark:bg-gray-800/60 border-l-[3px] border-l-gray-200 dark:border-l-gray-600">
                            <td class="w-10 text-center">
                              <button v-if="openChildren(child).length > 0" @click="toggleExpand(child.key)" class="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors rounded ml-2">
                                <component :is="expandedFeatures.has(child.key) ? ChevronDown : ChevronRight" :size="13" />
                              </button>
                            </td>
                            <td class="py-2.5 whitespace-nowrap">
                              <div class="flex items-center gap-2 pl-4">
                                <span class="text-gray-300 dark:text-gray-600 text-xs font-mono select-none w-4 text-right">{{ ci < openChildren(item).length - 1 ? '├─' : '└─' }}</span>
                                <span :class="TYPE_STYLE.epic" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide leading-none">Epic</span>
                                <a :href="JIRA + child.key" target="_blank" rel="noreferrer" class="text-blue-500 hover:underline text-xs font-medium">{{ child.key }}</a>
                              </div>
                            </td>
                            <td class="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400">{{ child.summary }} <span v-if="openChildren(child).length > 0" class="text-[10px] text-gray-400 ml-1">({{ openChildren(child).length }})</span></td>
                            <td class="px-4 py-2.5" />
                            <td class="px-4 py-2.5"><span :class="STATUS_STYLE[child.status] || 'bg-gray-100 text-gray-600'" class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium">{{ child.status }}</span></td>
                            <td class="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400"><span v-if="child.assignee">{{ child.assignee }}</span><span v-else class="text-red-500 font-medium">—  unassigned</span></td>
                            <td class="px-4 py-2.5" />
                          </tr>
                          <template v-if="expandedFeatures.has(child.key)">
                            <tr v-for="(gc, gci) in openChildren(child)" :key="gc.key"
                                class="border-b border-gray-50/50 dark:border-gray-700/20 transition-colors hover:bg-blue-50/30 dark:hover:bg-gray-700/30 bg-gray-100/50 dark:bg-gray-800/80 border-l-[3px] border-l-gray-100 dark:border-l-gray-700">
                              <td class="w-10" />
                              <td class="py-2 whitespace-nowrap">
                                <div class="flex items-center gap-2 pl-12">
                                  <span class="text-gray-300 dark:text-gray-600 text-[11px] font-mono select-none w-4 text-right">{{ gci < openChildren(child).length - 1 ? '├─' : '└─' }}</span>
                                  <a :href="JIRA + gc.key" target="_blank" rel="noreferrer" class="text-blue-400 hover:underline text-[11px] font-medium">{{ gc.key }}</a>
                                </div>
                              </td>
                              <td class="px-4 py-2 text-[11px] text-gray-500 dark:text-gray-400">{{ gc.summary }}</td>
                              <td class="px-4 py-2" />
                              <td class="px-4 py-2"><span :class="STATUS_STYLE[gc.status] || 'bg-gray-100 text-gray-600'" class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium">{{ gc.status }}</span></td>
                              <td class="px-4 py-2 text-[11px] text-gray-500 dark:text-gray-400"><span v-if="gc.assignee">{{ gc.assignee }}</span><span v-else class="text-red-400 font-medium">—</span></td>
                              <td class="px-4 py-2" />
                            </tr>
                          </template>
                        </template>
                      </template>
                    </template>
                  </tbody>
                </table>
              </div>

              <!-- ── RHAISTRAT subsection (collapsible, sub-grouped by product) ── -->
              <div>
                <button class="w-full px-5 py-2 bg-indigo-50 dark:bg-indigo-900/10 border-b border-indigo-200 dark:border-indigo-800/30 flex items-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer"
                        @click="toggleLane('strategy-' + relName)">
                  <component :is="expandedLanes.has('strategy-' + relName) ? ChevronDown : ChevronRight" :size="14" class="text-indigo-400" />
                  <div class="w-1.5 h-4 rounded-full bg-indigo-500" />
                  <span class="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">RHAISTRAT</span>
                  <span class="text-[11px] text-indigo-500 dark:text-indigo-400">({{ laneStrategies(data.releases.find(r => r.name === relName)).length }})</span>
                </button>
                <div v-if="expandedLanes.has('strategy-' + relName)" class="overflow-x-auto bg-indigo-50/30 dark:bg-indigo-900/5">
                  <div v-if="laneStrategies(data.releases.find(r => r.name === relName)).length === 0" class="px-5 py-8 text-center text-sm text-gray-400">
                    No RHAISTRAT items match this release and the current filters.
                  </div>
                  <template v-for="product in RFE_PRODUCTS" :key="product">
                    <template v-if="rfesByProduct(laneStrategies(data.releases.find(r => r.name === relName)))[product]?.length > 0">
                      <div class="px-5 py-1.5 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-200 dark:border-gray-600 flex items-center gap-2">
                        <span :class="PRODUCT_STYLE[product]" class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{{ RFE_PRODUCT_LABELS[product] }}</span>
                        <span class="text-[11px] text-gray-400">({{ rfesByProduct(laneStrategies(data.releases.find(r => r.name === relName)))[product].length }})</span>
                      </div>
                      <table class="min-w-full">
                        <thead class="border-b border-indigo-200 bg-indigo-50/80 dark:border-indigo-800/40 dark:bg-indigo-900/10">
                          <tr>
                            <th class="w-10 px-2 py-3" />
                            <th v-for="column in STRATEGY_COLS" :key="column.key"
                                class="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                              <button type="button" class="flex items-center gap-1 hover:text-indigo-900 dark:hover:text-indigo-100" @click="toggleSort(column.key)">
                                {{ column.label }}
                                <component :is="sortState.key === column.key ? (sortState.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown"
                                           :size="11" :class="sortState.key === column.key ? 'text-blue-600' : 'text-indigo-300 dark:text-indigo-600'" />
                              </button>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <template v-for="item in rfesByProduct(laneStrategies(data.releases.find(r => r.name === relName)))[product]" :key="item.key + '-' + product">
                            <tr class="border-b border-indigo-100 dark:border-indigo-800/20 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/10 border-l-[3px] border-l-indigo-500">
                              <td class="w-10 px-2 py-3 text-center">
                                <button v-if="item.children?.length > 0" @click="toggleExpand(item.key)"
                                        class="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors rounded">
                                  <component :is="expandedFeatures.has(item.key) ? ChevronDown : ChevronRight" :size="15" />
                                </button>
                              </td>
                              <td class="px-3 py-3 text-center whitespace-nowrap"><span class="text-xs font-semibold text-gray-400">{{ item.order }}</span></td>
                              <td class="px-4 py-3 whitespace-nowrap">
                                <div class="flex items-center gap-2.5">
                                  <span :class="TYPE_STYLE.strategy" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide leading-none">Strategy</span>
                                  <a :href="JIRA + item.key" target="_blank" rel="noreferrer" class="text-blue-600 hover:underline text-sm font-semibold">{{ item.key }}</a>
                                </div>
                              </td>
                              <td class="px-4 py-3">
                                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ item.summary }}</span>
                                <span v-if="item.children?.length > 0" class="text-[11px] text-gray-400 ml-1.5">({{ item.children.length }} epics)</span>
                              </td>
                              <td class="min-w-[190px] px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                                <span v-if="item.targetVersions?.length">{{ item.targetVersions.join(', ') }}</span>
                                <span v-else class="text-gray-300 dark:text-gray-600">—</span>
                              </td>
                              <td class="min-w-[190px] px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                                <span v-if="item.fixVersions?.length">{{ item.fixVersions.join(', ') }}</span>
                                <span v-else class="text-gray-300 dark:text-gray-600">—</span>
                              </td>
                              <td class="px-4 py-3 whitespace-nowrap"><span :class="PRIORITY_STYLE[item.priority] || PRIORITY_STYLE['Undefined']" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium">{{ item.priority }}</span></td>
                              <td class="px-4 py-3 whitespace-nowrap"><span :class="STATUS_STYLE[item.status] || 'bg-gray-100 text-gray-600'" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium">{{ item.status }}</span></td>
                              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300"><span v-if="item.assignee">{{ item.assignee }}</span><span v-else class="text-red-500 font-medium text-xs">—  unassigned</span></td>
                            </tr>
                            <template v-if="expandedFeatures.has(item.key)">
                              <tr v-for="(child, ci) in item.children" :key="child.key"
                                  class="border-b border-indigo-50 dark:border-indigo-900/10 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 bg-white/60 dark:bg-gray-800/60 border-l-[3px] border-l-indigo-200 dark:border-l-indigo-800">
                                <td class="w-10" />
                                <td colspan="2" class="py-2.5 whitespace-nowrap">
                                  <div class="flex items-center gap-2 pl-4">
                                    <span class="text-indigo-300 dark:text-indigo-700 text-xs font-mono select-none w-4 text-right">{{ ci < item.children.length - 1 ? '├─' : '└─' }}</span>
                                    <span :class="TYPE_STYLE.epic" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide leading-none">{{ child.type || 'Epic' }}</span>
                                    <a :href="JIRA + child.key" target="_blank" rel="noreferrer" class="text-blue-500 hover:underline text-xs font-medium">{{ child.key }}</a>
                                  </div>
                                </td>
                                <td class="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400">{{ child.summary }}</td>
                                <td class="px-4 py-2.5" />
                                <td class="px-4 py-2.5" />
                                <td class="px-4 py-2.5" />
                                <td class="px-4 py-2.5"><span :class="STATUS_STYLE[child.status] || 'bg-gray-100 text-gray-600'" class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium">{{ child.status }}</span></td>
                                <td class="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400"><span v-if="child.assignee">{{ child.assignee }}</span><span v-else class="text-red-500 font-medium">—</span></td>
                              </tr>
                            </template>
                          </template>
                        </tbody>
                      </table>
                    </template>
                  </template>
                </div>
              </div>

              <!-- ── AIPCC subsection (Epics grouped into this release) ── -->
              <div>
                <button class="flex w-full cursor-pointer items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2 transition-colors hover:bg-amber-100 dark:border-amber-800/30 dark:bg-amber-900/10 dark:hover:bg-amber-900/20"
                        @click="toggleLane('aipcc-' + relName)">
                  <component :is="expandedLanes.has('aipcc-' + relName) ? ChevronDown : ChevronRight" :size="14" class="text-amber-500" />
                  <div class="h-4 w-1.5 rounded-full bg-amber-500" />
                  <span class="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">AIPCC</span>
                  <span class="text-[11px] text-amber-600 dark:text-amber-400">({{ laneEpics(data.releases.find(r => r.name === relName)).length }})</span>
                </button>
                <div v-if="expandedLanes.has('aipcc-' + relName)" class="overflow-x-auto bg-amber-50/20 dark:bg-amber-900/5">
                  <table class="min-w-full">
                    <thead class="border-b border-amber-200 bg-amber-50/80 dark:border-amber-800/40 dark:bg-amber-900/10">
                      <tr>
                        <th v-for="column in EPIC_COLS" :key="column.key"
                            class="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                          <button type="button" class="flex items-center gap-1 hover:text-amber-950 dark:hover:text-amber-100" @click="toggleSort(column.key)">
                            {{ column.label }}
                            <component :is="sortState.key === column.key ? (sortState.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown"
                                       :size="11" :class="sortState.key === column.key ? 'text-blue-600' : 'text-amber-300 dark:text-amber-600'" />
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="item in laneEpics(data.releases.find(r => r.name === relName))" :key="item.key + '-' + relName"
                          class="border-b border-amber-100 transition-colors last:border-0 hover:bg-amber-50/50 dark:border-amber-900/20 dark:hover:bg-amber-900/10">
                        <td class="px-4 py-3 text-center text-xs font-semibold text-gray-400">{{ item.order }}</td>
                        <td class="whitespace-nowrap px-4 py-3">
                          <div class="flex items-center gap-2">
                            <span :class="item.isPackage ? TYPE_STYLE.package : TYPE_STYLE.epic" class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase">{{ item.isPackage ? 'Package' : 'Epic' }}</span>
                            <a :href="JIRA + item.key" target="_blank" rel="noreferrer" class="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">{{ item.key }}</a>
                          </div>
                        </td>
                        <td class="min-w-[340px] px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{{ item.summary }}</td>
                        <td class="whitespace-nowrap px-4 py-3">
                          <span :class="PROJECT_STYLE[item.project] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'" class="rounded px-2 py-1 text-[11px] font-bold">{{ item.project }}</span>
                        </td>
                        <td class="min-w-[190px] px-4 py-3 text-xs text-gray-600 dark:text-gray-300"><span v-if="item.targetVersions.length">{{ item.targetVersions.join(', ') }}</span><span v-else class="text-gray-300 dark:text-gray-600">—</span></td>
                        <td class="min-w-[190px] px-4 py-3 text-xs text-gray-600 dark:text-gray-300"><span v-if="item.fixVersions.length">{{ item.fixVersions.join(', ') }}</span><span v-else class="text-gray-300 dark:text-gray-600">—</span></td>
                        <td class="whitespace-nowrap px-4 py-3 text-xs"><a v-if="item.parent" :href="JIRA + item.parent" target="_blank" rel="noreferrer" class="font-medium text-blue-500 hover:underline">{{ item.parent }}</a><span v-else class="text-gray-300 dark:text-gray-600">—</span></td>
                        <td class="whitespace-nowrap px-4 py-3"><span :class="PRIORITY_STYLE[item.priority] || PRIORITY_STYLE.Undefined" class="rounded px-2 py-0.5 text-xs font-medium">{{ item.priority }}</span></td>
                        <td class="whitespace-nowrap px-4 py-3"><span :class="STATUS_STYLE[item.status] || 'bg-gray-100 text-gray-600'" class="rounded px-2 py-0.5 text-xs font-medium">{{ item.status }}</span></td>
                        <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300"><span v-if="item.assignee">{{ item.assignee }}</span><span v-else class="text-xs font-medium text-red-500">— unassigned</span></td>
                      </tr>
                      <tr v-if="laneEpics(data.releases.find(r => r.name === relName)).length === 0">
                        <td :colspan="EPIC_COLS.length" class="px-6 py-8 text-center text-sm text-gray-400">No AIPCC Epics match this release and the current filters.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- ── RFEs subsection (collapsible, sub-grouped by product) ── -->
              <div v-if="laneRfes(data.releases.find(r => r.name === relName)).length > 0">
                <button class="w-full px-5 py-2 bg-emerald-50 dark:bg-emerald-900/10 border-b border-emerald-200 dark:border-emerald-800/30 flex items-center gap-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors cursor-pointer"
                        @click="toggleLane('rfe-' + relName)">
                  <component :is="expandedLanes.has('rfe-' + relName) ? ChevronDown : ChevronRight" :size="14" class="text-emerald-400" />
                  <div class="w-1.5 h-4 rounded-full bg-emerald-500" />
                  <span class="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">RFEs</span>
                  <span class="text-[11px] text-emerald-500 dark:text-emerald-400">({{ laneRfes(data.releases.find(r => r.name === relName)).length }})</span>
                </button>
                <div v-if="expandedLanes.has('rfe-' + relName)" class="overflow-x-auto bg-emerald-50/30 dark:bg-emerald-900/5">
                  <template v-for="product in RFE_PRODUCTS" :key="product">
                    <template v-if="rfesByProduct(laneRfes(data.releases.find(r => r.name === relName)))[product]?.length > 0">
                      <div class="px-5 py-1.5 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-200 dark:border-gray-600 flex items-center gap-2">
                        <span :class="PRODUCT_STYLE[product]" class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{{ RFE_PRODUCT_LABELS[product] }}</span>
                        <span class="text-[11px] text-gray-400">({{ rfesByProduct(laneRfes(data.releases.find(r => r.name === relName)))[product].length }})</span>
                      </div>
                      <table class="min-w-full">
                        <tbody>
                          <template v-for="item in rfesByProduct(laneRfes(data.releases.find(r => r.name === relName)))[product]" :key="item.key + '-' + product">
                            <tr class="border-b border-emerald-100 dark:border-emerald-800/20 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/10 border-l-[3px] border-l-emerald-500">
                              <td class="w-10 px-2 py-3 text-center">
                                <button v-if="item.children?.length > 0" @click="toggleExpand(item.key)"
                                        class="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors rounded">
                                  <component :is="expandedFeatures.has(item.key) ? ChevronDown : ChevronRight" :size="15" />
                                </button>
                              </td>
                              <td class="px-3 py-3 text-center whitespace-nowrap"><span class="text-gray-300">—</span></td>
                              <td class="px-4 py-3 whitespace-nowrap">
                                <div class="flex items-center gap-2.5">
                                  <span :class="TYPE_STYLE.rfe" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide leading-none">RFE</span>
                                  <a :href="JIRA + item.key" target="_blank" rel="noreferrer" class="text-blue-600 hover:underline text-sm font-semibold">{{ item.key }}</a>
                                </div>
                              </td>
                              <td class="px-4 py-3">
                                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ item.summary }}</span>
                                <span v-if="item.children?.length > 0" class="text-[11px] text-gray-400 ml-1.5">({{ item.children.length }} linked)</span>
                              </td>
                              <td class="px-4 py-3 whitespace-nowrap"><span :class="PRIORITY_STYLE[item.priority] || PRIORITY_STYLE['Undefined']" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium">{{ item.priority }}</span></td>
                              <td class="px-4 py-3 whitespace-nowrap"><span :class="STATUS_STYLE[item.status] || 'bg-gray-100 text-gray-600'" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium">{{ item.status }}</span></td>
                              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300"><span v-if="item.assignee">{{ item.assignee }}</span><span v-else class="text-red-500 font-medium text-xs">—  unassigned</span></td>
                              <td class="px-4 py-3 whitespace-nowrap"><span class="text-gray-300 text-sm">—</span></td>
                            </tr>
                            <template v-if="expandedFeatures.has(item.key)">
                              <tr v-for="(child, ci) in item.children" :key="child.key"
                                  class="border-b border-emerald-50 dark:border-emerald-900/10 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 bg-white/60 dark:bg-gray-800/60 border-l-[3px] border-l-emerald-200 dark:border-l-emerald-800">
                                <td class="w-10" />
                                <td class="py-2.5 whitespace-nowrap">
                                  <div class="flex items-center gap-2 pl-4">
                                    <span class="text-emerald-300 dark:text-emerald-700 text-xs font-mono select-none w-4 text-right">{{ ci < item.children.length - 1 ? '├─' : '└─' }}</span>
                                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide leading-none bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800">Strategy</span>
                                    <a :href="JIRA + child.key" target="_blank" rel="noreferrer" class="text-blue-500 hover:underline text-xs font-medium">{{ child.key }}</a>
                                  </div>
                                </td>
                                <td class="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400">{{ child.summary }}</td>
                                <td class="px-4 py-2.5" />
                                <td class="px-4 py-2.5"><span :class="STATUS_STYLE[child.status] || 'bg-gray-100 text-gray-600'" class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium">{{ child.status }}</span></td>
                                <td class="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400"><span v-if="child.assignee">{{ child.assignee }}</span><span v-else class="text-red-500 font-medium">—</span></td>
                                <td class="px-4 py-2.5" />
                              </tr>
                            </template>
                          </template>
                        </tbody>
                      </table>
                    </template>
                  </template>
                </div>
              </div>

            </template>
          </div>
        </template>
      </template>

    </template>
  </div>
</template>
