<template>
  <div class="dashboard test-execution-theme">
    <div class="container">
      <!-- Loading / Error -->
      <div v-if="loading" class="loading">Loading…</div>
      <div v-else-if="error" class="error">{{ error }}</div>

      <template v-else>
        <div v-if="!hasAnyNightlyData" class="no-data">
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
              :disabled="!hasReleasesTabData"
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
            <div v-if="!rhoaiDeploymentHealth" class="no-data tab-empty">
              No nightly build results have been uploaded yet.
            </div>
            <template v-else>
              <div class="tab-panel-heading">
                <h2 class="tab-panel-title">{{ NIGHTLY_BUILD_STABILITY_TITLE }}</h2>
                <p class="tab-panel-intro">
                  Results of the RHOAI nightly builds, starting with the BVT gate (deployment, cluster and RHOAI
                  health checks) that runs before the other quality gates.
                  Click a date to open every build recorded that day.
                </p>
              </div>

              <FilterBar
                :filters="filters"
                :versions="availableVersions"
                :releases="availableReleases"
                :products="NIGHTLY_PRODUCTS"
                :allow-all="false"
                :show-date-toggle="false"
                :max-date="todayIso"
                @filters-change="updateFilters"
              />

              <div class="section rhoai-deployment-section">
                <NightlyHealthLegend :title="NIGHTLY_BUILD_STABILITY_TITLE" />
                <NightlyHealthTable
                  :payload="rhoaiDeploymentHealth"
                  :heatmap-components="heatmap"
                  :tab-panel-active="activeTab === 'releases'"
                  :version-filter="nightlyVersionFilter"
                  :date-window="nightlyDateWindow"
                  :cells-open-day-panel="false"
                  :window-max-date="todayIso"
                  @step-window="stepNightlyWindow"
                  @component-click="onComponentClick"
                />
              </div>
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
              <NightlyHealthLegend :title="gatesPanelTitle" />
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
import NightlyHealthTable from '../components/NightlyHealthTable.vue'
import NightlyHealthLegend from '../components/NightlyHealthLegend.vue'
import { cleanVer, compareVersionRelease, isZStream } from '../utils/versionFilter.js'
import {
  collectNightlyVersionReleases,
  filterNightlyHealthByStream,
  shiftDateWindow,
  formatTimestamp,
  jenkinsJobBasename,
  REPORTING_STREAM_KEYS,
  RHOAI_NIGHTLY_BVT_STREAM_KEY,
  TEST_RESULTS_SOURCE_QUERY_PARAM,
  nightlyTestResultsPanelTitle,
  streamKeyFromTestResultsSourceQuery,
  testResultsSourceQueryValueForUrl
} from '../composables/useNightlyHealthMatrix'
import '../styles/test-execution-theme.css'

const {
  loadData,
  heatmap,
  nightlyHealth: allNightlyHealth,
  loading,
  error,
  hasNightlyData: hasAnyNightlyData
} = useTestDashboard()

/** Header of the nightly BVT matrix on the RHOAI Releases tab (RHAI-59088). */
const NIGHTLY_BUILD_STABILITY_TITLE = 'Nightly Build Stability'

/** Products with nightly results; RHAII joins later. */
const NIGHTLY_PRODUCTS = ['RHOAI']

/** Default From/To window, in days, ending today (RHAI-59096). */
const NIGHTLY_WINDOW_DAYS = 5

/** Nightly BVT stream: "Nightly Build Stability" matrix on the RHOAI Releases tab. */
const rhoaiDeploymentHealth = computed(() =>
  filterNightlyHealthByStream(allNightlyHealth.value, { include: [RHOAI_NIGHTLY_BVT_STREAM_KEY] })
)

/** Promotion Gate tab: every other stream (the nightly BVT is not a Test Results Source there). */
const nightlyHealth = computed(() =>
  filterNightlyHealthByStream(allNightlyHealth.value, { exclude: [RHOAI_NIGHTLY_BVT_STREAM_KEY] })
)
const hasNightlyData = computed(() => Boolean(nightlyHealth.value))

/** RHOAI Releases tab: the Nightly Build Stability matrix (nightly BVT stream). */
const hasReleasesTabData = computed(() => Boolean(rhoaiDeploymentHealth.value))

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

/**
 * Tab requested by the URL. The nightly BVT is not a Promotion Gate source: `tab=gates&source=rhoai-nightly-bvt`
 * opens RHOAI Releases, where its results are shown.
 */
function requestedTabParam() {
  const tab = nav?.params?.value?.[TEST_EXECUTION_TAB_PARAM]
  const source = String(nav?.params?.value?.[TEST_RESULTS_SOURCE_QUERY_PARAM] ?? '').trim().toLowerCase()
  if (parseTabQueryValue(tab) === 'gates' && jenkinsJobBasename(source) === RHOAI_NIGHTLY_BVT_STREAM_KEY) {
    return 'releases'
  }
  return tab
}

function parseTabQueryValue(raw) {
  const tab = String(raw ?? '').trim().toLowerCase()
  if (tab === 'releases' || tab === 'nightly') return 'releases'
  if (tab === 'gates') return 'gates'
  return null
}

function resolveTabFromParam(raw) {
  const tab = parseTabQueryValue(raw)
  if (tab === 'releases' && hasReleasesTabData.value) return 'releases'
  if (tab === 'gates' && hasNightlyData.value) return 'gates'
  return null
}

function defaultTabForData() {
  if (hasReleasesTabData.value) return 'releases'
  if (hasNightlyData.value) return 'gates'
  return 'releases'
}

function applyActiveTabFromNavParams() {
  const wanted = parseTabQueryValue(requestedTabParam())
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
    if (hasReleasesTabData.value) {
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
  if (tab === 'releases') return hasReleasesTabData.value
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
  if (tab === 'releases' && !hasReleasesTabData.value) return
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

watch([hasNightlyData, hasReleasesTabData], () => {
  const fromUrl = resolveTabFromParam(requestedTabParam())
  if (fromUrl) {
    activeTab.value = fromUrl
    if (fromUrl === 'gates') {
      applyTestResultsSourceFromNavParams()
    }
    return
  }
  if (activeTab.value === 'releases' && !hasReleasesTabData.value && hasNightlyData.value) {
    activeTab.value = 'gates'
  } else if (activeTab.value === 'gates' && !hasNightlyData.value && hasReleasesTabData.value) {
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

/** Today's UTC date (nightly columns are UTC days). */
const todayIso = new Date().toISOString().slice(0, 10)

/** YYYY-MM-DD `days` before `iso`. */
function isoDaysBefore(iso, days) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10)
}

const filters = ref({
  product: NIGHTLY_PRODUCTS[0],
  version: null,
  release: null,
  useDateRange: true,
  fromDate: isoDaysBefore(todayIso, NIGHTLY_WINDOW_DAYS - 1),
  toDate: todayIso
})

onMounted(() => {
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

/** Version/release pairs with nightly BVT runs, newest first (3.7-EA1 before 3.6 GA). */
const nightlyVersionReleases = computed(() => collectNightlyVersionReleases(rhoaiDeploymentHealth.value))

const availableVersions = computed(() => [...new Set(nightlyVersionReleases.value.map((vr) => vr.version))])

/** Releases with runs for the selected version, oldest first (EA1, EA2, GA). */
const availableReleases = computed(() => nightlyVersionReleases.value
  .filter((vr) => vr.version === filters.value.version)
  .sort(compareVersionRelease)
  .map((vr) => vr.release))

/** Newest release with runs for a version (GA for z-streams). */
function newestReleaseFor(version) {
  if (isZStream(version)) return 'GA'
  return nightlyVersionReleases.value.find((vr) => vr.version === version)?.release ?? null
}

// No "All" (RHAI-59092): default to the newest version/release, and keep the selection valid when data changes.
watch(
  nightlyVersionReleases,
  (pairs) => {
    const { version, release } = filters.value
    if (pairs.some((vr) => vr.version === version && vr.release === release)) return
    const newest = pairs[0]
    filters.value = { ...filters.value, version: newest?.version ?? null, release: newest?.release ?? null }
  },
  { immediate: true }
)

const nightlyVersionFilter = computed(() => (filters.value.version
  ? { version: filters.value.version, release: filters.value.release }
  : null))

/** From/To window for the matrix columns; a reversed window is read in order. */
const nightlyDateWindow = computed(() => {
  const { fromDate, toDate } = filters.value
  if (!fromDate || !toDate) return null
  return fromDate <= toDate ? { from: fromDate, to: toDate } : { from: toDate, to: fromDate }
})

/** Newer / Older above the matrix: move the From/To window by its length (RHAI-59096). */
function stepNightlyWindow(direction) {
  if (!nightlyDateWindow.value) return
  const { from, to } = shiftDateWindow(nightlyDateWindow.value, direction, todayIso)
  filters.value = { ...filters.value, fromDate: from, toDate: to }
}

function updateFilters(newFilters) {
  const version = newFilters?.version ? cleanVer(newFilters.version) : filters.value.version
  const releaseHasRuns = nightlyVersionReleases.value
    .some((vr) => vr.version === version && vr.release === newFilters?.release)
  let release = releaseHasRuns ? newFilters.release : newestReleaseFor(version)
  if (isZStream(version)) release = 'GA'
  filters.value = { ...filters.value, ...newFilters, version, release, useDateRange: true }
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
