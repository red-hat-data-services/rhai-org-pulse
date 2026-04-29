<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 transition-all"
    :class="[
      warning ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20' : '',
      clickable ? 'cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm' : ''
    ]"
    @click="clickable && $emit('click')"
  >
    <div class="flex items-center justify-between mb-1">
      <span class="text-sm text-gray-500 dark:text-gray-400">{{ label }}</span>
      <div class="flex items-center gap-1">
        <MethodologyInfo v-if="tooltip" :text="tooltip" />
        <svg v-if="clickable" class="h-4 w-4 text-gray-400 dark:text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
      </div>
    </div>
    <div class="flex items-baseline gap-2">
      <span class="text-2xl font-bold" :class="valueColorClass">{{ displayValue }}</span>
      <span v-if="unit" class="text-sm text-gray-500 dark:text-gray-400">{{ unit }}</span>
    </div>
    <p v-if="subtitle" class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ subtitle }}</p>
    <slot name="footer" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import MethodologyInfo from './MethodologyInfo.vue'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [Number, String], default: null },
  unit: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  tooltip: { type: String, default: '' },
  clickable: { type: Boolean, default: false },
  warning: { type: Boolean, default: false },
  colorThresholds: { type: Object, default: null }
})

defineEmits(['click'])

const displayValue = computed(() => {
  if (props.value == null || props.value === '') return '--'
  if (typeof props.value === 'number') {
    return props.unit === '%' ? Math.round(props.value) : props.value
  }
  return props.value
})

const valueColorClass = computed(() => {
  if (!props.colorThresholds || props.value == null) return 'text-gray-900 dark:text-gray-100'
  const { good, warn } = props.colorThresholds
  if (good != null && props.value >= good) return 'text-green-600'
  if (warn != null && props.value >= warn) return 'text-amber-600'
  return 'text-red-600'
})
</script>
