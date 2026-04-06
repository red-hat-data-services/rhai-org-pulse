<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-200 group/card"
    :class="{ 'cursor-pointer': clickable }"
    @click="$emit('click')"
  >
    <!-- Row 1: Name + engagement badge + hover chevron -->
    <div class="flex items-start justify-between mb-3">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{{ orgName }}</h3>
      <ChevronRightIcon
        v-if="clickable"
        :size="16"
        class="shrink-0 ml-2 text-gray-300 dark:text-gray-600 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200"
      />
    </div>

    <!-- Row 2: Contribution count + trend -->
    <div class="flex items-baseline gap-2 mb-0.5">
      <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">
        {{ teamContributions.toLocaleString() }}
      </p>
      <span
        v-if="showTrend"
        class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium"
        :class="trendClasses"
      >
        {{ trendArrow }} {{ trendLabel }}
      </span>
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">Team Contributions</p>

    <!-- Row 3: Team share bar -->
    <div class="mb-4">
      <div class="flex items-center justify-between text-xs mb-1.5">
        <span class="text-gray-500 dark:text-gray-400 font-medium">Team share</span>
        <span class="font-semibold text-gray-700 dark:text-gray-300">{{ teamShareLabel }}%</span>
      </div>
      <div class="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
        <div
          class="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
          :style="{ width: Math.min(teamSharePercent, 100) + '%' }"
        ></div>
      </div>
    </div>

    <!-- Row 4: Bottom metadata -->
    <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
      <span v-if="activeTeamMembers > 0" class="flex items-center gap-1">
        <UsersIcon :size="14" class="text-gray-400 dark:text-gray-500" />
        {{ activeTeamMembers }} active
      </span>
      <span v-if="leadershipCount > 0" class="flex items-center gap-1">
        <CrownIcon :size="14" class="text-amber-500" />
        {{ leadershipCount }} {{ leadershipCount === 1 ? 'leader' : 'leaders' }}
      </span>
      <span v-if="maintainerCount > 0" class="flex items-center gap-1">
        <ShieldIcon :size="14" class="text-blue-500" />
        {{ maintainerCount }} {{ maintainerCount === 1 ? 'maintainer' : 'maintainers' }}
      </span>
      <span v-if="projectCount > 0" class="text-gray-400 dark:text-gray-500 ml-auto">
        {{ projectCount }} {{ projectCount === 1 ? 'project' : 'projects' }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  Users as UsersIcon,
  Crown as CrownIcon,
  Shield as ShieldIcon,
  ChevronRight as ChevronRightIcon,
} from 'lucide-vue-next'

defineEmits(['click'])

const props = defineProps({
  orgName: { type: String, default: '' },
  teamContributions: { type: Number, default: 0 },
  totalContributions: { type: Number, default: 0 },
  teamSharePercent: { type: Number, default: 0 },
  percentChange: { type: Number, default: 0 },
  activeTeamMembers: { type: Number, default: 0 },
  leadershipCount: { type: Number, default: 0 },
  maintainerCount: { type: Number, default: 0 },
  projectCount: { type: Number, default: 0 },
  showTrend: { type: Boolean, default: false },
  clickable: { type: Boolean, default: false }
})

const teamShareLabel = computed(() => Number(props.teamSharePercent).toFixed(1))

const trendArrow = computed(() => {
  if (props.percentChange > 0) return '↑'
  if (props.percentChange < 0) return '↓'
  return '→'
})

const trendLabel = computed(() => {
  const abs = Math.abs(props.percentChange)
  const prefix = props.percentChange > 0 ? '+' : ''
  return `${prefix}${abs.toFixed(1)}%`
})

const trendClasses = computed(() => {
  if (props.percentChange > 0) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
  if (props.percentChange < 0) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
  return 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50'
})

</script>
