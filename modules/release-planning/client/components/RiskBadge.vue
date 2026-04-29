<script setup>
import { computed } from 'vue'

const props = defineProps({
  level: { type: String, default: 'green' },
  flagCount: { type: Number, default: 0 },
  flags: { type: Array, default: () => [] },
  override: { type: Object, default: null }
})

const displayLevel = computed(function() {
  if (props.override) return props.override.riskOverride || props.level
  return props.level
})

const badgeClasses = computed(function() {
  var level = displayLevel.value
  if (level === 'red') return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/30'
  if (level === 'yellow') return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-500/30'
  return 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-500/30'
})

const levelLabel = computed(function() {
  var level = displayLevel.value
  if (level === 'red') return 'Red'
  if (level === 'yellow') return 'Yellow'
  return 'Green'
})

const tooltipText = computed(function() {
  var lines = []
  if (props.override) {
    lines.push('Manual override: ' + props.override.riskOverride)
    if (props.override.reason) lines.push('Reason: ' + props.override.reason)
  }
  if (props.flags && props.flags.length > 0) {
    for (var i = 0; i < props.flags.length; i++) {
      lines.push(props.flags[i].category + ': ' + props.flags[i].message)
    }
  }
  return lines.join('\n')
})
</script>

<template>
  <span
    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium relative"
    :class="badgeClasses"
    :title="tooltipText"
  >
    {{ levelLabel }}
    <sup
      v-if="flagCount > 0"
      class="text-[9px] font-bold -mt-1"
    >{{ flagCount }}</sup>
    <span
      v-if="override"
      class="ml-0.5 text-[9px] opacity-70"
      title="Manually overridden"
    >M</span>
  </span>
</template>
