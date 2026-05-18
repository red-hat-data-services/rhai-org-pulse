<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  validation: { type: Object, default: null },
  /** When true: title + status badge in a row; body expands on click (e.g. feature detail header). */
  collapsible: { type: Boolean, default: false }
})

const JIRA_BASE = 'https://redhat.atlassian.net/browse/'

const expandedChecklist = ref(false)
/** Collapsible panel open state (detail header); collapsed by default. */
const sectionOpen = ref(false)

const v = computed(() => props.validation)

const headerBadgeClass = computed(() => {
  const s = v.value?.status
  if (!s || s === 'skipped') return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'
  if (s === 'ok') return 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-300 border-green-300 dark:border-green-500/40'
  if (s === 'warning') return 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-500/40'
  return 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300 border-red-300 dark:border-red-500/40'
})

const headerLabel = computed(() => {
  const s = v.value?.status
  if (!v.value) return 'No data'
  if (!v.value.applies && v.value.status === 'skipped') {
    if (v.value.reason === 'not_planned') return 'N/A (not in scope)'
    if (v.value.reason === 'no_config') return 'Disabled'
    return 'Skipped'
  }
  if (s === 'ok') return 'Aligned'
  if (s === 'warning') return 'Review needed'
  if (s === 'error') return 'Action required'
  return s || 'Unknown'
})

function browse(key) {
  return key ? `${JIRA_BASE}${key}` : '#'
}

const rollup = computed(() => v.value?.signoffStatusRollup || null)

const rollupTotal = computed(() => {
  if (!rollup.value) return 0
  return (rollup.value.Done || 0) + (rollup.value['In Progress'] || 0) + (rollup.value['To Do'] || 0) + (rollup.value.Other || 0)
})

function categoryPct(cat) {
  const t = rollupTotal.value
  if (!t || !rollup.value) return 0
  return Math.round(((rollup.value[cat] || 0) / t) * 100)
}

const matchedRows = computed(() => v.value?.matchedChecklistItems || [])

/** Open work first (to do / new → in progress → other); completed (done) last. */
const CHECKLIST_STATUS_ORDER = {
  'To Do': 0,
  'In Progress': 1,
  Other: 2,
  Done: 3
}

const matchedRowsSorted = computed(() => {
  const rows = [...matchedRows.value]
  rows.sort((a, b) => {
    const catA = a.signoffStatusCategory || 'Other'
    const catB = b.signoffStatusCategory || 'Other'
    const rankA = CHECKLIST_STATUS_ORDER[catA] ?? 2
    const rankB = CHECKLIST_STATUS_ORDER[catB] ?? 2
    if (rankA !== rankB) return rankA - rankB
    return String(a.signoffKey || '').localeCompare(String(b.signoffKey || ''))
  })
  return rows
})

const missingRows = computed(() => v.value?.missingChecklistItems || [])

function statusChipClass(category) {
  if (category === 'Done') return 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-300'
  if (category === 'In Progress') return 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300'
  if (category === 'To Do') return 'bg-gray-100 dark:bg-gray-600/30 text-gray-700 dark:text-gray-300'
  return 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300'
}

/** Legacy payloads used shape_shallow / shape_deep; omit default path from UI. */
const signoffSelectionHint = computed(() => {
  const m = v.value?.selectionMethod
  if (!m || m === 'shape_shallow') return null
  if (m === 'nested_epics' || m === 'shape_deep') {
    return 'Signoff epic matched under nested RHOAIENG work (not only a direct child of the feature).'
  }
  return null
})

const rootCardClass = computed(() =>
  props.collapsible
    ? [
        'mt-6 rounded-xl border shadow-sm',
        'border-violet-200/90 dark:border-violet-500/35',
        'bg-violet-50/90 dark:bg-violet-950/35',
        'ring-1 ring-violet-100/70 dark:ring-violet-400/10',
        'px-4 py-3 sm:px-5 sm:py-4'
      ].join(' ')
    : 'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden'
)

const appliesBodyClass = computed(() =>
  props.collapsible ? 'space-y-4' : 'p-4 space-y-4'
)

const skippedBodyClass = computed(() =>
  props.collapsible
    ? 'text-sm text-gray-600 dark:text-gray-400'
    : 'p-4 text-sm text-gray-600 dark:text-gray-400'
)
</script>

<template>
  <div v-if="v" :class="rootCardClass">
    <!-- Standalone card header -->
    <div
      v-if="!collapsible"
      class="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2"
    >
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Release signoff</h2>
        <span
          class="inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold"
          :class="headerBadgeClass"
        >{{ headerLabel }}</span>
        <span
          v-if="signoffSelectionHint"
          class="text-[10px] text-gray-500 dark:text-gray-400 max-w-md leading-snug"
        >{{ signoffSelectionHint }}</span>
      </div>
    </div>

    <!-- Collapsible summary row (title + badge only) -->
    <button
      v-else
      type="button"
      class="w-full flex items-center justify-between gap-3 text-left rounded-lg py-2.5 px-2 -mx-0.5 hover:bg-violet-100/70 dark:hover:bg-violet-900/35 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 dark:focus-visible:ring-violet-500/50"
      :aria-expanded="sectionOpen"
      aria-controls="signoff-section-body"
      @click="sectionOpen = !sectionOpen"
    >
      <div class="flex flex-wrap items-center gap-2 min-w-0">
        <h2 class="text-lg font-semibold text-violet-950 dark:text-violet-100">Release signoff</h2>
        <span
          class="inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold shrink-0"
          :class="headerBadgeClass"
        >{{ headerLabel }}</span>
      </div>
      <svg
        class="w-5 h-5 shrink-0 text-violet-500 dark:text-violet-400/90 transition-transform duration-200"
        :class="sectionOpen ? 'rotate-180' : ''"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div
      v-show="!collapsible || sectionOpen"
      id="signoff-section-body"
      :class="
        collapsible
          ? 'mt-3 pt-4 space-y-4 border-t border-violet-200/80 dark:border-violet-500/30'
          : ''
      "
    >
      <p
        v-if="collapsible && signoffSelectionHint"
        class="text-[10px] text-violet-800/85 dark:text-violet-200/80 leading-snug"
      >
        {{ signoffSelectionHint }}
      </p>

    <!-- Skipped / not applicable -->
    <div
      v-if="!v.applies && v.status === 'skipped'"
      :class="skippedBodyClass"
    >
      <template v-if="v.reason === 'not_planned'">
        Signoff checklist applies to features that are <strong class="text-gray-800 dark:text-gray-200">in progress</strong> or have a <strong class="text-gray-800 dark:text-gray-200">fix version</strong>.
      </template>
      <template v-else-if="v.reason === 'no_config'">
        Signoff templates are not configured in this environment.
      </template>
      <template v-else>
        Not evaluated.
      </template>
    </div>

    <!-- Applies -->
    <div v-else :class="appliesBodyClass">
      <p
        v-if="v.message"
        class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
      >
        {{ v.message }}
      </p>

      <div
        v-if="v.releaseType || v.expectedTemplateKey || v.signoffEpic"
        class="flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-600 dark:text-gray-400"
      >
        <span v-if="v.releaseType">
          Release type:
          <span class="font-medium text-gray-900 dark:text-gray-100">{{ v.releaseType }}</span>
        </span>
        <span v-if="v.signoffEpic?.key" class="flex items-center gap-1 flex-wrap">
          Signoff epic:
          <a
            :href="browse(v.signoffEpic.key)"
            class="font-mono text-primary-600 dark:text-blue-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >{{ v.signoffEpic.key }}</a>
          <span
            v-if="v.signoffEpic.status"
            class="text-gray-500 dark:text-gray-500"
          >({{ v.signoffEpic.status }})</span>
        </span>
        <span v-if="v.expectedTemplateKey" class="flex items-center gap-1 flex-wrap">
          Template epic:
          <a
            :href="browse(v.expectedTemplateKey)"
            class="font-mono text-primary-600 dark:text-blue-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >{{ v.expectedTemplateKey }}</a>
        </span>
        <span v-if="v.cloneLinksToTemplate === false && v.expectedTemplateKey" class="text-amber-700 dark:text-amber-400">
          No Cloners link to template (matched by checklist shape).
        </span>
      </div>

      <!-- Missing from signoff epic (present on template, not linked under signoff) -->
      <div
        v-if="missingRows.length"
        class="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50/80 dark:bg-red-500/10 px-3 py-2"
      >
        <div class="text-xs font-semibold text-red-800 dark:text-red-300 mb-1">Missing from signoff epic</div>
        <p class="text-[11px] text-red-800/90 dark:text-red-200/90 mb-2">
          These checklist items exist on the template epic but are not on this signoff epic.
        </p>
        <ul class="text-sm space-y-1.5 text-red-900 dark:text-red-100">
          <li v-for="(row, idx) in missingRows" :key="'m-' + idx" class="flex flex-wrap gap-x-2 gap-y-0.5">
            <a
              v-if="row.templateKey"
              :href="browse(row.templateKey)"
              class="font-mono text-xs text-primary-700 dark:text-red-200 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >{{ row.templateKey }}</a>
            <span class="text-gray-700 dark:text-gray-300">{{ row.summary }}</span>
            <span
              v-if="row.templateStatus"
              class="text-[10px] px-1.5 py-0 rounded bg-white/70 dark:bg-gray-900/40"
            >template {{ row.templateStatus }}</span>
          </li>
        </ul>
      </div>

      <!-- Rollup bar -->
      <div v-if="rollup && rollupTotal > 0" class="space-y-1">
        <div class="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Matched checklist items (signoff status)
        </div>
        <div class="h-2.5 w-full rounded-full overflow-hidden flex bg-gray-200 dark:bg-gray-700">
          <div
            v-if="rollup.Done > 0"
            class="bg-green-500 transition-all"
            :style="{ width: categoryPct('Done') + '%' }"
          />
          <div
            v-if="rollup['In Progress'] > 0"
            class="bg-blue-500 transition-all"
            :style="{ width: categoryPct('In Progress') + '%' }"
          />
          <div
            v-if="rollup['To Do'] > 0"
            class="bg-gray-400 dark:bg-gray-500 transition-all"
            :style="{ width: categoryPct('To Do') + '%' }"
          />
          <div
            v-if="rollup.Other > 0"
            class="bg-purple-500 transition-all"
            :style="{ width: categoryPct('Other') + '%' }"
          />
        </div>
        <div class="flex flex-wrap gap-3 text-[11px] text-gray-600 dark:text-gray-400">
          <span><span class="inline-block w-2 h-2 rounded-full bg-green-500 align-middle mr-1" /> Done {{ rollup.Done }}</span>
          <span><span class="inline-block w-2 h-2 rounded-full bg-blue-500 align-middle mr-1" /> Active {{ rollup['In Progress'] }}</span>
          <span><span class="inline-block w-2 h-2 rounded-full bg-gray-400 align-middle mr-1" /> To do {{ rollup['To Do'] }}</span>
          <span v-if="rollup.Other"><span class="inline-block w-2 h-2 rounded-full bg-purple-500 align-middle mr-1" /> Other {{ rollup.Other }}</span>
        </div>
      </div>

      <!-- Matched table -->
      <div v-if="matchedRowsSorted.length">
        <button
          type="button"
          class="text-xs font-semibold text-primary-600 dark:text-blue-400 hover:underline mb-2"
          @click="expandedChecklist = !expandedChecklist"
        >
          {{ expandedChecklist ? 'Hide' : 'Show' }} checklist ({{ matchedRowsSorted.length }} items)
        </button>
        <div
          v-show="expandedChecklist"
          class="overflow-x-auto max-h-72 overflow-y-auto rounded border border-gray-200 dark:border-gray-700"
        >
          <table class="w-full text-xs">
            <thead class="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
              <tr class="text-left text-gray-500 dark:text-gray-400">
                <th class="px-2 py-1.5 font-medium">Signoff issue</th>
                <th class="px-2 py-1.5 font-medium">Summary</th>
                <th class="px-2 py-1.5 font-medium">Status</th>
                <th class="px-2 py-1.5 font-medium">Template</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, idx) in matchedRowsSorted"
                :key="row.signoffKey || row.templateKey || 'r-' + idx"
                class="border-t border-gray-100 dark:border-gray-800"
              >
                <td class="px-2 py-1.5 font-mono whitespace-nowrap">
                  <a
                    :href="browse(row.signoffKey)"
                    class="text-primary-600 dark:text-blue-400 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >{{ row.signoffKey }}</a>
                </td>
                <td class="px-2 py-1.5 text-gray-800 dark:text-gray-200 max-w-xs truncate" :title="row.summary">
                  {{ row.summary }}
                </td>
                <td class="px-2 py-1.5 whitespace-nowrap">
                  <span
                    class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
                    :class="statusChipClass(row.signoffStatusCategory)"
                  >{{ row.signoffStatus }}</span>
                </td>
                <td class="px-2 py-1.5 font-mono text-gray-500 dark:text-gray-500 whitespace-nowrap">
                  {{ row.templateKey }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>
