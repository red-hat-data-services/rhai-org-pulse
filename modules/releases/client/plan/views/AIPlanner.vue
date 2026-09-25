<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import { useDraftPlans } from '../composables/useDraftPlans'

const iframeRef = ref(null)
const DEMO_URL = '/ai-first-scheduler/index.html'

const {
  approveFeature,
  persist
} = useDraftPlans()

// Handle postMessage from iframe when user adds features to Plan Approval
const handleIframeMessage = async (event) => {
  // Validate origin
  if (event.origin !== window.location.origin) return

  if (event.data.type === 'add-to-draft-plan') {
    try {
      // Each feature in the message
      const features = event.data.features || []
      for (const feature of features) {
        // Add to draft plan
        const result = approveFeature(feature.key, true)
        if (!result || !result.ok) {
          console.warn(`Could not add feature ${feature.key} to Plan Approval`)
        }
      }
      // Persist the changes to Plan Approval
      await persist()
      console.log('Features added to Plan Approval')
    } catch (e) {
      console.error('Failed to add features to Plan Approval:', e)
    }
  }
}

onMounted(async () => {
  // Wait for iframe to load, then fetch data and send via postMessage
  if (!iframeRef.value) return

  // Listen for messages from the iframe
  window.addEventListener('message', handleIframeMessage)

  iframeRef.value.onload = async () => {
    try {
      const snapshot = await apiRequest('/modules/releases/planning/ai-planner')
      // Send data to iframe via postMessage
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
})

onUnmounted(() => {
  // Clean up message listener
  window.removeEventListener('message', handleIframeMessage)
})
</script>

<template>
  <div class="w-full h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
    <iframe
      ref="iframeRef"
      :src="DEMO_URL"
      class="flex-1 w-full border-none"
      title="AI-First Release Planner"
      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
    />
  </div>
</template>
