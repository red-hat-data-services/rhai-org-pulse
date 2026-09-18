<template>
  <span
    class="inline-block px-2.5 py-0.5 rounded-full text-[0.7rem] font-semibold uppercase tracking-wide whitespace-nowrap"
    :class="cls"
  >{{ display }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: String, default: '' }
})

const KEY = computed(() => String(props.value || '').toUpperCase())

const display = computed(() => {
  if (!props.value) return 'Unknown'
  return String(props.value).replace(/_/g, ' ')
})

// Palette echoing the reference validation report (pass green / fail red /
// category-specific hues), adapted for light + dark.
const MAP = {
  PASS: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  FAIL: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  SKIP: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  // bug categories
  PRODUCT_BUG: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  ENVIRONMENT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  SPEC_DEFECT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  AUTOMATION_BUG: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  CREDENTIAL_EXPOSURE: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  // bug actions
  FILED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  EXISTING: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  SPEC_FIX: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  MATCH: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  NONE: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  // confidence
  HIGH: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
}

const cls = computed(() => MAP[KEY.value] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300')
</script>
