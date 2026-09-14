<template>
  <div>
    <ScheduleView v-if="activeView === 'release-schedule'" @show-aipcc="activeView = 'aipcc-milestones'" />
    <AipccMilestonesView v-else @show-schedule="activeView = 'release-schedule'" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ScheduleView from './ScheduleView.vue'
import AipccMilestonesView from './AipccMilestonesView.vue'

const activeView = ref('release-schedule')
</script>
