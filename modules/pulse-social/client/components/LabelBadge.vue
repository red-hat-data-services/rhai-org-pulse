<template>
  <span
    v-if="label"
    class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full"
    :class="badgeClasses"
  >
    <span>{{ icon }}</span>
    <span>{{ displayLabel }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, default: null },
  resolved: { type: Boolean, default: false }
})

const LABEL_CONFIG = {
  'win': { display: 'Win', icon: '🏆', classes: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  'customer-success': { display: 'Customer', icon: '🤝', classes: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  'til': { display: 'TIL', icon: '💡', classes: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  'question': { display: 'Question', icon: '❓', classes: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  'milestone': { display: 'Milestone', icon: '🎯', classes: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' }
}

const config = computed(() => LABEL_CONFIG[props.label] || null)
const badgeClasses = computed(() => config.value?.classes || '')
const icon = computed(() => config.value?.icon || '')
const displayLabel = computed(() => {
  if (props.label === 'question' && props.resolved) return 'Resolved ✓'
  return config.value?.display || props.label
})
</script>
