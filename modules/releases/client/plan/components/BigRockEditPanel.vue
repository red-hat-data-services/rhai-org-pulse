<script setup>
import { ref } from 'vue'
import { useBigRockEditor } from '../composables/useBigRockEditor'
import { useFocusTrap } from '../composables/useFocusTrap'

const emit = defineEmits(['save', 'cancel'])

const { isOpen, formData, saving, saveError, fieldErrors, isNewRock, isDirty } = useBigRockEditor()

const outcomeKeyInput = ref('')
const panelRef = ref(null)
const showDiscardPrompt = ref(false)
const { handleKeydown } = useFocusTrap(panelRef, isOpen, function() { attemptCancel() })

function addOutcomeKey() {
  var key = outcomeKeyInput.value.trim().toUpperCase()
  if (!key) return
  if (formData.value.outcomeKeys.includes(key)) {
    outcomeKeyInput.value = ''
    return
  }
  formData.value.outcomeKeys.push(key)
  outcomeKeyInput.value = ''
}

function parseAndAddKeys(text) {
  var keys = text.split(/[,\n\r]+/)
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i].trim().toUpperCase()
    if (!key) continue
    if (formData.value.outcomeKeys.includes(key)) continue
    formData.value.outcomeKeys.push(key)
  }
}

function handlePaste(event) {
  var pasted = (event.clipboardData || window.clipboardData).getData('text')
  if (!pasted) return
  // Only intercept if the pasted text contains separators (comma or newline)
  if (/[,\n\r]/.test(pasted)) {
    event.preventDefault()
    parseAndAddKeys(pasted)
    outcomeKeyInput.value = ''
  }
}

function removeOutcomeKey(index) {
  formData.value.outcomeKeys.splice(index, 1)
}

function handleOutcomeKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault()
    addOutcomeKey()
  }
}

function handleSave() {
  emit('save')
}

function attemptCancel() {
  if (saving.value) return
  if (isDirty.value) {
    showDiscardPrompt.value = true
    return
  }
  emit('cancel')
}

function confirmDiscard() {
  showDiscardPrompt.value = false
  emit('cancel')
}

function keepEditing() {
  showDiscardPrompt.value = false
}

function handleRetry() {
  emit('save')
}
</script>

<template>
  <!-- Backdrop -->
  <Transition name="fade">
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-black/30 z-40"
      @click="attemptCancel"
    />
  </Transition>

  <!-- Dialog -->
  <Transition name="dialog">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
    <div
      ref="panelRef"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-panel-title"
      class="w-full max-w-lg max-h-[90vh] bg-white dark:bg-gray-800 shadow-xl rounded-lg flex flex-col border border-gray-200 dark:border-gray-700"
      @keydown="handleKeydown"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 id="edit-panel-title" class="text-base font-semibold text-gray-900 dark:text-gray-100">
          {{ isNewRock ? 'Add Big Rock' : 'Edit Big Rock' }}
        </h2>
        <button
          @click="attemptCancel"
          aria-label="Close dialog"
          class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Save error notification -->
      <div v-if="saveError" role="alert" class="mx-5 mt-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400">
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="font-medium">Save failed</p>
            <p class="mt-1">{{ saveError }}</p>
          </div>
          <button
            @click="handleRetry"
            :disabled="saving"
            class="shrink-0 px-3 py-1 text-xs font-medium rounded bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/30 disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      </div>

      <!-- Form body -->
      <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <!-- Name (read-only) -->
        <div v-if="!isNewRock">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
          <p class="px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-md">{{ formData.name }}</p>
        </div>
        <div v-else>
          <label for="rock-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Name <span class="text-red-500">*</span>
          </label>
          <input
            id="rock-name"
            v-model="formData.name"
            type="text"
            maxlength="100"
            class="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            :class="fieldErrors.name ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
            placeholder="e.g., MaaS"
          />
          <p v-if="fieldErrors.name" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.name }}</p>
        </div>

        <!-- Pillar (read-only) -->
        <div v-if="formData.pillar">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pillar</label>
          <p class="px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-md">{{ formData.pillar }}</p>
        </div>

        <!-- Owner -->
        <div>
          <label for="rock-owner" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Owner</label>
          <input
            id="rock-owner"
            v-model="formData.owner"
            type="text"
            maxlength="200"
            class="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            :class="fieldErrors.owner ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
            placeholder="e.g., jsmith@redhat.com"
          />
          <p v-if="fieldErrors.owner" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.owner }}</p>
        </div>

        <!-- Engineering Lead -->
        <div>
          <label for="rock-architect" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Engineering Lead</label>
          <input
            id="rock-architect"
            v-model="formData.architect"
            type="text"
            maxlength="200"
            class="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            :class="fieldErrors.architect ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
            placeholder="e.g., jdoe@redhat.com"
          />
          <p v-if="fieldErrors.architect" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.architect }}</p>
        </div>

        <!-- Outcome Keys (tag input) -->
        <div>
          <label for="rock-outcome-key" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Outcome Keys</label>
          <div class="flex flex-wrap gap-1.5 mb-2" v-if="formData.outcomeKeys.length > 0">
            <span
              v-for="(key, idx) in formData.outcomeKeys"
              :key="key"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-400"
            >
              {{ key }}
              <button
                @click="removeOutcomeKey(idx)"
                :aria-label="'Remove ' + key"
                class="hover:text-red-500 ml-0.5"
                type="button"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          </div>
          <div class="flex gap-2">
            <input
              id="rock-outcome-key"
              v-model="outcomeKeyInput"
              type="text"
              @keydown="handleOutcomeKeydown"
              @paste="handlePaste"
              class="flex-1 px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              :class="fieldErrors.outcomeKeys ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
              placeholder="e.g., RHAISTRAT-1513 (press Enter)"
            />
            <button
              @click="addOutcomeKey"
              type="button"
              class="px-3 py-2 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Add
            </button>
          </div>
          <p v-if="fieldErrors.outcomeKeys" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.outcomeKeys }}</p>
        </div>

        <!-- Notes -->
        <div>
          <label for="rock-notes" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
          <textarea
            id="rock-notes"
            v-model="formData.notes"
            rows="3"
            maxlength="2000"
            class="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-y"
            :class="fieldErrors.notes ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
            placeholder="Optional notes..."
          />
          <p v-if="fieldErrors.notes" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.notes }}</p>
        </div>

      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
        <button
          @click="attemptCancel"
          :disabled="saving"
          class="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          @click="handleSave"
          :disabled="saving"
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
    </div>
  </Transition>

  <!-- Discard changes confirmation -->
  <Transition name="fade">
    <div
      v-if="showDiscardPrompt"
      class="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center"
      @click.self="keepEditing"
    >
      <div
        role="alertdialog"
        aria-labelledby="discard-title"
        aria-describedby="discard-desc"
        class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-5 max-w-sm mx-4 border border-gray-200 dark:border-gray-700"
      >
        <h3 id="discard-title" class="text-sm font-semibold text-gray-900 dark:text-gray-100">Unsaved changes</h3>
        <p id="discard-desc" class="mt-1 text-sm text-gray-600 dark:text-gray-400">You have unsaved changes. Discard?</p>
        <div class="mt-4 flex justify-end gap-3">
          <button
            @click="keepEditing"
            class="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Keep Editing
          </button>
          <button
            @click="confirmDiscard"
            class="px-3 py-1.5 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
  transform: scale(0.95);
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
