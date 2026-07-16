<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import PmIdentityBar from '../components/PmIdentityBar.vue'
import PlanningPrepView from './PlanningPrepView.vue'
import MyPipelineView from './MyPipelineView.vue'
import LearnView from './LearnView.vue'
import DetailDrawer from '../components/DetailDrawer.vue'
import CopyToast from '../components/CopyToast.vue'
import { usePmIdentity } from '../composables/usePmIdentity.js'
import { usePipeline } from '../composables/usePipeline.js'
import { buildPlanningPrepMarkdown, copyToClipboard } from '../utils/export-markdown.js'

const VIEW_TO_TAB = {
  'planning-prep': 'planning',
  'my-pipeline': 'pipeline',
  'learn': 'learn'
}

function readActiveTabFromHash() {
  const hash = window.location.hash || ''
  const match = hash.match(/#\/pm-pipeline\/([^?]+)/)
  const viewId = match?.[1] || 'planning-prep'
  return VIEW_TO_TAB[viewId] || 'planning'
}

const activeTab = ref(readActiveTabFromHash())

function onHashChange() {
  activeTab.value = readActiveTabFromHash()
}

onMounted(() => {
  window.addEventListener('hashchange', onHashChange)
})

onUnmounted(() => {
  window.removeEventListener('hashchange', onHashChange)
})

const {
  user,
  pmDisplayName,
  viewAsPm,
  effectivePmDisplayName,
  isViewAsActive,
  impersonationLabel,
  release,
  clearViewAs
} = usePmIdentity()

const {
  loading,
  error,
  data,
  items,
  stats,
  heroItem,
  actionGroups,
  waitingItems,
  load
} = usePipeline(effectivePmDisplayName, release)

const localName = ref(pmDisplayName.value)
const localViewAs = ref(viewAsPm.value)
const localRelease = ref(release.value)
const selectedItem = ref(null)
const toastShow = ref(false)
const toastMessage = ref('Copied to clipboard')

watch(pmDisplayName, (v) => { localName.value = v })
watch(viewAsPm, (v) => { localViewAs.value = v })
watch(release, (v) => { localRelease.value = v })

watch(effectivePmDisplayName, (name) => {
  if (name?.trim()) load()
}, { immediate: true })

const bannerText = computed(() => {
  if (isViewAsActive.value) {
    return effectivePmDisplayName.value
  }
  if (impersonationLabel.value && effectivePmDisplayName.value) {
    return `${effectivePmDisplayName.value} (via impersonation)`
  }
  return null
})

function handleLoad() {
  pmDisplayName.value = localName.value
  viewAsPm.value = localViewAs.value
  release.value = localRelease.value
  load()
}

function openItem(item) {
  selectedItem.value = item
}

async function handleExport() {
  if (!data.value) return
  const md = buildPlanningPrepMarkdown({
    pmDisplayName: effectivePmDisplayName.value,
    release: release.value,
    stats: stats.value,
    items: items.value,
    fetchedAt: data.value.fetchedAt
  })
  const ok = await copyToClipboard(md)
  toastMessage.value = ok
    ? 'Planning prep copied — paste into Confluence or your notes'
    : 'Copy failed — see browser console'
  toastShow.value = true
  if (!ok) console.log(md)
  setTimeout(() => { toastShow.value = false }, 3500)
}
</script>

<template>
  <div class="min-h-full bg-gray-50 dark:bg-gray-900">
    <div
      v-if="bannerText"
      class="bg-amber-100 dark:bg-amber-900/40 border-b border-amber-300 dark:border-amber-700 px-4 py-2 text-sm text-amber-900 dark:text-amber-100 text-center"
    >
      Viewing <strong>{{ bannerText }}</strong>'s pipeline
      <span v-if="user"> (signed in as {{ user.displayName || user.email }})</span>
      <button
        v-if="isViewAsActive"
        type="button"
        class="ml-3 underline font-medium"
        @click="clearViewAs(); localViewAs = ''; load()"
      >
        Exit view-as
      </button>
    </div>

    <PmIdentityBar
      v-model:pm-display-name="localName"
      v-model:view-as-pm="localViewAs"
      v-model:release="localRelease"
      :loading="loading"
      :user="user"
      @load="handleLoad"
    />

    <PlanningPrepView
      v-show="activeTab === 'planning'"
      :stats="stats"
      :hero-item="heroItem"
      :action-groups="actionGroups"
      :waiting-items="waitingItems"
      :loading="loading"
      :error="error"
      :fetched-at="data?.fetchedAt"
      @select="openItem"
      @export="handleExport"
    />
    <MyPipelineView
      v-show="activeTab === 'pipeline'"
      :items="items"
      :loading="loading"
      :error="error"
      @select="openItem"
    />
    <LearnView v-show="activeTab === 'learn'" />

    <DetailDrawer :item="selectedItem" @close="selectedItem = null" />
    <CopyToast :show="toastShow" :message="toastMessage" />
  </div>
</template>
