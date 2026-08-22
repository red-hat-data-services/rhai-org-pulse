<script setup>
import { ref, shallowRef, computed, onMounted, watch } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js'
import { useAiAdoption } from '../composables/useAiAdoption.js'
import { apiRequest } from '@shared/client'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Filler, Tooltip, Legend)

const PIPELINE_META = {
  stratCreator: { name: 'Strategy Creator', short: 'Strat', description: 'AI auto-generates and refines feature strategy definitions, validated against a quality rubric with optional human sign-off.', labels: ['strat-creator-auto-created', 'strat-creator-auto-refined', 'strat-creator-rubric-pass', 'strat-creator-human-sign-off'] },
  rfeCreator: { name: 'RFE Creator', short: 'RFE', description: 'AI auto-creates RFEs, runs feasibility assessment, auto-fixes quality issues, and can split large features.', labels: ['rfe-creator-auto-created', 'rfe-creator-autofix-rubric-pass', 'rfe-creator-feasibility-pass', 'rfe-creator-split-result'] },
  testPlan: { name: 'Test Plan Generator', short: 'Test Plan', description: 'AI auto-generates and revises test plans for features, validated against a quality rubric.', labels: ['test-plan-auto-created', 'test-plan-auto-revised', 'test-plan-rubric-pass'] },
  qg1: { name: 'Priority Scoring (QG1)', short: 'QG1', description: 'Automated RICE priority scoring and quality gate evaluation for feature prioritization.', labels: ['rp-qg1-auto-rice', 'rp-qg1-pass', 'rp-qg1-fail'] },
  aiDoc: { name: 'AI-First Documentation', short: 'AI Doc', description: 'AI contributes documentation drafts, Jira content, and technical writing.', labels: ['ai1st-doc-contributed', 'ai1st-doc-invoked', 'ai1st-jira-contributed'] },
  uxdAgentic: { name: 'UXD Agentic', short: 'UXD', description: 'AI-assisted UX design process for generating or validating design specifications.', labels: ['uxd-agentic'] },
  epicCreator: { name: 'Epic Creator / Decomposer', short: 'Epic Creator', description: 'AI decomposes signed-off STRATs into implementation epics with visible dependencies, producing structured work breakdown for component teams.', labels: ['epic-creator-auto-decomposed', 'epic-creator-auto-created', 'epic-creator-split-result'] }
}
const PIPELINE_KEYS = Object.keys(PIPELINE_META)
const RELEASE_OPTIONS = [
  { value: 'all', label: 'All Releases' },
  { value: '3.4 GA', label: '3.4 GA' },
  { value: '3.5 EA1', label: '3.5 EA1' },
  { value: '3.5 EA2', label: '3.5 EA2' },
  { value: '3.5 GA', label: '3.5 GA' }
]
const BASELINE_NAME = '3.4 GA'

const { data, loading, error, fetchData } = useAiAdoption()
const scorecardData = shallowRef(null)
const selectedRelease = ref('all')
const selectedComponent = ref('all')
const expandedPipelines = ref({})
const scorecardView = ref('table')
const selectedChartMetric = ref('features')
const selectedBaseline = ref(BASELINE_NAME)
const componentSortKey = ref('aiTouched')
const componentSortAsc = ref(false)
const expandedSections = ref({ summary: true, pipeline: false, planning: false, execution: false, delivery: false })

async function loadData() {
  const comp = selectedComponent.value === 'all' ? null : selectedComponent.value
  const rel = selectedRelease.value === 'all' ? null : selectedRelease.value

  await fetchData(rel, comp)

  if (!scorecardData.value || comp !== _lastScorecardComp) {
    const full = await apiRequest(
      `/modules/releases/ai-adoption${comp ? '?component=' + encodeURIComponent(comp) : ''}`
    )
    scorecardData.value = full
    _lastScorecardComp = comp
  }
}
let _lastScorecardComp = null

onMounted(() => loadData())
watch([selectedRelease, selectedComponent], () => loadData())

const releaseGroups = computed(() => data.value?.releaseGroups || [])
const scorecardGroups = computed(() => scorecardData.value?.releaseGroups || [])

const allComponents = computed(() => {
  const set = new Set()
  const groups = scorecardGroups.value.length ? scorecardGroups.value : releaseGroups.value
  for (const rg of groups) {
    for (const c of rg.components || []) set.add(c.name)
  }
  return [...set].sort()
})

const baseline = computed(() => scorecardGroups.value.find(r => r.releaseGroup === selectedBaseline.value) || null)
const postBaselineGroups = computed(() => scorecardGroups.value.filter(r => r.releaseGroup !== selectedBaseline.value))
const baselineOptions = computed(() => scorecardGroups.value.map(g => g.releaseGroup))

const summaryStats = computed(() => {
  const groups = releaseGroups.value
  const totalFeatures = groups.reduce((s, g) => s + g.totalFeatures, 0)
  const aiTouched = groups.reduce((s, g) => s + g.aiTouchedFeatures, 0)
  const pct = totalFeatures > 0 ? Math.round((aiTouched / totalFeatures) * 100) : 0
  const activePipelines = new Set()
  for (const g of groups) {
    for (const c of g.components || []) {
      for (const k of PIPELINE_KEYS) {
        if (c.pipelines[k] > 0) activePipelines.add(k)
      }
    }
  }
  return { totalFeatures, aiTouched, pct, activePipelines: activePipelines.size }
})

function groupPipelineTotals(group) {
  if (group.pipelines) return group.pipelines
  const totals = {}
  for (const k of PIPELINE_KEYS) totals[k] = 0
  for (const c of group.components || []) {
    for (const k of PIPELINE_KEYS) totals[k] += c.pipelines[k] || 0
  }
  return totals
}

function delta(current, base) {
  const d = current - base
  if (d > 0) return '+' + d
  if (d < 0) return String(d)
  return '—'
}

function deltaPp(currentPct, basePct) {
  const d = currentPct - basePct
  if (d > 0) return '+' + d + 'pp'
  if (d < 0) return d + 'pp'
  return '—'
}

function aiPct(group) {
  return group.totalFeatures > 0 ? Math.round((group.aiTouchedFeatures / group.totalFeatures) * 100) : 0
}

function activePipelineCount(group) {
  const totals = groupPipelineTotals(group)
  return PIPELINE_KEYS.filter(k => totals[k] > 0).length
}

const DOMAIN_DEFINITIONS = {
  planning: {
    label: 'Planning Domain',
    color: 'emerald',
    description: 'Pipelines that shape what gets built — strategy, RFE creation, and epic decomposition.',
    pipelines: ['stratCreator', 'rfeCreator', 'epicCreator']
  },
  execution: {
    label: 'Execution Domain',
    color: 'orange',
    description: 'Pipelines that drive how work gets done — prioritization, test planning, and UX design.',
    pipelines: ['qg1', 'testPlan', 'uxdAgentic']
  },
  delivery: {
    label: 'Delivery Domain',
    color: 'sky',
    description: 'Pipelines that support shipping — documentation and release-readiness artifacts.',
    pipelines: ['aiDoc']
  }
}

function domainTotal(group, domainKey) {
  const totals = groupPipelineTotals(group)
  return DOMAIN_DEFINITIONS[domainKey].pipelines.reduce((s, k) => s + (totals[k] || 0), 0)
}

function domainActivePipelines(group, domainKey) {
  const totals = groupPipelineTotals(group)
  const keys = DOMAIN_DEFINITIONS[domainKey].pipelines
  return keys.filter(k => totals[k] > 0).length
}

const SCORECARD_METRICS = [
  { key: 'features', label: 'Total Features Delivered', tooltip: 'Total number of Jira Feature issues shipped in this release across selected projects and components.', getValue: g => g.totalFeatures, group: 'summary' },
  { key: 'aiTouched', label: 'Features Using AI', tooltip: 'Features where at least one AI pipeline assisted in strategy, planning, testing, or documentation.', getValue: g => g.aiTouchedFeatures, group: 'summary' },
  { key: 'aiPct', label: 'AI Adoption Rate', tooltip: 'Percentage of delivered features that used AI pipelines. Calculated as Features Using AI / Total Features × 100.', getValue: g => aiPct(g), isPct: true, group: 'summary', highlight: true },
  { key: 'activePipelines', label: 'Active AI Pipelines', tooltip: 'How many of the 7 available AI pipelines were used by at least one feature in this release.', getValue: g => activePipelineCount(g), suffix: '/7', group: 'summary' },
  ...PIPELINE_KEYS.map(k => ({
    key: k, label: PIPELINE_META[k].name,
    tooltip: PIPELINE_META[k].description,
    getValue: g => groupPipelineTotals(g)[k],
    group: 'pipeline'
  })),
  { key: 'planningTotal', label: 'Features Touched', tooltip: 'Total features touched by any planning pipeline (Strategy Creator, RFE Creator, Epic Creator).', getValue: g => domainTotal(g, 'planning'), group: 'planning' },
  { key: 'planningActive', label: 'Active Pipelines', tooltip: 'How many of the 3 planning pipelines were used in this release.', getValue: g => domainActivePipelines(g, 'planning'), suffix: '/3', group: 'planning' },
  ...DOMAIN_DEFINITIONS.planning.pipelines.map(k => ({
    key: 'planning_' + k, label: PIPELINE_META[k].name,
    tooltip: PIPELINE_META[k].description,
    getValue: g => groupPipelineTotals(g)[k],
    group: 'planning'
  })),
  { key: 'executionTotal', label: 'Features Touched', tooltip: 'Total features touched by any execution pipeline (Priority Scoring, Test Plan Generator, UXD Agentic).', getValue: g => domainTotal(g, 'execution'), group: 'execution' },
  { key: 'executionActive', label: 'Active Pipelines', tooltip: 'How many of the 3 execution pipelines were used in this release.', getValue: g => domainActivePipelines(g, 'execution'), suffix: '/3', group: 'execution' },
  ...DOMAIN_DEFINITIONS.execution.pipelines.map(k => ({
    key: 'execution_' + k, label: PIPELINE_META[k].name,
    tooltip: PIPELINE_META[k].description,
    getValue: g => groupPipelineTotals(g)[k],
    group: 'execution'
  })),
  { key: 'deliveryTotal', label: 'Features Touched', tooltip: 'Total features touched by delivery pipelines (AI-First Documentation).', getValue: g => domainTotal(g, 'delivery'), group: 'delivery' },
  { key: 'deliveryActive', label: 'Active Pipelines', tooltip: 'How many of the 1 delivery pipeline(s) were used in this release.', getValue: g => domainActivePipelines(g, 'delivery'), suffix: '/1', group: 'delivery' },
  ...DOMAIN_DEFINITIONS.delivery.pipelines.map(k => ({
    key: 'delivery_' + k, label: PIPELINE_META[k].name,
    tooltip: PIPELINE_META[k].description,
    getValue: g => groupPipelineTotals(g)[k],
    group: 'delivery'
  }))
]


const scorecardColumns = computed(() => {
  const bl = baseline.value
  const post = postBaselineGroups.value
  if (!bl) return []
  return [bl, ...post]
})

function scorecardDelta(metric, group) {
  if (!baseline.value || group.releaseGroup === selectedBaseline.value) return null
  const current = metric.getValue(group)
  const base = metric.getValue(baseline.value)
  if (metric.isPct) return deltaPp(current, base)
  return delta(current, base)
}

function scorecardDeltaClass(metric, group) {
  if (!baseline.value || group.releaseGroup === selectedBaseline.value) return ''
  const diff = metric.getValue(group) - metric.getValue(baseline.value)
  if (diff > 0) return 'text-green-600 dark:text-green-400'
  if (diff < 0) return 'text-red-500 dark:text-red-400'
  return 'text-gray-400 dark:text-gray-500'
}

function scorecardColHeaderClass(releaseGroup) {
  const isBase = releaseGroup === selectedBaseline.value
  const isSelected = selectedRelease.value !== 'all' && releaseGroup === selectedRelease.value
  if (isSelected) return 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border-b-2 border-primary-500'
  if (isBase) return 'bg-amber-50/60 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400'
  return 'text-gray-500 dark:text-gray-400'
}

function scorecardColCellClass(releaseGroup) {
  const isBase = releaseGroup === selectedBaseline.value
  const isSelected = selectedRelease.value !== 'all' && releaseGroup === selectedRelease.value
  if (isSelected) return 'bg-primary-50/50 dark:bg-primary-900/10'
  if (isBase) return 'bg-amber-50/30 dark:bg-amber-900/5'
  return ''
}

function formatCellValue(metric, group) {
  const val = metric.getValue(group)
  if (metric.isPct) return val + '%'
  if (metric.suffix) return val + metric.suffix
  return val
}

function showCoverageBar(metric) {
  return !metric.isPct && !metric.suffix && metric.key !== 'features'
}

function coverageDenominator(metric, group) {
  if (metric.group === 'summary') return group.totalFeatures
  return group.aiTouchedFeatures
}

function coveragePct(metric, group) {
  const denom = coverageDenominator(metric, group)
  if (!denom) return 0
  return Math.min(Math.round((metric.getValue(group) / denom) * 100), 100)
}

function coverageTipLine1(metric, group) {
  const val = metric.getValue(group)
  const denom = coverageDenominator(metric, group)
  const pct = coveragePct(metric, group)
  if (metric.group === 'summary') {
    return `${val} of ${denom} total features used AI (${pct}%)`
  }
  return `${val} of ${denom} AI-touched features used ${metric.label} (${pct}%)`
}



const scorecardChartData = computed(() => {
  const cols = scorecardColumns.value
  if (!cols.length) return null
  const metric = SCORECARD_METRICS.find(m => m.key === selectedChartMetric.value) || SCORECARD_METRICS[0]
  const labels = cols.map(c => c.releaseGroup)
  const values = cols.map(c => metric.getValue(c))
  const pointBg = cols.map(c => c.releaseGroup === selectedBaseline.value ? '#f59e0b' : '#3b82f6')
  const pointBorder = cols.map(c => c.releaseGroup === selectedBaseline.value ? '#d97706' : '#2563eb')
  return {
    labels,
    datasets: [{
      label: metric.label,
      data: values,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.08)',
      fill: true,
      tension: 0.3,
      pointRadius: 7,
      pointHoverRadius: 9,
      pointBackgroundColor: pointBg,
      pointBorderColor: pointBorder,
      pointBorderWidth: 2,
      borderWidth: 2.5
    }]
  }
})

const scorecardChartOptions = computed(() => {
  const metric = SCORECARD_METRICS.find(m => m.key === selectedChartMetric.value) || SCORECARD_METRICS[0]
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 12, weight: '500' } } },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(156,163,175,0.15)' },
        ticks: {
          color: '#9ca3af',
          font: { size: 11 },
          callback: v => metric.isPct ? v + '%' : (metric.suffix ? v + metric.suffix : v)
        }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111827',
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: ctx => {
            const val = ctx.parsed.y
            const formatted = metric.isPct ? val + '%' : (metric.suffix ? val + metric.suffix : val)
            const label = ctx.label === selectedBaseline.value ? `${formatted} (baseline)` : formatted
            return `${metric.label}: ${label}`
          }
        }
      }
    }
  }
})

function componentPct(row) {
  return row.total > 0 ? Math.round((row.aiTouched / row.total) * 100) : 0
}

function toggleComponentSort(key) {
  if (componentSortKey.value === key) {
    componentSortAsc.value = !componentSortAsc.value
  } else {
    componentSortKey.value = key
    componentSortAsc.value = false
  }
}

const perComponentRows = computed(() => {
  const map = {}
  for (const rg of releaseGroups.value) {
    for (const c of rg.components || []) {
      if (!map[c.name]) {
        map[c.name] = { name: c.name, total: 0, aiTouched: 0, pipelines: {} }
        for (const k of PIPELINE_KEYS) map[c.name].pipelines[k] = 0
      }
      map[c.name].total += c.total
      map[c.name].aiTouched += c.aiTouched
      for (const k of PIPELINE_KEYS) map[c.name].pipelines[k] += c.pipelines[k] || 0
    }
  }
  const rows = Object.values(map)
  const key = componentSortKey.value
  const dir = componentSortAsc.value ? 1 : -1
  rows.sort((a, b) => {
    let va, vb
    if (key === 'total') { va = a.total; vb = b.total }
    else if (key === 'aiTouched') { va = a.aiTouched; vb = b.aiTouched }
    else { va = componentPct(a); vb = componentPct(b) }
    return (va - vb) * dir
  })
  return rows
})

const FIRST_PASS_TRACKED = ['stratCreator', 'rfeCreator', 'testPlan', 'qg1']
const FIRST_PASS_COMING_SOON = ['aiDoc', 'uxdAgentic', 'epicCreator']

const firstPassRates = computed(() => {
  const groups = scorecardGroups.value
  if (!groups.length) return []

  const acc = {}
  for (const k of FIRST_PASS_TRACKED) acc[k] = { accepted: 0, total: 0 }

  for (const g of groups) {
    const fp = g.firstPass || {}
    for (const k of FIRST_PASS_TRACKED) {
      if (fp[k]) {
        acc[k].accepted += fp[k].accepted || 0
        acc[k].total += fp[k].total || 0
      }
    }
  }

  const tracked = FIRST_PASS_TRACKED.map(key => ({
    key,
    name: PIPELINE_META[key].name,
    short: PIPELINE_META[key].short,
    accepted: acc[key].accepted,
    total: acc[key].total,
    pct: acc[key].total > 0
      ? Math.round((acc[key].accepted / acc[key].total) * 100)
      : 0,
    comingSoon: false
  })).sort((a, b) => b.pct - a.pct)

  const comingSoon = FIRST_PASS_COMING_SOON.map(key => ({
    key,
    name: PIPELINE_META[key].name,
    short: PIPELINE_META[key].short,
    accepted: 0,
    total: 0,
    pct: 0,
    comingSoon: true
  }))

  return [...tracked, ...comingSoon]
})

const throughputRows = computed(() => {
  const groups = scorecardGroups.value
  if (!groups.length) return []

  const compMap = {}
  for (const rg of groups) {
    for (const c of rg.components || []) {
      if (!compMap[c.name]) {
        compMap[c.name] = { name: c.name, releases: {}, totalAiTouched: 0, totalFeatures: 0, pipelines: {} }
        for (const k of PIPELINE_KEYS) compMap[c.name].pipelines[k] = 0
      }
      compMap[c.name].totalAiTouched += c.aiTouched
      compMap[c.name].totalFeatures += c.total
      for (const k of PIPELINE_KEYS) compMap[c.name].pipelines[k] += (c.pipelines[k] || 0)
      const aiPct = c.total > 0 ? Math.round((c.aiTouched / c.total) * 100) : 0
      compMap[c.name].releases[rg.releaseGroup] = {
        features: c.total,
        aiTouched: c.aiTouched,
        aiPct,
        aggregateEffort: c.aggregateEffort || 0,
        avgEffort: c.avgEffort || 0
      }
    }
  }

  const baselineName = selectedBaseline.value
  const latestName = groups[groups.length - 1].releaseGroup

  const rows = Object.values(compMap).map(row => {
    const bl = row.releases[baselineName]
    const lt = row.releases[latestName]
    row.baselineAvg = bl ? bl.avgEffort : 0
    row.latestAvg = lt ? lt.avgEffort : 0
    row.baselineFeatures = bl ? bl.features : 0
    row.latestFeatures = lt ? lt.features : 0
    row.latestAiPct = lt ? lt.aiPct : 0
    const blThroughput = row.baselineFeatures * (row.baselineAvg || 1)
    const ltThroughput = row.latestFeatures * (row.latestAvg || 1)
    row.baselineThroughput = Math.round(blThroughput * 10) / 10
    row.latestThroughput = Math.round(ltThroughput * 10) / 10
    row.throughputDelta = blThroughput > 0
      ? Math.round(((ltThroughput - blThroughput) / blThroughput) * 100)
      : (ltThroughput > 0 ? 100 : 0)
    row.overallAiPct = row.totalFeatures > 0 ? Math.round((row.totalAiTouched / row.totalFeatures) * 100) : 0
    row.dominantPipelines = PIPELINE_KEYS.filter(k => row.pipelines[k] > 0).map(k => PIPELINE_META[k].short).join(', ') || 'None'
    return row
  })

  rows.sort((a, b) => b.totalAiTouched - a.totalAiTouched)

  return rows
})

function effortCellClass(avgEffort, baselineAvg) {
  if (!baselineAvg || baselineAvg === 0) return ''
  const ratio = avgEffort / baselineAvg
  if (ratio >= 0.9) return 'text-emerald-700 dark:text-emerald-400'
  if (ratio >= 0.7) return 'text-amber-700 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function togglePipeline(key) {
  expandedPipelines.value[key] = !expandedPipelines.value[key]
}

function componentPipelineTotals(group, compName) {
  const comp = (group.components || []).find(c => c.name === compName)
  if (!comp) return PIPELINE_KEYS.reduce((o, k) => { o[k] = 0; return o }, {})
  const totals = {}
  for (const k of PIPELINE_KEYS) totals[k] = comp.pipelines[k] || 0
  return totals
}

function componentActivePipelines(group, compName) {
  const totals = componentPipelineTotals(group, compName)
  return PIPELINE_KEYS.filter(k => totals[k] > 0).length
}

function componentAiPct(group, compName) {
  const comp = (group.components || []).find(c => c.name === compName)
  if (!comp || comp.total === 0) return 0
  return Math.round((comp.aiTouched / comp.total) * 100)
}

function componentTotal(group, compName) {
  const comp = (group.components || []).find(c => c.name === compName)
  return comp ? comp.total : 0
}

function componentAiTouched(group, compName) {
  const comp = (group.components || []).find(c => c.name === compName)
  return comp ? comp.aiTouched : 0
}

const executiveSummary = computed(() => {
  const groups = scorecardGroups.value
  if (groups.length < 2) return null

  const bl = baseline.value
  const latest = groups[groups.length - 1]
  if (!bl || bl.releaseGroup === latest.releaseGroup) return null

  const isFiltered = selectedComponent.value !== 'all'
  const compName = selectedComponent.value
  const strengths = []
  const concerns = []

  const blPct = isFiltered ? componentAiPct(bl, compName) : aiPct(bl)
  const latestPct = isFiltered ? componentAiPct(latest, compName) : aiPct(latest)
  const pctDelta = latestPct - blPct

  const blTotal = isFiltered ? componentTotal(bl, compName) : bl.totalFeatures
  const latestTotal = isFiltered ? componentTotal(latest, compName) : latest.totalFeatures
  const blAi = isFiltered ? componentAiTouched(bl, compName) : bl.aiTouchedFeatures
  const latestAi = isFiltered ? componentAiTouched(latest, compName) : latest.aiTouchedFeatures

  const blPipelines = isFiltered ? componentActivePipelines(bl, compName) : activePipelineCount(bl)
  const latestPipelines = isFiltered ? componentActivePipelines(latest, compName) : activePipelineCount(latest)

  const blPTotals = isFiltered ? componentPipelineTotals(bl, compName) : groupPipelineTotals(bl)
  const latestPTotals = isFiltered ? componentPipelineTotals(latest, compName) : groupPipelineTotals(latest)

  const label = isFiltered ? compName : 'overall'
  let headline

  if (pctDelta > 0) {
    headline = `${isFiltered ? compName + ' ' : ''}AI adoption grew from ${blPct}% to ${latestPct}% between ${bl.releaseGroup} and ${latest.releaseGroup}.`
    strengths.push(`Adoption rate increased ${pctDelta}pp — from ${blPct}% (${bl.releaseGroup}) to ${latestPct}% (${latest.releaseGroup}).`)
  } else if (pctDelta < 0) {
    headline = `${isFiltered ? compName + ' ' : ''}AI adoption dropped from ${blPct}% to ${latestPct}% between ${bl.releaseGroup} and ${latest.releaseGroup}.`
    concerns.push(`Adoption rate decreased ${Math.abs(pctDelta)}pp — from ${blPct}% (${bl.releaseGroup}) to ${latestPct}% (${latest.releaseGroup}).`)
  } else {
    headline = `${isFiltered ? compName + ' ' : ''}AI adoption held steady at ${latestPct}% between ${bl.releaseGroup} and ${latest.releaseGroup}.`
  }

  if (latestPct >= 80) {
    strengths.push(`Strong ${label} adoption at ${latestPct}% in ${latest.releaseGroup}.`)
  } else if (latestPct > 0 && latestPct < 30) {
    concerns.push(`Low ${label} adoption at only ${latestPct}% in ${latest.releaseGroup} — significant room for improvement.`)
  }

  if (latestPipelines > blPipelines) {
    strengths.push(`Pipeline breadth expanded from ${blPipelines}/7 to ${latestPipelines}/7 active pipelines.`)
  } else if (latestPipelines < blPipelines) {
    concerns.push(`Pipeline breadth narrowed from ${blPipelines}/7 to ${latestPipelines}/7 active pipelines.`)
  }

  if (blTotal > 0 && latestTotal > blTotal * 1.5) {
    strengths.push(`Feature volume grew ${Math.round(((latestTotal / blTotal) - 1) * 100)}% (${blTotal} → ${latestTotal}), showing increased throughput.`)
  } else if (blTotal > 0 && latestTotal < blTotal * 0.5) {
    concerns.push(`Feature volume dropped ${Math.round((1 - latestTotal / blTotal) * 100)}% (${blTotal} → ${latestTotal}).`)
  }

  if (latestAi > blAi && blAi > 0) {
    strengths.push(`AI-touched features grew from ${blAi} to ${latestAi} (${Math.round(((latestAi / blAi) - 1) * 100)}% increase).`)
  }

  const surgedPipelines = PIPELINE_KEYS.filter(k => blPTotals[k] === 0 && latestPTotals[k] > 0)
  const droppedPipelines = PIPELINE_KEYS.filter(k => blPTotals[k] > 0 && latestPTotals[k] === 0)
  const zeroPipelines = PIPELINE_KEYS.filter(k => latestPTotals[k] === 0)

  if (surgedPipelines.length > 0) {
    strengths.push(`${surgedPipelines.map(k => PIPELINE_META[k].name).join(', ')} ${surgedPipelines.length === 1 ? 'was' : 'were'} newly adopted since baseline.`)
  }

  if (droppedPipelines.length > 0) {
    concerns.push(`${droppedPipelines.map(k => PIPELINE_META[k].name).join(', ')} ${droppedPipelines.length === 1 ? 'was' : 'were'} active at baseline but dropped to zero.`)
  }

  if (zeroPipelines.length > 0 && zeroPipelines.length < PIPELINE_KEYS.length) {
    concerns.push(`${zeroPipelines.map(k => PIPELINE_META[k].name).join(', ')} ${zeroPipelines.length === 1 ? 'has' : 'have'} zero usage in ${latest.releaseGroup} — potential for expansion.`)
  }

  if (!isFiltered) {
    const compRows = perComponentRows.value
    const lowAdoption = compRows.filter(r => r.total >= 5 && componentPct(r) < 30)
    if (lowAdoption.length > 0) {
      concerns.push(`${lowAdoption.length} component${lowAdoption.length === 1 ? '' : 's'} (${lowAdoption.map(r => r.name).join(', ')}) ${lowAdoption.length === 1 ? 'has' : 'have'} <30% AI adoption despite having 5+ features — these are high-impact targets for AI onboarding.`)
    }
    const highAdoption = compRows.filter(r => r.total >= 5 && componentPct(r) >= 80)
    if (highAdoption.length > 0) {
      strengths.push(`${highAdoption.map(r => r.name).join(', ')} ${highAdoption.length === 1 ? 'leads' : 'lead'} with 80%+ AI adoption.`)
    }

    const midTier = compRows.filter(r => r.total >= 5 && componentPct(r) >= 30 && componentPct(r) < 60)
    if (midTier.length > 0) {
      concerns.push(`${midTier.length} component${midTier.length === 1 ? '' : 's'} (${midTier.map(r => `${r.name} at ${componentPct(r)}%`).join(', ')}) sit in the 30–60% range — close to tipping point for full adoption.`)
    }

    if (compRows.length >= 3) {
      const pcts = compRows.filter(r => r.total >= 3).map(r => componentPct(r))
      const maxPct = Math.max(...pcts)
      const minPct = Math.min(...pcts)
      if (maxPct - minPct > 40) {
        concerns.push(`${maxPct - minPct}pp gap between highest (${maxPct}%) and lowest (${minPct}%) adopting components — adoption is uneven across the product.`)
      }
    }

    const untouched = latestTotal - latestAi
    if (untouched > 10) {
      concerns.push(`${untouched} features in ${latest.releaseGroup} had no AI pipeline involvement — ${Math.round((untouched / latestTotal) * 100)}% of the release went through fully manual workflows.`)
    }
  } else {
    const topPipeline = PIPELINE_KEYS.reduce((best, k) => latestPTotals[k] > (latestPTotals[best] || 0) ? k : best, PIPELINE_KEYS[0])
    if (latestPTotals[topPipeline] > 0) {
      strengths.push(`Most-used pipeline: ${PIPELINE_META[topPipeline].name} with ${latestPTotals[topPipeline]} labeled features in ${latest.releaseGroup}.`)
    }

    const lowestPipeline = PIPELINE_KEYS.filter(k => latestPTotals[k] > 0).reduce((low, k) => latestPTotals[k] < latestPTotals[low] ? k : low, topPipeline)
    if (lowestPipeline !== topPipeline && latestPTotals[lowestPipeline] > 0) {
      concerns.push(`${PIPELINE_META[lowestPipeline].name} has the lowest usage at ${latestPTotals[lowestPipeline]} features — consider increasing adoption for this pipeline.`)
    }

    const untouched = latestTotal - latestAi
    if (untouched > 0) {
      concerns.push(`${untouched} of ${latestTotal} features (${Math.round((untouched / latestTotal) * 100)}%) in ${latest.releaseGroup} had no AI pipeline involvement.`)
    }

    if (latestPct > 0 && latestPct < 50) {
      concerns.push(`${compName} is below 50% adoption — less than half of features are using AI pipelines.`)
    }

    const activePipes = PIPELINE_KEYS.filter(k => latestPTotals[k] > 0)
    if (activePipes.length > 0 && activePipes.length <= 2) {
      concerns.push(`Only ${activePipes.length} of ${PIPELINE_KEYS.length} pipelines active — adoption is concentrated in ${activePipes.map(k => PIPELINE_META[k].name).join(' and ')}.`)
    }
  }

  // Release-over-release dip detection
  for (let i = 1; i < groups.length; i++) {
    const prev = groups[i - 1]
    const curr = groups[i]
    const prevPct = isFiltered ? componentAiPct(prev, compName) : aiPct(prev)
    const currPct = isFiltered ? componentAiPct(curr, compName) : aiPct(curr)
    if (prevPct > currPct && prevPct - currPct >= 5) {
      concerns.push(`Adoption dipped ${prevPct - currPct}pp between ${prev.releaseGroup} (${prevPct}%) and ${curr.releaseGroup} (${currPct}%).`)
    }
  }

  return { strengths, concerns, headline }
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-start justify-between mb-6">
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">AI Adoption Report</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Projects: AIPCC, RHAIENG, RHOAIENG, INFERENG, RHAI, RHAISTRAT &middot; Issue type: Feature &middot; Source: Jira
        </p>
      </div>
      <a
        href="https://drive.google.com/file/d/1NGm-dMgBhxLGYnIicXRZ3p6TSFHQOTNg/view?usp=drive_link"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-700 hover:bg-primary-100 dark:hover:bg-primary-900/50"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
        Video Demo
      </a>
    </div>

    <!-- Loading -->
    <div v-if="loading && !data" class="text-center py-16">
      <svg class="animate-spin h-6 w-6 text-primary-500 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <p class="text-sm text-gray-500 dark:text-gray-400">Fetching AI adoption data from Jira...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error && !data" class="text-center py-16">
      <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
      <button @click="fetchData()" class="mt-3 px-4 py-2 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700">Retry</button>
    </div>

    <template v-else-if="data">
      <!-- Filter bar -->
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6 px-5 py-4 flex items-center gap-5 flex-wrap shadow-sm">
        <div class="flex flex-col gap-1">
          <label class="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Component</label>
          <select v-model="selectedComponent" class="text-sm font-medium rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 pl-3 pr-8 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors appearance-none cursor-pointer" :class="selectedComponent !== 'all' ? 'border-primary-400 dark:border-primary-500 bg-primary-50/50 dark:bg-primary-900/20' : ''">
            <option value="all">All Components</option>
            <option v-for="c in allComponents" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Release</label>
          <select v-model="selectedRelease" class="text-sm font-medium rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 pl-3 pr-8 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors appearance-none cursor-pointer" :class="selectedRelease !== 'all' ? 'border-primary-400 dark:border-primary-500 bg-primary-50/50 dark:bg-primary-900/20' : ''">
            <option v-for="r in RELEASE_OPTIONS" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
        </div>
        <button v-if="selectedComponent !== 'all' || selectedRelease !== 'all'" @click="selectedComponent = 'all'; selectedRelease = 'all'" class="self-end mb-0.5 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          Reset Filters
        </button>
        <div v-if="loading" class="ml-auto self-end mb-1">
          <span class="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
            <svg class="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            Refreshing...
          </span>
        </div>
      </div>

      <!-- Summary stats -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center relative">
          <span class="absolute top-2 right-2 group/s1">
            <svg class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 cursor-help hover:text-gray-500 dark:hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" stroke-linecap="round" /></svg>
            <span class="invisible opacity-0 group-hover/s1:visible group-hover/s1:opacity-100 transition-opacity duration-150 absolute bottom-full right-0 mb-2 z-50 w-56 whitespace-normal break-words px-3 py-2 text-[11px] leading-relaxed text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg pointer-events-none after:content-[''] after:absolute after:top-full after:right-3 after:border-4 after:border-transparent after:border-t-gray-900 dark:after:border-t-gray-700">Total Jira Feature issues across all selected releases, projects, and components.</span>
          </span>
          <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ summaryStats.totalFeatures }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Features</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 p-4 text-center relative">
          <span class="absolute top-2 right-2 group/s2">
            <svg class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 cursor-help hover:text-gray-500 dark:hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" stroke-linecap="round" /></svg>
            <span class="invisible opacity-0 group-hover/s2:visible group-hover/s2:opacity-100 transition-opacity duration-150 absolute bottom-full right-0 mb-2 z-50 w-56 whitespace-normal break-words px-3 py-2 text-[11px] leading-relaxed text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg pointer-events-none after:content-[''] after:absolute after:top-full after:right-3 after:border-4 after:border-transparent after:border-t-gray-900 dark:after:border-t-gray-700">Features where at least one AI pipeline assisted in strategy, planning, testing, or documentation.</span>
          </span>
          <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ summaryStats.aiTouched }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">AI-Touched Features</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800 p-4 text-center relative">
          <span class="absolute top-2 right-2 group/s3">
            <svg class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 cursor-help hover:text-gray-500 dark:hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" stroke-linecap="round" /></svg>
            <span class="invisible opacity-0 group-hover/s3:visible group-hover/s3:opacity-100 transition-opacity duration-150 absolute bottom-full right-0 mb-2 z-50 w-56 whitespace-normal break-words px-3 py-2 text-[11px] leading-relaxed text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg pointer-events-none after:content-[''] after:absolute after:top-full after:right-3 after:border-4 after:border-transparent after:border-t-gray-900 dark:after:border-t-gray-700">Percentage of all features that used AI pipelines. Calculated as AI-Touched / Total Features × 100.</span>
          </span>
          <p class="text-2xl font-bold text-green-600 dark:text-green-400">{{ summaryStats.pct }}%</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Overall AI Adoption</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center relative">
          <span class="absolute top-2 right-2 group/s4">
            <svg class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 cursor-help hover:text-gray-500 dark:hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" stroke-linecap="round" /></svg>
            <span class="invisible opacity-0 group-hover/s4:visible group-hover/s4:opacity-100 transition-opacity duration-150 absolute bottom-full right-0 mb-2 z-50 w-56 whitespace-normal break-words px-3 py-2 text-[11px] leading-relaxed text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg pointer-events-none after:content-[''] after:absolute after:top-full after:right-3 after:border-4 after:border-transparent after:border-t-gray-900 dark:after:border-t-gray-700">How many of the 7 available AI pipelines (Strat, RFE, Test Plan, QG1, AI Doc, UXD, Epic Creator) were used across all selected releases.</span>
          </span>
          <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ summaryStats.activePipelines }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Active Pipelines</p>
        </div>
      </div>

      <!-- Executive Summary -->
      <div v-if="executiveSummary" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-transparent dark:from-gray-700/30 dark:to-transparent">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-800/40 flex items-center justify-center shrink-0">
              <svg class="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </span>
            <div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Executive Summary</h3>
              <p class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{{ executiveSummary.headline }}</p>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-700">
          <div class="px-5 py-4">
            <div class="flex items-center gap-2 mb-3">
              <span class="w-5 h-5 rounded-full bg-green-100 dark:bg-green-800/40 flex items-center justify-center shrink-0">
                <svg class="w-3 h-3 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
              </span>
              <span class="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">Strengths</span>
            </div>
            <ul v-if="executiveSummary.strengths.length" class="space-y-2">
              <li v-for="(item, i) in executiveSummary.strengths" :key="i" class="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                <span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></span>
                {{ item }}
              </li>
            </ul>
            <p v-else class="text-sm text-gray-400 dark:text-gray-500 italic">No notable strengths identified.</p>
          </div>
          <div class="px-5 py-4">
            <div class="flex items-center gap-2 mb-3">
              <span class="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center shrink-0">
                <svg class="w-3 h-3 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </span>
              <span class="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Areas for Growth</span>
            </div>
            <ul v-if="executiveSummary.concerns.length" class="space-y-2">
              <li v-for="(item, i) in executiveSummary.concerns" :key="i" class="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                <span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                {{ item }}
              </li>
            </ul>
            <p v-else class="text-sm text-gray-400 dark:text-gray-500 italic">No concerns identified — strong adoption across the board.</p>
          </div>
        </div>
      </div>

      <!-- Scorecard: table / chart toggle -->
      <div v-if="scorecardColumns.length" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6 shadow-sm">
        <!-- Header with baseline selector and toggle -->
        <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-4">
          <div>
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">AI Adoption Scorecard</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">All metrics compared against the selected baseline. Deltas show change from baseline.</p>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <div class="flex flex-col gap-0.5">
              <label class="text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Baseline</label>
              <select v-model="selectedBaseline" class="text-xs font-medium rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 pl-2 pr-6 py-1 cursor-pointer">
                <option v-for="opt in baselineOptions" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </div>
          <div class="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
            <button @click="scorecardView = 'table'" class="px-3 py-1.5 text-xs font-medium rounded-md transition-all" :class="scorecardView === 'table' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'">
              <span class="flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M3 14h18M3 6h18M3 18h18" /></svg>
                Table
              </span>
            </button>
            <button @click="scorecardView = 'chart'" class="px-3 py-1.5 text-xs font-medium rounded-md transition-all" :class="scorecardView === 'chart' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'">
              <span class="flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6 0h6m-6 0V9a2 2 0 012-2h2a2 2 0 012 2v10m6 0v-4a2 2 0 00-2-2h-2a2 2 0 00-2 2v4" /></svg>
                Chart
              </span>
            </button>
          </div>
          </div>
        </div>

        <!-- TABLE VIEW -->
        <div v-if="scorecardView === 'table'" class="overflow-x-auto overflow-y-visible">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b-2 border-gray-200 dark:border-gray-600">
                <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-52">Metric</th>
                <th v-for="col in scorecardColumns" :key="col.releaseGroup" class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider whitespace-nowrap" :class="scorecardColHeaderClass(col.releaseGroup)">
                  <div class="flex items-center justify-center gap-1.5">
                    {{ col.releaseGroup }}
                    <span v-if="col.releaseGroup === selectedBaseline" class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 text-amber-800 dark:bg-amber-800/50 dark:text-amber-300 uppercase tracking-wide">Base</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <!-- Overview section header -->
              <tr class="border-b border-gray-200 dark:border-gray-600 bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/15 dark:to-transparent cursor-pointer select-none" @click="expandedSections.summary = !expandedSections.summary">
                <td :colspan="scorecardColumns.length + 1" class="px-5 py-2.5">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="w-1 h-4 rounded-full bg-blue-500"></span>
                      <span class="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Overview</span>
                      <span class="text-[10px] text-gray-400 dark:text-gray-500">{{ SCORECARD_METRICS.filter(m => m.group === 'summary').length }} metrics</span>
                    </div>
                    <svg class="w-4 h-4 text-gray-400 transition-transform" :class="expandedSections.summary ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </td>
              </tr>
              <!-- Overview rows -->
              <template v-if="expandedSections.summary">
                <template v-for="metric in SCORECARD_METRICS.filter(m => m.group === 'summary')" :key="metric.key">
                  <tr class="border-b border-gray-100 dark:border-gray-700/40 transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-700/20" :class="metric.highlight ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''">
                    <td class="px-5 py-3 whitespace-nowrap">
                      <div class="flex items-center gap-1.5 relative">
                        <span class="font-medium text-gray-900 dark:text-gray-100 text-[13px]">{{ metric.label }}</span>
                        <span class="relative group/tip inline-flex">
                          <svg class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 cursor-help hover:text-gray-500 dark:hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" stroke-linecap="round" /></svg>
                          <span class="invisible opacity-0 group-hover/tip:visible group-hover/tip:opacity-100 transition-opacity duration-150 absolute bottom-full left-0 mb-2 z-50 w-64 whitespace-normal break-words px-3 py-2 text-[11px] leading-relaxed text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg pointer-events-none after:content-[''] after:absolute after:top-full after:left-4 after:border-4 after:border-transparent after:border-t-gray-900 dark:after:border-t-gray-700">{{ metric.tooltip }}</span>
                        </span>
                      </div>
                    </td>
                    <td v-for="col in scorecardColumns" :key="col.releaseGroup" class="px-4 py-3 text-center" :class="scorecardColCellClass(col.releaseGroup)">
                      <span class="font-semibold text-[15px]" :class="metric.highlight ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'">{{ formatCellValue(metric, col) }}</span>
                      <div v-if="scorecardDelta(metric, col)" class="text-[11px] mt-0.5 font-medium" :class="scorecardDeltaClass(metric, col)">{{ scorecardDelta(metric, col) }}</div>
                      <div v-if="showCoverageBar(metric)" class="relative group/bar mt-1.5 flex items-center gap-1.5 justify-center cursor-help">
                        <div class="w-16 h-1 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                          <div class="h-full rounded-full transition-all" :class="coveragePct(metric, col) >= 50 ? 'bg-blue-500' : 'bg-blue-300 dark:bg-blue-600'" :style="{ width: coveragePct(metric, col) + '%' }"></div>
                        </div>
                        <span class="text-[9px] text-gray-400 dark:text-gray-500 tabular-nums">{{ coveragePct(metric, col) }}%</span>
                        <span class="invisible opacity-0 group-hover/bar:visible group-hover/bar:opacity-100 transition-opacity duration-150 absolute bottom-full right-0 mb-2 z-50 w-64 whitespace-normal break-words px-3 py-2 text-[11px] leading-relaxed text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg pointer-events-none after:content-[''] after:absolute after:top-full after:right-4 after:border-4 after:border-transparent after:border-t-gray-900 dark:after:border-t-gray-700">{{ coverageTipLine1(metric, col) }}<br/>{{ col.releaseGroup }}: {{ col.totalFeatures }} total, {{ col.aiTouchedFeatures }} AI-touched</span>
                      </div>
                    </td>
                  </tr>
                </template>
              </template>

              <!-- Pipeline Breakdown section header -->
              <tr class="border-b border-gray-200 dark:border-gray-600 bg-gradient-to-r from-purple-50 to-transparent dark:from-purple-900/15 dark:to-transparent cursor-pointer select-none" @click="expandedSections.pipeline = !expandedSections.pipeline">
                <td :colspan="scorecardColumns.length + 1" class="px-5 py-2.5">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="w-1 h-4 rounded-full bg-purple-500"></span>
                      <span class="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest">Pipeline Breakdown</span>
                      <span class="text-[10px] text-gray-400 dark:text-gray-500">{{ SCORECARD_METRICS.filter(m => m.group === 'pipeline').length }} pipelines</span>
                    </div>
                    <svg class="w-4 h-4 text-gray-400 transition-transform" :class="expandedSections.pipeline ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </td>
              </tr>
              <!-- Pipeline rows -->
              <template v-if="expandedSections.pipeline">
                <template v-for="(metric, idx) in SCORECARD_METRICS.filter(m => m.group === 'pipeline')" :key="metric.key">
                  <tr class="border-b border-gray-100 dark:border-gray-700/40 transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-700/20" :class="idx % 2 === 0 ? 'bg-gray-50/30 dark:bg-gray-800/30' : ''">
                    <td class="px-5 py-3 whitespace-nowrap">
                      <div class="flex items-center gap-1.5 relative">
                        <span class="font-medium text-gray-900 dark:text-gray-100 text-[13px]">{{ metric.label }}</span>
                        <span class="relative group/tip inline-flex">
                          <svg class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 cursor-help hover:text-gray-500 dark:hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" stroke-linecap="round" /></svg>
                          <span class="invisible opacity-0 group-hover/tip:visible group-hover/tip:opacity-100 transition-opacity duration-150 absolute bottom-full left-0 mb-2 z-50 w-64 whitespace-normal break-words px-3 py-2 text-[11px] leading-relaxed text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg pointer-events-none after:content-[''] after:absolute after:top-full after:left-4 after:border-4 after:border-transparent after:border-t-gray-900 dark:after:border-t-gray-700">{{ metric.tooltip }}</span>
                        </span>
                      </div>
                    </td>
                    <td v-for="col in scorecardColumns" :key="col.releaseGroup" class="px-4 py-3 text-center" :class="scorecardColCellClass(col.releaseGroup)">
                      <span class="font-semibold text-[15px] text-gray-900 dark:text-gray-100">{{ formatCellValue(metric, col) }}</span>
                      <div v-if="scorecardDelta(metric, col)" class="text-[11px] mt-0.5 font-medium" :class="scorecardDeltaClass(metric, col)">{{ scorecardDelta(metric, col) }}</div>
                      <div v-if="showCoverageBar(metric)" class="relative group/bar mt-1.5 flex items-center gap-1.5 justify-center cursor-help">
                        <div class="w-16 h-1 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                          <div class="h-full rounded-full transition-all" :class="coveragePct(metric, col) >= 50 ? 'bg-purple-500' : 'bg-purple-300 dark:bg-purple-600'" :style="{ width: coveragePct(metric, col) + '%' }"></div>
                        </div>
                        <span class="text-[9px] text-gray-400 dark:text-gray-500 tabular-nums">{{ coveragePct(metric, col) }}%</span>
                        <span class="invisible opacity-0 group-hover/bar:visible group-hover/bar:opacity-100 transition-opacity duration-150 absolute bottom-full right-0 mb-2 z-50 w-64 whitespace-normal break-words px-3 py-2 text-[11px] leading-relaxed text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg pointer-events-none after:content-[''] after:absolute after:top-full after:right-4 after:border-4 after:border-transparent after:border-t-gray-900 dark:after:border-t-gray-700">{{ coverageTipLine1(metric, col) }}<br/>{{ col.releaseGroup }}: {{ col.totalFeatures }} total, {{ col.aiTouchedFeatures }} AI-touched</span>
                      </div>
                    </td>
                  </tr>
                </template>
              </template>

              <!-- Planning Domain section header -->
              <tr class="border-b border-gray-200 dark:border-gray-600 bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-900/15 dark:to-transparent cursor-pointer select-none" @click="expandedSections.planning = !expandedSections.planning">
                <td :colspan="scorecardColumns.length + 1" class="px-5 py-2.5">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="w-1 h-4 rounded-full bg-emerald-500"></span>
                      <span class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Planning Domain</span>
                      <span class="text-[10px] text-gray-400 dark:text-gray-500">Strategy, RFE & Epic creation</span>
                    </div>
                    <svg class="w-4 h-4 text-gray-400 transition-transform" :class="expandedSections.planning ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </td>
              </tr>
              <template v-if="expandedSections.planning">
                <template v-for="(metric, idx) in SCORECARD_METRICS.filter(m => m.group === 'planning')" :key="metric.key">
                  <tr class="border-b border-gray-100 dark:border-gray-700/40 transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-700/20" :class="idx % 2 === 0 ? 'bg-gray-50/30 dark:bg-gray-800/30' : ''">
                    <td class="px-5 py-3 whitespace-nowrap">
                      <div class="flex items-center gap-1.5 relative">
                        <span class="font-medium text-gray-900 dark:text-gray-100 text-[13px]">{{ metric.label }}</span>
                        <span class="relative group/tip inline-flex">
                          <svg class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 cursor-help hover:text-gray-500 dark:hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" stroke-linecap="round" /></svg>
                          <span class="invisible opacity-0 group-hover/tip:visible group-hover/tip:opacity-100 transition-opacity duration-150 absolute bottom-full left-0 mb-2 z-50 w-64 whitespace-normal break-words px-3 py-2 text-[11px] leading-relaxed text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg pointer-events-none after:content-[''] after:absolute after:top-full after:left-4 after:border-4 after:border-transparent after:border-t-gray-900 dark:after:border-t-gray-700">{{ metric.tooltip }}</span>
                        </span>
                      </div>
                    </td>
                    <td v-for="col in scorecardColumns" :key="col.releaseGroup" class="px-4 py-3 text-center" :class="scorecardColCellClass(col.releaseGroup)">
                      <span class="font-semibold text-[15px] text-gray-900 dark:text-gray-100">{{ formatCellValue(metric, col) }}</span>
                      <div v-if="scorecardDelta(metric, col)" class="text-[11px] mt-0.5 font-medium" :class="scorecardDeltaClass(metric, col)">{{ scorecardDelta(metric, col) }}</div>
                      <div v-if="showCoverageBar(metric)" class="relative group/bar mt-1.5 flex items-center gap-1.5 justify-center cursor-help">
                        <div class="w-16 h-1 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                          <div class="h-full rounded-full transition-all" :class="coveragePct(metric, col) >= 50 ? 'bg-emerald-500' : 'bg-emerald-300 dark:bg-emerald-600'" :style="{ width: coveragePct(metric, col) + '%' }"></div>
                        </div>
                        <span class="text-[9px] text-gray-400 dark:text-gray-500 tabular-nums">{{ coveragePct(metric, col) }}%</span>
                        <span class="invisible opacity-0 group-hover/bar:visible group-hover/bar:opacity-100 transition-opacity duration-150 absolute bottom-full right-0 mb-2 z-50 w-64 whitespace-normal break-words px-3 py-2 text-[11px] leading-relaxed text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg pointer-events-none after:content-[''] after:absolute after:top-full after:right-4 after:border-4 after:border-transparent after:border-t-gray-900 dark:after:border-t-gray-700">{{ coverageTipLine1(metric, col) }}<br/>{{ col.releaseGroup }}: {{ col.totalFeatures }} total, {{ col.aiTouchedFeatures }} AI-touched</span>
                      </div>
                    </td>
                  </tr>
                </template>
              </template>

              <!-- Execution Domain section header -->
              <tr class="border-b border-gray-200 dark:border-gray-600 bg-gradient-to-r from-orange-50 to-transparent dark:from-orange-900/15 dark:to-transparent cursor-pointer select-none" @click="expandedSections.execution = !expandedSections.execution">
                <td :colspan="scorecardColumns.length + 1" class="px-5 py-2.5">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="w-1 h-4 rounded-full bg-orange-500"></span>
                      <span class="text-[11px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest">Execution Domain</span>
                      <span class="text-[10px] text-gray-400 dark:text-gray-500">Prioritization, testing & UX design</span>
                    </div>
                    <svg class="w-4 h-4 text-gray-400 transition-transform" :class="expandedSections.execution ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </td>
              </tr>
              <template v-if="expandedSections.execution">
                <template v-for="(metric, idx) in SCORECARD_METRICS.filter(m => m.group === 'execution')" :key="metric.key">
                  <tr class="border-b border-gray-100 dark:border-gray-700/40 transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-700/20" :class="idx % 2 === 0 ? 'bg-gray-50/30 dark:bg-gray-800/30' : ''">
                    <td class="px-5 py-3 whitespace-nowrap">
                      <div class="flex items-center gap-1.5 relative">
                        <span class="font-medium text-gray-900 dark:text-gray-100 text-[13px]">{{ metric.label }}</span>
                        <span class="relative group/tip inline-flex">
                          <svg class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 cursor-help hover:text-gray-500 dark:hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" stroke-linecap="round" /></svg>
                          <span class="invisible opacity-0 group-hover/tip:visible group-hover/tip:opacity-100 transition-opacity duration-150 absolute bottom-full left-0 mb-2 z-50 w-64 whitespace-normal break-words px-3 py-2 text-[11px] leading-relaxed text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg pointer-events-none after:content-[''] after:absolute after:top-full after:left-4 after:border-4 after:border-transparent after:border-t-gray-900 dark:after:border-t-gray-700">{{ metric.tooltip }}</span>
                        </span>
                      </div>
                    </td>
                    <td v-for="col in scorecardColumns" :key="col.releaseGroup" class="px-4 py-3 text-center" :class="scorecardColCellClass(col.releaseGroup)">
                      <span class="font-semibold text-[15px] text-gray-900 dark:text-gray-100">{{ formatCellValue(metric, col) }}</span>
                      <div v-if="scorecardDelta(metric, col)" class="text-[11px] mt-0.5 font-medium" :class="scorecardDeltaClass(metric, col)">{{ scorecardDelta(metric, col) }}</div>
                      <div v-if="showCoverageBar(metric)" class="relative group/bar mt-1.5 flex items-center gap-1.5 justify-center cursor-help">
                        <div class="w-16 h-1 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                          <div class="h-full rounded-full transition-all" :class="coveragePct(metric, col) >= 50 ? 'bg-orange-500' : 'bg-orange-300 dark:bg-orange-600'" :style="{ width: coveragePct(metric, col) + '%' }"></div>
                        </div>
                        <span class="text-[9px] text-gray-400 dark:text-gray-500 tabular-nums">{{ coveragePct(metric, col) }}%</span>
                        <span class="invisible opacity-0 group-hover/bar:visible group-hover/bar:opacity-100 transition-opacity duration-150 absolute bottom-full right-0 mb-2 z-50 w-64 whitespace-normal break-words px-3 py-2 text-[11px] leading-relaxed text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg pointer-events-none after:content-[''] after:absolute after:top-full after:right-4 after:border-4 after:border-transparent after:border-t-gray-900 dark:after:border-t-gray-700">{{ coverageTipLine1(metric, col) }}<br/>{{ col.releaseGroup }}: {{ col.totalFeatures }} total, {{ col.aiTouchedFeatures }} AI-touched</span>
                      </div>
                    </td>
                  </tr>
                </template>
              </template>

              <!-- Delivery Domain section header -->
              <tr class="border-b border-gray-200 dark:border-gray-600 bg-gradient-to-r from-sky-50 to-transparent dark:from-sky-900/15 dark:to-transparent cursor-pointer select-none" @click="expandedSections.delivery = !expandedSections.delivery">
                <td :colspan="scorecardColumns.length + 1" class="px-5 py-2.5">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="w-1 h-4 rounded-full bg-sky-500"></span>
                      <span class="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest">Delivery Domain</span>
                      <span class="text-[10px] text-gray-400 dark:text-gray-500">Documentation & release readiness</span>
                    </div>
                    <svg class="w-4 h-4 text-gray-400 transition-transform" :class="expandedSections.delivery ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </td>
              </tr>
              <template v-if="expandedSections.delivery">
                <template v-for="(metric, idx) in SCORECARD_METRICS.filter(m => m.group === 'delivery')" :key="metric.key">
                  <tr class="border-b border-gray-100 dark:border-gray-700/40 transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-700/20" :class="idx % 2 === 0 ? 'bg-gray-50/30 dark:bg-gray-800/30' : ''">
                    <td class="px-5 py-3 whitespace-nowrap">
                      <div class="flex items-center gap-1.5 relative">
                        <span class="font-medium text-gray-900 dark:text-gray-100 text-[13px]">{{ metric.label }}</span>
                        <span class="relative group/tip inline-flex">
                          <svg class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 cursor-help hover:text-gray-500 dark:hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" stroke-linecap="round" /></svg>
                          <span class="invisible opacity-0 group-hover/tip:visible group-hover/tip:opacity-100 transition-opacity duration-150 absolute bottom-full left-0 mb-2 z-50 w-64 whitespace-normal break-words px-3 py-2 text-[11px] leading-relaxed text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg pointer-events-none after:content-[''] after:absolute after:top-full after:left-4 after:border-4 after:border-transparent after:border-t-gray-900 dark:after:border-t-gray-700">{{ metric.tooltip }}</span>
                        </span>
                      </div>
                    </td>
                    <td v-for="col in scorecardColumns" :key="col.releaseGroup" class="px-4 py-3 text-center" :class="scorecardColCellClass(col.releaseGroup)">
                      <span class="font-semibold text-[15px] text-gray-900 dark:text-gray-100">{{ formatCellValue(metric, col) }}</span>
                      <div v-if="scorecardDelta(metric, col)" class="text-[11px] mt-0.5 font-medium" :class="scorecardDeltaClass(metric, col)">{{ scorecardDelta(metric, col) }}</div>
                      <div v-if="showCoverageBar(metric)" class="relative group/bar mt-1.5 flex items-center gap-1.5 justify-center cursor-help">
                        <div class="w-16 h-1 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                          <div class="h-full rounded-full transition-all" :class="coveragePct(metric, col) >= 50 ? 'bg-sky-500' : 'bg-sky-300 dark:bg-sky-600'" :style="{ width: coveragePct(metric, col) + '%' }"></div>
                        </div>
                        <span class="text-[9px] text-gray-400 dark:text-gray-500 tabular-nums">{{ coveragePct(metric, col) }}%</span>
                        <span class="invisible opacity-0 group-hover/bar:visible group-hover/bar:opacity-100 transition-opacity duration-150 absolute bottom-full right-0 mb-2 z-50 w-64 whitespace-normal break-words px-3 py-2 text-[11px] leading-relaxed text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg pointer-events-none after:content-[''] after:absolute after:top-full after:right-4 after:border-4 after:border-transparent after:border-t-gray-900 dark:after:border-t-gray-700">{{ coverageTipLine1(metric, col) }}<br/>{{ col.releaseGroup }}: {{ col.totalFeatures }} total, {{ col.aiTouchedFeatures }} AI-touched</span>
                      </div>
                    </td>
                  </tr>
                </template>
              </template>
            </tbody>
          </table>
        </div>

        <!-- CHART VIEW -->
        <div v-else class="p-5">
          <div class="flex items-center gap-3 mb-4">
            <label class="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Metric</label>
            <select v-model="selectedChartMetric" class="text-sm font-medium rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 pl-3 pr-8 py-1.5 cursor-pointer">
              <optgroup label="Overview">
                <option v-for="m in SCORECARD_METRICS.filter(x => x.group === 'summary')" :key="m.key" :value="m.key">{{ m.label }}</option>
              </optgroup>
              <optgroup label="Pipeline Breakdown">
                <option v-for="m in SCORECARD_METRICS.filter(x => x.group === 'pipeline')" :key="m.key" :value="m.key">{{ m.label }}</option>
              </optgroup>
              <optgroup label="Planning Domain">
                <option v-for="m in SCORECARD_METRICS.filter(x => x.group === 'planning')" :key="m.key" :value="m.key">{{ m.label }}</option>
              </optgroup>
              <optgroup label="Execution Domain">
                <option v-for="m in SCORECARD_METRICS.filter(x => x.group === 'execution')" :key="m.key" :value="m.key">{{ m.label }}</option>
              </optgroup>
              <optgroup label="Delivery Domain">
                <option v-for="m in SCORECARD_METRICS.filter(x => x.group === 'delivery')" :key="m.key" :value="m.key">{{ m.label }}</option>
              </optgroup>
            </select>
            <div class="flex items-center gap-3 ml-auto text-[11px] text-gray-400 dark:text-gray-500">
              <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm bg-amber-500 inline-block"></span> Baseline</span>
              <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm bg-blue-500 inline-block"></span> Release</span>
            </div>
          </div>
          <div class="h-80">
            <Line v-if="scorecardChartData" :data="scorecardChartData" :options="scorecardChartOptions" />
          </div>
        </div>
      </div>

      <!-- First-Time Pass Rate -->
      <div v-if="firstPassRates.length" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6 shadow-sm">
        <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-cyan-50 to-transparent dark:from-cyan-900/15 dark:to-transparent">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-full bg-cyan-100 dark:bg-cyan-800/40 flex items-center justify-center shrink-0">
              <svg class="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </span>
            <div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">First-Time Pass Rate</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Percentage of features where AI-generated output was accepted without revision</p>
            </div>
          </div>
        </div>
        <div class="p-5 space-y-3">
          <div v-for="item in firstPassRates" :key="item.key" class="rounded-lg border px-4 py-3 transition-colors" :class="item.comingSoon ? 'border-gray-100 dark:border-gray-700/40 bg-gray-50/50 dark:bg-gray-800/30 opacity-60' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'">
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-3 min-w-0">
                <span class="w-1.5 h-8 rounded-full shrink-0" :class="item.comingSoon ? 'bg-gray-300 dark:bg-gray-600' : item.pct >= 75 ? 'bg-emerald-500' : item.pct >= 50 ? 'bg-amber-500' : 'bg-red-500'"></span>
                <div class="min-w-0">
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ item.name }}</span>
                  <p v-if="!item.comingSoon && item.total > 0" class="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{{ item.accepted }} of {{ item.total }} features accepted first time</p>
                  <p v-else-if="!item.comingSoon" class="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">No data yet</p>
                </div>
              </div>
              <div v-if="item.comingSoon" class="shrink-0">
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 uppercase tracking-wider">Coming Soon</span>
              </div>
              <div v-else class="flex items-center gap-4 shrink-0">
                <div class="w-32 h-2 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                  <div class="h-full rounded-full transition-all duration-500" :class="item.pct >= 75 ? 'bg-emerald-500' : item.pct >= 50 ? 'bg-amber-500' : 'bg-red-500'" :style="{ width: item.pct + '%' }"></div>
                </div>
                <span class="text-lg font-bold tabular-nums w-14 text-right" :class="item.pct >= 75 ? 'text-emerald-600 dark:text-emerald-400' : item.pct >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'">{{ item.total > 0 ? item.pct + '%' : '—' }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="px-5 pb-4">
          <p class="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">Tracks pipelines with revision-signal labels. AI-First Documentation, UXD Agentic, and Epic Creator will be added when revision tracking is available.</p>
        </div>
      </div>

      <!-- Component Throughput table -->
      <div v-if="selectedComponent === 'all' && throughputRows.length > 1" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto shadow-sm">
        <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="w-1 h-4 rounded-full bg-violet-500"></span>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Component Throughput</h3>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 ml-3">Feature delivery and normalized effort per component across releases — proving AI adoption drives genuine throughput, not inflated counts</p>
            </div>
          </div>
          <div class="flex items-center gap-8 mt-3 ml-3">
            <div class="flex flex-col items-center px-5 py-2.5 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600 min-w-[80px]">
              <span class="font-bold text-gray-900 dark:text-gray-100 text-base leading-tight">17</span>
              <span class="font-semibold text-emerald-700 dark:text-emerald-400 text-xs mt-0.5">4.3 avg</span>
              <span class="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">35% AI</span>
            </div>
            <div class="flex flex-col gap-2 text-[11px] text-gray-600 dark:text-gray-300">
              <div class="flex items-center gap-2">
                <span class="font-bold text-gray-900 dark:text-gray-100 text-sm w-8 text-right">17</span>
                <span class="text-gray-300 dark:text-gray-600">→</span>
                <span>Total features delivered in this release</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-emerald-700 dark:text-emerald-400 text-sm w-8 text-right">4.3</span>
                <span class="text-gray-300 dark:text-gray-600">→</span>
                <span>Avg effort per feature normalized using RICE Score, Story Points, # of child issues</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-gray-500 dark:text-gray-400 text-sm w-8 text-right">35%</span>
                <span class="text-gray-300 dark:text-gray-600">→</span>
                <span>AI pipeline adoption rate</span>
              </div>
            </div>
          </div>
        </div>
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b-2 border-gray-200 dark:border-gray-600">
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-white dark:bg-gray-800">Component</th>
              <template v-for="rg in scorecardGroups" :key="rg.releaseGroup">
                <th class="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider whitespace-nowrap" :class="rg.releaseGroup === selectedBaseline ? 'text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/10' : 'text-gray-500 dark:text-gray-400'">
                  <div class="flex flex-col items-center gap-0.5">
                    <span>{{ rg.releaseGroup }}</span>
                    <span class="text-[9px] font-normal text-gray-400 dark:text-gray-500">{{ rg.totalFeatures }} features</span>
                  </div>
                </th>
              </template>
              <th class="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-l border-gray-200 dark:border-gray-600 group relative cursor-help">
                <span class="inline-flex items-center gap-1">Dominant Pipelines
                  <svg class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </span>
                <div class="hidden group-hover:block absolute z-20 top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3 text-left normal-case tracking-normal">
                  <p class="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1.5">AI Pipeline Key</p>
                  <div class="space-y-1.5 text-[11px] font-normal">
                    <div><span class="font-semibold text-gray-800 dark:text-gray-200">Strat</span> <span class="text-gray-500 dark:text-gray-400">— Auto-generates feature strategy definitions</span></div>
                    <div><span class="font-semibold text-gray-800 dark:text-gray-200">RFE</span> <span class="text-gray-500 dark:text-gray-400">— Auto-creates RFEs with feasibility checks</span></div>
                    <div><span class="font-semibold text-gray-800 dark:text-gray-200">Test Plan</span> <span class="text-gray-500 dark:text-gray-400">— Auto-generates and revises test plans</span></div>
                    <div><span class="font-semibold text-gray-800 dark:text-gray-200">QG1</span> <span class="text-gray-500 dark:text-gray-400">— Automated RICE scoring and quality gates</span></div>
                    <div><span class="font-semibold text-gray-800 dark:text-gray-200">AI Doc</span> <span class="text-gray-500 dark:text-gray-400">— AI-contributed documentation and Jira content</span></div>
                    <div><span class="font-semibold text-gray-800 dark:text-gray-200">UXD</span> <span class="text-gray-500 dark:text-gray-400">— AI-assisted UX design and validation</span></div>
                    <div><span class="font-semibold text-gray-800 dark:text-gray-200">Epic Creator</span> <span class="text-gray-500 dark:text-gray-400">— Decomposes strategies into implementation epics</span></div>
                  </div>
                </div>
              </th>
              <th class="px-3 py-3 text-center text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider border-l-2 border-violet-200 dark:border-violet-700/50 bg-violet-50/40 dark:bg-violet-900/10 group relative cursor-help">
                <span class="inline-flex items-center gap-1">Throughput Delta
                  <svg class="w-3.5 h-3.5 text-violet-400 dark:text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </span>
                <div class="hidden group-hover:block absolute z-20 top-full right-0 mt-1 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3 text-left normal-case tracking-normal cursor-default" @click.stop>
                  <p class="text-[10px] font-semibold text-violet-600 dark:text-violet-400 uppercase mb-1.5">Formula</p>
                  <div class="text-[11px] font-normal text-gray-700 dark:text-gray-300 space-y-1.5">
                    <div class="bg-violet-50 dark:bg-violet-900/20 rounded px-2 py-1.5 font-mono text-[10px]">
                      <div>Throughput = Features × Avg Effort</div>
                      <div class="mt-1">Delta = (Latest − Baseline) / Baseline × 100</div>
                    </div>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400">Effort-weighted to prevent inflation from splitting features into smaller, low-effort items.</p>
                  </div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in throughputRows" :key="row.name" :class="idx % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''" class="border-b border-gray-100 dark:border-gray-700/40 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
              <td class="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100 sticky left-0 bg-inherit whitespace-nowrap">{{ row.name }}</td>
              <template v-for="rg in scorecardGroups" :key="rg.releaseGroup + row.name">
                <td class="px-3 py-2.5 text-center" :class="rg.releaseGroup === selectedBaseline ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''">
                  <template v-if="row.releases[rg.releaseGroup]">
                    <div class="font-semibold text-gray-900 dark:text-gray-100 text-[13px]">{{ row.releases[rg.releaseGroup].features }}</div>
                    <div class="text-[11px] mt-0.5 tabular-nums" :class="effortCellClass(row.releases[rg.releaseGroup].avgEffort, row.baselineAvg)">
                      {{ row.releases[rg.releaseGroup].avgEffort }} avg
                    </div>
                    <div class="text-[9px] mt-0.5 tabular-nums text-gray-400 dark:text-gray-500">{{ row.releases[rg.releaseGroup].aiPct }}% AI</div>
                  </template>
                  <span v-else class="text-gray-300 dark:text-gray-600">—</span>
                </td>
              </template>
              <td class="px-3 py-2.5 text-gray-600 dark:text-gray-400 text-xs border-l border-gray-100 dark:border-gray-700/40">{{ row.dominantPipelines }}</td>
              <td class="px-3 py-2.5 text-center border-l-2 border-violet-100 dark:border-violet-800/40 bg-violet-50/20 dark:bg-violet-900/5 group/delta relative">
                <template v-if="row.baselineThroughput > 0 || row.latestThroughput > 0">
                  <span class="font-bold text-sm tabular-nums" :class="row.throughputDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : row.throughputDelta === 0 ? 'text-gray-500 dark:text-gray-400' : 'text-red-600 dark:text-red-400'">
                    {{ row.throughputDelta > 0 ? '+' : '' }}{{ row.throughputDelta }}%
                  </span>
                  <div class="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">{{ row.baselineThroughput }} → {{ row.latestThroughput }}</div>
                  <div class="hidden group-hover/delta:block absolute z-20 bottom-full right-0 mb-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-2.5 text-left text-[10px] font-normal tracking-normal">
                    <p class="font-semibold text-gray-700 dark:text-gray-200 mb-1">{{ row.name }}</p>
                    <div class="space-y-0.5 text-gray-500 dark:text-gray-400 font-mono">
                      <div>Baseline: {{ row.baselineFeatures }} feat × {{ row.baselineAvg }} avg = <span class="text-gray-700 dark:text-gray-200 font-semibold">{{ row.baselineThroughput }}</span></div>
                      <div>Latest: {{ row.latestFeatures }} feat × {{ row.latestAvg }} avg = <span class="text-gray-700 dark:text-gray-200 font-semibold">{{ row.latestThroughput }}</span></div>
                      <div class="border-t border-gray-100 dark:border-gray-700 pt-0.5 mt-0.5">Delta: ({{ row.latestThroughput }} − {{ row.baselineThroughput }}) / {{ row.baselineThroughput }} = <span class="font-semibold" :class="row.throughputDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'">{{ row.throughputDelta > 0 ? '+' : '' }}{{ row.throughputDelta }}%</span></div>
                    </div>
                  </div>
                </template>
                <span v-else class="text-[10px] text-gray-400 dark:text-gray-500">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Per-component breakdown (when All Components) -->
      <div v-if="selectedComponent === 'all' && perComponentRows.length > 1" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto shadow-sm">
        <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-2">
            <span class="w-1 h-4 rounded-full bg-teal-500"></span>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Per-Component Breakdown</h3>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 ml-3">AI adoption metrics aggregated by component across all selected releases</p>
        </div>
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Component</th>
              <th v-for="col in [{key:'total',label:'Features'},{key:'aiTouched',label:'AI-Touched'},{key:'pct',label:'AI %'}]" :key="col.key" class="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider cursor-pointer select-none transition-colors" :class="componentSortKey === col.key ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'" @click="toggleComponentSort(col.key)">
                <span class="inline-flex items-center gap-1 justify-end">
                  {{ col.label }}
                  <span class="inline-flex flex-col -space-y-1">
                    <svg class="w-2.5 h-2.5 transition-colors" :class="componentSortKey === col.key && componentSortAsc ? 'text-primary-600 dark:text-primary-400' : 'text-gray-300 dark:text-gray-600'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg>
                    <svg class="w-2.5 h-2.5 transition-colors" :class="componentSortKey === col.key && !componentSortAsc ? 'text-primary-600 dark:text-primary-400' : 'text-gray-300 dark:text-gray-600'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </span>
                </span>
              </th>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dominant Pipelines</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in perComponentRows" :key="row.name" :class="idx % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800/50' : ''" class="border-b border-gray-100 dark:border-gray-700/50">
              <td class="px-4 py-2 text-gray-900 dark:text-gray-100 font-medium">{{ row.name }}</td>
              <td class="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{{ row.total }}</td>
              <td class="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{{ row.aiTouched }}</td>
              <td class="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{{ row.total > 0 ? Math.round((row.aiTouched / row.total) * 100) : 0 }}%</td>
              <td class="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">
                {{ PIPELINE_KEYS.filter(k => row.pipelines[k] > 0).map(k => PIPELINE_META[k].short).join(', ') || 'None' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pipeline taxonomy (collapsible) -->
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6 shadow-sm">
        <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-2">
            <span class="w-1 h-4 rounded-full bg-indigo-500"></span>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Pipelines Identified</h3>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 ml-3">Seven distinct AI automation pipelines detected via Jira labels. Click to expand details.</p>
        </div>
        <div class="divide-y divide-gray-100 dark:divide-gray-700/50">
          <div v-for="(meta, key) in PIPELINE_META" :key="key">
            <button @click="togglePipeline(key)" class="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
              <span class="flex items-center gap-2">
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ meta.name }}</span>
                <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{{ meta.labels.length }} labels</span>
              </span>
              <svg :class="expandedPipelines[key] ? 'rotate-180' : ''" class="w-4 h-4 text-gray-400 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            <div v-if="expandedPipelines[key]" class="px-5 pb-3">
              <p class="text-xs text-gray-600 dark:text-gray-400 mb-1">{{ meta.description }}</p>
              <p class="text-xs text-gray-400 dark:text-gray-500">Labels: {{ meta.labels.join(', ') }}</p>
            </div>
          </div>
        </div>
      </div>

    </template>
  </div>
</template>
