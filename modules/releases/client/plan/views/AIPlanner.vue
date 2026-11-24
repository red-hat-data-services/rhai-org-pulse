<script setup>
import { ref, onMounted, watch } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import { useFeatureScheduling } from '../composables/useFeatureScheduling'
import { useClickOutside } from '../composables/useClickOutside'
import { PM_ACTORS } from '../ai-planner/constants.js'
import FeatureSchedulingPreview from './FeatureSchedulingPreview.vue'
import ExecutivePreview from './ExecutivePreview.vue'
import ArchitecturePreview from './ArchitecturePreview.vue'
import DataAppendixPreview from './DataAppendixPreview.vue'

// Nov 11 2026 cutover: this tab now renders the native Vue port directly,
// replacing the <iframe src="/ai-first-scheduler/index.html"> + postMessage
// round-trip. public/ai-first-scheduler/index.html is left in place (not
// deleted) but is no longer referenced here; production validation of this
// native version is a separate, later decision. See AI-PLANNER-HANDOFF.md and
// the Nov 3 2026 migration plan.
//
// Sub-tabs match index.html's "main-tab-bar" as of PR #1877 (Roadmap dropped,
// its cards/release-selector folded into Executive) -- just Feature Scheduling
// and Executive. Architecture and Data Appendix are reachable the same way
// index.html exposes them: the ☰ hamburger menu, not a main tab.
//
// Removed rather than carried forward: the postMessage-based "Add to Plan"
// write path (addFeaturesToPlan/candidateFromPlannerRow, useDraftPlans,
// the Toast notification) that used to live here. It only existed to handle
// 'add-to-draft-plan' messages from the iframe's Add-to-Plan button; neither
// FeatureSchedulingPreview.vue nor ExecutivePreview.vue has that button (that
// integration is explicitly out of scope -- see prior stage-1d scoping notes),
// so the handler had no sender left and was dead code. Rebuilding an
// equivalent trigger is stage 1d's job, not this cutover's.
//
// Also not ported: the ?user= URL query-param handshake (resolvePlannerUrl())
// that used to tell the sandboxed iframe who was signed in. That was a
// workaround for the iframe being a separate browsing context; native Vue
// here already runs inside the authenticated app shell, so the signed-in PM
// is resolved directly below instead (same draft-plans/access endpoint, same
// PM_ACTORS lookup, same localStorage key the iframe itself used for
// cross-session persistence -- just no URL round-trip needed). Also not
// ported: the postMessage-driven userRole/engLead/ENG_COMPONENTS tab-default
// logic (index.html lines ~3024-3031) -- it depends on 'pm-user'/'eng-user'
// messages that AIPlanner.vue never actually sent even in the iframe era, so
// it was already dead in production, not something this cutover removes.

const SELECTED_PM_STORAGE_KEY = 'selectedPm' // same key index.html's applyPmFilter()/restoreMyComp() use

const { filters } = useFeatureScheduling()

const SUB_TABS = [
  { id: 'features', label: '📋 Feature Scheduling' },
  { id: 'executive', label: '📊 Executive' }
]
const activeSubTab = ref('features')
// Latch pattern matching PlanView.vue's own `plannerOpened` -- mount each
// sub-tab's component once, on first visit, and keep it mounted (v-show) so
// switching tabs doesn't re-trigger useFeatureScheduling's onMounted fetch.
const featuresOpened = ref(true)
const executiveOpened = ref(false)
watch(activeSubTab, tab => {
  if (tab === 'executive') executiveOpened.value = true
})

const hamburgerOpen = ref(false)
const hamburgerRef = ref(null)
const hamburgerView = ref(null) // null | 'architecture' | 'data-appendix'

useClickOutside(hamburgerRef, () => { hamburgerOpen.value = false })

function openHamburgerView(view) {
  hamburgerView.value = view
  hamburgerOpen.value = false
}

function backToFeatures() {
  hamburgerView.value = null
}

async function resolvePmFromSession() {
  try {
    const access = await apiRequest('/modules/releases/draft-plans/access')
    const uid = (access && access.session && access.session.uid) || ''
    const actor = uid.split('@')[0].toLowerCase()
    const pm = PM_ACTORS[actor]
    if (pm) {
      filters.value = { ...filters.value, pm }
      return
    }
  } catch {
    // Signed-in identity is unavailable; fall back to the last manual selection.
  }
  const saved = localStorage.getItem(SELECTED_PM_STORAGE_KEY)
  if (saved) filters.value = { ...filters.value, pm: saved }
}

// Persist manual PM filter changes the same way index.html's applyPmFilter() does,
// so the selection survives a reload even without a resolvable session actor.
watch(() => filters.value.pm, pm => {
  if (pm) localStorage.setItem(SELECTED_PM_STORAGE_KEY, pm)
  else localStorage.removeItem(SELECTED_PM_STORAGE_KEY)
})

onMounted(() => {
  resolvePmFromSession()
})
</script>

<template>
  <div class="w-full bg-gray-50 dark:bg-gray-900">
    <div v-if="!hamburgerView" class="flex items-center border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2">
      <button
        v-for="tab in SUB_TABS"
        :key="tab.id"
        type="button"
        @click="activeSubTab = tab.id"
        class="px-4 py-3 text-sm font-medium border-b-2 transition-colors"
        :class="activeSubTab === tab.id
          ? 'border-primary-500 text-primary-600 dark:text-primary-400'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
      >{{ tab.label }}</button>

      <div ref="hamburgerRef" class="relative ml-auto my-2 mr-2">
        <button
          type="button"
          @click="hamburgerOpen = !hamburgerOpen"
          title="Architecture & Data Appendix"
          class="text-base px-2.5 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-300 font-bold"
        >☰</button>
        <div
          v-if="hamburgerOpen"
          class="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[170px] py-1 z-50"
        >
          <div
            @click="openHamburgerView('architecture')"
            class="px-4 py-2 text-xs text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
          >🏗 Architecture</div>
          <div
            @click="openHamburgerView('data-appendix')"
            class="px-4 py-2 text-xs text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
          >📊 Data Appendix</div>
        </div>
      </div>
    </div>

    <div v-if="hamburgerView" class="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <button
        type="button"
        @click="backToFeatures"
        class="text-xs px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-primary-600 dark:text-blue-400 font-semibold"
      >← Back to Features</button>
    </div>

    <ArchitecturePreview v-if="hamburgerView === 'architecture'" />
    <DataAppendixPreview v-else-if="hamburgerView === 'data-appendix'" />
    <template v-else>
      <FeatureSchedulingPreview v-if="featuresOpened" v-show="activeSubTab === 'features'" />
      <ExecutivePreview v-if="executiveOpened" v-show="activeSubTab === 'executive'" />
    </template>
  </div>
</template>
