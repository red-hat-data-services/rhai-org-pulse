<script setup>
import { ref, watch, nextTick } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const props = defineProps({
  team: { type: Object, default: null },
  isOpen: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'saved'])

const boards = ref([])
const saving = ref(false)
const saveError = ref('')
const panelRef = ref(null)
let previouslyFocused = null

// Sync local boards state when team changes or drawer opens
watch(() => [props.isOpen, props.team], ([open]) => {
  if (open && props.team) {
    boards.value = (props.team.boards || []).map(b => ({ url: b.url, name: b.name || '' }))
    saveError.value = ''
    previouslyFocused = document.activeElement
    nextTick(() => {
      if (panelRef.value) {
        const first = panelRef.value.querySelector('button, input, [tabindex]:not([tabindex="-1"])')
        if (first) first.focus()
      }
    })
  } else if (!open && previouslyFocused && previouslyFocused.focus) {
    previouslyFocused.focus()
    previouslyFocused = null
  }
}, { immediate: true })

function addBoard() {
  boards.value.push({ url: '', name: '' })
  nextTick(() => {
    if (panelRef.value) {
      const inputs = panelRef.value.querySelectorAll('input[data-field="url"]')
      const last = inputs[inputs.length - 1]
      if (last) last.focus()
    }
  })
}

function removeBoard(index) {
  boards.value.splice(index, 1)
}

function isValidUrl(url) {
  return /^https?:\/\/.+/.test(url)
}

function boardErrors(board) {
  if (!board.url.trim()) return null
  if (!isValidUrl(board.url.trim())) return 'Must start with https:// or http://'
  if (board.url.trim().length > 2048) return 'URL too long (max 2048 characters)'
  return null
}

function hasErrors() {
  return boards.value.some(b => b.url.trim() && boardErrors(b))
}

async function handleSave() {
  // Filter out empty rows
  const toSave = boards.value
    .filter(b => b.url.trim())
    .map(b => ({ url: b.url.trim(), name: b.name.trim() || undefined }))

  if (hasErrors()) return

  saving.value = true
  saveError.value = ''
  try {
    await apiRequest(`/modules/team-tracker/structure/teams/${props.team.id}/boards`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boards: toSave })
    })
    emit('saved')
    emit('close')
  } catch (err) {
    saveError.value = err.message || 'Failed to save boards'
  } finally {
    saving.value = false
  }
}

function handleCancel() {
  emit('close')
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    handleCancel()
    return
  }
  if (event.key !== 'Tab' || !panelRef.value) return

  const focusable = Array.from(panelRef.value.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
  ))
  if (focusable.length === 0) return

  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (event.shiftKey) {
    if (document.activeElement === first) {
      event.preventDefault()
      last.focus()
    }
  } else {
    if (document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
}
</script>

<template>
  <!-- Backdrop -->
  <Transition name="fade">
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-black/30 z-40"
      @click="handleCancel"
    />
  </Transition>

  <!-- Panel -->
  <Transition name="slide">
    <div
      v-if="isOpen"
      ref="panelRef"
      role="dialog"
      aria-modal="true"
      aria-labelledby="boards-drawer-title"
      class="fixed top-0 right-0 h-full w-full max-w-lg bg-white dark:bg-gray-800 shadow-xl z-50 flex flex-col border-l border-gray-200 dark:border-gray-700"
      @keydown="handleKeydown"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 id="boards-drawer-title" class="text-base font-semibold text-gray-900 dark:text-gray-100">
          Edit Boards &mdash; {{ team?.name }}
        </h2>
        <button
          @click="handleCancel"
          aria-label="Close panel"
          class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Save error -->
      <div v-if="saveError" role="alert" class="mx-5 mt-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400">
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="font-medium">Save failed</p>
            <p class="mt-1">{{ saveError }}</p>
          </div>
          <button
            @click="handleSave"
            :disabled="saving"
            class="shrink-0 px-3 py-1 text-xs font-medium rounded bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/30 disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto px-5 py-4">
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Add links to Jira boards, Kanban boards, or any project tracking URLs for this team.
        </p>

        <!-- Board list -->
        <div class="space-y-3">
          <div
            v-for="(board, idx) in boards"
            :key="idx"
            class="group relative rounded-lg border border-gray-200 dark:border-gray-700 p-3"
          >
            <div class="flex items-start gap-3">
              <div class="flex-1 space-y-2">
                <div>
                  <label :for="'board-url-' + idx" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">URL</label>
                  <input
                    :id="'board-url-' + idx"
                    v-model="board.url"
                    data-field="url"
                    type="url"
                    placeholder="https://issues.redhat.com/jira/software/boards/123"
                    class="w-full px-3 py-1.5 border rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    :class="boardErrors(board) ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
                  />
                  <p v-if="boardErrors(board)" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ boardErrors(board) }}</p>
                </div>
                <div>
                  <label :for="'board-name-' + idx" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Name <span class="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
                  </label>
                  <input
                    :id="'board-name-' + idx"
                    v-model="board.name"
                    type="text"
                    maxlength="200"
                    placeholder="e.g., Sprint Board"
                    class="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              <button
                @click="removeBoard(idx)"
                :aria-label="'Remove board ' + (board.name || idx + 1)"
                class="mt-5 p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded"
                type="button"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="boards.length === 0" class="text-center py-8 text-gray-400 dark:text-gray-500">
          <p class="text-sm">No boards configured for this team.</p>
        </div>

        <!-- Add button -->
        <button
          @click="addBoard"
          type="button"
          class="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add board
        </button>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
        <button
          @click="handleCancel"
          :disabled="saving"
          class="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          @click="handleSave"
          :disabled="saving || hasErrors()"
          :aria-busy="saving"
          class="px-4 py-2 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <svg v-if="saving" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
