<template>
  <div class="space-y-6">
    <!-- Headcount Chart -->
    <div v-if="headcount" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Headcount by Role</h3>
      <HeadcountChart :headcount="headcount" />
    </div>

    <!-- Team Members -->
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Team Members
        <span class="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">{{ members.length }} member{{ members.length !== 1 ? 's' : '' }}</span>
      </h3>
      <TeamMembersTable :members="members" :teamKey="teamKey" />
    </div>
  </div>
</template>

<script setup>
import HeadcountChart from './HeadcountChart.vue'
import TeamMembersTable from './TeamMembersTable.vue'

defineProps({
  headcount: { type: Object, default: null },
  members: { type: Array, default: () => [] },
  teamKey: { type: String, default: null }
})
</script>
