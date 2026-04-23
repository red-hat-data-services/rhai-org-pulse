<script setup>
import { computed } from 'vue'

const props = defineProps({
  features: { type: Object, default: () => ({}) }
})

const featureList = computed(() => Object.values(props.features))

const totalFeatures = computed(() => featureList.value.length)

const approvalRate = computed(() => {
  if (totalFeatures.value === 0) return 0
  const approved = featureList.value.filter(f => f.recommendation === 'approve').length
  return Math.round((approved / totalFeatures.value) * 100)
})

const avgScore = computed(() => {
  if (totalFeatures.value === 0) return 0
  const sum = featureList.value.reduce((acc, f) => acc + (f.scores?.total || 0), 0)
  return (sum / totalFeatures.value).toFixed(1)
})

const needsAttentionCount = computed(() => {
  return featureList.value.filter(f => f.needsAttention).length
})
</script>

<template>
  <div class="p-6 border-b border-gray-200 dark:border-gray-700">
    <div class="grid gap-6 grid-cols-2 lg:grid-cols-4">
      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">Total Features</p>
        <span class="text-3xl font-bold dark:text-gray-100">{{ totalFeatures }}</span>
      </div>

      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">Approval Rate</p>
        <span class="text-3xl font-bold dark:text-gray-100">{{ approvalRate }}%</span>
      </div>

      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">Avg Score</p>
        <span class="text-3xl font-bold dark:text-gray-100">{{ avgScore }}</span>
        <p class="text-xs text-gray-400 dark:text-gray-500">out of 8</p>
      </div>

      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">Needs Attention</p>
        <span class="text-3xl font-bold" :class="needsAttentionCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'dark:text-gray-100'">
          {{ needsAttentionCount }}
        </span>
      </div>
    </div>
  </div>
</template>
