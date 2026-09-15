<script setup>
import { ref, inject, onMounted, onUnmounted } from 'vue'
import { useDraftPlans } from '../composables/useDraftPlans'

const { session, approveFeature, persist, filterDecision } = useDraftPlans()
const iframeRef = ref(null)
const moduleNav = inject('moduleNav', null)

const PLANNER_URL = 'https://htmlpreview.github.io/?https://github.com/yuvalluria/rhai-release-planner/blob/06f84e5/index.html'

function onIframeLoad() {
  const actor = session.value && session.value.actor
  if (!actor || !iframeRef.value) return
  iframeRef.value.contentWindow.postMessage({ type: 'pm-user', actor }, 'https://htmlpreview.github.io')
}

function onMessage(e) {
  if (e.origin !== 'https://htmlpreview.github.io') return
  if (!e.data || e.data.type !== 'add-to-draft-plan') return
  if (!Array.isArray(e.data.features)) return
  const features = e.data.features
  features.forEach(f => approveFeature(f.key, true))
  if (features.length > 0) {
    persist()
    filterDecision.value = 'approved'
    if (moduleNav && moduleNav.updateParams) {
      moduleNav.updateParams({ tab: 'draft-plans' }, { push: false })
    }
  }
}

onMounted(() => window.addEventListener('message', onMessage))
onUnmounted(() => window.removeEventListener('message', onMessage))
</script>

<template>
  <div class="ai-planner-container" style="width: 100%; height: calc(100vh - 120px);">
    <iframe
      ref="iframeRef"
      :src="PLANNER_URL"
      style="width: 100%; height: 100%; border: none;"
      title="AI-First Release Planner"
      sandbox="allow-scripts allow-same-origin"
      @load="onIframeLoad"
    />
  </div>
</template>
