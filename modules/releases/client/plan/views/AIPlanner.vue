<script setup>
import { ref, inject, onMounted, onUnmounted } from 'vue'
import { useDraftPlans } from '../composables/useDraftPlans'

const { session, approveFeature, persist, filterDecision } = useDraftPlans()
const iframeRef = ref(null)
const moduleNav = inject('moduleNav', null)

const PLANNER_URL = 'https://htmlpreview.github.io/?https://github.com/yuvalluria/rhai-release-planner/blob/c5d4ebc/index.html'

function onIframeLoad() {
  const actor = session.value && session.value.actor
  if (!actor || !iframeRef.value) return
  iframeRef.value.contentWindow.postMessage({ type: 'pm-user', actor }, 'https://htmlpreview.github.io')
}

function onMessage(e) {
  if (e.origin !== 'https://htmlpreview.github.io') return
  if (!e.data || e.data.type !== 'add-to-draft-plan') return
  const features = e.data.features || []
  let approved = 0
  features.forEach(f => {
    const result = approveFeature(f.key, true)
    if (result && result.ok) approved++
  })
  if (approved > 0) {
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
