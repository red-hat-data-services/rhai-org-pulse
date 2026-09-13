<script setup>
import { ShieldCheck, RefreshCw } from 'lucide-vue-next'

defineProps({
  maturity: { type: String, required: true },
})
</script>

<template>
  <span
    v-if="maturity === 'stable'"
    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700"
  >
    <ShieldCheck :size="12" aria-hidden="true" />
    Stable
  </span>
  <span
    v-else
    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-amber-700 border border-dashed border-amber-400 dark:text-amber-300 dark:border-amber-600"
  >
    <RefreshCw :size="12" aria-hidden="true" />
    Rolling
  </span>
</template>
