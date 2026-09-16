<script setup>
import { computed } from 'vue'
import { useCategories } from '../composables/useCategories.js'

const props = defineProps({
  category: { type: String, required: true },
  pillars: { type: Array, default: () => [] },
  pillar: { type: Object, default: null }
})

const { getCategoryMeta, normalizePillar, colorWithAlpha } = useCategories()
const meta = computed(() => props.pillar ? normalizePillar(props.pillar) : getCategoryMeta(props.category, props.pillars))
</script>

<template>
  <span
    :class="['inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', meta.bgClass, meta.textClass]"
    :style="{ backgroundColor: colorWithAlpha(meta.color, 0.12), color: meta.color }"
  >
    <span class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: meta.color }"></span>
    {{ meta.shortName }}
  </span>
</template>
