<script setup>
import { computed } from 'vue'

const props = defineProps({
  testPlans: { type: Object, default: () => ({}) }
})

const planList = computed(() => Object.values(props.testPlans))

const totalPlans = computed(() => planList.value.length)

const avgScore = computed(() => {
  if (totalPlans.value === 0) return 0
  const sum = planList.value.reduce((acc, p) => acc + (p.score || 0), 0)
  return (sum / totalPlans.value).toFixed(1)
})

const readyCount = computed(() => {
  return planList.value.filter(p => p.verdict === 'Ready').length
})

const reviseCount = computed(() => {
  return planList.value.filter(p => p.verdict === 'Revise').length
})

const reworkCount = computed(() => {
  return planList.value.filter(p => p.verdict === 'Rework').length
})

const autoRevisedCount = computed(() => {
  return planList.value.filter(p => p.autoRevised).length
})
</script>

<template>
  <div class="p-6 border-b border-gray-200 dark:border-gray-700">
    <div class="grid gap-6 grid-cols-2 lg:grid-cols-6">
      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">Total Plans</p>
        <span class="text-3xl font-bold dark:text-gray-100">{{ totalPlans }}</span>
      </div>

      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">Avg Score</p>
        <span class="text-3xl font-bold dark:text-gray-100">{{ avgScore }}</span>
        <p class="text-xs text-gray-400 dark:text-gray-500">out of 10</p>
      </div>

      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">Ready</p>
        <span class="text-3xl font-bold" :class="readyCount > 0 ? 'text-green-600 dark:text-green-400' : 'dark:text-gray-100'">
          {{ readyCount }}
        </span>
      </div>

      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">Revise</p>
        <span class="text-3xl font-bold" :class="reviseCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'dark:text-gray-100'">
          {{ reviseCount }}
        </span>
      </div>

      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">Rework</p>
        <span class="text-3xl font-bold" :class="reworkCount > 0 ? 'text-red-600 dark:text-red-400' : 'dark:text-gray-100'">
          {{ reworkCount }}
        </span>
      </div>

      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">Auto-revised</p>
        <span class="text-3xl font-bold" :class="autoRevisedCount > 0 ? 'text-blue-600 dark:text-blue-400' : 'dark:text-gray-100'">
          {{ autoRevisedCount }}
        </span>
      </div>
    </div>
  </div>
</template>
