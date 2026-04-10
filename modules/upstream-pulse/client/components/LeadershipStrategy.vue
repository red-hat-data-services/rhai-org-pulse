<template>
  <div>
    <!-- Increase Investment -->
    <div v-if="increaseInvestment.length > 0" class="mb-6">
      <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Increase Investment</h4>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <div
          v-for="org in increaseInvestment"
          :key="org.org"
          class="rounded-lg p-3 cursor-pointer transition-all hover:shadow-md"
          :class="org.leads ? 'bg-red-400 dark:bg-red-800/35' : 'bg-gray-200 dark:bg-gray-700/40'"
          @click="$emit('org-click', org.org)"
        >
          <div class="text-sm font-semibold text-center mb-2 text-gray-900 dark:text-gray-100">
            {{ org.orgName }}
          </div>
          <div class="flex flex-wrap gap-1 justify-center">
            <span
              v-if="org.strategicLeadership"
              :class="getStrategicBadgeClass(org.strategicLeadership)"
              class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
            >
              {{ getStrategicLabel(org.strategicLeadership) }}
            </span>
            <span
              v-if="org.strategicParticipation"
              :class="getStrategicBadgeClass(org.strategicParticipation)"
              class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
            >
              {{ getStrategicLabel(org.strategicParticipation) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Sustain Investment -->
    <div v-if="sustainInvestment.length > 0" class="mb-6">
      <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Sustain Investment</h4>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <div
          v-for="org in sustainInvestment"
          :key="org.org"
          class="rounded-lg p-3 cursor-pointer transition-all hover:shadow-md"
          :class="org.leads ? 'bg-red-400 dark:bg-red-800/35' : 'bg-gray-200 dark:bg-gray-700/40'"
          @click="$emit('org-click', org.org)"
        >
          <div class="text-sm font-semibold text-center mb-2 text-gray-900 dark:text-gray-100">
            {{ org.orgName }}
          </div>
          <div class="flex flex-wrap gap-1 justify-center">
            <span
              v-if="org.strategicLeadership"
              :class="getStrategicBadgeClass(org.strategicLeadership)"
              class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
            >
              {{ getStrategicLabel(org.strategicLeadership) }}
            </span>
            <span
              v-if="org.strategicParticipation"
              :class="getStrategicBadgeClass(org.strategicParticipation)"
              class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
            >
              {{ getStrategicLabel(org.strategicParticipation) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Evaluating Investment -->
    <div v-if="evaluatingInvestment.length > 0">
      <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Evaluating Investment</h4>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <div
          v-for="org in evaluatingInvestment"
          :key="org.org"
          class="rounded-lg p-3 cursor-pointer transition-all hover:shadow-md"
          :class="org.leads ? 'bg-red-400 dark:bg-red-800/35' : 'bg-gray-200 dark:bg-gray-700/40'"
          @click="$emit('org-click', org.org)"
        >
          <div class="text-sm font-semibold text-center mb-2 text-gray-900 dark:text-gray-100">
            {{ org.orgName }}
          </div>
          <div class="flex flex-wrap gap-1 justify-center">
            <span
              v-if="org.strategicLeadership"
              :class="getStrategicBadgeClass(org.strategicLeadership)"
              class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
            >
              {{ getStrategicLabel(org.strategicLeadership) }}
            </span>
            <span
              v-if="org.strategicParticipation"
              :class="getStrategicBadgeClass(org.strategicParticipation)"
              class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
            >
              {{ getStrategicLabel(org.strategicParticipation) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="increaseInvestment.length === 0 && sustainInvestment.length === 0 && evaluatingInvestment.length === 0" class="text-center py-8">
      <p class="text-sm text-gray-500 dark:text-gray-400">No organizations with strategic importance assigned</p>
    </div>

    <!-- Legend -->
    <div v-if="increaseInvestment.length > 0 || sustainInvestment.length > 0 || evaluatingInvestment.length > 0" class="flex items-center justify-center gap-6 text-sm mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded bg-red-400 dark:bg-red-800/35"></div>
        <span class="text-gray-600 dark:text-gray-400 font-medium">Red Hat Leads</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded bg-gray-200 dark:bg-gray-700/40"></div>
        <span class="text-gray-600 dark:text-gray-400 font-medium">Red Hat Participates</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

defineEmits(['org-click'])

const props = defineProps({
  orgActivity: {
    type: Array,
    default: () => []
  }
})

const increaseInvestment = computed(() => {
  return props.orgActivity
    .filter(org =>
      org.strategicParticipation === 'increasing_participation' ||
      org.strategicLeadership === 'increasing_leadership'
    )
    .filter(org => org.leadershipCount > 0 || org.total > 0 || org.maintainerCount > 0)
    .map(org => ({
      ...org,
      leads: org.leadershipCount > 0
    }))
})

const sustainInvestment = computed(() => {
  return props.orgActivity
    .filter(org => {
      // No increase tags
      const hasIncrease = org.strategicParticipation === 'increasing_participation' ||
                         org.strategicLeadership === 'increasing_leadership'
      if (hasIncrease) return false

      // Has at least one sustain tag
      return org.strategicParticipation === 'sustaining_participation' ||
             org.strategicLeadership === 'sustaining_leadership'
    })
    .filter(org => org.leadershipCount > 0 || org.total > 0 || org.maintainerCount > 0)
    .map(org => ({
      ...org,
      leads: org.leadershipCount > 0
    }))
})

const evaluatingInvestment = computed(() => {
  return props.orgActivity
    .filter(org => {
      // No increase tags
      const hasIncrease = org.strategicParticipation === 'increasing_participation' ||
                         org.strategicLeadership === 'increasing_leadership'
      if (hasIncrease) return false

      // No sustain tags
      const hasSustain = org.strategicParticipation === 'sustaining_participation' ||
                        org.strategicLeadership === 'sustaining_leadership'
      if (hasSustain) return false

      // Has at least one evaluating tag
      return org.strategicParticipation === 'evaluating_participation' ||
             org.strategicLeadership === 'evaluating_leadership'
    })
    .filter(org => org.leadershipCount > 0 || org.total > 0 || org.maintainerCount > 0)
    .map(org => ({
      ...org,
      leads: org.leadershipCount > 0
    }))
})

function getStrategicLabel(strategic) {
  if (!strategic) return ''
  const labels = {
    'evaluating_participation': 'Evaluating Participation',
    'sustaining_participation': 'Sustaining Participation',
    'increasing_participation': 'Increasing Participation',
    'evaluating_leadership': 'Evaluating Leadership',
    'sustaining_leadership': 'Sustaining Leadership',
    'increasing_leadership': 'Increasing Leadership',
  }
  return labels[strategic] || strategic
}

function getStrategicBadgeClass(strategic) {
  const classes = {
    'evaluating_participation': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    'sustaining_participation': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    'increasing_participation': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    'evaluating_leadership': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    'sustaining_leadership': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    'increasing_leadership': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  }
  return classes[strategic] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
}
</script>
