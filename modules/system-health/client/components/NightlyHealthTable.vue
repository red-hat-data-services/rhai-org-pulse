<template>
  <div class="nightly-health">
    <div
      v-if="totalDays > 0 && (maxPageOffset > 0 || jenkinsJobOptions.length > 1)"
      class="pager-toolbar"
    >
      <div v-if="maxPageOffset > 0" class="pager">
        <button type="button" class="pager-btn" :disabled="!canPageNewer" @click="pageNewer">
          ← Newer {{ columnsPerPage }} days
        </button>
        <span class="pager-label">
          {{ visibleDayRangeLabel }}
          <span class="pager-count">({{ visibleDays.length }} of {{ totalDays }} days)</span>
        </span>
        <button type="button" class="pager-btn" :disabled="!canPageOlder" @click="pageOlder">
          Older {{ columnsPerPage }} days →
        </button>
      </div>
      <div v-if="jenkinsJobOptions.length > 1" class="pager-job-filter">
        <label class="pager-job-label">
          <span class="pager-job-label-text">Test Results Source</span>
          <select
            v-model="selectedStreamKey"
            class="pager-job-select"
            aria-label="Test Results Source"
          >
            <option v-for="job in jenkinsJobOptions" :key="job.stream_key" :value="job.stream_key">
              {{ job.label }}
            </option>
          </select>
        </label>
      </div>
    </div>
    <div v-if="viewingOlderDays" class="pager-notice" role="status">
      You are viewing older UTC days. Latest data is
      <strong>{{ friendlyDate(newestDayDate) }}</strong>
      (build #{{ newestBuildLabel }}).
      <button type="button" class="pager-link-btn" @click="jumpToNewestDays">
        Jump to newest days
      </button>
    </div>
    <p
      v-else-if="totalDays > 0 && visibleDays.length === totalDays"
      class="day-snapshot-hint"
    >
      Showing all {{ totalDays }} UTC days in this snapshot
      (one column per calendar day, newest → oldest left to right; same-day Jenkins retries are in the day panel).
      Paging appears when more than {{ NIGHTLY_PAGE_SIZE }} UTC days are published.
    </p>

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
                @click="onMatrixDayClick(day.date, $event)"
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
              <a
                v-if="rowLinkTarget(rowId)"
                href="#"
                class="comp-link"
                :title="rowNameTooltip(rowId)"
                @click.prevent="onComponentLinkClick(rowId)"
              >
                {{ rowName(rowId) }}
              </a>
              <span v-else class="comp-label" :title="rowNameTooltip(rowId)">{{ rowName(rowId) }}</span>
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
                @click="onMatrixDayClick(day.date, $event)"
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
                      :class="dscSourceStatusClass(cellSourceStatusSubtitle(cellFor(day, rowId)))"
                    >
                      {{ cellSourceStatusSubtitlePrefix(rowId) }}: {{ cellSourceStatusSubtitle(cellFor(day, rowId)) }}
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

    <Teleport to="body">
      <div
        v-if="selectedDayEntry"
        ref="dayPopupRef"
        class="test-execution-theme nightly-day-popup day-panel day-panel--popup"
        :style="dayPopupStyle"
        tabindex="-1"
        role="dialog"
        aria-modal="false"
        :aria-labelledby="dayPanelTitleId"
      >
        <div class="day-panel-header">
          <h3 :id="dayPanelTitleId">Runs on {{ selectedDayEntry.date }}</h3>
          <button type="button" class="day-panel-close" @click="dismissDayPanel">
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
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, toRef, useId } from 'vue'
import { onClickOutside, onKeyStroke, useEventListener } from '@vueuse/core'
import {
  NIGHTLY_PAGE_SIZE,
  useNightlyHealthMatrix,
  resolveSelectedRun,
  findMatrixCell,
  resolveDisplayMatrixCell,
  cellDisplayStatus,
  nightlyCellTone,
  cellSourceStatusSubtitle,
  cellSourceStatusSubtitlePrefix,
  dscSourceStatusClass,
  rowLabel,
  rowLabelTooltip,
  nightlyRowHeatmapLinkTarget,
  friendlyDate,
  formatTimestamp,
  safeHttpUrl
} from '../composables/useNightlyHealthMatrix'
import '../styles/test-execution-theme.css'

const props = defineProps({
  payload: {
    type: Object,
    required: true
  },
  /** Full heatmap inventory so nightly rows match Component Heatmap (cells may still be –). */
  heatmapComponents: {
    type: Array,
    default: () => []
  }
})

const selectedStreamKey = defineModel('selectedStreamKey', { type: String, default: null })

const emit = defineEmits(['component-click'])

const payloadRef = toRef(props, 'payload')
const heatmapComponentsRef = toRef(props, 'heatmapComponents')

const {
  visibleDays,
  rowIds,
  canPageNewer,
  canPageOlder,
  pageNewer,
  pageOlder,
  openDay,
  closeDay,
  selectedDate,
  selectedDayEntry,
  selectedDayRuns,
  totalDays,
  maxPageOffset,
  columnsPerPage,
  jumpToNewestDays,
  viewingOlderDays,
  newestDayDate,
  sortedDays,
  jenkinsJobOptions
} = useNightlyHealthMatrix(payloadRef, heatmapComponentsRef, selectedStreamKey)

const dayPopupRef = ref(null)
const dayPanelTitleId = useId()
const popupPos = ref({ top: 0, left: 0 })
const lastMatrixClickTarget = ref(null)
const lastPopupClickEvent = ref(null)

const POPUP_WIDTH = 380
const POPUP_VIEWPORT_GUTTER = 24

const dayPopupStyle = computed(() => ({
  top: `${popupPos.value.top}px`,
  left: `${popupPos.value.left}px`
}))

function positionDayPopup(event) {
  if (!event || typeof event.clientX !== 'number' || typeof event.clientY !== 'number') {
    return
  }
  const margin = 8
  const gap = 6
  const clickX = event.clientX
  const clickY = event.clientY
  const popupEl = dayPopupRef.value
  const height = popupEl?.offsetHeight || 240
  const width = Math.min(POPUP_WIDTH, Math.max(0, window.innerWidth - POPUP_VIEWPORT_GUTTER))

  // Below the pointer; popup centered horizontally so the click sits above its middle.
  let left = clickX - width / 2
  let top = clickY + gap

  left = Math.min(Math.max(margin, left), window.innerWidth - width - margin)

  if (top + height > window.innerHeight - margin) {
    top = clickY - height - gap
  }
  if (top < margin) {
    top = margin
  }

  popupPos.value = { top, left }
}

function focusDayPopup() {
  dayPopupRef.value?.focus?.()
}

function dismissDayPanel() {
  const restore = lastMatrixClickTarget.value
  closeDay()
  nextTick(() => {
    if (restore && typeof restore.focus === 'function') {
      restore.focus()
    }
  })
}

function onMatrixDayClick(date, event) {
  lastMatrixClickTarget.value = event?.currentTarget ?? null
  lastPopupClickEvent.value = event ?? null
  openDay(date)
  positionDayPopup(event)
  nextTick(() => {
    positionDayPopup(event)
    focusDayPopup()
    requestAnimationFrame(() => {
      positionDayPopup(event)
      focusDayPopup()
    })
  })
}

onKeyStroke('Escape', () => {
  if (selectedDayEntry.value) dismissDayPanel()
})

onClickOutside(dayPopupRef, (ev) => {
  if (ev.target.closest?.('.cell-btn, .date-header-btn')) {
    return
  }
  if (selectedDayEntry.value) closeDay()
})

useEventListener(window, 'resize', () => {
  if (!selectedDayEntry.value || !lastPopupClickEvent.value) return
  positionDayPopup(lastPopupClickEvent.value)
})

const visibleDayRangeLabel = computed(() => {
  if (visibleDays.value.length === 0) return 'No nightly days'
  const newest = visibleDays.value[0]?.date
  const oldest = visibleDays.value[visibleDays.value.length - 1]?.date
  return `${friendlyDate(newest)} – ${friendlyDate(oldest)}`
})

const newestBuildLabel = computed(() => {
  const day = sortedDays.value[sortedDays.value.length - 1]
  if (!day) return '—'
  const { run } = resolveSelectedRun(day)
  return run?.build_number ?? '—'
})

const rowNameCache = computed(() => {
  const map = new Map()
  for (const day of sortedDays.value) {
    for (const run of day.runs || []) {
      if (!run) continue
      for (const rowId of rowIds.value) {
        if (map.has(rowId)) continue
        const cell = findMatrixCell(run, rowId)
        if (cell) map.set(rowId, rowLabel(rowId, cell, props.heatmapComponents))
      }
    }
  }
  return map
})

function rowName(rowId) {
  return rowNameCache.value.get(rowId) || rowLabel(rowId, null, props.heatmapComponents)
}

function rowNameTooltip(rowId) {
  for (const day of sortedDays.value) {
    for (const run of day.runs || []) {
      const cell = findMatrixCell(run, rowId)
      if (cell) return rowLabelTooltip(rowId, cell)
    }
  }
  return rowLabelTooltip(rowId, null)
}

const rowLinkTargetCache = computed(() => {
  const map = new Map()
  for (const rowId of rowIds.value) {
    const target = nightlyRowHeatmapLinkTarget(rowId, props.heatmapComponents, sortedDays.value)
    if (target) map.set(rowId, target)
  }
  return map
})

function rowLinkTarget(rowId) {
  return rowLinkTargetCache.value.get(rowId) || null
}

function onComponentLinkClick(rowId) {
  const name = rowLinkTarget(rowId)
  if (name) emit('component-click', name)
}

function selectionError(day) {
  return resolveSelectedRun(day).error
}

function selectedRun(day) {
  return resolveSelectedRun(day).run
}

function cellFor(day, rowId) {
  return resolveDisplayMatrixCell(selectedRun(day), rowId)
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
  if (passed === 0 && failed === 0 && skipped === 0) {
    return null
  }
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

.pager-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.pager-job-filter {
  margin-left: auto;
}

.pager-job-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.pager-job-label-text {
  font-weight: 600;
  color: var(--te-pager-label, #374151);
}

.pager-job-select {
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--te-border, #e5e7eb);
  background: var(--te-surface, #fff);
  color: var(--te-text, #111827);
  max-width: min(420px, 55vw);
}

.pager-btn {
  background: var(--te-accent-soft, rgba(37, 99, 235, 0.08));
  border: 1px solid var(--te-accent-border, rgba(37, 99, 235, 0.25));
  color: var(--te-accent, #2563eb);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.pager-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pager-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--te-pager-label, #374151);
}

.pager-count {
  font-weight: 500;
  color: var(--te-text-muted, #6b7280);
}

.day-snapshot-hint {
  font-size: 12px;
  color: var(--te-text-muted, #6b7280);
  margin: 0 0 10px;
  line-height: 1.4;
}

.pager-notice {
  font-size: 12px;
  color: var(--te-text-muted, #6b7280);
  background: var(--te-help-bg, #f3f4f6);
  border: 1px solid var(--te-border, #e5e7eb);
  border-radius: 6px;
  padding: 8px 12px;
  margin: 0 0 10px;
  line-height: 1.45;
}

.pager-link-btn {
  margin-left: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--te-accent, #2563eb);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
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
  font-weight: 500;
  padding: 8px 12px;
}

.comp-link {
  color: var(--te-link, #5ea7ff);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}

.comp-link:hover {
  color: var(--te-link-hover, #8ec5ff);
  text-decoration: underline;
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

.cell-substatus.dsc-status-ready {
  color: #15803d;
}

.cell-substatus.dsc-status-not-ready {
  color: #b91c1c;
}

html.dark .cell-substatus.dsc-status-ready {
  color: #2ed573;
}

html.dark .cell-substatus.dsc-status-not-ready {
  color: #ff4757;
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
  padding: 16px 18px;
  border: 1px solid var(--te-panel-border, #d1d5db);
  border-radius: 8px;
  background: var(--te-panel-bg-strong, #ffffff);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
}

.day-panel--popup {
  position: fixed;
  z-index: 2000;
  width: min(380px, calc(100vw - 24px));
  max-height: min(70vh, 420px);
  overflow-y: auto;
  margin: 0;
  box-sizing: border-box;
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

<!-- Teleport renders on body: opaque panel + theme tokens (not scoped) -->
<style>
.test-execution-theme.nightly-day-popup {
  background: #ffffff;
  color: #111827;
  border: 1px solid #d1d5db;
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.28);
}

.test-execution-theme.nightly-day-popup .day-panel-header h3,
.test-execution-theme.nightly-day-popup .run-build {
  color: #111827;
}

.test-execution-theme.nightly-day-popup .run-list-meta,
.test-execution-theme.nightly-day-popup .run-list-detail,
.test-execution-theme.nightly-day-popup .run-status,
.test-execution-theme.nightly-day-popup .day-panel-empty,
.test-execution-theme.nightly-day-popup .day-panel-close {
  color: #4b5563;
}

html.dark .test-execution-theme.nightly-day-popup {
  background: #0a1929;
  color: #e8eef4;
  border-color: #1e4976;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.65);
}

html.dark .test-execution-theme.nightly-day-popup .day-panel-header h3,
html.dark .test-execution-theme.nightly-day-popup .run-build {
  color: #ffffff;
}

html.dark .test-execution-theme.nightly-day-popup .run-list-meta,
html.dark .test-execution-theme.nightly-day-popup .run-list-detail,
html.dark .test-execution-theme.nightly-day-popup .run-status,
html.dark .test-execution-theme.nightly-day-popup .day-panel-empty,
html.dark .test-execution-theme.nightly-day-popup .day-panel-close {
  color: #8899aa;
}

html.dark .test-execution-theme.nightly-day-popup .run-list-item {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

html.dark .test-execution-theme .pager-btn {
  background: rgba(94, 167, 255, 0.12);
  border: 1px solid rgba(94, 167, 255, 0.35);
  color: #5ea7ff;
}

html.dark .test-execution-theme .pager-label {
  color: #c8d4de;
}
</style>
