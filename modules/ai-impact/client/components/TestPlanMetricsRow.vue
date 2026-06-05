<script setup>
import { computed } from 'vue'

const props = defineProps({
  testPlans: { type: Object, default: () => ({}) }
})

const planList = computed(() => Object.values(props.testPlans))

const stats = computed(() => {
  let sum = 0, ready = 0, revise = 0, rework = 0, autoRevised = 0
  for (const p of planList.value) {
    sum += (p.score || 0)
    if (p.verdict === 'Ready') ready++
    else if (p.verdict === 'Revise') revise++
    else if (p.verdict === 'Rework') rework++
    if (p.autoRevised) autoRevised++
  }
  const total = planList.value.length
  return {
    total,
    avg: total ? (sum / total).toFixed(1) : 0,
    passRate: total ? Math.round((ready / total) * 100) : 0,
    ready,
    revise,
    rework,
    autoRevised
  }
})
</script>

<template>
  <div class="p-6 border-b border-gray-200 dark:border-gray-700">
    <div class="grid gap-6 grid-cols-2 lg:grid-cols-7">
      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">Total Plans</p>
        <span class="text-3xl font-bold dark:text-gray-100">{{ stats.total }}</span>
      </div>

      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">Pass Rate</p>
        <span class="text-3xl font-bold dark:text-gray-100">{{ stats.passRate }}%</span>
      </div>

      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">Avg Score</p>
        <span class="text-3xl font-bold dark:text-gray-100">{{ stats.avg }}</span>
        <p class="text-xs text-gray-400 dark:text-gray-500">out of 10</p>
      </div>

      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">Ready</p>
        <span class="text-3xl font-bold" :class="stats.ready > 0 ? 'text-green-600 dark:text-green-400' : 'dark:text-gray-100'">
          {{ stats.ready }}
        </span>
      </div>

      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">Revise</p>
        <span class="text-3xl font-bold" :class="stats.revise > 0 ? 'text-amber-600 dark:text-amber-400' : 'dark:text-gray-100'">
          {{ stats.revise }}
        </span>
      </div>

      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">Rework</p>
        <span class="text-3xl font-bold" :class="stats.rework > 0 ? 'text-red-600 dark:text-red-400' : 'dark:text-gray-100'">
          {{ stats.rework }}
        </span>
      </div>

      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">Auto-revised</p>
        <span class="text-3xl font-bold" :class="stats.autoRevised > 0 ? 'text-blue-600 dark:text-blue-400' : 'dark:text-gray-100'">
          {{ stats.autoRevised }}
        </span>
      </div>
    </div>
  </div>
</template>
