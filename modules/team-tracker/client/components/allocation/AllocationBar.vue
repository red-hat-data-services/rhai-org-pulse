<template>
  <div class="w-full">
    <div v-if="total === 0" data-testid="no-data" class="h-6 bg-gray-100 dark:bg-gray-700 rounded text-center text-xs text-gray-400 dark:text-gray-500 leading-6">
      {{ metricMode === 'counts' ? 'No issues' : 'No points' }}
    </div>
    <div v-else class="relative h-6 rounded overflow-visible flex">
      <div
        v-for="(seg, i) in segments"
        :key="seg.key"
        :data-testid="`segment-${seg.key}`"
        class="group/seg relative h-full flex items-center justify-center text-xs font-medium cursor-default"
        :class="[
          `bg-${seg.color}-400 text-${seg.color}-900`,
          i === 0 ? 'rounded-l' : '',
          seg.isLast ? 'rounded-r' : ''
        ]"
        :style="{ width: seg.percent + '%' }"
        :title="`${seg.name}: ${seg.value} ${unitLabel} (${seg.percent}%)`"
      >
        <span v-if="seg.percent >= 10">{{ seg.percent }}%</span>
        <div data-testid="tooltip" class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-900 text-white text-xs font-medium rounded shadow-lg whitespace-nowrap opacity-0 group-hover/seg:opacity-100 pointer-events-none transition-opacity z-10">
          {{ seg.name }}: {{ seg.percent }}%
          <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>

      <!-- Dynamic target markers at cumulative category boundaries -->
      <div
        v-for="marker in targetMarkers"
        :key="'marker-' + marker"
        data-testid="target-marker"
        class="absolute top-0 bottom-0 w-px border-l border-dashed border-gray-600 opacity-50"
        :style="{ left: marker + '%' }"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAllocationStrategy } from '../../composables/useAllocationStrategy'

const { categories } = useAllocationStrategy()

const props = defineProps({
  buckets: {
    type: Object,
    required: true
  },
  totalPoints: {
    type: Number,
    required: true
  },
  totalCount: {
    type: Number,
    default: 0
  },
  metricMode: {
    type: String,
    default: 'points'
  }
})

const unitLabel = computed(() => props.metricMode === 'counts' ? 'issues' : 'pts')

const total = computed(() => {
  return props.metricMode === 'counts' ? props.totalCount : props.totalPoints
})

function bucketValue(key) {
  const bucket = props.buckets[key]
  if (!bucket) return 0
  if (props.metricMode === 'counts') return bucket.count || 0
  return bucket.points || 0
}

const allCategories = computed(() => [
  ...categories.value,
  { key: 'uncategorized', name: 'Uncategorized', color: 'gray', target: 0 }
])

const segments = computed(() => {
  if (total.value === 0) return []
  const visible = allCategories.value
    .map(cat => ({
      key: cat.key,
      name: cat.name,
      color: cat.color,
      value: bucketValue(cat.key),
      percent: Math.round(bucketValue(cat.key) / total.value * 100)
    }))
    .filter(s => s.percent > 0)
  // Mark the last visible segment for rounded corners
  if (visible.length > 0) {
    visible[visible.length - 1].isLast = true
  }
  return visible
})

const targetMarkers = computed(() => {
  const markers = []
  let cumulative = 0
  const cats = categories.value
  for (let i = 0; i < cats.length - 1; i++) {
    cumulative += cats[i].target
    markers.push(cumulative)
  }
  return markers
})
</script>
