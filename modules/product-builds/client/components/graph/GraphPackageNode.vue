<script setup>
import { Handle, Position } from '@vue-flow/core'

defineProps({
  data: { type: Object, required: true },
  id: { type: String, required: true },
})
</script>

<template>
  <Handle type="target" :position="Position.Top" class="!bg-gray-500" />

  <div
    class="px-3 py-2 min-w-[120px] text-center text-xs font-mono cursor-pointer select-none rounded-lg border-2"
    :class="{
      'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-500 shadow-[0_0_12px_rgba(240,171,0,0.6)] border-4': data.isSelected,
      'bg-green-50 dark:bg-green-900/20 border-green-600 dark:border-green-500 font-bold': !data.isSelected && data.isRoot,
      'bg-teal-50 dark:bg-teal-900/20 border-teal-500': !data.isSelected && !data.isRoot && data.preBuilt,
      'bg-white dark:bg-gray-800 border-blue-600 dark:border-blue-400': !data.isSelected && !data.isRoot && !data.preBuilt,
      'border-dashed !border-gray-500': data.isBuildOnly && !data.isSelected,
    }"
  >
    <div>{{ data.label }}</div>
    <div
      v-if="data.preBuilt && !data.isSelected"
      class="text-[10px] text-teal-600 dark:text-teal-400 mt-0.5"
    >
      (pre-built)
    </div>
  </div>

  <Handle type="source" :position="Position.Bottom" class="!bg-gray-500" />
</template>
