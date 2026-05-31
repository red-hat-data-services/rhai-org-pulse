<template>
  <div v-if="attachments.length > 0" class="mt-3 flex flex-wrap gap-2">
    <template v-for="att in attachments" :key="att.id">
      <a
        v-if="att.type === 'image'"
        :href="attachmentUrl(att.filename)"
        target="_blank"
        class="block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
      >
        <img
          :src="attachmentUrl(att.filename)"
          :alt="att.original_name"
          class="max-h-[300px] max-w-full object-cover"
          loading="lazy"
        />
      </a>
      <a
        v-else
        :href="attachmentUrl(att.filename)"
        target="_blank"
        class="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600 transition-colors text-sm"
      >
        <span class="text-gray-400">📎</span>
        <span class="text-gray-700 dark:text-gray-300 truncate max-w-[200px]">{{ att.original_name }}</span>
        <span class="text-xs text-gray-400">{{ formatSize(att.size) }}</span>
      </a>
    </template>
  </div>
</template>

<script setup>
import { getApiBase } from '@shared/client/services/api'

defineProps({
  attachments: { type: Array, default: () => [] }
})

function attachmentUrl(filename) {
  return `${getApiBase()}/modules/pulse-social/attachments/${filename}`
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
}
</script>
