<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const PRODUCT_LABELS = {
  'rhel-ai': 'RHEL AI',
  'base-images': 'Base Images',
  'builder-images': 'Builder Images',
  'wheel-collections': 'Wheel Collections',
}

function getKey() {
  const hash = window.location.hash || ''
  const parts = hash.replace('#/', '').split('?')[0].split('/')
  return parts[1] || ''
}

const productKey = ref(getKey())
const productLabel = ref(PRODUCT_LABELS[productKey.value] || productKey.value)

function onHashChange() {
  productKey.value = getKey()
  productLabel.value = PRODUCT_LABELS[productKey.value] || productKey.value
}

onMounted(() => window.addEventListener('hashchange', onHashChange))
onUnmounted(() => window.removeEventListener('hashchange', onHashChange))
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ productLabel }}</h1>
    </div>
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center">
      <p class="text-sm text-gray-500 dark:text-gray-400">This product view is not yet implemented.</p>
    </div>
  </div>
</template>
