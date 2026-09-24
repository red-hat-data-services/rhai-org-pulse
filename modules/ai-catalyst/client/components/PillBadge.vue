<template>
  <span :class="classes" :style="style">{{ label }}</span>
</template>

<script setup>
import { computed } from 'vue'
import { useCategories } from '../composables/useCategories.js'

const props = defineProps({
  label: { type: String, required: true },
  variant: { type: String, default: 'default' },
  color: { type: String, default: '' },
})

const { colorWithAlpha } = useCategories()

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
  if (props.color) return `${base} border text-gray-700 dark:text-gray-300`
  return `${base} ${variantClasses[props.variant] || variantClasses.default}`
})

const style = computed(() => props.color
  ? { backgroundColor: colorWithAlpha(props.color, 0.12), borderColor: colorWithAlpha(props.color, 0.45) }
  : undefined)
</script>
