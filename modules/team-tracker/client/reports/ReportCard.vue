<template>
  <button
    @click="$emit('select')"
    :aria-label="'Open ' + title + ' report'"
    class="group text-left bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all duration-200 cursor-pointer"
    data-testid="report-card"
  >
    <div class="flex items-start gap-3">
      <div class="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg text-primary-600 dark:text-primary-400 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/50 transition-colors">
        <component :is="iconComponent" :size="20" />
      </div>
      <div class="flex-1 min-w-0">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{{ title }}</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{{ description }}</p>
      </div>
    </div>
    <div v-if="tags.length > 0" class="flex flex-wrap gap-1.5 mt-3">
      <span
        v-for="tag in tags"
        :key="tag"
        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
      >
        {{ tag }}
      </span>
    </div>
  </button>
</template>

<script setup>
import {
  TrendingUp,
  BarChart3,
  PieChart,
  FileText,
  BarChart2,
} from 'lucide-vue-next'
import { computed } from 'vue'

const ICON_MAP = {
  TrendingUp,
  BarChart3,
  PieChart,
  FileText,
  BarChart2,
}

const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: String, required: true },
  tags: { type: Array, default: () => [] },
})
defineEmits(['select'])

const iconComponent = computed(() => ICON_MAP[props.icon] || BarChart3)
</script>
