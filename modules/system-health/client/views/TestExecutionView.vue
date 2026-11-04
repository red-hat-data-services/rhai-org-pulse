<template>
  <div class="dashboard test-execution-theme">
    <div class="container">
      <!-- Loading / Error -->
      <div v-if="loading" class="loading">Loading…</div>
      <div v-else-if="error" class="error">{{ error }}</div>

      <template v-else>
        <div v-if="!hasHeatmapData && !hasNightlyData" class="no-data">
          No test execution data has been uploaded yet. The external test-reports
          pipeline pushes data to this dashboard via the bulk API.
        </div>

        <template v-else>
          <template v-if="hasHeatmapData">
            <div class="header opensearch-section-header">
              <h1>Test Execution <span class="beta-tag">(Beta)</span></h1>
              <p>Aggregated view of RHOAI test execution across all components, quality gates, and releases. Data is ingested from Jenkins CI builds and indexed in OpenSearch.</p>
            </div>

            <FilterBar
              :filters="filters"
              :versions="availableVersions"
              :releases="availableReleases"
              @filters-change="updateFilters"
            />

            <MetricsCards
              v-if="filteredComponents.length > 0"
              :components="filteredComponents"
              :filters="filters"
            />

            <div
              v-if="filteredComponents.length === 0"
              class="no-data heatmap-filter-empty"
            >
              <p>{{ heatmapFilterEmptyMessage }}</p>
            </div>
            <template v-else>
              <div class="section">
                <div class="section-title">
                  <h2>Component Heatmap</h2>
                </div>
                <div class="help-box">
                  <h4>How to read the heatmap</h4>
                  <ul>
                    <li><strong>Each row</strong> is a test component (e.g., Platform, Workbenches, Model Server).</li>
                    <li><strong>Each column</strong> is a calendar date. Dates with no executions show "–".</li>
                    <li><strong>Cell color</strong> indicates pass rate: <span class="color-green">🟢 ≥95%</span> · <span class="color-amber">🟡 80–94%</span> · <span class="color-orange">🟠 60–79%</span> · <span class="color-red">🔴 &lt;60%</span>.</li>
                    <li><strong>Cell content</strong> shows the pass percentage, plus pass/fail/skip counts below it.</li>
                  </ul>
                </div>

                <HeatmapTable
                  :components="filteredComponents"
                  @component-click="onComponentClick"
                />
              </div>

              <TrendChart :components="filteredComponents" />
            </template>
          </template>

          <div v-if="hasNightlyData" class="section nightly-section">
            <div class="section-title nightly-section-header">
              <h2>Nightly Build Health</h2>
              <p class="section-sub">
                <template v-if="nightlyHealth?.generated_at">
                  Generated {{ formatTimestamp(nightlyHealth.generated_at) }}.
                </template>
                Matrix shows promotion-gate status per day (same fields as
                <code>promotion_gate_test_summary.yaml</code>). Click a date column to list all builds that day.
                <strong>Test Results Source</strong> below filters this matrix only.
              </p>
              <div class="help-box nightly-help">
                <h4>How to read Nightly Build Health</h4>
                <ul>
                  <li><strong>Each column</strong> is a UTC day; the cell uses that day&apos;s selected promotion-gate run (<code>latest_run_id</code>).</li>
                  <li><strong>–</strong> means that component is missing from that run&apos;s YAML. <strong>Not Installed</strong> means the summary explicitly reports the component is not on the cluster.</li>
                  <li><strong>Blocked</strong> means deployment or gate prerequisites failed. A Blocked cell can still show recorded test counts. A <strong>DSC:</strong> subtitle is operator/DataScienceCluster readiness from YAML, not a passed test result.</li>
                </ul>
              </div>
            </div>
            <NightlyHealthTable
              v-model:selected-stream-key="selectedNightlyStreamKey"
              :payload="nightlyHealth"
              :heatmap-components="heatmap"
              @component-click="onComponentClick"
            />
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject, watch, nextTick } from 'vue'
import { useTestDashboard } from '../composables/useTestDashboard'
import FilterBar from '../components/FilterBar.vue'
import MetricsCards from '../components/MetricsCards.vue'
import HeatmapTable from '../components/HeatmapTable.vue'
import TrendChart from '../components/TrendChart.vue'
import NightlyHealthTable from '../components/NightlyHealthTable.vue'
import {
  formatTimestamp,
  TEST_RESULTS_SOURCE_QUERY_PARAM,
  streamKeyFromTestResultsSourceQuery,
  testResultsSourceQueryValue
} from '../composables/useNightlyHealthMatrix'
import '../styles/test-execution-theme.css'

const { loadData, heatmap, nightlyHealth, loading, error, hasHeatmapData, hasNightlyData } = useTestDashboard()

const nav = inject('moduleNav', null)

const selectedNightlyStreamKey = ref(null)

let applyingSourceFromUrl = false
/** Blocks hash sync until URL `source` is applied (avoids default stream clobbering deep links). */
const initialSourceResolved = ref(false)

function applyTestResultsSourceFromNavParams() {
  if (!hasNightlyData.value) {
    initialSourceResolved.value = true
    return
  }
  const raw = nav?.params?.value?.[TEST_RESULTS_SOURCE_QUERY_PARAM]
  if (raw == null || raw === '') {
    initialSourceResolved.value = true
    return
  }
  const key = streamKeyFromTestResultsSourceQuery(nightlyHealth.value, String(raw))
  if (!key) {
    initialSourceResolved.value = true
    return
  }
  if (key === selectedNightlyStreamKey.value) {
    initialSourceResolved.value = true
    syncTestResultsSourceToNavParams(key)
    return
  }
  applyingSourceFromUrl = true
  selectedNightlyStreamKey.value = key
  nextTick(() => {
    applyingSourceFromUrl = false
    initialSourceResolved.value = true
  })
}

function syncTestResultsSourceToNavParams(streamKey) {
  if (!initialSourceResolved.value || !nav?.updateParams || applyingSourceFromUrl) return
  const nextValue = streamKey
    ? testResultsSourceQueryValue(nightlyHealth.value, streamKey)
    : undefined
  const current = nav.params.value?.[TEST_RESULTS_SOURCE_QUERY_PARAM]
  if (nextValue === current || (!nextValue && (current == null || current === ''))) return
  nav.updateParams(
    { [TEST_RESULTS_SOURCE_QUERY_PARAM]: nextValue || undefined },
    { push: false }
  )
}

watch(nightlyHealth, () => {
  initialSourceResolved.value = false
  applyTestResultsSourceFromNavParams()
})

if (nav) {
  watch(
    () => nav.params.value?.[TEST_RESULTS_SOURCE_QUERY_PARAM],
    () => applyTestResultsSourceFromNavParams()
  )
}

watch(selectedNightlyStreamKey, (key) => {
  syncTestResultsSourceToNavParams(key)
})

const filters = ref({
  version: 'All',
  release: 'All',
  useDateRange: true,
  fromDate: null,
  toDate: null
})

// Set default dates (last 30 days) and load data on mount.
onMounted(() => {
  const today = new Date()
  const from = new Date(today)
  from.setDate(today.getDate() - 30)

  filters.value.fromDate = formatDate(from)
  filters.value.toDate = formatDate(today)

  loadData()
})

const components = computed(() => heatmap.value || [])

// Distinct versions/releases discovered from the data, to populate filters.
const availableVersions = computed(() => {
  const set = new Set()
  components.value.forEach((comp) => {
    Object.values(comp.days || {}).forEach((day) => {
      Object.entries(day.by_vr || {}).forEach(([vrKey, vr]) => {
        if ((vr.total || 0) > 0) {
          set.add(normalizeVersion(vrKey.split('|')[0]))
        }
      })
    })
  })
  return Array.from(set).sort()
})

const availableReleases = computed(() => {
  const set = new Set()
  components.value.forEach((comp) => {
    Object.values(comp.days || {}).forEach((day) => {
      Object.entries(day.by_vr || {}).forEach(([vrKey, vr]) => {
        if ((vr.total || 0) > 0) {
          const r = vrKey.split('|')[1]
          if (r) set.add(r)
        }
      })
    })
  })
  return Array.from(set).sort()
})

function filterHeatmapComponents(filterOverrides = {}) {
  if (!components.value || components.value.length === 0) return []

  const f = { ...filters.value, ...filterOverrides }
  const from = f.fromDate
  const to = f.toDate
  const useDate = f.useDateRange !== false

  return components.value
    .map((comp) => {
      const filteredDays = {}

      Object.entries(comp.days || {}).forEach(([date, day]) => {
        if (useDate && (date < from || date > to)) return

        if ((f.version !== 'All' || f.release !== 'All') && day.by_vr) {
          let totalP = 0
          let totalF = 0
          let totalS = 0
          let totalT = 0
          let urls = []

          Object.entries(day.by_vr).forEach(([vrKey, vr]) => {
            if (vrKeyMatches(vrKey, f.version, f.release)) {
              totalP += vr.passed || 0
              totalF += vr.failed || 0
              totalS += vr.skipped || 0
              totalT += vr.total || 0
              urls = urls.concat(vr.jenkins_urls || [])
            }
          })

          const filteredByVr = {}
          Object.entries(day.by_vr).forEach(([vrKey, vr]) => {
            if (vrKeyMatches(vrKey, f.version, f.release)) {
              filteredByVr[vrKey] = vr
            }
          })

          if (totalT > 0) {
            filteredDays[date] = {
              passed: totalP,
              failed: totalF,
              skipped: totalS,
              total: totalT,
              jenkins_urls: urls,
              by_vr: filteredByVr
            }
          }
        } else {
          filteredDays[date] = day
        }
      })

      let overallP = 0
      let overallF = 0
      let overallS = 0
      let overallT = 0
      Object.values(filteredDays).forEach((day) => {
        overallP += day.passed || 0
        overallF += day.failed || 0
        overallS += day.skipped || 0
        overallT += day.total || 0
      })

      return {
        component: comp.component,
        overall: {
          total: overallT,
          passed: overallP,
          failed: overallF,
          skipped: overallS
        },
        days: filteredDays
      }
    })
    .filter((comp) => comp.overall.total > 0)
}

const filteredComponents = computed(() => filterHeatmapComponents())

watch(
  [availableVersions, availableReleases],
  ([versions, releases]) => {
    let next = filters.value
    let changed = false
    if (next.version !== 'All' && !versions.includes(next.version)) {
      next = { ...next, version: 'All' }
      changed = true
    }
    if (next.release !== 'All' && !releases.includes(next.release)) {
      next = { ...next, release: 'All' }
      changed = true
    }
    if (changed) filters.value = next
  },
  { immediate: true }
)

const heatmapDateExtents = computed(() => {
  let min = null
  let max = null
  for (const comp of components.value) {
    for (const d of Object.keys(comp.days || {})) {
      if (!min || d < min) min = d
      if (!max || d > max) max = d
    }
  }
  return min && max ? { min, max } : null
})

const heatmapFilterEmptyMessage = computed(() => {
  const f = filters.value
  const ext = heatmapDateExtents.value
  let msg =
    'No component test executions match the current filters. The heatmap only shows rows with non-zero test counts (production OpenSearch data).'
  if (f.useDateRange !== false && f.fromDate && f.toDate && ext) {
    msg += ` Uploaded heatmap dates span ${ext.min} through ${ext.max}; selected range is ${f.fromDate} through ${f.toDate}.`
  }
  if (
    filteredComponents.value.length === 0 &&
    (f.version !== 'All' || f.release !== 'All') &&
    filterHeatmapComponents({ version: 'All', release: 'All' }).length > 0
  ) {
    msg += ' Set Version and Release to All — promotion-gate placeholder rows often use update channels with zero test counts.'
  } else if (
    filteredComponents.value.length === 0 &&
    f.useDateRange !== false &&
    filterHeatmapComponents({ useDateRange: false }).length > 0
  ) {
    msg += ' Widen the date range or disable Date Range to include older heatmap days.'
  }
  if (hasNightlyData.value) {
    msg += ' Promotion-gate status is in Nightly Build Health below.'
  }
  return msg
})

function vrKeyMatches(vrKey, version, release) {
  const [v, r] = vrKey.split('|')
  const normV = normalizeVersion(v)
  
  if (version && version !== 'All' && normalizeVersion(version) !== normV) return false
  if (release && release !== 'All' && r !== release) return false
  
  return true
}

function normalizeVersion(v) {
  const base = v.split('-')[0]
  const parts = base.split('.')
  return parts.length >= 2 ? parts[0] + '.' + parts[1] : base
}

function formatDate(d) {
  return d.toISOString().slice(0, 10)
}

function updateFilters(newFilters) {
  filters.value = { ...newFilters }
}

function onComponentClick(componentName) {
  if (nav) {
    nav.navigateTo('test-execution-detail', { component: componentName })
  } else {
    window.location.hash = `#/system-health/test-execution-detail?component=${encodeURIComponent(componentName)}`
  }
}

</script>

<style scoped>
.dashboard {
  color: var(--te-text);
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.container {
  max-width: 1500px;
  margin: 0 auto;
  padding: 24px 32px;
}

.header {
  margin-bottom: 8px;
}

.opensearch-section-header {
  margin-top: 0;
}

.header h1 {
  font-size: 26px;
  font-weight: 700;
  color: var(--te-heading);
  margin-bottom: 4px;
}

.beta-tag {
  font-size: 14px;
  color: var(--te-beta);
  font-weight: 500;
  vertical-align: middle;
}

.header p {
  font-size: 13px;
  color: var(--te-text-muted);
  line-height: 1.5;
  max-width: 900px;
}

.section-title {
  margin-bottom: 6px;
}

.section-title h2 {
  font-size: 18px;
  font-weight: 600;
  color: var(--te-heading);
  margin-bottom: 2px;
  background: var(--te-section-title-bg);
  padding: 10px 16px;
  border-radius: 6px;
}

.section-title p {
  font-size: 12px;
  color: var(--te-text-muted);
  padding-left: 16px;
}

.section-title p code {
  font-size: 11px;
  font-weight: 600;
  color: var(--te-heading);
  background: var(--te-surface-raised);
  padding: 0 4px;
  border-radius: 3px;
}

.nightly-section-header .section-sub {
  font-size: 12px;
  color: var(--te-text-muted);
  padding-left: 16px;
  margin: 0 0 10px;
  line-height: 1.4;
}

.nightly-section-header .section-sub code {
  font-size: 11px;
  font-weight: 600;
  color: var(--te-heading);
  background: var(--te-surface-raised);
  padding: 0 4px;
  border-radius: 3px;
}

.help-box {
  background: var(--te-help-bg);
  border: 1px solid var(--te-help-border);
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 6px;
}

.help-box h4 {
  font-size: 13px;
  color: var(--te-accent);
  margin-bottom: 6px;
  font-weight: 600;
}

.help-box p,
.help-box li {
  font-size: 12px;
  color: var(--te-text-muted);
  line-height: 1.6;
}

.help-box ul {
  padding-left: 18px;
  margin-top: 4px;
}

.color-green {
  color: #2ed573;
}

.color-amber {
  color: #ffa502;
}

.color-orange {
  color: #e17055;
}

.color-red {
  color: #ff4757;
}

.loading,
.error,
.no-data {
  text-align: center;
  padding: 60px;
  font-size: 16px;
}

.loading {
  color: var(--te-loading);
}

.error {
  color: #ff4757;
}

.no-data {
  color: var(--te-text-muted);
}

.section {
  margin-top: 28px;
}
</style>
