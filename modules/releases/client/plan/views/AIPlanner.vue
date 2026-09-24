<script setup>
import { ref, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const iframeRef = ref(null)
const DEMO_URL = '/ai-first-scheduler/index.html'

onMounted(async () => {
  // Wait for iframe to load, then fetch data and send via postMessage
  if (!iframeRef.value) return

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
</script>

<template>
  <div class="h-full w-full bg-gray-50 dark:bg-gray-900">
    <iframe
      ref="iframeRef"
      :src="DEMO_URL"
      class="w-full h-full border-none rounded"
      title="AI-First Release Planner"
      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
    />
  </div>
</template>
