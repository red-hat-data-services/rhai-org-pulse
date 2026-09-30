<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import { useDraftPlans } from '../composables/useDraftPlans'

const iframeRef = ref(null)
const DEMO_URL = '/ai-first-scheduler/index.html'

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
})

onUnmounted(() => {
  // Clean up message listener
  window.removeEventListener('message', handleIframeMessage)
})
</script>

<template>
  <div class="w-full flex flex-col bg-gray-50 dark:bg-gray-900" style="min-height: calc(100vh - 7rem)">
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
