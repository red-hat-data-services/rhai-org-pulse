<template>
  <div
    ref="composerRef"
    class="bg-white dark:bg-gray-800 rounded-xl shadow-sm transition-all duration-250"
    :class="{ 'shadow-md': isExpanded }"
  >
    <!-- Stage 1: Collapsed -->
    <div
      v-if="!isExpanded"
      @click="expand"
      class="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl transition-colors"
      role="button"
      aria-expanded="false"
      aria-label="Open post composer"
    >
      <PersonAvatar :name="userName" :uid="userUid" size="lg" />
      <span class="text-gray-400 dark:text-gray-500 text-[15px]">{{ composer.placeholder.value }}</span>
    </div>

    <!-- Stage 2-4: Expanded -->
    <div v-else class="p-5">
      <div class="flex items-start gap-3">
        <PersonAvatar :name="userName" :uid="userUid" size="lg" />
        <div class="flex-1 min-w-0">

          <!-- Write / Preview tabs -->
          <div class="flex items-center gap-4 mb-3 border-b border-gray-200 dark:border-gray-700">
            <button
              @click="activeTab = 'write'"
              class="pb-2 text-sm font-medium border-b-2 transition-colors cursor-pointer"
              :class="activeTab === 'write'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
            >
              Write
            </button>
            <button
              @click="activeTab = 'preview'"
              class="pb-2 text-sm font-medium border-b-2 transition-colors cursor-pointer"
              :class="activeTab === 'preview'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
            >
              Preview
            </button>
          </div>

          <!-- Write tab -->
          <div v-show="activeTab === 'write'">
            <!-- Markdown toolbar -->
            <div v-if="composer.body.value.length > 0 || showToolbar" class="mb-2">
              <MarkdownToolbar @action="handleToolbarAction" />
            </div>

            <!-- Textarea with drag-and-drop -->
            <div
              class="relative rounded-lg border border-gray-200 dark:border-gray-700 transition-colors"
              :class="dragActive ? 'border-primary-400 bg-primary-50/50 dark:bg-primary-900/10 dark:border-primary-600' : ''"
              @dragover.prevent="dragActive = true"
              @dragleave="dragActive = false"
              @drop.prevent="handleDrop"
            >
              <textarea
                ref="textareaRef"
                v-model="composer.body.value"
                :placeholder="composer.placeholder.value"
                class="w-full resize-none bg-transparent text-[15px] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none leading-relaxed p-3 rounded-lg"
                :rows="4"
                @input="autoGrow"
                @keydown="handleKeydown"
                @paste="handlePaste"
                @focus="showToolbar = true"
              ></textarea>

              <!-- Drag overlay -->
              <div
                v-if="dragActive"
                class="absolute inset-0 flex items-center justify-center rounded-lg pointer-events-none"
              >
                <span class="text-sm font-medium text-primary-600 dark:text-primary-400">Drop files here</span>
              </div>
            </div>

            <!-- Uploaded files preview -->
            <div v-if="attachedFiles.length > 0" class="mt-2 space-y-1">
              <div
                v-for="(file, index) in attachedFiles"
                :key="index"
                class="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-1.5"
              >
                <span class="text-gray-400">{{ file.type?.startsWith('image/') ? '🖼' : '📎' }}</span>
                <span class="text-gray-700 dark:text-gray-300 truncate flex-1">{{ file.name }}</span>
                <span class="text-xs text-gray-400">{{ formatSize(file.size) }}</span>
                <button
                  @click="removeFile(index)"
                  class="text-gray-400 hover:text-red-500 cursor-pointer text-xs"
                  aria-label="Remove file"
                >
                  ✕
                </button>
              </div>
            </div>

            <!-- Upload progress -->
            <div v-if="uploading" class="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span class="w-3 h-3 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin"></span>
              Uploading...
            </div>

            <!-- Drop hint -->
            <p class="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
              Attach images by dragging, pasting (Ctrl+V), or <button @click="triggerFileInput" class="text-primary-600 dark:text-primary-400 hover:underline cursor-pointer">browsing</button>.
            </p>
            <input
              ref="fileInputRef"
              type="file"
              class="hidden"
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.md"
              multiple
              @change="handleFileSelect"
            />
          </div>

          <!-- Preview tab -->
          <div v-show="activeTab === 'preview'" class="min-h-[100px]">
            <div
              v-if="composer.body.value.trim()"
              class="text-[15px] text-gray-800 dark:text-gray-200 leading-relaxed p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <MarkdownRenderer :content="composer.body.value" />
            </div>
            <div v-else class="flex items-center justify-center h-[100px] text-sm text-gray-400 dark:text-gray-500">
              Nothing to preview yet
            </div>
          </div>

          <!-- Label chips (appear when typing) -->
          <div
            v-if="composer.body.value.trim().length > 0"
            class="mt-3 flex flex-wrap items-center gap-2 transition-opacity duration-200"
          >
            <LabelChips :selected="composer.label.value" @select="handleLabelSelect" />
          </div>

          <!-- Action row -->
          <div class="flex items-center justify-between mt-4">
            <div class="text-xs text-gray-400 dark:text-gray-500">
              <span v-if="composer.error.value" class="text-red-500">{{ composer.error.value }}</span>
              <span v-else-if="attachedFiles.length > 0">{{ attachedFiles.length }} file{{ attachedFiles.length > 1 ? 's' : '' }} attached</span>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="collapse"
                class="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                @click="handleSubmit"
                :disabled="!composer.canSubmit.value || uploading"
                class="px-4 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer"
                :class="composer.canSubmit.value && !uploading
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'"
              >
                <span v-if="composer.submitting.value" class="flex items-center gap-1">
                  <span class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Posting...
                </span>
                <span v-else>Post</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import PersonAvatar from './PersonAvatar.vue'
import LabelChips from './LabelChips.vue'
import MarkdownToolbar from './MarkdownToolbar.vue'
import MarkdownRenderer from './MarkdownRenderer.vue'
import { useComposer } from '../composables/useComposer'
import { useAuth } from '@shared/client/composables/useAuth'
import { getApiBase } from '@shared/client/services/api'

const emit = defineEmits(['posted'])

const composer = useComposer()
const { user } = useAuth()

const isExpanded = ref(false)
const composerRef = ref(null)
const textareaRef = ref(null)
const fileInputRef = ref(null)
const activeTab = ref('write')
const showToolbar = ref(false)
const dragActive = ref(false)
const attachedFiles = ref([])
const uploading = ref(false)
let expandedAt = 0

const userName = ref('You')
const userUid = ref('')

onMounted(() => {
  if (user.value) {
    userName.value = user.value.name || user.value.email || 'You'
    userUid.value = user.value.uid || user.value.email || ''
  }
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleEscape)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleEscape)
})

function expand() {
  isExpanded.value = true
  expandedAt = Date.now()
  activeTab.value = 'write'
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

function collapse() {
  isExpanded.value = false
  showToolbar.value = false
  activeTab.value = 'write'
  attachedFiles.value = []
  composer.reset()
}

function handleClickOutside(e) {
  if (!isExpanded.value) return
  if (Date.now() - expandedAt < 200) return
  if (composer.body.value.trim().length > 0 || attachedFiles.value.length > 0) return
  if (composerRef.value && !composerRef.value.contains(e.target)) {
    isExpanded.value = false
    showToolbar.value = false
    composer.reset()
  }
}

function handleEscape(e) {
  if (e.key === 'Escape' && isExpanded.value && composer.body.value.trim().length === 0 && attachedFiles.value.length === 0) {
    isExpanded.value = false
    showToolbar.value = false
    composer.reset()
  }
}

function autoGrow() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

function handleLabelSelect(label) {
  composer.selectLabel(label)
}

// ─── Markdown toolbar actions ────────────────────────────────

function handleToolbarAction(action) {
  if (action === 'image') {
    fileInputRef.value?.click()
    return
  }
  if (action === 'attach') {
    fileInputRef.value?.click()
    return
  }

  const el = textareaRef.value
  if (!el) return

  const start = el.selectionStart
  const end = el.selectionEnd
  const text = composer.body.value
  const selected = text.slice(start, end)

  let insert, cursorOffset

  switch (action) {
    case 'bold':
      insert = selected ? `**${selected}**` : '**bold text**'
      cursorOffset = selected ? insert.length : 2
      break
    case 'italic':
      insert = selected ? `*${selected}*` : '*italic text*'
      cursorOffset = selected ? insert.length : 1
      break
    case 'heading':
      insert = selected ? `## ${selected}` : '## Heading'
      cursorOffset = insert.length
      break
    case 'link':
      if (selected) {
        insert = `[${selected}](url)`
        cursorOffset = insert.length - 1
      } else {
        insert = '[link text](url)'
        cursorOffset = 1
      }
      break
    case 'code':
      insert = selected ? `\`${selected}\`` : '`code`'
      cursorOffset = selected ? insert.length : 1
      break
    case 'codeblock':
      insert = selected ? `\n\`\`\`\n${selected}\n\`\`\`\n` : '\n```\ncode\n```\n'
      cursorOffset = selected ? insert.length : 5
      break
    case 'quote':
      insert = selected ? `> ${selected}` : '> quote'
      cursorOffset = insert.length
      break
    case 'ul':
      insert = selected
        ? selected.split('\n').map(l => `- ${l}`).join('\n')
        : '- item'
      cursorOffset = insert.length
      break
    case 'ol':
      insert = selected
        ? selected.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n')
        : '1. item'
      cursorOffset = insert.length
      break
    default:
      return
  }

  composer.body.value = text.slice(0, start) + insert + text.slice(end)
  nextTick(() => {
    el.focus()
    const newPos = start + cursorOffset
    el.setSelectionRange(newPos, newPos)
    autoGrow()
  })
}

// ─── Keyboard shortcuts ──────────────────────────────────────

function handleKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
    switch (e.key.toLowerCase()) {
      case 'b':
        e.preventDefault()
        handleToolbarAction('bold')
        break
      case 'i':
        e.preventDefault()
        handleToolbarAction('italic')
        break
      case 'k':
        e.preventDefault()
        handleToolbarAction('link')
        break
      case 'enter':
        e.preventDefault()
        handleSubmit()
        break
    }
  }
}

// ─── File handling ────────────────────────────────────────────

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleFileSelect(e) {
  addFiles(Array.from(e.target.files))
  e.target.value = ''
}

function handleDrop(e) {
  dragActive.value = false
  if (e.dataTransfer?.files?.length) {
    addFiles(Array.from(e.dataTransfer.files))
  }
}

function handlePaste(e) {
  const items = e.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (file) addFiles([file])
      return
    }
  }
}

function addFiles(files) {
  for (const f of files) {
    if (attachedFiles.value.length >= 5) break
    if (f.size > 10 * 1024 * 1024) {
      composer.error.value = `${f.name} exceeds the 10MB limit`
      continue
    }
    attachedFiles.value.push(f)
  }
}

function removeFile(index) {
  attachedFiles.value.splice(index, 1)
  composer.error.value = null
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
}

async function uploadFiles(postId) {
  const results = []
  for (const file of attachedFiles.value) {
    try {
      const buf = await file.arrayBuffer()
      const resp = await fetch(`${getApiBase()}/modules/pulse-social/attachments`, {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-Filename': encodeURIComponent(file.name),
          'X-Post-Id': postId
        },
        body: buf
      })
      if (resp.ok) {
        results.push(await resp.json())
      } else {
        const errData = await resp.json().catch(() => ({}))
        console.error('[pulse-social] Upload rejected:', resp.status, errData)
        composer.error.value = errData.error || `Upload failed (${resp.status})`
      }
    } catch (err) {
      console.error('[pulse-social] Upload error:', err)
      composer.error.value = 'Upload failed: ' + err.message
    }
  }
  return results
}

// ─── Submit ──────────────────────────────────────────────────

async function handleSubmit() {
  const post = await composer.submit()
  if (!post) return

  let finalPost = post
  if (attachedFiles.value.length > 0) {
    uploading.value = true
    await uploadFiles(post.id)
    uploading.value = false
    try {
      const { apiRequest } = await import('@shared/client/services/api')
      finalPost = await apiRequest(`/modules/pulse-social/posts/${post.id}`)
      finalPost.reactions = {}
      finalPost.comment_count = 0
      finalPost.recent_comments = []
    } catch {
      // Fall back to original post data
    }
  }

  isExpanded.value = false
  showToolbar.value = false
  activeTab.value = 'write'
  attachedFiles.value = []
  emit('posted', finalPost)
}
</script>
