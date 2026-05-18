<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, default: null },
  templateOutOfDate: { type: Boolean, default: false },
  /** Matched checklist item count (denominator). */
  checklistTotal: { type: Number, default: null },
  /** Rollup Done count (numerator for complete). */
  checklistDone: { type: Number, default: null },
  /** Checklist items on template not on signoff epic (when present in index). */
  missingCount: { type: Number, default: null },
  rollupInProgress: { type: Number, default: null },
  rollupToDo: { type: Number, default: null },
  rollupOther: { type: Number, default: null }
})

const activeOpen = computed(() => (props.rollupInProgress ?? 0) + (props.rollupOther ?? 0))
const todoOpen = computed(() => props.rollupToDo ?? 0)
const openTotal = computed(() => activeOpen.value + todoOpen.value)

/** Percent of matched checklist items in Done (100 × done / total). */
const percentComplete = computed(() => {
  const t = props.checklistTotal
  if (t == null || t <= 0) return null
  const d = Math.min(props.checklistDone ?? 0, t)
  return Math.round((d / t) * 100)
})

const showErrorIcon = computed(() => props.status === 'error')

/** Non-percent fallback text (percent uses "Signoff: NN%" in template). */
const fallbackLabel = computed(() => {
  const s = props.status
  if (!s || s === 'skipped') return '—'
  if (s === 'error') return 'SIGNOFF'
  if (s === 'ok') return 'OK'
  if (s === 'warning') return '—'
  return s
})

const showPercent = computed(() => percentComplete.value != null)

const isLooseStyle = computed(() => showPercent.value || showErrorIcon.value)

const chipClass = computed(() => {
  const s = props.status
  if (!s || s === 'skipped') {
    return 'bg-gray-100 dark:bg-gray-700/80 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600'
  }
  if (s === 'ok') {
    return 'bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-300 border-green-300 dark:border-green-500/35'
  }
  if (s === 'warning') {
    return 'bg-amber-100 dark:bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-500/35'
  }
  return 'bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300 border-red-300 dark:border-red-500/35'
})

const titleAttr = computed(() => {
  const parts = []
  const s = props.status
  const pct = percentComplete.value
  const t = props.checklistTotal
  const d = props.checklistDone ?? 0

  if (pct != null && t != null) {
    parts.push(
      `Signoff checklist ${pct}% complete (${d} done of ${t} matched items). ` +
        `Open: ${openTotal.value} (active ${activeOpen.value}, to do ${todoOpen.value}) — active includes in progress and other statuses.`
    )
  }

  if (s === 'ok') {
    if (pct == null) parts.push('Release signoff checklist matches the template.')
  } else if (s === 'warning') {
    parts.push('Template may have changed after signoff epic, or multiple clone epics matched — see feature detail.')
  } else if (s === 'error') {
    if (props.missingCount != null && props.missingCount > 0) {
      parts.push(
        `${props.missingCount} template checklist item(s) not present on the signoff epic.`
      )
    } else if (pct == null) {
      parts.push('Signoff checklist incomplete, template unavailable, or no matching signoff epic.')
    }
  } else if (s === 'skipped' || !s) {
    parts.push('Signoff not evaluated for this feature.')
  }

  if (props.templateOutOfDate) parts.push('Template may have changed.')
  return parts.join(' ')
})
</script>

<template>
  <span
    class="inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-semibold"
    :class="[
      chipClass,
      isLooseStyle || showErrorIcon ? 'tabular-nums normal-case tracking-normal' : 'uppercase tracking-wide'
    ]"
    :title="titleAttr"
  >
    <svg
      v-if="showErrorIcon"
      class="w-3 h-3 shrink-0 text-current opacity-90"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      stroke-width="2.5"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"
      />
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 15.75h.007v.008H12v-.008z" />
    </svg>
    <template v-if="showPercent">
      Signoff: {{ percentComplete }}%
    </template>
    <template v-else>
      {{ fallbackLabel }}
    </template>
  </span>
</template>
