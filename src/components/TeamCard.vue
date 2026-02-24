<template>
  <div
    class="bg-white rounded-lg border border-gray-200 p-5 cursor-pointer hover:border-primary-300 hover:shadow-md transition-all"
    @click="$emit('select')"
  >
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-semibold text-gray-900 truncate">{{ displayName }}</h3>
      <span v-if="metrics" class="text-xs text-gray-400">{{ metrics.sprintsUsed }} sprint avg</span>
    </div>

    <div v-if="metrics" class="grid grid-cols-3 gap-3">
      <div>
        <div class="flex items-center gap-1">
          <p class="text-xs text-gray-500">Reliability</p>
          <MethodologyInfo text="Weighted commitment reliability across recent sprints: total delivered points / total committed points. Higher is better — 80%+ is strong." />
        </div>
        <p class="text-lg font-bold" :class="reliabilityColor">{{ metrics.commitmentReliabilityPoints }}%</p>
      </div>
      <div>
        <div class="flex items-center gap-1">
          <p class="text-xs text-gray-500">Avg Velocity</p>
          <MethodologyInfo text="Average story points delivered per sprint. Measures how much work the team typically completes each sprint." />
        </div>
        <p class="text-lg font-bold text-gray-900">{{ metrics.avgVelocityPoints }} <span class="text-xs font-normal text-gray-400">pts</span></p>
      </div>
      <div>
        <div class="flex items-center gap-1">
          <p class="text-xs text-gray-500">Avg Scope Change</p>
          <MethodologyInfo text="Average number of issues added or removed per sprint after the sprint started. Lower means more stable sprint planning." />
        </div>
        <p class="text-lg font-bold text-gray-900">{{ metrics.avgScopeChange }}</p>
      </div>
    </div>

    <div v-else class="text-sm text-gray-400 italic">No sprint data available</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import MethodologyInfo from './MethodologyInfo.vue'

const props = defineProps({
  board: { type: Object, required: true },
  summaryData: { type: Object, default: null }
})

defineEmits(['select'])

const displayName = computed(() =>
  props.board.displayName || props.board.name
)

const metrics = computed(() =>
  props.summaryData?.metrics || null
)

const reliabilityColor = computed(() => {
  const val = metrics.value?.commitmentReliabilityPoints
  if (val == null) return 'text-gray-900'
  if (val >= 80) return 'text-green-600'
  if (val >= 60) return 'text-amber-600'
  return 'text-red-600'
})
</script>
