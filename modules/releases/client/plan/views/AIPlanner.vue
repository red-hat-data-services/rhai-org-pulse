<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import { useDraftPlans } from '../composables/useDraftPlans'

const iframeRef = ref(null)
const containerRef = ref(null)
const containerHeight = ref('600px')
const DEMO_URL = '/ai-first-scheduler/index.html'

// The Plan tab wraps its content in a height-less div, so h-full collapses and the iframe is
// left at whatever min-height we give it — half a screen on a 1080p display. Measure the space
// actually remaining below the container instead. TAB_GUTTER matches that wrapper's p-6 padding.
const TAB_GUTTER = 24
let layoutObserver = null

function syncContainerHeight() {
  if (!containerRef.value) return
  const top = containerRef.value.getBoundingClientRect().top
  containerHeight.value = Math.max(400, window.innerHeight - top - TAB_GUTTER) + 'px'
}

const {
  draft,
  selectedVersion,
  approveFeature,
  loadCycles,
  loadEditor,
  persist
} = useDraftPlans()

async function ensureDraftPlanLoaded() {
  if (draft.value && draft.value.version === selectedVersion.value) return true
  try {
    await loadCycles('RHOAI')
    await loadEditor(selectedVersion.value)
  } catch {
    return false
  }
  return !!draft.value
}

const handleIframeMessage = async (event) => {
  if (event.origin !== window.location.origin) return

  if (event.data.type === 'add-to-draft-plan') {
    // If iframe specifies a version, load that version first
    if (event.data.version && event.data.version !== selectedVersion.value) {
      try {
        await loadEditor(event.data.version)
      } catch (e) {
        console.warn(`Could not load version ${event.data.version}:`, e)
        return
      }
    }

    if (!await ensureDraftPlanLoaded()) {
      console.warn('Plan Approval data is unavailable')
      return
    }
    try {
      const features = event.data.features || []
      let anyApproved = false
      for (const feature of features) {
        const result = approveFeature(feature.key, true)
        if (!result || !result.ok) {
          console.warn(`Could not add feature ${feature.key} to Plan Approval`)
        } else {
          anyApproved = true
        }
      }
      if (anyApproved) {
        await persist()
      }
    } catch (e) {
      console.error('Failed to add features to Plan Approval:', e)
    }
  }
}

// Send data to iframe via postMessage
const sendDataToIframe = async () => {
  if (!iframeRef.value) return
  try {
    const snapshot = await apiRequest('/modules/releases/planning/ai-planner')
    iframeRef.value.contentWindow.postMessage({
      type: 'ai-planner-data',
      features: snapshot.features || [],
      bugQueue: snapshot.bugQueue || [],
      capacity: snapshot.capacity || {},
      cveReserve: snapshot.cveReserve || {},
      lastSyncedAt: snapshot.lastSyncedAt || new Date().toISOString()
    }, window.location.origin)
  } catch (e) {
    console.error('Failed to load AI Planner data:', e)
  }
}

onMounted(() => {
  // Listen for messages from the iframe
  window.addEventListener('message', handleIframeMessage)
  syncContainerHeight()
  window.addEventListener('resize', syncContainerHeight)
  // Banners above the tab can be dismissed at runtime, which shifts the container upwards.
  // Resize on the next frame so the write lands outside the observer's delivery cycle,
  // which is what otherwise surfaces as a ResizeObserver loop error.
  layoutObserver = new ResizeObserver(() => requestAnimationFrame(syncContainerHeight))
  layoutObserver.observe(document.body)
})

onUnmounted(() => {
  // Clean up message listener
  window.removeEventListener('message', handleIframeMessage)
  window.removeEventListener('resize', syncContainerHeight)
  if (layoutObserver) layoutObserver.disconnect()
})
</script>

<template>
  <div ref="containerRef" class="w-full flex flex-col bg-gray-50 dark:bg-gray-900" :style="{ height: containerHeight }">
    <iframe
      ref="iframeRef"
      :src="DEMO_URL"
      class="flex-1 w-full border-none"
      title="AI-First Release Planner"
      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
      @load="sendDataToIframe"
    />
  </div>
</template>
