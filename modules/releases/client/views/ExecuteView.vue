<template>
  <div>
    <div class="border-b border-gray-200 dark:border-gray-700">
      <nav class="flex -mb-px px-4" aria-label="Execute sub-tabs" role="tablist">
        <button
          v-for="tab in executeTabs"
          :key="tab.id"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.id"
          :data-testid="'execute-tab-' + tab.id"
          class="px-4 py-3 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === tab.id
            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <div class="p-6">
      <KeepAlive>
        <component
          :is="componentMap[activeTab]"
          :view-mode="activeTab === 'feature-execution' ? viewMode : undefined"
          @update:viewMode="setViewMode"
        />
      </KeepAlive>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, inject } from 'vue'
import ExecuteWorkspaceView from '../execute/views/ExecuteWorkspaceView.vue'
import TechDebtPrioritizationView from '../execute/views/TechDebtPrioritizationView.vue'

const nav = inject('moduleNav')

const executeTabs = [
  { id: 'feature-execution', label: 'Feature Execution' },
  { id: 'tech-debt-prioritization', label: 'Tech Debt Prioritization' }
]

const componentMap = {
  'feature-execution': ExecuteWorkspaceView,
  'tech-debt-prioritization': TechDebtPrioritizationView
}

const LEGACY_TAB_TO_VIEW = {
  'feature-tracking': 'table',
  'feature-list': 'signals',
  'feature-status': 'board'
}

const VALID_TABS = executeTabs.map(function(tab) { return tab.id })
const VALID_VIEWS = ['table', 'board', 'signals']
const DEFAULT_TAB = 'feature-execution'
const DEFAULT_VIEW = 'table'

function resolveTab(params) {
  const tab = params && params.tab
  if (VALID_TABS.includes(tab)) return tab
  if (VALID_VIEWS.includes(tab) || LEGACY_TAB_TO_VIEW[tab]) return DEFAULT_TAB
  return DEFAULT_TAB
}

function resolveView(params) {
  const p = params || {}
  if (p.view && VALID_VIEWS.includes(p.view)) return p.view
  if (p.tab && VALID_VIEWS.includes(p.tab)) return p.tab
  if (p.tab && LEGACY_TAB_TO_VIEW[p.tab]) return LEGACY_TAB_TO_VIEW[p.tab]
  return DEFAULT_VIEW
}

const initialParams = nav && nav.params ? nav.params.value || {} : {}
const activeTab = ref(resolveTab(initialParams))
const viewMode = ref(resolveView(initialParams))

let updatingFromUrl = false

function setViewMode(mode) {
  if (!VALID_VIEWS.includes(mode) || viewMode.value === mode) return
  viewMode.value = mode
}

watch(activeTab, function(tab) {
  if (updatingFromUrl || !nav || !nav.updateParams) return
  nav.updateParams({
    tab: tab,
    view: tab === 'feature-execution' && viewMode.value !== DEFAULT_VIEW
      ? viewMode.value
      : undefined
  })
})

watch(viewMode, function(mode) {
  if (updatingFromUrl || activeTab.value !== 'feature-execution' || !nav || !nav.updateParams) return
  nav.updateParams({
    tab: 'feature-execution',
    view: mode === DEFAULT_VIEW ? undefined : mode
  })
})

if (nav && nav.params) {
  watch(nav.params, function(params) {
    const p = params || {}
    const nextTab = resolveTab(p)
    const nextView = resolveView(p)
    const legacyTab = VALID_VIEWS.includes(p.tab) || Boolean(LEGACY_TAB_TO_VIEW[p.tab])

    updatingFromUrl = true
    activeTab.value = nextTab
    viewMode.value = nextView

    nextTick(function() {
      if (legacyTab && nav.updateParams) {
        nav.updateParams({
          tab: 'feature-execution',
          view: nextView === DEFAULT_VIEW ? undefined : nextView
        }, { push: false })
      }
      updatingFromUrl = false
    })
  }, { immediate: true })
}
</script>
