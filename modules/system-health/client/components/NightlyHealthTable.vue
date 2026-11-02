<template>
  <div class="nightly-health">
    <div v-if="totalDays > NIGHTLY_PAGE_SIZE" class="pager">
      <button type="button" class="pager-btn" :disabled="!canPageNewer" @click="pageNewer">
        ← Newer {{ NIGHTLY_PAGE_SIZE }} days
      </button>
      <span class="pager-label">
        {{ visibleDayRangeLabel }}
      </span>
      <button type="button" class="pager-btn" :disabled="!canPageOlder" @click="pageOlder">
        Older {{ NIGHTLY_PAGE_SIZE }} days →
      </button>
    </div>

    <div class="matrix-wrapper">
      <table class="nightly-matrix">
        <thead>
          <tr>
            <th class="comp-header">Component</th>
            <th
              v-for="day in visibleDays"
              :key="day.date"
              class="date-header"
              :class="{ 'date-header--selected': selectedDate === day.date }"
            >
              <button
                type="button"
                class="date-header-btn"
                :title="`Show all builds on ${day.date}`"
                @click="selectDay(day.date)"
              >
                <div class="date-cell">
                  <span class="date-label">{{ friendlyDate(day.date) }}</span>
                  <span v-if="columnBuildLabel(day)" class="build-label">{{ columnBuildLabel(day) }}</span>
                </div>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rowId in rowIds" :key="rowId">
            <td class="comp-name">
              <span class="comp-label">{{ rowName(rowId) }}</span>
            </td>
            <td
              v-for="day in visibleDays"
              :key="`${rowId}-${day.date}`"
              class="data-cell"
              :class="{ 'data-cell--selected': selectedDate === day.date }"
            >
              <button
                type="button"
                class="cell-btn"
                @click="selectDay(day.date)"
              >
                <template v-if="cellFor(day, rowId)">
                  <div
                    class="cell"
                    :class="`cell-${nightlyCellTone(cellFor(day, rowId))}`"
                  >
                    <div
                      class="cell-pct"
                      :class="`cell-pct-${nightlyCellTone(cellFor(day, rowId))}`"
                    >
                      {{ cellDisplayStatus(cellFor(day, rowId)) }}
                    </div>
                    <div
                      v-if="cellSourceStatusSubtitle(cellFor(day, rowId))"
                      class="cell-substatus"
                    >
                      BVT: {{ cellSourceStatusSubtitle(cellFor(day, rowId)) }}
                    </div>
                    <div v-if="cellTestCounts(cellFor(day, rowId))" class="cell-counts">
                      <span class="cp">{{ cellTestCounts(cellFor(day, rowId)).passed }}</span>
                      <span class="cf">{{ cellTestCounts(cellFor(day, rowId)).failed }}</span>
                      <span class="cs">{{ cellTestCounts(cellFor(day, rowId)).skipped }}</span>
                    </div>
                  </div>
                </template>
                <span v-else-if="selectionError(day)" class="cell-na" :title="selectionError(day)">!</span>
                <span v-else class="cell-na">–</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="selectedDayEntry" class="day-panel">
      <div class="day-panel-header">
        <h3>Runs on {{ selectedDayEntry.date }}</h3>
        <button type="button" class="day-panel-close" @click="selectDay(selectedDayEntry.date)">
          Close
        </button>
      </div>
      <p v-if="selectionError(selectedDayEntry)" class="selection-error" role="status">
        {{ selectionError(selectedDayEntry) }}
      </p>
      <div v-if="selectedDayRuns.length === 0" class="day-panel-empty">No runs recorded for this day.</div>
      <ul v-else class="run-list">
        <li
          v-for="run in selectedDayRuns"
          :key="run.run_id"
          class="run-list-item"
          :class="{ 'run-list-item--selected': run.run_id === selectedDayEntry.latest_run_id }"
        >
          <div class="run-list-main">
            <span v-if="run.run_id === selectedDayEntry.latest_run_id" class="selected-badge">Selected for column</span>
            <span class="run-build">Build #{{ run.build_number ?? '—' }}</span>
            <span v-if="runPromotionStatus(run)" class="run-status">{{ runPromotionStatus(run) }}</span>
          </div>
          <div class="run-list-meta">
            <span>{{ formatTimestamp(run.started_at) }}</span>
            <span v-if="run.completed_at"> → {{ formatTimestamp(run.completed_at) }}</span>
          </div>
          <div v-if="runMetaLine(run)" class="run-list-detail">{{ runMetaLine(run) }}</div>
          <a
            v-if="safeHttpUrl(run.jenkins_url)"
            class="run-link"
            :href="safeHttpUrl(run.jenkins_url)"
            target="_blank"
            rel="noopener noreferrer"
          >
            Jenkins run
          </a>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, toRef } from 'vue'
import {
  NIGHTLY_PAGE_SIZE,
  useNightlyHealthMatrix,
  resolveSelectedRun,
  findMatrixCell,
  cellDisplayStatus,
  nightlyCellTone,
  cellSourceStatusSubtitle,
  rowLabel,
  friendlyDate,
  formatTimestamp,
  safeHttpUrl
} from '../composables/useNightlyHealthMatrix'

const props = defineProps({
  payload: {
    type: Object,
    required: true
  }
})

const payloadRef = toRef(props, 'payload')

const {
  visibleDays,
  rowIds,
  canPageNewer,
  canPageOlder,
  pageNewer,
  pageOlder,
  selectDay,
  selectedDate,
  selectedDayEntry,
  selectedDayRuns,
  totalDays
} = useNightlyHealthMatrix(payloadRef)

const visibleDayRangeLabel = computed(() => {
  if (visibleDays.value.length === 0) return 'No nightly days'
  const newest = visibleDays.value[0]?.date
  const oldest = visibleDays.value[visibleDays.value.length - 1]?.date
  return `${friendlyDate(oldest)} – ${friendlyDate(newest)}`
})

const rowNameCache = computed(() => {
  const map = new Map()
  for (const day of props.payload?.days || []) {
    for (const run of day.runs || []) {
      if (!run) continue
      for (const rowId of rowIds.value) {
        if (map.has(rowId)) continue
        const cell = findMatrixCell(run, rowId)
        if (cell) map.set(rowId, rowLabel(rowId, cell))
      }
    }
  }
  return map
})

function rowName(rowId) {
  return rowNameCache.value.get(rowId) || rowLabel(rowId, null)
}

function selectionError(day) {
  return resolveSelectedRun(day).error
}

function selectedRun(day) {
  return resolveSelectedRun(day).run
}

function cellFor(day, rowId) {
  return findMatrixCell(selectedRun(day), rowId)
}

function columnBuildLabel(day) {
  const run = selectedRun(day)
  if (!run) return ''
  const pg = run.promotion_gate
  const num = run.build_number != null ? `#${run.build_number}` : ''
  const ver = pg?.rhoai_version ? `RHOAI ${pg.rhoai_version}` : ''
  return [num, ver].filter(Boolean).join(' · ')
}

function cellTestCounts(cell) {
  const t = cell?.tests
  if (!t || typeof t !== 'object') return null
  const passed = t.passed ?? 0
  const failed = t.failed ?? 0
  const skipped = t.skipped ?? 0
  if (passed === 0 && failed === 0 && skipped === 0) return null
  return { passed, failed, skipped }
}

function runPromotionStatus(run) {
  const pg = run.promotion_gate
  if (pg?.status) return pg.status
  if (run.source_result) return run.source_result
  return ''
}

function runMetaLine(run) {
  const pg = run.promotion_gate || {}
  const parts = []
  if (pg.rhoai_version) parts.push(`RHOAI ${pg.rhoai_version}`)
  if (pg.update_channel) parts.push(pg.update_channel)
  if (pg.cluster_name) parts.push(pg.cluster_name)
  if (pg.openshift_version) parts.push(`OCP ${pg.openshift_version}`)
  return parts.join(' · ')
}
</script>

<style scoped>
.nightly-health {
  margin-top: 0;
}

.pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.pager-btn {
  background: var(--te-accent-soft);
  border: 1px solid var(--te-accent-border);
  color: var(--te-accent);
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.pager-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pager-label {
  font-size: 12px;
  color: var(--te-pager-label);
}

.matrix-wrapper {
  overflow-x: auto;
  overflow-y: visible;
  margin-top: 16px;
  position: relative;
}

table.nightly-matrix {
  width: 100%;
  border-collapse: collapse;
  min-width: 800px;
}

table.nightly-matrix th,
table.nightly-matrix td {
  padding: 8px 6px;
  text-align: center;
  border-bottom: 1px solid var(--te-border, #1e4976);
  white-space: nowrap;
}

table.nightly-matrix th {
  font-size: 11px;
  color: var(--te-text-muted, #8899aa);
  font-weight: 600;
  position: sticky;
  top: 0;
  background: var(--te-sticky-bg, #0a1929);
  z-index: 10;
}

.comp-header {
  text-align: left;
  min-width: 180px;
}

.comp-name {
  text-align: left;
  font-weight: 600;
  padding: 8px 12px;
}

.comp-label {
  color: var(--te-heading, var(--te-text-primary, inherit));
  font-size: 13px;
  font-weight: 600;
}

.date-header {
  min-width: 80px;
}

.date-header--selected,
.data-cell--selected {
  background: var(--te-accent-soft);
  box-shadow: inset 0 0 0 2px var(--te-accent-border);
}

.date-header-btn {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
  width: 100%;
  display: flex;
  justify-content: center;
}

.date-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.date-label {
  font-size: 11px;
  color: var(--te-date-label, inherit);
  font-weight: 600;
}

.build-label {
  font-size: 10px;
  color: var(--te-comp-stats, #6b8299);
  font-weight: 400;
  max-width: 120px;
  white-space: normal;
  text-align: center;
  line-height: 1.2;
}

.data-cell {
  position: relative;
  padding: 4px 2px;
  vertical-align: middle;
}

.cell-btn {
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
  cursor: pointer;
  color: inherit;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.cell {
  border-radius: 6px;
  padding: 8px 6px;
  min-width: 72px;
  min-height: 52px;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  box-sizing: border-box;
}

.cell-green {
  background: rgba(46, 213, 115, 0.15);
  border: 1px solid rgba(46, 213, 115, 0.3);
}

.cell-amber,
.cell-blocked {
  background: rgba(255, 165, 2, 0.12);
  border: 1px solid rgba(255, 165, 2, 0.25);
}

.cell-red {
  background: rgba(255, 71, 87, 0.12);
  border: 1px solid rgba(255, 71, 87, 0.25);
}

.cell-muted,
.cell-neutral {
  background: rgba(107, 130, 153, 0.12);
  border: 1px solid rgba(107, 130, 153, 0.25);
}

.cell-pct {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.1;
  max-width: 100px;
  white-space: normal;
  word-break: break-word;
}

.cell-pct-green {
  color: #2ed573;
}

.cell-pct-amber,
.cell-pct-blocked {
  color: #ffa502;
}

.cell-pct-red {
  color: #ff4757;
}

.cell-pct-muted,
.cell-pct-neutral {
  color: var(--te-text-muted);
}

.cell-substatus {
  font-size: 9px;
  font-weight: 600;
  color: var(--te-text-muted);
  margin-top: 3px;
  line-height: 1.2;
}

.cell-counts {
  display: flex;
  gap: 3px;
  justify-content: center;
  font-size: 9px;
  font-weight: 600;
  margin-top: 3px;
}

.cell-counts .cp {
  color: #2ed573;
}

.cell-counts .cf {
  color: #ff4757;
}

.cell-counts .cs {
  color: #ffa502;
}

.cell-na {
  color: var(--te-cell-na, #4a5568);
  font-size: 13px;
}

.day-panel {
  margin-top: 20px;
  padding: 16px 18px;
  border: 1px solid var(--te-panel-border);
  border-radius: 8px;
  background: var(--te-panel-bg-strong);
}

.day-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.day-panel-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--te-heading);
}

.day-panel-close {
  background: transparent;
  border: 1px solid var(--te-border);
  color: var(--te-text-muted);
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.selection-error {
  color: #ffa502;
  font-size: 13px;
}

.run-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.run-list-item {
  padding: 12px 0;
  border-bottom: 1px solid var(--te-divider-soft);
}

.run-list-item--selected {
  border-left: 3px solid var(--te-accent);
  padding-left: 10px;
}

.run-list-main {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.selected-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--te-accent);
  background: var(--te-accent-soft);
  padding: 2px 8px;
  border-radius: 4px;
}

.run-build {
  font-weight: 600;
  color: var(--te-heading);
}

.run-status {
  text-transform: capitalize;
  color: var(--te-pager-label);
}

.run-list-meta,
.run-list-detail {
  font-size: 12px;
  color: var(--te-text-muted);
  margin-top: 4px;
}

.run-link {
  display: inline-block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--te-link);
}

.day-panel-empty {
  font-size: 13px;
  color: var(--te-text-muted);
}
</style>
