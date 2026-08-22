<script setup>
import { computed } from 'vue'
import { CircleCheckIcon, CircleXIcon, Loader2Icon, ClockIcon, CircleHelpIcon } from 'lucide-vue-next'

const props = defineProps({
  tests: { type: Array, default: () => [] }
})

const counts = computed(() => {
  let passed = 0, failed = 0, running = 0, pending = 0, unknown = 0
  for (const t of props.tests) {
    const s = t.status?.toLowerCase()
    if (s === 'testpassed') passed++
    else if (s === 'testfail') failed++
    else if (s === 'pending') pending++
    else if (s === 'inprogress') running++
    else unknown++
  }
  return { passed, failed, running, pending, unknown }
})
</script>

<template>
  <span v-if="tests.length > 0" class="inline-flex items-center gap-2">
    <span v-if="counts.passed > 0" class="inline-flex items-center gap-0.5 text-green-600 dark:text-green-400">
      <CircleCheckIcon class="w-3.5 h-3.5" />
      {{ counts.passed }}
    </span>
    <span v-if="counts.failed > 0" class="inline-flex items-center gap-0.5 text-red-600 dark:text-red-400">
      <CircleXIcon class="w-3.5 h-3.5" />
      {{ counts.failed }}
    </span>
    <span v-if="counts.running > 0" class="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400">
      <Loader2Icon class="w-3.5 h-3.5 animate-spin" />
      {{ counts.running }}
    </span>
    <span v-if="counts.pending > 0" class="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
      <ClockIcon class="w-3.5 h-3.5" />
      {{ counts.pending }}
    </span>
    <span v-if="counts.unknown > 0" class="inline-flex items-center gap-0.5 text-gray-500 dark:text-gray-400" title="Unrecognized test status">
      <CircleHelpIcon class="w-3.5 h-3.5" />
      {{ counts.unknown }}
    </span>
  </span>
  <span v-else class="text-sm text-gray-400 dark:text-gray-500">—</span>
</template>
