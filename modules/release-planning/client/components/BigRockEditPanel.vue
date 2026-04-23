<script setup>
import { ref } from 'vue'
import { useBigRockEditor } from '../composables/useBigRockEditor'

const emit = defineEmits(['save', 'cancel'])

const { isOpen, formData, saving, saveError, fieldErrors, isNewRock } = useBigRockEditor()

const outcomeKeyInput = ref('')

function addOutcomeKey() {
  const key = outcomeKeyInput.value.trim().toUpperCase()
  if (!key) return
  if (formData.value.outcomeKeys.includes(key)) {
    outcomeKeyInput.value = ''
    return
  }
  formData.value.outcomeKeys.push(key)
  outcomeKeyInput.value = ''
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

function handleCancel() {
  emit('cancel')
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
      @click="handleCancel"
    />
  </Transition>

  <!-- Panel -->
  <Transition name="slide">
    <div
      v-if="isOpen"
      class="fixed top-0 right-0 h-full w-full max-w-lg bg-white dark:bg-gray-800 shadow-xl z-50 flex flex-col border-l border-gray-200 dark:border-gray-700"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
          {{ isNewRock ? 'Add Big Rock' : 'Edit Big Rock' }}
        </h2>
        <button
          @click="handleCancel"
          class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Save error notification -->
      <div v-if="saveError" class="mx-5 mt-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400">
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
        <!-- Name -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Name <span class="text-red-500">*</span>
          </label>
          <input
            v-model="formData.name"
            type="text"
            maxlength="100"
            class="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            :class="fieldErrors.name ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
            placeholder="e.g., MaaS"
          />
          <p v-if="fieldErrors.name" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.name }}</p>
        </div>

        <!-- Full Name -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
          <input
            v-model="formData.fullName"
            type="text"
            maxlength="200"
            class="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            :class="fieldErrors.fullName ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
            placeholder="e.g., MaaS (continue from 3.4)"
          />
          <p v-if="fieldErrors.fullName" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.fullName }}</p>
        </div>

        <!-- Pillar -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pillar</label>
          <input
            v-model="formData.pillar"
            type="text"
            maxlength="100"
            class="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            :class="fieldErrors.pillar ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
            placeholder="e.g., Inference"
          />
          <p v-if="fieldErrors.pillar" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.pillar }}</p>
        </div>

        <!-- State -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">State</label>
          <input
            v-model="formData.state"
            type="text"
            maxlength="100"
            class="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            :class="fieldErrors.state ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
            placeholder="e.g., continue from 3.4"
          />
          <p v-if="fieldErrors.state" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.state }}</p>
        </div>

        <!-- Owner -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Owner</label>
          <input
            v-model="formData.owner"
            type="text"
            maxlength="200"
            class="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            :class="fieldErrors.owner ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
            placeholder="e.g., jsmith@redhat.com"
          />
          <p v-if="fieldErrors.owner" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.owner }}</p>
        </div>

        <!-- Outcome Keys (tag input) -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Outcome Keys</label>
          <div class="flex flex-wrap gap-1.5 mb-2" v-if="formData.outcomeKeys.length > 0">
            <span
              v-for="(key, idx) in formData.outcomeKeys"
              :key="key"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-400"
            >
              {{ key }}
              <button
                @click="removeOutcomeKey(idx)"
                class="hover:text-red-500 ml-0.5"
                type="button"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          </div>
          <div class="flex gap-2">
            <input
              v-model="outcomeKeyInput"
              type="text"
              @keydown="handleOutcomeKeydown"
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
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
          <textarea
            v-model="formData.notes"
            rows="3"
            maxlength="2000"
            class="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-y"
            :class="fieldErrors.notes ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
            placeholder="Optional notes..."
          />
          <p v-if="fieldErrors.notes" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.notes }}</p>
        </div>

        <!-- Description -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <textarea
            v-model="formData.description"
            rows="3"
            maxlength="2000"
            class="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-y"
            :class="fieldErrors.description ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
            placeholder="Optional description..."
          />
          <p v-if="fieldErrors.description" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.description }}</p>
        </div>
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
          :disabled="saving"
          class="px-4 py-2 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <svg v-if="saving" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
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
