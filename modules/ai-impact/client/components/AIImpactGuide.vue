<script setup>
import { ref, onMounted } from 'vue'
import AssessmentGuideModal from './AssessmentGuideModal.vue'

const DISMISS_KEY = 'ai-impact-guide-dismissed'

const showGuideModal = ref(false)
const initialTab = ref(null)

onMounted(() => {
  if (localStorage.getItem(DISMISS_KEY) !== 'true') {
    showGuideModal.value = true
  }
})

function closeGuide(dismiss) {
  showGuideModal.value = false
  initialTab.value = null
  if (dismiss) {
    localStorage.setItem(DISMISS_KEY, 'true')
  }
}

function openGuide(tab) {
  initialTab.value = tab || null
  showGuideModal.value = true
}

defineExpose({ openGuide })
</script>

<template>
  <button
    @click="openGuide()"
    class="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center group z-40"
  >
    <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span class="absolute bottom-full right-0 mb-2 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 dark:bg-gray-700 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
      AI Impact Guide
    </span>
  </button>

  <AssessmentGuideModal :show="showGuideModal" :initialTab="initialTab" @close="closeGuide" />
</template>
