<template>
  <div class="relative">
    <!-- Loading state -->
    <div
      v-if="isLoading"
      class="flex items-center justify-center py-16"
    >
      <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4" />
        <p class="text-sm text-gray-500">Loading module...</p>
      </div>
    </div>

    <!-- Error state -->
    <div
      v-else-if="hasError"
      class="flex items-center justify-center py-16"
    >
      <div class="text-center">
        <div class="text-red-400 mb-4">
          <AlertTriangle :size="48" class="mx-auto" />
        </div>
        <h3 class="text-lg font-medium text-gray-900 mb-2">Failed to load module</h3>
        <p class="text-sm text-gray-500 mb-4">The module content could not be loaded.</p>
        <button
          v-if="isAdmin"
          @click="$emit('retry-sync')"
          class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
        >
          Retry Sync
        </button>
      </div>
    </div>

    <!-- Not synced state -->
    <div
      v-else-if="!isSynced"
      class="flex items-center justify-center py-16"
    >
      <div class="text-center">
        <div class="text-gray-300 mb-4">
          <Package :size="48" class="mx-auto" />
        </div>
        <h3 class="text-lg font-medium text-gray-900 mb-2">This module hasn't been synced yet</h3>
        <p class="text-sm text-gray-500 mb-4">An admin needs to sync the module content.</p>
        <button
          v-if="isAdmin"
          @click="$emit('trigger-sync')"
          class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
        >
          Sync Now
        </button>
      </div>
    </div>

    <!-- iframe -->
    <iframe
      v-else
      ref="iframeRef"
      :src="iframeSrc"
      :title="moduleName"
      sandbox="allow-scripts allow-same-origin"
      class="w-full border-0"
      style="height: calc(100vh - 4rem)"
      @load="onIframeLoad"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { AlertTriangle, Package } from 'lucide-vue-next'

const props = defineProps({
  slug: { type: String, required: true },
  moduleName: { type: String, default: 'Module' },
  syncStatus: { type: String, default: null },
  isAdmin: Boolean
})

defineEmits(['trigger-sync', 'retry-sync'])

const iframeRef = ref(null)
const isLoading = ref(true)
const hasError = ref(false)
let loadTimeout = null

const isSynced = computed(() => props.syncStatus === 'success')

const iframeSrc = computed(() => `/modules/${props.slug}/index.html`)

function onIframeLoad() {
  isLoading.value = false
  hasError.value = false
  if (loadTimeout) {
    clearTimeout(loadTimeout)
    loadTimeout = null
  }
}

onMounted(() => {
  // 10 second timeout for iframe loading
  if (isSynced.value) {
    loadTimeout = setTimeout(() => {
      if (isLoading.value) {
        hasError.value = true
        isLoading.value = false
      }
    }, 10000)
  } else {
    isLoading.value = false
  }
})

onUnmounted(() => {
  if (loadTimeout) {
    clearTimeout(loadTimeout)
  }
})
</script>
