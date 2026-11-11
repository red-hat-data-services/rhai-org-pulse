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
          <nav
            class="dashboard-tabs"
            role="tablist"
            aria-label="Test execution views"
            @keydown="onExecutionTabKeydown"
          >
            <button
              id="test-exec-tab-releases"
              type="button"
              role="tab"
              class="dashboard-tab"
              :class="{ 'dashboard-tab--active': activeTab === 'releases' }"
              :aria-selected="activeTab === 'releases'"
              aria-controls="test-exec-panel-releases"
              :tabindex="activeTab === 'releases' ? 0 : -1"
              :disabled="!hasHeatmapData"
              @click="setActiveTab('releases')"
            >
              RHOAI Releases
            </button>
            <button
              id="test-exec-tab-gates"
              type="button"
              role="tab"
              class="dashboard-tab"
              :class="{ 'dashboard-tab--active': activeTab === 'gates' }"
              :aria-selected="activeTab === 'gates'"
              aria-controls="test-exec-panel-gates"
              :tabindex="activeTab === 'gates' ? 0 : -1"
              :disabled="!hasNightlyData"
              @click="setActiveTab('gates')"
            >
              Promotion Gate
            </button>
          </nav>

          <div
            id="test-exec-panel-releases"
            v-show="activeTab === 'releases'"
            role="tabpanel"
            class="tab-panel"
            aria-labelledby="test-exec-tab-releases"
          >
            <div v-if="!hasHeatmapData" class="no-data tab-empty">
              No OpenSearch release test data has been uploaded yet.
            </div>
            <template v-else>
              <div class="tab-panel-heading">
                <h2 class="tab-panel-title">RHOAI Releases Test Results</h2>
                <p class="tab-panel-intro">
                  Aggregated view of RHOAI test execution across all components, quality gates, and releases.
                  Data is ingested from Jenkins CI builds and indexed in OpenSearch.
                </p>
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
                    <h3 class="tab-section-subtitle">Component Heatmap</h3>
                  </div>
                  <div class="help-box tab-help-box">
                    <h4>ℹ️ How to read the heatmap</h4>
                    <ul>
                      <li><strong>Each row</strong> — A test component (e.g., Platform, Workbenches, Model Server).</li>
                      <li><strong>Each column</strong> — A calendar date; dates with no executions show "–".</li>
                      <li><strong>Cell color</strong> — Pass rate: <span class="color-green">🟢 ≥95%</span> · <span class="color-amber">🟡 80–94%</span> · <span class="color-orange">🟠 60–79%</span> · <span class="color-red">🔴 &lt;60%</span>.</li>
                      <li><strong>Cell content</strong> — Pass percentage plus pass/fail/skip counts below it.</li>
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
          </div>

          <div
            id="test-exec-panel-gates"
            v-show="activeTab === 'gates'"
            role="tabpanel"
            class="tab-panel"
            aria-labelledby="test-exec-tab-gates"
          >
            <div v-if="!hasNightlyData" class="no-data tab-empty">
              No promotion-gate nightly data has been uploaded yet.
            </div>
            <div v-else class="nightly-section--tab">
              <div class="tab-panel-heading">
                <h2 class="tab-panel-title">{{ gatesPanelTitle }}</h2>
                <p class="tab-panel-intro">
                  <template v-if="nightlyHealth?.generated_at">
                    Generated {{ formatTimestamp(nightlyHealth.generated_at) }}.
                  </template>
                  Each column shows promotion-gate results from the selected run for that day.
                  Click a date column to open every build recorded that day.
                </p>
              </div>
              <div class="help-box tab-help-box">
                <h4>ℹ️ How to read {{ gatesPanelTitle }}</h4>
                <ul>
                  <li><strong>Each column</strong> — Results from the selected run for that day; the day popup dialog lists all builds.</li>
                  <li><strong>Passed</strong> — The source reports a pass, or readiness is ready when no source status is available.</li>
                  <li><strong>Failed</strong> — The source reports a failure, or readiness is failed when no source status is available.</li>
                  <li><strong>Blocked</strong> — Health checks failed before tests ran, or <strong>DSC</strong> status for components is not ready.</li>
                  <li><strong>Blank</strong> — No result for that component; <strong>Not Installed</strong> — component set to 'removed' in DSC.</li>
                </ul>
              </div>
              <NightlyHealthTable
                v-model:selected-stream-key="selectedNightlyStreamKey"
                :payload="nightlyHealth"
                :heatmap-components="heatmap"
                :tab-panel-active="activeTab === 'gates'"
                @component-click="onComponentClick"
              />
            </div>
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
  REPORTING_STREAM_KEYS,
  TEST_RESULTS_SOURCE_QUERY_PARAM,
  nightlyTestResultsPanelTitle,
  streamKeyFromTestResultsSourceQuery,
  testResultsSourceQueryValueForUrl
} from '../composables/useNightlyHealthMatrix'
import '../styles/test-execution-theme.css'

const { loadData, heatmap, nightlyHealth, loading, error, hasHeatmapData, hasNightlyData } = useTestDashboard()

const nav = inject('moduleNav', null)

/** Hash query: `tab=releases` | `tab=gates` (distinct from nightly `source=` stream filter). */
const TEST_EXECUTION_TAB_PARAM = 'tab'

const EXECUTION_TAB_ORDER = ['releases', 'gates']
const EXECUTION_TAB_DOM_IDS = {
  releases: 'test-exec-tab-releases',
  gates: 'test-exec-tab-gates'
}

const selectedNightlyStreamKey = ref(null)
const activeTab = ref('releases')

const gatesPanelTitle = computed(() =>
  nightlyTestResultsPanelTitle(nightlyHealth.value, selectedNightlyStreamKey.value)
)

let applyingSourceFromUrl = false
let applyingTabFromUrl = false
/** Blocks hash sync until URL `source` is applied (avoids default stream clobbering deep links). */
const initialSourceResolved = ref(false)

function canonicalizeGatesSourceInUrl() {
  initialSourceResolved.value = true
  rewriteGatesSourceParamToMatchFilter()
}

function applyTestResultsSourceFromNavParams() {
  if (activeTab.value !== 'gates') {
    return
  }
  if (!hasNightlyData.value) {
    initialSourceResolved.value = true
    return
  }
  const raw = nav?.params?.value?.[TEST_RESULTS_SOURCE_QUERY_PARAM]
  if (raw == null || raw === '') {
    initialSourceResolved.value = true
    nextTick(() => rewriteGatesSourceParamToMatchFilter())
    return
  }
  const key = streamKeyFromTestResultsSourceQuery(nightlyHealth.value, String(raw))
  if (!key) {
    initialSourceResolved.value = true
    nextTick(() => canonicalizeGatesSourceInUrl())
    return
  }
  if (key === selectedNightlyStreamKey.value) {
    initialSourceResolved.value = true
    syncTestResultsSourceToNavParams(key)
    nextTick(() => rewriteGatesSourceParamToMatchFilter())
    return
  }
  applyingSourceFromUrl = true
  selectedNightlyStreamKey.value = key
  nextTick(() => {
    applyingSourceFromUrl = false
    initialSourceResolved.value = true
    syncTestResultsSourceToNavParams(key)
    rewriteGatesSourceParamToMatchFilter()
  })
}

function syncTestResultsSourceToNavParams(streamKey) {
  if (activeTab.value !== 'gates') return
  if (!nav?.updateParams || applyingSourceFromUrl) return
  if (!streamKey || !hasNightlyData.value) return
  const canonical = testResultsSourceQueryValueForUrl(nightlyHealth.value, streamKey)
  if (!canonical) return
  const current = nav.params.value?.[TEST_RESULTS_SOURCE_QUERY_PARAM]
  if (canonical === current) return
  if (!initialSourceResolved.value) return
  nav.updateParams(
    { [TEST_RESULTS_SOURCE_QUERY_PARAM]: canonical },
    { push: false }
  )
}

function rewriteGatesSourceParamToMatchFilter() {
  if (activeTab.value !== 'gates' || !hasNightlyData.value || !nav?.updateParams) return
  if (applyingSourceFromUrl) return
  const key = selectedNightlyStreamKey.value
  if (!key) return
  const canonical = testResultsSourceQueryValueForUrl(nightlyHealth.value, key)
  if (!canonical) return
  const current = nav.params.value?.[TEST_RESULTS_SOURCE_QUERY_PARAM]
  const needsRewrite =
    canonical !== current
    || REPORTING_STREAM_KEYS.has(String(current || ''))
  if (!needsRewrite) return
  applyingSourceFromUrl = true
  nav.updateParams({ [TEST_RESULTS_SOURCE_QUERY_PARAM]: canonical }, { push: false })
  nextTick(() => {
    applyingSourceFromUrl = false
  })
}

watch(nightlyHealth, () => {
  if (activeTab.value !== 'gates') {
    initialSourceResolved.value = true
    return
  }
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
  if (activeTab.value === 'gates') {
    syncTestResultsSourceToNavParams(key)
    nextTick(() => rewriteGatesSourceParamToMatchFilter())
  }
})

watch(
  [selectedNightlyStreamKey, nightlyHealth, activeTab, loading],
  () => {
    if (loading.value || activeTab.value !== 'gates' || !nightlyHealth.value) return
    nextTick(() => {
      initialSourceResolved.value = true
      rewriteGatesSourceParamToMatchFilter()
    })
  },
  { flush: 'post' }
)

function parseTabQueryValue(raw) {
  const tab = String(raw ?? '').trim().toLowerCase()
  if (tab === 'releases' || tab === 'nightly') return 'releases'
  if (tab === 'gates') return 'gates'
  return null
}

function resolveTabFromParam(raw) {
  const tab = parseTabQueryValue(raw)
  if (tab === 'releases' && hasHeatmapData.value) return 'releases'
  if (tab === 'gates' && hasNightlyData.value) return 'gates'
  return null
}

function defaultTabForData() {
  if (hasHeatmapData.value) return 'releases'
  if (hasNightlyData.value) return 'gates'
  return 'releases'
}

function applyActiveTabFromNavParams() {
  const wanted = parseTabQueryValue(nav?.params?.value?.[TEST_EXECUTION_TAB_PARAM])
  if (wanted === 'gates') {
    if (hasNightlyData.value) {
      activeTab.value = 'gates'
      return
    }
    if (loading.value) {
      activeTab.value = 'gates'
      return
    }
  }
  if (wanted === 'releases') {
    if (hasHeatmapData.value) {
      activeTab.value = 'releases'
      return
    }
    if (loading.value) {
      activeTab.value = 'releases'
      return
    }
  }
  const resolved = wanted ? resolveTabFromParam(wanted) : null
  activeTab.value = resolved || defaultTabForData()
}

function clearSourceFromNavParams() {
  if (!nav?.updateParams || applyingSourceFromUrl) return
  const current = nav.params.value?.[TEST_RESULTS_SOURCE_QUERY_PARAM]
  if (current == null || current === '') return
  applyingSourceFromUrl = true
  nav.updateParams({ [TEST_RESULTS_SOURCE_QUERY_PARAM]: undefined }, { push: false })
  nextTick(() => {
    applyingSourceFromUrl = false
  })
}

function syncActiveTabToNavParams(tab) {
  if (!nav?.updateParams || applyingTabFromUrl) return
  const next = tab === 'gates' ? 'gates' : tab === 'releases' ? 'releases' : undefined
  const current = nav.params.value?.[TEST_EXECUTION_TAB_PARAM]
  const patch = { [TEST_EXECUTION_TAB_PARAM]: next || undefined }
  if (tab === 'releases') {
    patch[TEST_RESULTS_SOURCE_QUERY_PARAM] = undefined
  } else if (tab === 'gates' && hasNightlyData.value && selectedNightlyStreamKey.value) {
    const canonical = testResultsSourceQueryValueForUrl(
      nightlyHealth.value,
      selectedNightlyStreamKey.value
    )
    if (canonical) {
      patch[TEST_RESULTS_SOURCE_QUERY_PARAM] = canonical
    }
  }
  const sourceCurrent = nav.params.value?.[TEST_RESULTS_SOURCE_QUERY_PARAM]
  const sourceClears = tab === 'releases' && sourceCurrent != null && sourceCurrent !== ''
  const tabMissing = Boolean(next) && (current == null || current === '')
  const sourcePatch = patch[TEST_RESULTS_SOURCE_QUERY_PARAM]
  const sourceChanges =
    sourcePatch !== undefined
    && sourcePatch !== sourceCurrent
    && !(sourcePatch == null && (sourceCurrent == null || sourceCurrent === ''))
  if (next === current && !sourceClears && !tabMissing && !sourceChanges) return
  nav.updateParams(patch, { push: false })
}

function isExecutionTabEnabled(tab) {
  if (tab === 'releases') return hasHeatmapData.value
  if (tab === 'gates') return hasNightlyData.value
  return false
}

function onExecutionTabKeydown(event) {
  const navigationKeys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (!navigationKeys.includes(event.key)) return
  const enabledTabs = EXECUTION_TAB_ORDER.filter(isExecutionTabEnabled)
  if (enabledTabs.length === 0) return
  event.preventDefault()
  let idx = enabledTabs.indexOf(activeTab.value)
  if (idx < 0) idx = 0
  if (event.key === 'Home') idx = 0
  else if (event.key === 'End') idx = enabledTabs.length - 1
  else if (event.key === 'ArrowRight') idx = (idx + 1) % enabledTabs.length
  else if (event.key === 'ArrowLeft') idx = (idx - 1 + enabledTabs.length) % enabledTabs.length
  const nextTab = enabledTabs[idx]
  setActiveTab(nextTab)
  nextTick(() => {
    document.getElementById(EXECUTION_TAB_DOM_IDS[nextTab])?.focus()
  })
}

function setActiveTab(tab) {
  if (tab === 'releases' && !hasHeatmapData.value) return
  if (tab === 'gates' && !hasNightlyData.value) return
  activeTab.value = tab
  nextTick(() => {
    syncActiveTabToNavParams(tab)
  })
}

watch(activeTab, (tab) => {
  syncActiveTabToNavParams(tab)
  if (tab === 'releases') {
    clearSourceFromNavParams()
  } else if (tab === 'gates') {
    initialSourceResolved.value = false
    applyTestResultsSourceFromNavParams()
  }
})

watch([hasNightlyData, hasHeatmapData], () => {
  const fromUrl = resolveTabFromParam(nav?.params?.value?.[TEST_EXECUTION_TAB_PARAM])
  if (fromUrl) {
    activeTab.value = fromUrl
    if (fromUrl === 'gates') {
      applyTestResultsSourceFromNavParams()
    }
    return
  }
  if (activeTab.value === 'releases' && !hasHeatmapData.value && hasNightlyData.value) {
    activeTab.value = 'gates'
  } else if (activeTab.value === 'gates' && !hasNightlyData.value && hasHeatmapData.value) {
    activeTab.value = 'releases'
  }
})

if (nav) {
  watch(
    () => nav.params.value?.[TEST_EXECUTION_TAB_PARAM],
    () => {
      applyingTabFromUrl = true
      applyActiveTabFromNavParams()
      nextTick(() => {
        applyingTabFromUrl = false
      })
    }
  )
}

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

  applyActiveTabFromNavParams()
  loadData()
})

watch(loading, (isLoading, wasLoading) => {
  if (wasLoading && !isLoading) {
    applyActiveTabFromNavParams()
    if (activeTab.value === 'gates') {
      applyTestResultsSourceFromNavParams()
    }
    syncActiveTabToNavParams(activeTab.value)
    canonicalizeGatesSourceInUrl()
  }
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
    msg += ' Promotion-gate status is on the Promotion Gate tab.'
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

.tab-panel-heading {
  margin-bottom: 16px;
}

.tab-panel-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--te-heading);
  margin: 0 0 8px;
  line-height: 1.2;
  font-family: inherit;
  letter-spacing: normal;
  text-transform: none;
  background: none;
  padding: 0;
  border-radius: 0;
}

.tab-panel-intro {
  font-size: 13px;
  font-weight: 400;
  color: var(--te-text-muted);
  line-height: 1.5;
  max-width: 900px;
  margin: 0 0 12px;
  padding: 0;
}

.tab-panel-intro code {
  font-size: 11px;
  font-weight: 600;
  color: var(--te-heading);
  background: var(--te-surface-raised);
  padding: 0 4px;
  border-radius: 3px;
}

.tab-section-subtitle {
  font-size: 16px;
  font-weight: 600;
  color: var(--te-heading);
  margin: 0;
  background: var(--te-section-title-bg);
  padding: 8px 16px;
  border-radius: 6px;
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

.help-box {
  background: var(--te-help-bg);
  border: 1px solid var(--te-help-border);
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 6px;
}

.tab-help-box {
  margin-top: 0;
  margin-bottom: 16px;
  max-width: none;
}

.help-box h4 {
  font-size: 13px;
  color: var(--te-accent);
  margin-bottom: 6px;
  font-weight: normal;
}

.help-box p,
.help-box li {
  font-size: 12px;
  color: var(--te-text-muted);
  line-height: 1.6;
  max-width: none;
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

.nightly-section--tab {
  margin-top: 16px;
}

.dashboard-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--te-border, #1e4976);
  margin-bottom: 20px;
}

.dashboard-tab {
  appearance: none;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--te-text-muted);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: -1px;
  padding: 10px 18px;
}

.dashboard-tab:hover:not(:disabled) {
  color: var(--te-heading);
}

.dashboard-tab--active {
  border-bottom-color: var(--te-accent, #5ea7ff);
  color: var(--te-heading);
}

.dashboard-tab:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.tab-panel {
  min-height: 120px;
}

.tab-empty {
  padding: 48px 24px;
}
</style>
