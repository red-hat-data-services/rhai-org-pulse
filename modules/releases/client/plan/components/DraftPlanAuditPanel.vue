<script setup>
import { computed } from 'vue'
import { AUDIT_DISPLAY_CAP, formatAuditDetail } from '../utils/draft-plan-model'

var props = defineProps({
  audit: { type: Array, default: function() { return [] } }
})

var displayEntries = computed(function() {
  return props.audit.slice(0, AUDIT_DISPLAY_CAP)
})

function formatTs(ts) {
  if (!ts) return ''
  var d = new Date(ts)
  if (Number.isNaN(d.getTime())) return String(ts)
  return d.toLocaleString()
}
</script>

<template>
  <aside
    role="complementary"
    aria-label="Draft plan audit log"
    class="mx-4 mt-3 mb-3 xl:mx-0 xl:mt-0 xl:mb-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 xl:sticky xl:top-3 xl:max-h-[calc(100vh-1.5rem)] xl:overflow-y-auto shrink-0"
  >
    <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
      Audit
      <span class="font-normal text-gray-400 dark:text-gray-500">({{ audit.length }})</span>
    </h2>

    <ul
      v-if="displayEntries.length"
      class="list-none m-0 p-0 text-xs leading-snug"
      data-testid="draft-plan-audit-list"
    >
      <li
        v-for="(entry, idx) in displayEntries"
        :key="entry.ts + '-' + idx"
        class="py-2 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
      >
        <div class="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">{{ formatTs(entry.ts) }}</div>
        <div class="text-gray-700 dark:text-gray-200">
          <span class="font-semibold text-gray-900 dark:text-gray-100">{{ entry.actor || '—' }}</span>
          <span class="text-gray-400 dark:text-gray-500"> — </span>
          {{ formatAuditDetail(entry) }}
        </div>
      </li>
    </ul>

    <p v-else class="text-xs text-gray-400 dark:text-gray-500 m-0">No changes yet.</p>
  </aside>
</template>
