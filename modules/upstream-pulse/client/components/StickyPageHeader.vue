<template>
  <div class="sticky top-16 z-[9] -mx-6 lg:-mx-8 px-6 lg:px-8 pt-2 pb-3 bg-gray-50 dark:bg-gray-900">
    <div class="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-gray-800 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_-2px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_16px_-2px_rgba(0,0,0,0.35)] ring-1 ring-gray-950/[0.05] dark:ring-white/[0.08] px-4 py-3 overflow-hidden">
      <div v-if="loading" class="absolute inset-x-0 bottom-0 h-[3px] bg-blue-100/50 dark:bg-blue-900/30">
        <div class="h-full w-2/5 bg-blue-500 rounded-full shadow-[0_0_8px_2px_rgba(59,130,246,0.5)] animate-[slideRight_1.2s_ease-in-out_infinite]"></div>
      </div>
      <div class="min-w-0">
        <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{{ title }}</h2>
        <p v-if="subtitle" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{{ subtitle }}</p>
        <slot name="subtitle-extra" />
      </div>
      <div class="flex items-center gap-2.5 shrink-0">
        <PeriodSelector v-model="selectedDays" />
        <slot name="extra" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import PeriodSelector from './PeriodSelector.vue'

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  modelValue: { type: String, required: true },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

const selectedDays = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})
</script>

<style scoped>
@keyframes slideRight {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}
</style>
