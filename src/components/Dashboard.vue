<template>
  <div class="container mx-auto px-6 py-6">
    <!-- Filter bar -->
    <div class="flex items-center justify-between mb-6">
      <FilterSelector
        :filters="filters"
        :activeFilterId="activeFilterId"
        @select-filter="$emit('select-filter', $event)"
        @create-filter="$emit('create-filter')"
        @edit-filter="$emit('edit-filter', $event)"
        @delete-filter="$emit('delete-filter', $event)"
      />
    </div>

    <!-- Summary row -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <MetricCard
        label="Avg Reliability"
        :value="summaryMetrics.avgReliability"
        unit="%"
        :colorThresholds="{ good: 80, warn: 60 }"
        tooltip="Average of each team's weighted commitment reliability across their last 6 closed sprints (total delivered points / total committed points)"
      />
      <MetricCard
        label="Total Velocity"
        :value="summaryMetrics.totalVelocity"
        unit="pts/sprint"
        tooltip="Sum of all filtered teams' average per-sprint velocity. Represents total organizational output per sprint cycle."
      />
      <MetricCard
        label="Below 80%"
        :value="summaryMetrics.belowThresholdCount"
        :subtitle="summaryMetrics.belowThresholdCount === 1 ? 'team below target reliability' : 'teams below target reliability'"
        :warning="summaryMetrics.belowThresholdCount > 0"
        tooltip="Number of filtered teams with weighted commitment reliability below 80%. These teams may need attention."
      />
      <MetricCard
        label="Teams"
        :value="filteredBoards.length"
        subtitle="Enabled and filtered"
      />
    </div>

    <!-- Aggregate trend chart -->
    <div v-if="aggregateTrendData.length > 0" class="bg-white rounded-lg border border-gray-200 p-5 mb-6">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">Aggregate Trend (Monthly)</h3>
      <TrendChart
        :labels="aggregateTrendData.map(d => d.label)"
        :datasets="[
          {
            label: 'Velocity (pts)',
            data: aggregateTrendData.map(d => d.velocityPoints),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.05)',
            yAxisID: 'y'
          },
          {
            label: 'Reliability (%)',
            data: aggregateTrendData.map(d => d.committedPoints > 0 ? Math.round(d.deliveredPoints / d.committedPoints * 100) : null),
            borderColor: '#16a34a',
            backgroundColor: 'rgba(22, 163, 74, 0.05)',
            yAxisID: 'y1'
          }
        ]"
        :scales="trendScales"
      />
    </div>

    <!-- Team grid -->
    <div v-if="filteredBoards.length === 0 && !isLoading" class="text-center py-12">
      <svg class="h-12 w-12 mx-auto text-gray-300 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
      <p class="text-gray-500">No teams found. Go to Board Settings to discover and enable boards.</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <TeamCard
        v-for="board in sortedBoards"
        :key="board.id"
        :board="board"
        :summaryData="getSummaryForBoard(board.id)"
        @select="$emit('select-team', board)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import FilterSelector from './FilterSelector.vue'
import MetricCard from './MetricCard.vue'
import TeamCard from './TeamCard.vue'
import TrendChart from './TrendChart.vue'
import { getAggregateTrend } from '../services/api'
import { formatMonthLabel } from '../utils/metrics'

const props = defineProps({
  boards: { type: Array, default: () => [] },
  dashboardSummary: { type: Object, default: null },
  filters: { type: Array, default: () => [] },
  activeFilterId: { type: String, default: null },
  activeFilter: { type: Object, default: null },
  isLoading: { type: Boolean, default: false }
})

defineEmits(['select-team', 'select-filter', 'create-filter', 'edit-filter', 'delete-filter'])

const aggregateTrendData = ref([])

const filteredBoards = computed(() => {
  if (!props.activeFilter) return props.boards
  const filterBoardIds = new Set(props.activeFilter.boardIds)
  return props.boards.filter(b => filterBoardIds.has(b.id))
})

const summaryMetrics = computed(() => {
  const boards = props.dashboardSummary?.boards || {}
  let reliabilitySum = 0
  let totalVelocity = 0
  let belowThresholdCount = 0
  let teamCount = 0

  for (const board of filteredBoards.value) {
    const data = boards[board.id]
    if (!data?.metrics) continue
    teamCount++
    reliabilitySum += data.metrics.commitmentReliabilityPoints || 0
    totalVelocity += data.metrics.avgVelocityPoints || 0
    if (data.metrics.commitmentReliabilityPoints < 80) {
      belowThresholdCount++
    }
  }

  return {
    avgReliability: teamCount > 0 ? Math.round(reliabilitySum / teamCount) : null,
    totalVelocity: teamCount > 0 ? totalVelocity : null,
    belowThresholdCount
  }
})

const trendScales = {
  x: {
    grid: { display: false },
    ticks: { font: { size: 11 } }
  },
  y: {
    type: 'linear',
    position: 'left',
    beginAtZero: true,
    title: { display: true, text: 'Points', font: { size: 11 } },
    grid: { color: 'rgba(0,0,0,0.05)' },
    ticks: { font: { size: 11 } }
  },
  y1: {
    type: 'linear',
    position: 'right',
    beginAtZero: true,
    suggestedMax: 120,
    title: { display: true, text: 'Reliability %', font: { size: 11 } },
    grid: { drawOnChartArea: false },
    ticks: { font: { size: 11 } }
  }
}

const sortedBoards = computed(() => {
  const boards = props.dashboardSummary?.boards || {}
  return [...filteredBoards.value].sort((a, b) => {
    const aReliability = boards[a.id]?.metrics?.commitmentReliabilityPoints ?? Infinity
    const bReliability = boards[b.id]?.metrics?.commitmentReliabilityPoints ?? Infinity
    return aReliability - bReliability
  })
})

function getSummaryForBoard(boardId) {
  return props.dashboardSummary?.boards?.[boardId] || null
}

// Fetch aggregate trend data when filtered boards change
watch(filteredBoards, async (boards) => {
  if (boards.length === 0) {
    aggregateTrendData.value = []
    return
  }

  try {
    const boardIds = boards.map(b => b.id)
    const data = await getAggregateTrend(boardIds)
    aggregateTrendData.value = (data.months || []).map(m => ({
      ...m,
      label: formatMonthLabel(m.month)
    }))
  } catch (error) {
    console.error('Failed to load aggregate trend:', error)
    aggregateTrendData.value = []
  }
}, { immediate: true })
</script>
