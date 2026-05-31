<template>
  <div>
    <!-- Drop zone / button -->
    <div
      ref="dropZone"
      @dragover.prevent="dragActive = true"
      @dragleave="dragActive = false"
      @drop.prevent="handleDrop"
      @click="triggerFileInput"
      class="flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg cursor-pointer transition-colors"
      :class="dragActive
        ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-600'
        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'"
    >
      <span class="text-gray-400 text-sm">📷</span>
      <span class="text-xs text-gray-500 dark:text-gray-400">
        {{ dragActive ? 'Drop file here' : 'Add image or file' }}
      </span>
    </div>

    <input
      ref="fileInput"
      type="file"
      class="hidden"
      accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.md"
      @change="handleFileSelect"
    />

    <!-- Preview of selected files -->
    <div v-if="files.length > 0" class="mt-2 space-y-1">
      <div v-for="(file, index) in files" :key="index" class="flex items-center gap-2 text-sm">
        <span class="text-gray-400">{{ file.type.startsWith('image/') ? '🖼️' : '📎' }}</span>
        <span class="text-gray-700 dark:text-gray-300 truncate flex-1">{{ file.name }}</span>
        <span class="text-xs text-gray-400">{{ formatSize(file.size) }}</span>
        <button @click="removeFile(index)" class="text-gray-400 hover:text-red-500 cursor-pointer text-xs">✕</button>
      </div>
    </div>

    <!-- Upload progress -->
    <div v-if="uploading" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
      Uploading {{ uploadingIndex + 1 }} of {{ files.length }}...
    </div>

    <!-- Error -->
    <div v-if="error" class="mt-1 text-xs text-red-500">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { getApiBase } from '@shared/client/services/api'
import { impersonatingUid } from '@shared/client/state/impersonation'

const emit = defineEmits(['uploaded'])

const fileInput = ref(null)
const files = ref([])
const dragActive = ref(false)
const uploading = ref(false)
const uploadingIndex = ref(0)
const error = ref(null)

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileSelect(e) {
  addFiles(e.target.files)
  e.target.value = ''
}

function handleDrop(e) {
  dragActive.value = false
  addFiles(e.dataTransfer.files)
}

function addFiles(fileList) {
  error.value = null
  const maxFiles = 5
  for (const f of fileList) {
    if (files.value.length >= maxFiles) {
      error.value = `Maximum ${maxFiles} files per post`
      break
    }
    if (f.size > 10 * 1024 * 1024) {
      error.value = `${f.name} exceeds the 10MB limit`
      continue
    }
    files.value.push(f)
  }
}

function removeFile(index) {
  files.value.splice(index, 1)
  error.value = null
}

async function uploadAll(postId) {
  if (files.value.length === 0) return []

  uploading.value = true
  error.value = null
  const results = []

  for (let i = 0; i < files.value.length; i++) {
    uploadingIndex.value = i
    const file = files.value[i]
    try {
      const buf = await file.arrayBuffer()
      const headers = {
        'Content-Type': file.type || 'application/octet-stream',
        'X-Filename': file.name,
        'X-Post-Id': postId
      }
      if (impersonatingUid.value) {
        headers['X-Impersonate-Uid'] = impersonatingUid.value
      }

      const resp = await fetch(`${getApiBase()}/modules/pulse-social/attachments`, {
        method: 'POST',
        headers,
        body: buf
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.error || `Upload failed (${resp.status})`)
      }

      const attachment = await resp.json()
      results.push(attachment)
    } catch (err) {
      error.value = `Failed to upload ${file.name}: ${err.message}`
      console.error('[pulse-social] Upload error:', err)
    }
  }

  uploading.value = false
  files.value = []
  emit('uploaded', results)
  return results
}

function reset() {
  files.value = []
  error.value = null
  uploading.value = false
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
}

defineExpose({ uploadAll, reset, files })
</script>
