<script setup>
import { computed } from 'vue'
import { useCategories } from '../composables/useCategories.js'

const props = defineProps({
  score: { type: Number, default: null },
  label: { type: String, default: '' },
  estimated: { type: Boolean, default: false }
})

const { getScoreClasses } = useCategories()
const classes = computed(() => getScoreClasses(props.score))
const displayScore = computed(() => props.score != null ? props.score.toFixed(1) : '—')
</script>

<template>
  <div class="flex flex-col items-center gap-0.5">
    <div
      :class="[
        'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold',
        classes,
        estimated ? 'border-2 border-dashed border-current' : ''
      ]"
    >
      {{ displayScore }}
    </div>
    <span v-if="label" class="text-[10px] text-gray-500 dark:text-gray-400 leading-tight text-center">{{ label }}</span>
  </div>
</template>
