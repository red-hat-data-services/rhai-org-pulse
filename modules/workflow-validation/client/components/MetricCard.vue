<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 px-5 py-4 text-center">
    <div class="text-2xl font-bold font-mono tracking-tight" :class="toneClass">
      {{ value }}
    </div>
    <div class="text-[0.7rem] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mt-1">
      {{ label }}
    </div>
    <div v-if="sub" class="text-[0.7rem] text-gray-400 dark:text-gray-500 mt-0.5">{{ sub }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: [String, Number], default: '—' },
  label: { type: String, required: true },
  sub: { type: String, default: '' },
  tone: { type: String, default: 'neutral' } // neutral | green | red | teal | amber
})

const toneClass = computed(() => ({
  neutral: 'text-gray-900 dark:text-gray-100',
  green: 'text-green-600 dark:text-green-400',
  red: 'text-red-600 dark:text-red-400',
  teal: 'text-teal-600 dark:text-teal-400',
  amber: 'text-amber-600 dark:text-amber-400'
}[props.tone] || 'text-gray-900 dark:text-gray-100'))
</script>
