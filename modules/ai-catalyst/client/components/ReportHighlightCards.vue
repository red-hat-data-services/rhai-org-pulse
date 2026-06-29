<script setup>
import { computed } from 'vue'
import { useCategories } from '../composables/useCategories.js'

const props = defineProps({
  candidates: { type: Array, required: true }
})

const emit = defineEmits(['select'])

const { getCategoryMeta } = useCategories()

const totalCount = computed(() => props.candidates.length)

const sweetSpotCount = computed(() =>
  props.candidates.filter(c =>
    c.impactScore != null && c.impactScore >= 7 &&
    c.feasibilityScore != null && c.feasibilityScore >= 7
  ).length
)

const highestImpact = computed(() => {
  let best = null
  for (const c of props.candidates) {
    if (c.impactScore != null && (!best || c.impactScore > best.impactScore)) {
      best = c
    }
  }
  return best
})

const dominantCategory = computed(() => {
  const counts = {}
  for (const c of props.candidates) {
    const cat = c.category || 'unknown'
    counts[cat] = (counts[cat] || 0) + 1
  }
  let maxKey = null
  let maxCount = 0
  for (const [key, count] of Object.entries(counts)) {
    if (count > maxCount) { maxKey = key; maxCount = count }
  }
  return maxKey ? { key: maxKey, count: maxCount, meta: getCategoryMeta(maxKey) } : null
})

const cards = computed(() => [
  {
    label: 'Total Candidates',
    value: String(totalCount.value),
    subtitle: 'projects discovered',
    borderColor: 'border-blue-500',
    clickable: false
  },
  {
    label: 'Sweet Spot',
    value: String(sweetSpotCount.value),
    subtitle: 'high impact + high feasibility',
    borderColor: 'border-green-500',
    clickable: false
  },
  {
    label: 'Highest Impact',
    value: highestImpact.value?.title || '—',
    subtitle: highestImpact.value
      ? `Impact: ${highestImpact.value.impactScore} · Feasibility: ${highestImpact.value.feasibilityScore ?? '—'}`
      : '',
    borderColor: 'border-purple-500',
    clickable: true,
    candidate: highestImpact.value
  },
  {
    label: 'Dominant Category',
    value: dominantCategory.value?.meta?.shortName || '—',
    subtitle: dominantCategory.value
      ? `${dominantCategory.value.count} of ${totalCount.value} (${Math.round(dominantCategory.value.count / totalCount.value * 100)}%)`
      : '',
    borderColor: 'border-amber-500',
    clickable: false
  }
])
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div
      v-for="(card, i) in cards"
      :key="i"
      data-testid="highlight-card"
      class="bg-white dark:bg-gray-800 rounded-xl border-t-4 border border-gray-200 dark:border-gray-700 px-4 py-3"
      :class="[card.borderColor, card.clickable && card.candidate ? 'cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 transition-colors' : '']"
      @click="card.clickable && card.candidate ? emit('select', card.candidate) : null"
    >
      <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
        {{ card.label }}
      </p>
      <p class="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
        {{ card.value }}
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
        {{ card.subtitle }}
      </p>
    </div>
  </div>
</template>
