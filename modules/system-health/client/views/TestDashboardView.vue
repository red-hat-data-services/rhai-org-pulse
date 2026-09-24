<template>
  <div class="dashboard">
    <div class="container">
      <!-- Header -->
      <div class="header">
        <h1>Test Execution Statistics <span class="beta-tag">(Beta)</span></h1>
        <p>Aggregated view of RHOAI test execution across all components, quality gates, and releases. Data is ingested from Jenkins CI builds and indexed in OpenSearch.</p>
      </div>

      <!-- Filter Bar -->
      <FilterBar 
        :filters="filters"
        :versions="availableVersions"
        :releases="availableReleases"
        @filters-change="updateFilters"
      />

      <!-- Metrics Cards -->
      <MetricsCards 
        v-if="filteredComponents.length > 0"
        :components="filteredComponents"
        :filters="filters"
      />

      <!-- Loading / Error / Empty States -->
      <div v-if="loading" class="loading">Loading…</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else-if="!hasData" class="no-data">
        No test execution data has been uploaded yet. The external test-reports
        pipeline pushes data to this dashboard via the bulk API.
      </div>
      <div v-else-if="filteredComponents.length === 0" class="no-data">
        No data available for the selected filters.
      </div>
      <template v-else>
        <!-- Heatmap section -->
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
              <li><strong>Hover</strong> over a cell to see a dropdown with every individual Jenkins run, each showing version, release, pass %, and a link to Jenkins.</li>
            </ul>
          </div>

          <HeatmapTable :components="filteredComponents" @component-click="onComponentClick" />
        </div>

        <!-- Version trend chart -->
        <TrendChart :components="filteredComponents" />
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { useTestDashboard } from '../composables/useTestDashboard'
import FilterBar from '../components/FilterBar.vue'
import MetricsCards from '../components/MetricsCards.vue'
import HeatmapTable from '../components/HeatmapTable.vue'
import TrendChart from '../components/TrendChart.vue'

const { loadData, heatmap, loading, error, hasData } = useTestDashboard()

const nav = inject('moduleNav', null)

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
      Object.keys(day.by_vr || {}).forEach((vrKey) => {
        set.add(normalizeVersion(vrKey.split('|')[0]))
      })
    })
  })
  return Array.from(set).sort()
})

const availableReleases = computed(() => {
  const set = new Set()
  components.value.forEach((comp) => {
    Object.values(comp.days || {}).forEach((day) => {
      Object.keys(day.by_vr || {}).forEach((vrKey) => {
        const r = vrKey.split('|')[1]
        if (r) set.add(r)
      })
    })
  })
  return Array.from(set).sort()
})

const filteredComponents = computed(() => {
  if (!components.value || components.value.length === 0) return []

  const f = filters.value
  const from = f.fromDate
  const to = f.toDate
  const useDate = f.useDateRange !== false

  return components.value
    .map(comp => {
      const filteredDays = {}
      
      Object.entries(comp.days || {}).forEach(([date, day]) => {
        // Apply date range filter
        if (useDate && (date < from || date > to)) return
        
        // Apply version/release filters
        if ((f.version !== 'All' || f.release !== 'All') && day.by_vr) {
          let totalP = 0, totalF = 0, totalS = 0, totalT = 0, urls = []
          
          Object.entries(day.by_vr).forEach(([vrKey, vr]) => {
            if (vrKeyMatches(vrKey, f.version, f.release)) {
              totalP += vr.passed || 0
              totalF += vr.failed || 0
              totalS += vr.skipped || 0
              totalT += vr.total || 0
              urls = urls.concat(vr.jenkins_urls || [])
            }
          })
          
          // Only include matching by_vr entries
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
          // No version/release filtering
          filteredDays[date] = day
        }
      })

      // Recalculate overall
      let overallP = 0, overallF = 0, overallS = 0, overallT = 0
      Object.values(filteredDays).forEach(day => {
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
    .filter(comp => comp.overall.total > 0)
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
    // Fallback when the app shell isn't present (e.g. isolated render).
    window.location.hash = `#/system-health/test-execution-detail?component=${encodeURIComponent(componentName)}`
  }
}
</script>

<style scoped>
.dashboard {
  background: #0a1929;
  color: #e0e0e0;
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

.header h1 {
  font-size: 26px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 4px;
}

.beta-tag {
  font-size: 14px;
  color: #ffa502;
  font-weight: 500;
  vertical-align: middle;
}

.header p {
  font-size: 13px;
  color: #8899aa;
  line-height: 1.5;
  max-width: 900px;
}

.section-title {
  margin-bottom: 6px;
}

.section-title h2 {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 2px;
  background: linear-gradient(90deg, #132f4c 0%, transparent 100%);
  padding: 10px 16px;
  border-radius: 6px;
}

.section-title p {
  font-size: 12px;
  color: #8899aa;
  padding-left: 16px;
}

.help-box {
  background: rgba(94, 167, 255, 0.06);
  border: 1px solid rgba(94, 167, 255, 0.15);
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 6px;
}

.help-box h4 {
  font-size: 13px;
  color: #5ea7ff;
  margin-bottom: 6px;
  font-weight: 600;
}

.help-box p,
.help-box li {
  font-size: 12px;
  color: #8899aa;
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
  color: #6b8299;
}

.error {
  color: #ff4757;
}

.no-data {
  color: #8899aa;
}

.section {
  margin-top: 28px;
}
</style>
