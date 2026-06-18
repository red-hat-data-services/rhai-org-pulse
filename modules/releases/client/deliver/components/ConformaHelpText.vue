<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

defineProps({
  good: { type: String, default: '' },
  attention: { type: String, default: '' },
  action: { type: String, default: '' }
})

const open = ref(false)
const root = ref(null)

function toggle(e) {
  e.stopPropagation()
  open.value = !open.value
}

function onDocClick(e) {
  if (open.value && root.value && !root.value.contains(e.target)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div ref="root" class="relative inline-block">
    <button
      @click="toggle"
      class="inline-flex items-center justify-center w-5 h-5 rounded-full text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
      title="Help"
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
      </svg>
    </button>
    <div
      v-if="open"
      class="absolute z-50 right-0 top-7 w-72 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-3 space-y-2 text-xs"
    >
      <div v-if="good" class="flex gap-2">
        <span class="mt-0.5 w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
        <div>
          <span class="font-semibold text-emerald-700 dark:text-emerald-400">Good: </span>
          <span class="text-gray-600 dark:text-gray-300">{{ good }}</span>
        </div>
      </div>
      <div v-if="attention" class="flex gap-2">
        <span class="mt-0.5 w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
        <div>
          <span class="font-semibold text-amber-700 dark:text-amber-400">Needs Attention: </span>
          <span class="text-gray-600 dark:text-gray-300">{{ attention }}</span>
        </div>
      </div>
      <div v-if="action" class="flex gap-2">
        <span class="mt-0.5 w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
        <div>
          <span class="font-semibold text-blue-700 dark:text-blue-400">Action: </span>
          <span class="text-gray-600 dark:text-gray-300">{{ action }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
