<script setup>
import { ref } from 'vue'
import { useDraftPlans } from '../composables/useDraftPlans'

const { session } = useDraftPlans()
const iframeRef = ref(null)

// Pinned to specific commit — update via PR to rhai-org-pulse
const PLANNER_URL = 'https://htmlpreview.github.io/?https://github.com/yuvalluria/rhai-release-planner/blob/9b91bf6/index.html'

function onIframeLoad() {
  const actor = session.value && session.value.actor
  if (!actor || !iframeRef.value) return
  iframeRef.value.contentWindow.postMessage({ type: 'pm-user', actor }, 'https://htmlpreview.github.io')
}
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
