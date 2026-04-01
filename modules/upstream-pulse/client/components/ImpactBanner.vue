<template>
  <div class="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 rounded-xl p-6 text-white">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-blue-100 text-sm">Total Team Impact</p>
        <p class="text-3xl font-bold">
          {{ teamTotal.toLocaleString() }} contributions
        </p>
        <p class="text-blue-200 mt-1">
          {{ teamPercent }}% of all project activity
        </p>
      </div>
      <div class="flex gap-6">
        <div v-for="item in breakdown" :key="item.label" class="text-center">
          <p class="text-2xl font-bold">{{ item.value.toLocaleString() }}</p>
          <p class="text-blue-200 text-sm">{{ item.label }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  contributions: { type: Object, default: () => ({}) }
})

const teamTotal = computed(() => props.contributions?.all?.team || 0)
const teamPercent = computed(() => {
  const pct = props.contributions?.all?.teamPercent
  return pct != null ? Number(pct).toFixed(1) : '0.0'
})

const breakdown = computed(() => [
  { label: 'Commits', value: props.contributions?.commits?.team || 0 },
  { label: 'PRs', value: props.contributions?.pullRequests?.team || 0 },
  { label: 'Reviews', value: props.contributions?.reviews?.team || 0 },
  { label: 'Issues', value: props.contributions?.issues?.team || 0 }
])
</script>
