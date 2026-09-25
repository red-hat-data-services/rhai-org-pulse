<template>
  <div class="detail">
    <div class="container">
      <a class="back-link" href="#" @click.prevent="goBack">← Back to heatmap</a>

      <div v-if="loading" class="loading">Loading…</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else-if="!detail && !heatmapEntry" class="error">
        No data available for component "{{ componentName }}".
      </div>

      <template v-else>
        <div class="header-row">
          <div class="header-left">
            <h1>{{ componentName }}</h1>
            <p>Deep-dive into quality gates, execution trends, and Jira failure classification for this component.</p>
          </div>

          <!-- Filter bar -->
          <div class="filter-bar">
            <div class="filter-group">
              <span class="filter-label">Environment</span>
              <span class="filter-value">RHOAI</span>
            </div>
            <div class="filter-group">
              <span class="filter-label">Version</span>
              <select v-model="filters.version">
                <option value="All">All</option>
                <option v-for="v in availableVersions" :key="v" :value="v">{{ v }}</option>
              </select>
            </div>
            <div class="filter-group">
              <span class="filter-label">Release</span>
              <select v-model="filters.release">
                <option value="All">All</option>
                <option v-for="r in availableReleases" :key="r" :value="r">{{ r }}</option>
              </select>
            </div>
            <div class="filter-group date-toggle">
              <span class="filter-label">Date Range</span>
              <label class="toggle">
                <input v-model="filters.useDateRange" type="checkbox">
                <span>Enable</span>
              </label>
            </div>
            <div class="filter-group" :class="{ disabled: !filters.useDateRange }">
              <span class="filter-label">From</span>
              <input v-model="filters.fromDate" type="date" :disabled="!filters.useDateRange">
            </div>
            <div class="filter-group" :class="{ disabled: !filters.useDateRange }">
              <span class="filter-label">To</span>
              <input v-model="filters.toDate" type="date" :disabled="!filters.useDateRange">
            </div>
          </div>
        </div>

        <div class="showing">
          Showing: {{ filterLabel }}
          <span v-if="filters.useDateRange"> · {{ friendlyDate(filters.fromDate) }} – {{ friendlyDate(filters.toDate) }}</span>
          <span v-else> · All dates</span>
        </div>

        <!-- Metric cards -->
        <div class="metrics">
          <div class="mc mc-results">
            <span class="mc-label">Total Tests</span>
            <span class="mc-value">{{ overall.total.toLocaleString() }}</span>
            <span class="mc-sub">Sum of all test cases</span>
          </div>
          <div class="mc mc-passed">
            <span class="mc-label">Passed</span>
            <span class="mc-value">{{ overall.passed.toLocaleString() }}</span>
            <span class="mc-sub">Completed successfully</span>
          </div>
          <div class="mc mc-failed">
            <span class="mc-label">Failed</span>
            <span class="mc-value">{{ overall.failed.toLocaleString() }}</span>
            <span class="mc-sub">Assertion / runtime errors</span>
          </div>
          <div class="mc mc-skipped">
            <span class="mc-label">Skipped</span>
            <span class="mc-value">{{ overall.skipped.toLocaleString() }}</span>
            <span class="mc-sub">Not executed (scope / deps)</span>
          </div>
          <div class="mc mc-pct">
            <span class="mc-label">Pass Rate</span>
            <span class="mc-value">{{ passPct(overall.passed, overall.total) }}%</span>
            <span class="mc-sub">Passed ÷ Total × 100</span>
          </div>
        </div>

        <!-- Quality Success Analysis -->
        <div class="qsr-container" :class="{ empty: !hasTfa }">
          <div class="qsr-header">
            <div>
              <div class="qsr-title">Quality Success Analysis</div>
              <div class="qsr-subtitle">Release readiness metrics: Execution Signal → Post-Triage Quality Signal</div>
            </div>
            <div v-if="hasTfa" class="qsr-meta">
              <div>Based on {{ tfa.total_failed.toLocaleString() }} Jira issues</div>
              <div>{{ tfa.classified.toLocaleString() }} classified · {{ tfa.unclassified.toLocaleString() }} pending triage</div>
              <a v-if="jql.openFailed" :href="jql.openFailed" target="_blank" class="open-failed-btn">🔍 Open Failed Jiras ↗</a>
            </div>
          </div>

          <div v-if="!hasTfa" class="qsr-empty">
            <p>No TFA (Test Failure Analysis) data available for this component{{ filters.version === 'All' && filters.release === 'All' ? '' : ' and the selected version/release' }}.</p>
            <p class="qsr-empty-sub">
              Once failures are classified in Jira with TFA labels, this section shows
              Raw Execution Success → Final Quality Success with the full classification breakdown.
            </p>
          </div>

          <template v-else>
            <!-- TFA header: triage progress bar + headline tiles -->
            <div class="tfa-hdr">
              <div class="tfa-hdr-title">Test Failure Analysis (TFA) — {{ filterLabel }}</div>
              <div class="tfa-progress">
                <div class="tfa-progress-fill" :class="{ 'fully-triaged': tfa.unclassified === 0 }" :style="{ width: qsr.triagePct + '%' }"></div>
                <span class="tfa-progress-label">{{ qsr.triagePct }}% Triaged</span>
                <span class="tfa-progress-count" :class="{ 'c-quality': tfa.unclassified === 0 }">{{ tfa.classified }} / {{ tfa.total_failed }}</span>
              </div>
              <div class="tfa-tiles">
                <component :is="jql.all ? 'a' : 'div'" :href="jql.all || undefined" :target="jql.all ? '_blank' : undefined" class="tfa-tile">
                  <div class="tfa-tile-label">Total Failed</div>
                  <div class="tfa-tile-value c-failed">{{ tfa.total_failed }} <span v-if="jql.all" class="tfa-tile-arrow">↗</span></div>
                </component>
                <component :is="jql.openFailed ? 'a' : 'div'" :href="jql.openFailed || undefined" :target="jql.openFailed ? '_blank' : undefined" class="tfa-tile">
                  <div class="tfa-tile-label">Open Failed</div>
                  <div class="tfa-tile-value c-failed">{{ openFailedCount }} <span v-if="jql.openFailed" class="tfa-tile-arrow">↗</span></div>
                </component>
                <component :is="jql.classified ? 'a' : 'div'" :href="jql.classified || undefined" :target="jql.classified ? '_blank' : undefined" class="tfa-tile">
                  <div class="tfa-tile-label">Classified</div>
                  <div class="tfa-tile-value c-quality">{{ tfa.classified }} <span v-if="jql.classified" class="tfa-tile-arrow">↗</span></div>
                </component>
                <component :is="jql.unclassified ? 'a' : 'div'" :href="jql.unclassified || undefined" :target="jql.unclassified ? '_blank' : undefined" class="tfa-tile">
                  <div class="tfa-tile-label">Unclassified</div>
                  <div class="tfa-tile-value c-warn2">{{ tfa.unclassified }} <span v-if="jql.unclassified" class="tfa-tile-arrow">↗</span></div>
                </component>
                <div class="tfa-tile">
                  <div class="tfa-tile-label">Triage Rate</div>
                  <div class="tfa-tile-value c-triage">{{ qsr.triagePct }}%</div>
                </div>
              </div>
            </div>

            <!-- Three headline metrics -->
            <div class="qsr-metrics">
              <div class="qsr-card exec">
                <div class="qsr-card-label">Execution Signal</div>
                <div class="qsr-card-value">{{ qsr.rawPassRate }}%</div>
                <div class="qsr-card-desc">What Jenkins reported before triage</div>
                <div class="qsr-card-formula">
                  <div class="formula-note">Passed ÷ (Passed + Failed)</div>
                  <div>{{ overall.passed.toLocaleString() }} ÷ ({{ overall.passed.toLocaleString() }} + {{ overall.failed.toLocaleString() }}) = <strong class="c-exec">{{ qsr.rawPassRate }}%</strong></div>
                </div>
              </div>

              <div class="qsr-arrow"><span>→</span><span class="qsr-arrow-label">Triage</span></div>

              <div class="qsr-card quality" :class="{ incomplete: !qsr.triageComplete }">
                <div class="qsr-card-label">
                  Post-Triage Quality
                  <span v-if="!qsr.triageComplete" class="badge-warn">⚠ INCOMPLETE</span>
                </div>
                <template v-if="qsr.triageComplete">
                  <div class="qsr-card-value">{{ qsr.bestCaseQuality }}%</div>
                  <div class="qsr-card-desc">True product health after RCA</div>
                  <div class="qsr-card-formula">
                    <div class="formula-note">Passed ÷ (Passed + Product Bugs)</div>
                    <div>{{ overall.passed.toLocaleString() }} ÷ ({{ overall.passed.toLocaleString() }} + {{ qsr.productBugs }}) = <strong class="c-quality">{{ qsr.bestCaseQuality }}%</strong></div>
                  </div>
                </template>
                <template v-else>
                  <div class="qsr-card-value range">{{ qsr.worstCaseQuality }}% – {{ qsr.bestCaseQuality }}%</div>
                  <div class="qsr-card-desc c-warn">True product health (range due to {{ tfa.unclassified }} unclassified)</div>
                  <div class="qsr-card-formula">
                    <div class="formula-note">Passed ÷ (Passed + Product Bugs + Unclassified?)</div>
                    <div><span class="c-failed">Worst:</span> {{ qsr.worstCaseQuality }}% · <span class="c-quality">Best:</span> {{ qsr.bestCaseQuality }}%</div>
                  </div>
                </template>
              </div>

              <div class="qsr-arrow"><span>→</span><span class="qsr-arrow-label">Coverage</span></div>

              <div class="qsr-card coverage">
                <div class="qsr-card-label">Validated Coverage</div>
                <div class="qsr-card-value">{{ qsr.validatedCoverage }}%</div>
                <div class="qsr-card-desc">Tests with conclusive outcome</div>
                <div class="qsr-card-formula">
                  <div class="formula-note">(Passed + Classified) ÷ Total</div>
                  <div>({{ overall.passed.toLocaleString() }} + {{ tfa.classified }}) ÷ {{ overall.total.toLocaleString() }} = <strong class="c-coverage">{{ qsr.validatedCoverage }}%</strong></div>
                </div>
              </div>
            </div>

            <!-- Classification bridge -->
            <div class="qsr-bridge">
              <div class="qsr-bridge-title">📊 Classification Bridge</div>
              <div class="qsr-bridge-total">
                <a v-if="jql.all" :href="jql.all" target="_blank">{{ tfa.total_failed.toLocaleString() }} reported failures ↗</a>
                <span v-else>{{ tfa.total_failed.toLocaleString() }} reported failures</span>
              </div>
              <div class="qsr-tree">
                <div class="qsr-tree-item">
                  <span class="qsr-tree-dot" style="background:#ff4757"></span>
                  <span class="qsr-tree-label"><strong>Product Failures</strong> — Real product defects found by tests</span>
                  <a v-if="jql.productBug" :href="jql.productBug" target="_blank" class="qsr-tree-count" style="color:#ff4757">{{ qsr.productBugs }}</a>
                  <span v-else class="qsr-tree-count" style="color:#ff4757">{{ qsr.productBugs }}</span>
                  <span class="qsr-tree-pct">{{ pctOf(qsr.productBugs) }}%</span>
                </div>
                <div class="qsr-tree-item">
                  <span class="qsr-tree-dot" style="background:#3498db"></span>
                  <span class="qsr-tree-label"><strong>Infrastructure / Environment</strong> — CI instability, env setup issues</span>
                  <a v-if="jql.infraEnv" :href="jql.infraEnv" target="_blank" class="qsr-tree-count" style="color:#3498db">{{ qsr.infraEnvTotal }}</a>
                  <span v-else class="qsr-tree-count" style="color:#3498db">{{ qsr.infraEnvTotal }}</span>
                  <span class="qsr-tree-pct">{{ pctOf(qsr.infraEnvTotal) }}%</span>
                </div>
                <div class="qsr-tree-item">
                  <span class="qsr-tree-dot" style="background:#ffa502"></span>
                  <span class="qsr-tree-label"><strong>Test Automation Defects</strong> — Flaky tests, test code bugs, false positives</span>
                  <a v-if="jql.testDefects" :href="jql.testDefects" target="_blank" class="qsr-tree-count" style="color:#ffa502">{{ qsr.testDefects }}</a>
                  <span v-else class="qsr-tree-count" style="color:#ffa502">{{ qsr.testDefects }}</span>
                  <span class="qsr-tree-pct">{{ pctOf(qsr.testDefects) }}%</span>
                </div>
                <div class="qsr-tree-item">
                  <span class="qsr-tree-dot" style="background:#fdcb6e"></span>
                  <span class="qsr-tree-label"><strong>Known Issues</strong> — Matches already tracked and accepted issues</span>
                  <a v-if="jql.knownIssues" :href="jql.knownIssues" target="_blank" class="qsr-tree-count" style="color:#fdcb6e">{{ qsr.knownIssues }}</a>
                  <span v-else class="qsr-tree-count" style="color:#fdcb6e">{{ qsr.knownIssues }}</span>
                  <span class="qsr-tree-pct">{{ pctOf(qsr.knownIssues) }}%</span>
                </div>
                <div v-if="tfa.unclassified > 0" class="qsr-tree-item pending">
                  <span class="qsr-tree-dot dashed"></span>
                  <span class="qsr-tree-label"><strong class="c-warn2">⚠ Pending Triage</strong> — Not yet classified</span>
                  <a v-if="jql.unclassified" :href="jql.unclassified" target="_blank" class="qsr-tree-count" style="color:#ff6b7a">{{ tfa.unclassified }}</a>
                  <span v-else class="qsr-tree-count" style="color:#ff6b7a">{{ tfa.unclassified }}</span>
                  <span class="qsr-tree-pct">{{ pctOf(tfa.unclassified) }}%</span>
                </div>
              </div>

            </div>

            <!-- Leadership summary -->
            <div class="qsr-summary">
              <div class="qsr-summary-item">
                <div class="qsr-summary-label">Before Triage</div>
                <div class="qsr-summary-value c-exec">"{{ qsr.rawPassRate }}% of executed tests passed"</div>
              </div>
              <div class="qsr-summary-item">
                <div class="qsr-summary-label">After Triage {{ qsr.triageComplete ? '' : '(Incomplete)' }}</div>
                <div v-if="qsr.triageComplete" class="qsr-summary-value c-quality">"{{ qsr.bestCaseQuality }}% of conclusive product validations passed"</div>
                <div v-else class="qsr-summary-value c-warn small">"Between {{ qsr.worstCaseQuality }}% and {{ qsr.bestCaseQuality }}% quality" — {{ tfa.unclassified }} failures need triage</div>
              </div>
              <div class="qsr-summary-item">
                <div class="qsr-summary-label">Classification Summary</div>
                <div class="qsr-summary-value small muted">
                  {{ tfa.classified }} classified ({{ qsr.triagePct }}% triage rate) ·
                  <strong class="c-failed">{{ qsr.productBugs }} confirmed product bugs</strong>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- TFA charts: failure classification + Jira status -->
        <div v-if="hasTfa" class="two-col">
          <div class="panel">
            <h3>Failure Classification</h3>
            <p class="panel-sub">Distribution of TFA labels. Click a slice or legend row to open the matching Jira query.</p>
            <div v-if="hasClassification" class="chart-container">
              <Doughnut :data="classificationChart" :options="classificationChartOptions" />
            </div>
            <div v-else class="chart-empty">
              <div class="chart-empty-icon">📊</div>
              <div class="chart-empty-title">No Classification Data</div>
              <div class="chart-empty-sub">All {{ tfa.total_failed }} failures are pending triage.</div>
            </div>
            <div v-if="hasClassification" class="tfa-legend">
              <component
                :is="row.url ? 'a' : 'div'"
                v-for="row in classificationLegend"
                :key="row.key"
                :href="row.url || undefined"
                :target="row.url ? '_blank' : undefined"
                class="tfa-legend-item"
              >
                <span class="dot" :style="{ background: row.color }"></span>
                <strong>{{ row.name }}</strong> ({{ row.count }}) — {{ row.desc }}
                <span v-if="row.url" class="legend-arrow">↗</span>
              </component>
            </div>
          </div>

          <div class="panel">
            <h3>Jira Status Distribution</h3>
            <p class="panel-sub">Workflow status of test-failed issues. Click a bar or a status below to open the matching Jira query.</p>
            <div v-if="hasStatus" class="chart-container">
              <Bar :data="statusChart" :options="statusChartOptions" />
            </div>
            <div v-else class="chart-empty">
              <div class="chart-empty-icon">📈</div>
              <div class="chart-empty-title">No Status Data</div>
              <div class="chart-empty-sub">Jira status was not captured for these issues.</div>
            </div>
            <div v-if="hasStatus" class="tfa-legend">
              <component
                :is="row.url ? 'a' : 'div'"
                v-for="row in statusLinks"
                :key="row.status"
                :href="row.url || undefined"
                :target="row.url ? '_blank' : undefined"
                class="tfa-legend-item"
              >
                <span class="dot" :style="{ background: row.color }"></span>
                <strong>{{ row.status }}</strong> ({{ row.count }})
                <span v-if="row.url" class="legend-arrow">↗</span>
              </component>
            </div>
          </div>
        </div>

        <!-- Quality gates heatmap -->
        <div v-if="gateRows.length" class="panel">
          <h3>Quality Gates Heatmap</h3>
          <p class="panel-sub">Per-gate, per-day pass rate for {{ componentName }}. Color-coded like the main heatmap.</p>
          <div class="gate-heatmap-wrap">
            <table class="gate-hm">
              <thead>
                <tr>
                  <th>Gate</th>
                  <th v-for="d in gateDates" :key="d">{{ friendlyDate(d) }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in gateRows" :key="row.gate">
                  <td>
                    {{ row.gate }}
                    <div class="gate-sub">{{ passPct(row.passed, row.total) }}% · {{ row.total.toLocaleString() }} tests</div>
                  </td>
                  <td v-for="d in gateDates" :key="`${row.gate}-${d}`">
                    <span v-if="!row.days[d] || !row.days[d].total" class="gc-na">–</span>
                    <span
                      v-else
                      class="gate-cell"
                      :class="`gc-${pctColor(passPct(row.days[d].passed, row.days[d].total))}`"
                      @mouseenter="activeGateCell = `${row.gate}-${d}`"
                      @mouseleave="activeGateCell = null"
                    >
                      <span class="gc-pct" :class="`gc-pct-${pctColor(passPct(row.days[d].passed, row.days[d].total))}`">
                        {{ passPct(row.days[d].passed, row.days[d].total) }}%
                      </span>
                      <span class="gc-runs">{{ row.days[d].passed }}P {{ row.days[d].failed }}F</span>

                      <!-- Hover dropdown: per-run Jenkins test-result links for this gate/day -->
                      <span v-if="activeGateCell === `${row.gate}-${d}` && (row.days[d].executions || []).length" class="gc-dd">
                        <span class="gc-dd-title">{{ row.gate }} · {{ friendlyDate(d) }} · {{ row.days[d].executions.length }} run(s)</span>
                        <span v-for="(ex, i) in row.days[d].executions" :key="i" class="gc-dd-run">
                          <a v-if="ex.jenkins_url" :href="testReportUrl(ex.jenkins_url)" target="_blank" class="gc-dd-link">{{ jenkinsLabel(ex.jenkins_url) }} · test report ↗</a>
                          <span v-else class="gc-dd-link">Run {{ i + 1 }}</span>
                          <span class="gc-dd-nums">
                            <span class="cp">{{ ex.passed || 0 }}P</span>
                            <span class="cf">{{ ex.failed || 0 }}F</span>
                            <span class="cs">{{ ex.skipped || 0 }}S</span>
                          </span>
                        </span>
                      </span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Version trend -->
        <TrendChart v-if="heatmapEntry" :components="[heatmapEntry]" />
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, watch } from 'vue'
import { Doughnut, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { fetchComponentDetail } from '../composables/useTestDashboard'
import TrendChart from '../components/TrendChart.vue'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

const JIRA_BASE = 'https://issues.redhat.com/issues/?jql='
// Test-failed/-skipped issues span both Jira projects (RHOAIENG + RHAI).
const PROJECT_CLAUSE = 'project IN (RHOAIENG, RHAI)'

// TFA label → display name, color, description (mirrors reference component.html)
const TFA_NAMES = {
  'tfa-product-bug': 'Product Bug',
  'tfa-automation-bug': 'Automation Bug',
  'tfa-infra-issue': 'Infra Issue',
  'tfa-env-setup': 'Env Setup',
  'tfa-duplicate': 'Duplicate',
  'tfa-known-issue': 'Known Issue',
  'tfa-false-positive': 'False Positive',
  'tfa-wrong-assignment': 'Wrong Assignment'
}
const TFA_COLORS = {
  'tfa-product-bug': '#ff4757',
  'tfa-automation-bug': '#ffa502',
  'tfa-infra-issue': '#3498db',
  'tfa-env-setup': '#a29bfe',
  'tfa-duplicate': '#6b8299',
  'tfa-known-issue': '#fdcb6e',
  'tfa-false-positive': '#2ed573',
  'tfa-wrong-assignment': '#e17055'
}
const TFA_DESC = {
  'tfa-product-bug': 'Real product issue found by the test',
  'tfa-automation-bug': 'Test code issue or flaky automation',
  'tfa-infra-issue': 'Infrastructure instability or defect',
  'tfa-env-setup': 'Environment setup issue (e.g., missing dependency)',
  'tfa-duplicate': 'Same root cause as another tracked issue',
  'tfa-known-issue': 'Failure matches an already known and tracked issue',
  'tfa-false-positive': 'Passed on re-run, non-reproducible',
  'tfa-wrong-assignment': 'Failure initially routed to wrong component'
}
const STATUS_COLORS = {
  'Open': '#ff4757', 'New': '#ff4757', 'Reopened': '#ff4757', 'To Do': '#ff4757',
  'Backlog': '#6b8299', 'Deferred': '#6b8299',
  'In Progress': '#ffa502', 'In Development': '#ffa502',
  'Review': '#3498db', 'In Review': '#3498db', 'Testing': '#3498db',
  'Resolved': '#2ed573', 'Closed': '#2ed573', 'Done': '#2ed573'
}

const nav = inject('moduleNav', null)

const loading = ref(false)
const error = ref(null)
const detail = ref(null)
const activeGateCell = ref(null)
const heatmapEntry = ref(null)
const jiraConfig = ref(null)

const filters = ref({
  version: 'All',
  release: 'All',
  useDateRange: false,
  fromDate: null,
  toDate: null
})

const componentName = computed(() => {
  if (nav && nav.params && nav.params.value) return nav.params.value.component || ''
  const params = new URLSearchParams((window.location.hash.split('?')[1]) || '')
  return params.get('component') || ''
})

watch(componentName, async (name) => {
  if (!name) return
  loading.value = true
  error.value = null
  detail.value = null
  heatmapEntry.value = null
  jiraConfig.value = null
  try {
    const res = await fetchComponentDetail(name)
    detail.value = res.detail
    heatmapEntry.value = res.heatmapEntry
    jiraConfig.value = res.jiraConfig
    // Default the date window to the data's span (last 30 days of activity).
    initDates()
  } catch (err) {
    error.value = err.message || 'Failed to load component detail'
  } finally {
    loading.value = false
  }
}, { immediate: true })

function initDates() {
  const today = new Date()
  const from = new Date(today)
  from.setDate(today.getDate() - 30)
  filters.value.fromDate = formatDate(from)
  filters.value.toDate = formatDate(today)
}

// ── Version / release options discovered from this component's heatmap by_vr ──
const availableVersions = computed(() => {
  const set = new Set()
  if (heatmapEntry.value) {
    Object.values(heatmapEntry.value.days || {}).forEach((day) => {
      Object.keys(day.by_vr || {}).forEach((k) => set.add(normalizeVersion(k.split('|')[0])))
    })
  }
  return Array.from(set).sort()
})

const availableReleases = computed(() => {
  const set = new Set()
  if (heatmapEntry.value) {
    Object.values(heatmapEntry.value.days || {}).forEach((day) => {
      Object.keys(day.by_vr || {}).forEach((k) => {
        const r = k.split('|')[1]
        if (r) set.add(r)
      })
    })
  }
  return Array.from(set).sort()
})

const filterLabel = computed(() => {
  const parts = []
  if (filters.value.version !== 'All') parts.push(filters.value.version)
  if (filters.value.release !== 'All') parts.push(filters.value.release)
  return parts.join(' ') || 'All releases'
})

function vrMatches(vrKey) {
  const [v, r] = vrKey.split('|')
  if (filters.value.version !== 'All' && normalizeVersion(v) !== normalizeVersion(filters.value.version)) return false
  if (filters.value.release !== 'All' && r !== filters.value.release) return false
  return true
}

function dateInRange(date) {
  if (!filters.value.useDateRange) return true
  return date >= filters.value.fromDate && date <= filters.value.toDate
}

// ── Overall totals, filtered by version/release (via heatmap by_vr) + date ──
const overall = computed(() => {
  // Prefer heatmap by_vr so version/release filtering is accurate.
  if (heatmapEntry.value) {
    let passed = 0, failed = 0, skipped = 0, total = 0
    Object.entries(heatmapEntry.value.days || {}).forEach(([date, day]) => {
      if (!dateInRange(date)) return
      if (filters.value.version === 'All' && filters.value.release === 'All') {
        passed += day.passed || 0; failed += day.failed || 0; skipped += day.skipped || 0; total += day.total || 0
      } else if (day.by_vr) {
        Object.entries(day.by_vr).forEach(([k, vr]) => {
          if (vrMatches(k)) {
            passed += vr.passed || 0; failed += vr.failed || 0; skipped += vr.skipped || 0; total += vr.total || 0
          }
        })
      }
    })
    return { total, passed, failed, skipped }
  }
  const o = (detail.value && detail.value.overall) || {}
  return { total: o.total || 0, passed: o.passed || 0, failed: o.failed || 0, skipped: o.skipped || 0 }
})

// ── Quality gates (components.json[comp].quality_gates), date-filtered ──
const gateRows = computed(() => {
  const qg = (detail.value && detail.value.quality_gates) || {}
  return Object.entries(qg).map(([gate, days]) => {
    let passed = 0, failed = 0, skipped = 0, total = 0
    const normDays = {}
    Object.entries(days || {}).forEach(([date, d]) => {
      if (!dateInRange(date)) return
      const p = d.passed || 0, f = d.failed || 0, s = d.skipped || 0
      const t = d.total || (p + f + s)
      // Carry the per-run executions (each has jenkins_url) so the gate cell can
      // link to the component-specific Jenkins test result.
      const executions = Array.isArray(d.executions) ? d.executions : []
      normDays[date] = { passed: p, failed: f, skipped: s, total: t, executions }
      passed += p; failed += f; skipped += s; total += t
    })
    return { gate, days: normDays, passed, failed, skipped, total }
  }).filter((r) => r.total > 0)
})

// Shorten a Jenkins URL into a readable run label for the dropdown.
function jenkinsLabel(url) {
  if (!url) return 'Run'
  return url
    .replace('https://jenkins-csb-rhods-opendatascience.dno.corp.redhat.com/job/', '')
    .replace(/\/$/, '')
    .replace(/\/job\//g, '/')
}

// Deep-link a Jenkins build URL to its test-results page (…/testReport/) rather
// than the build root, so the link lands on the run's test report. Note: a
// single Jenkins run covers multiple components, so this is the whole run's
// report — component-specific evidence is the Jira "Open Failed Jiras" link.
function testReportUrl(url) {
  if (!url) return url
  const base = url.endsWith('/') ? url : url + '/'
  return `${base}testReport/`
}

const gateDates = computed(() => {
  const set = new Set()
  gateRows.value.forEach((r) => Object.keys(r.days).forEach((d) => set.add(d)))
  return Array.from(set).sort((a, b) => b.localeCompare(a))
})


// ── TFA aggregation from jira_config.tfa[vr][component], version/release-filtered ──
const tfa = computed(() => {
  const merged = { tfa: {}, classified: 0, unclassified: 0, status: {}, total_failed: 0 }
  const cfg = jiraConfig.value
  if (!cfg || !cfg.tfa) return merged
  const keys = matchingVrKeys(Object.keys(cfg.tfa))
  keys.forEach((rk) => {
    const teams = cfg.tfa[rk] || {}
    Object.entries(teams).forEach(([comp, data]) => {
      if (!componentMatches(comp)) return
      Object.entries(data.tfa || {}).forEach(([label, v]) => { merged.tfa[label] = (merged.tfa[label] || 0) + v })
      merged.classified += data.classified || 0
      merged.unclassified += data.unclassified || 0
      merged.total_failed += data.total_failed || 0
      Object.entries(data.status || {}).forEach(([s, v]) => { merged.status[s] = (merged.status[s] || 0) + v })
    })
  })
  return merged
})

const hasTfa = computed(() => tfa.value.total_failed > 0)

// Open failed count = test-failed issues whose Jira status is NOT a
// closed/resolved state, derived from the pre-computed status breakdown so it
// matches the "Open Failed Jiras" JQL (status NOT IN (Closed, Resolved)).
const CLOSED_STATUSES = ['Closed', 'Resolved', 'Done']
const openFailedCount = computed(() =>
  Object.entries(tfa.value.status || {})
    .filter(([s]) => !CLOSED_STATUSES.includes(s))
    .reduce((sum, [, v]) => sum + v, 0)
)

const qsr = computed(() => {
  const o = overall.value
  const t = tfa.value
  const productBugs = t.tfa['tfa-product-bug'] || 0
  const infraEnvTotal = (t.tfa['tfa-infra-issue'] || 0) + (t.tfa['tfa-env-setup'] || 0)
  const testDefects = (t.tfa['tfa-automation-bug'] || 0) + (t.tfa['tfa-false-positive'] || 0) + (t.tfa['tfa-duplicate'] || 0) + (t.tfa['tfa-wrong-assignment'] || 0)
  const knownIssues = t.tfa['tfa-known-issue'] || 0

  const rawPassRate = (o.passed + o.failed) > 0 ? round1(o.passed / (o.passed + o.failed) * 100) : 0
  const triageComplete = t.unclassified === 0
  const bestCaseQuality = (o.passed + productBugs) > 0 ? round1(o.passed / (o.passed + productBugs) * 100) : 100
  const worstBugs = productBugs + t.unclassified
  const worstCaseQuality = (o.passed + worstBugs) > 0 ? round1(o.passed / (o.passed + worstBugs) * 100) : 0
  const triagePct = t.total_failed > 0 ? Math.round(t.classified / t.total_failed * 100) : 0
  const validatedCoverage = o.total > 0 ? round1((o.passed + t.classified) / o.total * 100) : 0

  return {
    productBugs, infraEnvTotal, testDefects, knownIssues,
    rawPassRate, triageComplete, bestCaseQuality, worstCaseQuality, triagePct, validatedCoverage
  }
})

// ── Jira JQL link builders (mirror reference component.html) ──
const jql = computed(() => {
  const cfg = jiraConfig.value
  if (!cfg) return {}
  return {
    all: buildJql('test-failed', null),
    // "Open Failed Jiras" link — failed tests still open (not Closed/Resolved).
    openFailed: buildOpenFailedJql(),
    classified: buildTfaGroupJql(['tfa-product-bug', 'tfa-automation-bug', 'tfa-infra-issue', 'tfa-env-setup', 'tfa-duplicate', 'tfa-known-issue', 'tfa-false-positive', 'tfa-wrong-assignment']),
    productBug: buildTfaJql('tfa-product-bug'),
    // Classification Bridge groups — same label groupings as the qsr computed.
    infraEnv: buildTfaGroupJql(['tfa-infra-issue', 'tfa-env-setup']),
    testDefects: buildTfaGroupJql(['tfa-automation-bug', 'tfa-false-positive', 'tfa-duplicate', 'tfa-wrong-assignment']),
    knownIssues: buildTfaGroupJql(['tfa-known-issue']),
    unclassified: buildUnclassifiedJql(),
    skipped: buildJql('test-skipped', null)
  }
})

// ── Failure classification (doughnut) ──
const tfaEntries = computed(() => {
  return Object.entries(tfa.value.tfa || {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
})

const hasClassification = computed(() => tfaEntries.value.length > 0)

const classificationChart = computed(() => ({
  labels: tfaEntries.value.map(([k]) => TFA_NAMES[k] || k),
  datasets: [{
    data: tfaEntries.value.map(([, v]) => v),
    backgroundColor: tfaEntries.value.map(([k]) => TFA_COLORS[k] || '#6b8299'),
    borderColor: '#0d2137',
    borderWidth: 2
  }]
}))

const classificationChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  onClick: (evt, elems) => {
    if (elems.length > 0) {
      const [label] = tfaEntries.value[elems[0].index]
      const url = buildTfaJql(label)
      if (url) window.open(url, '_blank')
    }
  },
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw} issues — click to view in Jira` } }
  }
}

// Clickable legend rows for the classification chart.
const classificationLegend = computed(() =>
  tfaEntries.value.map(([k, v]) => ({
    key: k,
    name: TFA_NAMES[k] || k,
    desc: TFA_DESC[k] || '',
    color: TFA_COLORS[k] || '#6b8299',
    count: v,
    url: buildTfaJql(k)
  }))
)

// ── Jira status distribution (bar) ──
const statusEntries = computed(() => {
  return Object.entries(tfa.value.status || {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
})

const hasStatus = computed(() => statusEntries.value.length > 0)

const statusChart = computed(() => ({
  labels: statusEntries.value.map(([s]) => s),
  datasets: [{
    label: 'Issues',
    data: statusEntries.value.map(([, v]) => v),
    backgroundColor: statusEntries.value.map(([s]) => STATUS_COLORS[s] || '#6b8299'),
    borderRadius: 4
  }]
}))

const statusChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  onClick: (evt, elems) => {
    if (elems.length > 0) {
      const [status] = statusEntries.value[elems[0].index]
      const url = buildStatusJql(status)
      if (url) window.open(url, '_blank')
    }
  },
  onHover: (evt, elems) => {
    if (evt?.native?.target) evt.native.target.style.cursor = elems.length ? 'pointer' : 'default'
  },
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw} issues — click to open in Jira` } }
  },
  scales: {
    x: { ticks: { color: '#6b8299', font: { size: 10 } }, grid: { color: 'rgba(30,73,118,.2)' } },
    y: { ticks: { color: '#6b8299', font: { size: 10 } }, grid: { color: 'rgba(30,73,118,.3)' }, beginAtZero: true }
  }
}

// Per-status entries with their Jira query link (for an accessible list of
// evidence links below the chart, so every status is clickable, not just bars).
const statusLinks = computed(() =>
  statusEntries.value.map(([status, count]) => ({
    status,
    count,
    color: STATUS_COLORS[status] || '#6b8299',
    url: buildStatusJql(status)
  }))
)

function matchingVrKeys(keys) {
  const { version, release } = filters.value
  if (version !== 'All' && release !== 'All') return keys.filter((k) => k === `${version}|${release}`)
  if (version !== 'All') return keys.filter((k) => k.startsWith(version + '|'))
  if (release !== 'All') return keys.filter((k) => k.endsWith('|' + release))
  return keys
}

function componentMatches(comp) {
  const target = componentName.value.toLowerCase()
  const c = comp.toLowerCase()
  return c === target || c.includes(target) || target.includes(c)
}

function resolveJiraComponent() {
  // Map the dashboard component name -> exact Jira component name. Fall back to
  // the component's own name when it isn't in the map.
  const cfg = jiraConfig.value
  const map = (cfg && cfg.component_jira_map) || {}
  return map[componentName.value] || componentName.value
}

function matchingReleases() {
  const cfg = jiraConfig.value
  const rels = (cfg && cfg.releases) || {}
  return matchingVrKeys(Object.keys(rels)).map((k) => rels[k]).filter(Boolean)
}

function buildJql(label) {
  const cfg = jiraConfig.value
  if (!cfg) return null
  const matching = matchingReleases()
  if (!matching.length) return null
  const fvs = new Set()
  matching.forEach((r) => { fvs.add(`'${r.rhoai_jira_version}'`); fvs.add(`'${r.fix_version}'`) })
  const fvList = Array.from(fvs).join(', ')
  const jiraComponent = resolveJiraComponent()
  // Scope to both Jira projects (some components, e.g. "AI Testing + Workflow
  // Validation", live in RHAI rather than RHOAIENG).
  let q = `${PROJECT_CLAUSE}`
  if (jiraComponent) q += ` AND component = "${jiraComponent}"`
  q += ` AND (fixVersion IN (${fvList}) OR affectedVersion IN (${fvList}) OR 'Target Version' IN (${fvList}))`
  q += ` AND labels = "${label}"`
  return JIRA_BASE + encodeURIComponent(q)
}

// Jira query link for a single workflow status in the Status Distribution chart:
// the failed-tests query for this component/version, narrowed to one status.
function buildStatusJql(status) {
  const base = buildJql('test-failed')
  if (!base || !status) return null
  const decoded = decodeURIComponent(base.slice(JIRA_BASE.length))
  return JIRA_BASE + encodeURIComponent(`${decoded} AND status = "${status}"`)
}

function buildTfaJql(tfaLabel) {
  const base = buildJql('test-failed')
  if (!base) return null
  // Append the TFA label to the failed-tests query.
  const decoded = decodeURIComponent(base.slice(JIRA_BASE.length))
  return JIRA_BASE + encodeURIComponent(`${decoded} AND labels = "${tfaLabel}"`)
}

function buildUnclassifiedJql() {
  const base = buildJql('test-failed')
  if (!base) return null
  const tfaLabels = ['tfa-product-bug', 'tfa-automation-bug', 'tfa-infra-issue', 'tfa-env-setup', 'tfa-duplicate', 'tfa-known-issue', 'tfa-false-positive', 'tfa-wrong-assignment']
  const decoded = decodeURIComponent(base.slice(JIRA_BASE.length))
  const notClause = tfaLabels.map((l) => `labels != "${l}"`).join(' AND ')
  return JIRA_BASE + encodeURIComponent(`${decoded} AND ${notClause}`)
}

// "Open Failed Jiras" link: the component's failed-tests query, restricted to
// issues that are still open (not Closed/Resolved).
function buildOpenFailedJql() {
  const base = buildJql('test-failed')
  if (!base) return null
  const decoded = decodeURIComponent(base.slice(JIRA_BASE.length))
  return JIRA_BASE + encodeURIComponent(`${decoded} AND status NOT IN (Closed, Resolved)`)
}

// Jira link for a Classification Bridge group (one or more TFA labels, OR'd),
// intersected with the component's failed-tests query.
function buildTfaGroupJql(labels) {
  const base = buildJql('test-failed')
  if (!base || !labels || !labels.length) return null
  const decoded = decodeURIComponent(base.slice(JIRA_BASE.length))
  const inList = labels.map((l) => `"${l}"`).join(', ')
  return JIRA_BASE + encodeURIComponent(`${decoded} AND labels IN (${inList})`)
}

// ── helpers ──
function pctOf(n) {
  return tfa.value.total_failed > 0 ? Math.round(n / tfa.value.total_failed * 100) : 0
}
function round1(n) { return Math.round(n * 10) / 10 }
function passPct(passed, total) { return total > 0 ? Math.round((passed / total) * 100) : 0 }
function pctColor(pct) {
  if (pct >= 95) return 'green'
  if (pct >= 80) return 'amber'
  if (pct >= 60) return 'orange'
  return 'red'
}
function formatDate(d) { return d.toISOString().slice(0, 10) }
function friendlyDate(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months[d.getMonth()] + ' ' + d.getDate()
}
function normalizeVersion(v) {
  const base = String(v).split('-')[0]
  const parts = base.split('.')
  return parts.length >= 2 ? parts[0] + '.' + parts[1] : base
}

function goBack() {
  if (nav) nav.navigateTo('test-execution', {})
  else window.location.hash = '#/system-health/test-execution'
}
</script>

<style scoped>
.detail {
  background: #0a1929;
  color: #e0e0e0;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.container { max-width: 1500px; margin: 0 auto; padding: 24px 32px; }

.back-link { font-size: 13px; display: inline-block; margin-bottom: 8px; color: #5ea7ff; text-decoration: none; }
.back-link:hover { text-decoration: underline; }
.open-failed-btn { display: inline-block; margin-top: 6px; font-size: 12px; font-weight: 600; color: #ff6b7a; text-decoration: none; background: rgba(255,71,87,.12); border: 1px solid rgba(255,71,87,.35); border-radius: 6px; padding: 4px 10px; }
.open-failed-btn:hover { background: rgba(255,71,87,.2); }

.header-row { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin: 8px 0 12px; }
.header-left h1 { font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 4px; }
.header-left p { font-size: 13px; color: #8899aa; max-width: 620px; line-height: 1.5; }

/* Filter bar */
.filter-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.filter-group { display: flex; flex-direction: column; gap: 2px; }
.filter-group.disabled { opacity: 0.4; pointer-events: none; }
.filter-label { font-size: 9px; text-transform: uppercase; color: #6b8299; letter-spacing: 0.5px; font-weight: 600; }
.filter-value { font-size: 12px; color: #fff; font-weight: 500; }
.date-toggle { border-left: 1px solid #1e4976; padding-left: 12px; margin-left: 4px; }
.toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 11px; color: #ccc; }
.toggle input { accent-color: #5ea7ff; width: 14px; height: 14px; }
.filter-bar select,
.filter-bar input[type="date"] {
  background: #132f4c; color: #fff; border: 1px solid #1e4976; border-radius: 4px;
  padding: 5px 8px; font-size: 12px; cursor: pointer; outline: none; min-width: 90px;
}
.filter-bar select:hover,
.filter-bar input[type="date"]:hover { border-color: #3a6ea5; }
.filter-bar input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; }

.showing { font-size: 12px; color: #6b8299; margin-bottom: 12px; }

/* Metric cards */
.metrics { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-bottom: 20px; }
.mc { border-radius: 8px; padding: 16px 20px; display: flex; flex-direction: column; gap: 4px; }
.mc-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8; font-weight: 600; }
.mc-value { font-size: 32px; font-weight: 700; color: #fff; }
.mc-sub { font-size: 10px; opacity: 0.7; margin-top: 2px; }
.mc-results { background: #132f4c; }
.mc-passed { background: #00b894; }
.mc-failed { background: #ff4757; }
.mc-skipped { background: #132f4c; }
.mc-pct { background: rgba(162, 155, 254, 0.15); border: 1px solid rgba(162, 155, 254, 0.3); }

/* QSR */
/* TFA header: triage progress + tiles */
.tfa-hdr { margin-bottom: 20px; }
.tfa-hdr-title { font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 12px; }
.tfa-progress { position: relative; height: 26px; background: #0d2137; border: 1px solid #1e4976; border-radius: 6px; overflow: hidden; display: flex; align-items: center; }
.tfa-progress-fill { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #ff4757, #ff6b7a); border-radius: 6px 0 0 6px; }
.tfa-progress-fill.fully-triaged { background: linear-gradient(90deg, #7bed9f, #a8f0bd); border-radius: 6px; }
.tfa-progress-label { position: absolute; left: 50%; transform: translateX(-50%); font-size: 12px; font-weight: 700; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.6); }
.tfa-progress-count { position: absolute; right: 10px; font-size: 12px; font-weight: 700; color: #ff6b7a; }
.tfa-tiles { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 10px; }
.tfa-tile { background: #0d2137; border: 1px solid #1e4976; border-radius: 8px; padding: 10px 14px; text-decoration: none; display: block; }
a.tfa-tile:hover { border-color: #3a6ea5; }
.tfa-tile-label { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #6b8299; margin-bottom: 4px; }
.tfa-tile-value { font-size: 20px; font-weight: 700; }
.tfa-tile-arrow { font-size: 12px; }
.c-triage { color: #a29bfe; }

.qsr-container { background: linear-gradient(135deg, #0d2137 0%, #132f4c 100%); border: 2px solid #1e4976; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
.qsr-container.empty { opacity: 0.65; }
.qsr-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
.qsr-title { font-size: 18px; font-weight: 700; color: #fff; }
.qsr-subtitle { font-size: 12px; color: #8899aa; margin-top: 4px; }
.qsr-meta { font-size: 10px; color: #6b8299; text-align: right; }
.qsr-empty { text-align: center; padding: 24px; color: #6b8299; }
.qsr-empty-sub { font-size: 11px; margin-top: 8px; }

.qsr-metrics { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; gap: 16px; align-items: stretch; margin-bottom: 24px; }
.qsr-card { background: #0a1929; border-radius: 12px; padding: 22px 18px; text-align: center; border: 1px solid #1e4976; position: relative; overflow: hidden; }
.qsr-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; }
.qsr-card.exec::before { background: linear-gradient(90deg, #ffa502, #ff7f50); }
.qsr-card.quality::before { background: linear-gradient(90deg, #2ed573, #00b894); }
.qsr-card.coverage::before { background: linear-gradient(90deg, #5ea7ff, #3498db); }
.qsr-card.incomplete { border-color: #ffa502; }
.qsr-card-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #8899aa; font-weight: 700; margin-bottom: 12px; }
.qsr-card-value { font-size: 44px; font-weight: 800; margin-bottom: 8px; line-height: 1; }
.qsr-card-value.range { font-size: 30px; color: #ffa502; }
.qsr-card.exec .qsr-card-value { color: #ffa502; }
.qsr-card.quality .qsr-card-value { color: #2ed573; }
.qsr-card.coverage .qsr-card-value { color: #5ea7ff; }
.qsr-card-desc { font-size: 12px; color: #8899aa; line-height: 1.4; font-weight: 500; }
.qsr-card-formula { font-size: 10px; color: #6b8299; margin-top: 12px; font-family: 'SF Mono', Monaco, monospace; background: #0d2137; padding: 8px 12px; border-radius: 6px; text-align: left; }
.formula-note { color: #8899aa; margin-bottom: 4px; }
.badge-warn { color: #ffa502; font-size: 9px; background: rgba(255, 165, 2, 0.15); padding: 2px 6px; border-radius: 4px; }
.qsr-arrow { display: flex; flex-direction: column; justify-content: center; align-items: center; color: #4a5568; font-size: 24px; padding: 0 8px; }
.qsr-arrow-label { font-size: 9px; text-transform: uppercase; margin-top: 4px; letter-spacing: 0.5px; }

.qsr-bridge { background: #0a1929; border-radius: 10px; padding: 20px; border: 1px solid #1e4976; }
.qsr-bridge-title { font-size: 13px; font-weight: 600; color: #fff; margin-bottom: 16px; }
.qsr-bridge-total { font-size: 14px; font-weight: 700; margin-bottom: 12px; }
.qsr-bridge-total a { color: #ff4757; text-decoration: none; }
.qsr-bridge-total a:hover { text-decoration: underline; }
.qsr-tree { margin-left: 8px; border-left: 2px solid #1e4976; padding-left: 16px; }
.qsr-tree-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(30, 73, 118, 0.3); }
.qsr-tree-item:last-child { border-bottom: none; }
.qsr-tree-item.pending { background: rgba(255, 71, 87, 0.05); margin-left: -16px; padding-left: 16px; border-radius: 4px; }
.qsr-tree-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
.qsr-tree-dot.dashed { background: #6b8299; border: 2px dashed #ff4757; }
.qsr-tree-label { flex: 1; font-size: 12px; color: #ccc; }
.qsr-tree-count { font-size: 14px; font-weight: 700; min-width: 50px; text-align: right; text-decoration: none; }
a.qsr-tree-count { text-decoration: underline; text-underline-offset: 2px; }
.qsr-tree-pct { font-size: 10px; color: #6b8299; min-width: 40px; text-align: right; }

.qsr-skipped { margin-top: 16px; padding-top: 16px; border-top: 1px solid #1e4976; }
.qsr-skipped-title { font-size: 12px; color: #ffa502; font-weight: 600; margin-bottom: 8px; }
.qsr-skipped-title a { color: #a29bfe; text-decoration: none; }
.qsr-skipped-row { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #8899aa; padding: 4px 0; }
.qsr-skipped-row .count { min-width: 40px; font-weight: 600; }

.qsr-summary { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #1e4976; }
.qsr-summary-item { text-align: center; padding: 12px; background: #0a1929; border-radius: 8px; }
.qsr-summary-label { font-size: 10px; text-transform: uppercase; color: #6b8299; letter-spacing: 0.5px; margin-bottom: 4px; }
.qsr-summary-value { font-size: 15px; font-weight: 700; color: #fff; }
.qsr-summary-value.small { font-size: 12px; }
.qsr-summary-value.muted { color: #8899aa; font-weight: 500; }

.c-exec { color: #ffa502; }
.c-quality { color: #2ed573; }
.c-coverage { color: #5ea7ff; }
.c-failed { color: #ff4757; }
.c-warn { color: #ffa502; }
.c-warn2 { color: #ff6b7a; }

/* Panels + gate heatmap */
.panel { background: #0d2137; border: 1px solid #1e4976; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
.panel h3 { font-size: 15px; font-weight: 600; color: #fff; margin-bottom: 4px; }
.panel-sub { font-size: 11px; color: #6b8299; margin-bottom: 14px; }

.gate-heatmap-wrap { overflow-x: auto; overflow-y: visible; position: relative; }
table.gate-hm { width: 100%; border-collapse: collapse; }
table.gate-hm th, table.gate-hm td { padding: 6px 5px; text-align: center; border-bottom: 1px solid #1e4976; white-space: nowrap; font-size: 11px; }
table.gate-hm th { color: #6b8299; font-weight: 600; }
table.gate-hm th:first-child, table.gate-hm td:first-child { text-align: left; min-width: 110px; font-weight: 500; }
.gate-sub { font-size: 10px; color: #6b8299; margin-top: 2px; }
.gate-cell { display: inline-block; border-radius: 6px; padding: 6px 6px 4px; min-width: 56px; text-align: center; position: relative; cursor: pointer; }
.gc-dd { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: 4px; z-index: 50; background: #0a1929; border: 1px solid #1e4976; border-radius: 8px; padding: 8px; min-width: 240px; max-width: 360px; box-shadow: 0 8px 24px rgba(0,0,0,.5); text-align: left; white-space: normal; }
.gc-dd-title { display: block; font-size: 10px; font-weight: 600; color: #8899aa; margin-bottom: 6px; }
.gc-dd-run { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 3px 0; }
.gc-dd-link { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; color: #5ea7ff; text-decoration: none; }
.gc-dd-link:hover { text-decoration: underline; }
.gc-dd-nums { white-space: nowrap; font-size: 10px; }
.gc-dd-nums .cp { color: #2ed573; margin-left: 4px; }
.gc-dd-nums .cf { color: #ff4757; margin-left: 4px; }
.gc-dd-nums .cs { color: #ffa502; margin-left: 4px; }
.gc-green { background: rgba(46, 213, 115, 0.15); border: 1px solid rgba(46, 213, 115, 0.3); }
.gc-amber { background: rgba(255, 165, 2, 0.12); border: 1px solid rgba(255, 165, 2, 0.25); }
.gc-orange { background: rgba(225, 112, 85, 0.12); border: 1px solid rgba(225, 112, 85, 0.25); }
.gc-red { background: rgba(255, 71, 87, 0.12); border: 1px solid rgba(255, 71, 87, 0.25); }
.gc-na { color: #4a5568; }
.gc-pct { font-size: 14px; font-weight: 700; line-height: 1; display: block; }
.gc-pct-green { color: #2ed573; }
.gc-pct-amber { color: #ffa502; }
.gc-pct-orange { color: #e17055; }
.gc-pct-red { color: #ff4757; }
.gc-runs { font-size: 9px; color: #8899aa; margin-top: 2px; display: block; }

.chart-container { position: relative; width: 100%; height: 280px; }

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }

.chart-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 240px; color: #6b8299; text-align: center; }
.chart-empty-icon { font-size: 42px; opacity: 0.3; margin-bottom: 12px; }
.chart-empty-title { font-size: 13px; font-weight: 600; color: #8899aa; }
.chart-empty-sub { font-size: 11px; margin-top: 4px; color: #ffa502; }

.tfa-legend { margin-top: 12px; }
.tfa-legend-item { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 11px; color: #8899aa; text-decoration: none; }
a.tfa-legend-item:hover { color: #cdd6e0; }
.tfa-legend-item .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.tfa-legend-item strong { color: #cdd6e0; }
.legend-arrow { font-size: 10px; color: #5ea7ff; }

.loading, .error { text-align: center; padding: 60px; font-size: 15px; }
.loading { color: #6b8299; }
.error { color: #ff4757; }

@media (max-width: 1000px) {
  .qsr-metrics { grid-template-columns: 1fr; }
  .qsr-arrow { display: none; }
  .metrics { grid-template-columns: repeat(2, 1fr); }
  .qsr-summary { grid-template-columns: 1fr; }
  .two-col { grid-template-columns: 1fr; }
}
</style>
