<script setup>
import { computed } from 'vue'
import { useCategories } from '../composables/useCategories.js'

const props = defineProps({
  category: { type: String, required: true }
})

const { getCategoryMeta } = useCategories()
const meta = computed(() => getCategoryMeta(props.category))
</script>

<template>
  <span :class="['inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', meta.bgClass, meta.textClass]">
    <span :class="['w-1.5 h-1.5 rounded-full', meta.dotClass]"></span>
    {{ meta.shortName }}
  </span>
</template>
