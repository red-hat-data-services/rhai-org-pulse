<template>
  <span :class="classes">{{ label }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  variant: { type: String, default: 'default' },
})

const variantClasses = {
  strategy: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  lineage: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  need: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  capability: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  status: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  default: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
}

const classes = computed(() => {
  const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium'
  return `${base} ${variantClasses[props.variant] || variantClasses.default}`
})
</script>
