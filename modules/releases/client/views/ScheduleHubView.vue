<template>
  <div>
    <ScheduleView
      v-if="activeView === 'release-schedule'"
      :initial-products="routePills"
      @products-change="showScheduleProducts"
      @show-aipcc="showAipccMilestones"
    />
    <AipccMilestonesView v-else @show-schedule="showReleaseSchedule" />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import ScheduleView from './ScheduleView.vue'
import AipccMilestonesView from './AipccMilestonesView.vue'

const AIPCC_ROUTE_SEGMENT = 'aipcc'

function currentHashRoute() {
  const [path, query = ''] = (window.location.hash || '').split('?')
  const segments = path.replace(/^#\/?/, '').split('/').filter(Boolean)
  return { segments, query }
}

function viewFromHash() {
  const { segments } = currentHashRoute()
  return segments.at(-1) === AIPCC_ROUTE_SEGMENT ? 'aipcc-milestones' : 'release-schedule'
}

const activeView = ref(viewFromHash())
const routePills = ref(currentHashRoute().segments.slice(2))

function syncViewFromHash() {
  activeView.value = viewFromHash()
  routePills.value = currentHashRoute().segments.slice(2)
}

function navigateToPills(pills) {
  const { segments, query } = currentHashRoute()
  const nextSegments = segments.slice(0, 2).concat(pills)

  const hash = `#/${nextSegments.join('/')}${query ? `?${query}` : ''}`
  if (window.location.hash !== hash) {
    window.location.hash = hash
    syncViewFromHash()
  }
}

function showAipccMilestones() {
  navigateToPills([AIPCC_ROUTE_SEGMENT])
}

function showReleaseSchedule() {
  navigateToPills([])
}

function showScheduleProducts(products) {
  navigateToPills(products)
}

onMounted(() => {
  window.addEventListener('hashchange', syncViewFromHash)
})

onUnmounted(() => {
  window.removeEventListener('hashchange', syncViewFromHash)
})
</script>
