<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import {
  X as XIcon,
  Target as TargetIcon,
  Loader2 as Loader2Icon,
  CheckCircle2 as CheckCircle2Icon,
  AlertCircle as AlertCircleIcon,
  ChevronDown as ChevronDownIcon,
} from 'lucide-vue-next'
import { apiRequest } from '@shared/client/services/api'

const MODULE_API = '/modules/upstream-pulse'

const props = defineProps({
  open: { type: Boolean, default: false },
  org: { type: Object, default: null },
  allOrgs: { type: Array, default: () => [] },
})

const emit = defineEmits(['close', 'saved'])

const selectedGithubOrg = ref('')
const participation = ref('')
const leadership = ref('')

const submitStatus = ref('idle')
const submitError = ref('')

const participationOptions = [
  { value: '', label: 'None' },
  { value: 'evaluating_participation', label: 'Evaluating Participation' },
  { value: 'sustaining_participation', label: 'Sustaining Participation' },
  { value: 'increasing_participation', label: 'Increasing Participation' },
]

const leadershipOptions = [
  { value: '', label: 'None' },
  { value: 'evaluating_leadership', label: 'Evaluating Leadership' },
  { value: 'sustaining_leadership', label: 'Sustaining Leadership' },
  { value: 'increasing_leadership', label: 'Increasing Leadership' },
]

const isAddMode = computed(() => !props.org)

const availableOrgs = computed(() =>
  props.allOrgs
    .filter(o => !o.strategicParticipation && !o.strategicLeadership)
    .sort((a, b) => a.name.localeCompare(b.name))
)

const targetGithubOrg = computed(() =>
  isAddMode.value ? selectedGithubOrg.value : props.org?.githubOrg
)

const targetOrgName = computed(() => {
  if (!isAddMode.value) return props.org?.name
  const found = props.allOrgs.find(o => o.githubOrg === selectedGithubOrg.value)
  return found?.name || selectedGithubOrg.value
})

const canSubmit = computed(() =>
  targetGithubOrg.value &&
  (!isAddMode.value || participation.value || leadership.value) &&
  submitStatus.value !== 'submitting'
)

function resetForm() {
  selectedGithubOrg.value = ''
  participation.value = props.org?.strategicParticipation || ''
  leadership.value = props.org?.strategicLeadership || ''
  submitStatus.value = 'idle'
  submitError.value = ''
}

async function handleSubmit() {
  if (!canSubmit.value) return
  submitStatus.value = 'submitting'
  submitError.value = ''

  try {
    await apiRequest(`${MODULE_API}/orgs/${encodeURIComponent(targetGithubOrg.value)}/strategy`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategicParticipation: participation.value || null,
        strategicLeadership: leadership.value || null,
      }),
    })
    submitStatus.value = 'success'
    setTimeout(() => emit('saved'), 600)
  } catch (err) {
    submitStatus.value = 'error'
    submitError.value = err.message || 'Failed to save strategy'
  }
}

function onBackdropClick() {
  if (submitStatus.value !== 'submitting') emit('close')
}

function onEscape(e) {
  if (e.key === 'Escape' && submitStatus.value !== 'submitting') {
    emit('close')
  }
}

watch(() => props.open, (open) => {
  if (open) {
    resetForm()
    document.addEventListener('keydown', onEscape)
  } else {
    document.removeEventListener('keydown', onEscape)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onEscape)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[100] flex items-center justify-center">
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-[2px]"
        @click="onBackdropClick"
      />

      <!-- Dialog -->
      <div
        role="dialog"
        aria-modal="true"
        class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-[480px] max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-6 pt-6 pb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <TargetIcon class="w-5 h-5 text-blue-600 dark:text-blue-400" :stroke-width="1.7" />
            </div>
            <div>
              <h3 class="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                {{ isAddMode ? 'Add to Strategy' : 'Edit Strategy' }}
              </h3>
              <p class="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">
                {{ isAddMode ? 'Set strategic goals for an organization' : `Update goals for ${org?.name}` }}
              </p>
            </div>
          </div>
          <button
            @click="emit('close')"
            :disabled="submitStatus === 'submitting'"
            class="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <XIcon class="w-4 h-4" />
          </button>
        </div>

        <!-- Success state -->
        <div v-if="submitStatus === 'success'" class="px-6 pb-6">
          <div class="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4">
            <div class="flex items-start gap-3">
              <CheckCircle2Icon class="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p class="text-sm font-medium text-emerald-900 dark:text-emerald-200">Strategy updated successfully</p>
                <p class="text-[13px] text-emerald-700 dark:text-emerald-300 mt-1">
                  <span class="font-medium">{{ targetOrgName }}</span> strategic classification has been saved.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Form -->
        <form v-if="submitStatus !== 'success'" @submit.prevent="handleSubmit" class="px-6 pb-6">
          <div class="space-y-4">
            <!-- Org picker (add mode only) -->
            <div v-if="isAddMode">
              <label class="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Organization <span class="text-red-400">*</span>
              </label>
              <div class="relative">
                <select
                  v-model="selectedGithubOrg"
                  :disabled="submitStatus === 'submitting'"
                  class="w-full appearance-none pl-3 pr-10 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500"
                >
                  <option value="" disabled>Select an organization...</option>
                  <option v-for="o in availableOrgs" :key="o.githubOrg" :value="o.githubOrg">
                    {{ o.name }} ({{ o.githubOrg }})
                  </option>
                </select>
                <ChevronDownIcon class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              <p v-if="availableOrgs.length === 0" class="mt-1.5 text-[12px] text-gray-400 dark:text-gray-500">
                All organizations already have strategic classifications.
              </p>
            </div>

            <!-- Org name (edit mode) -->
            <div v-else>
              <label class="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Organization
              </label>
              <div class="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300">
                {{ org?.name }} <span class="text-gray-400 dark:text-gray-500">({{ org?.githubOrg }})</span>
              </div>
            </div>

            <!-- Participation level -->
            <div>
              <label class="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Participation Level
              </label>
              <div class="relative">
                <select
                  v-model="participation"
                  :disabled="submitStatus === 'submitting'"
                  class="w-full appearance-none pl-3 pr-10 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500"
                >
                  <option v-for="opt in participationOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
                <ChevronDownIcon class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <!-- Leadership level -->
            <div>
              <label class="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Leadership Level
              </label>
              <div class="relative">
                <select
                  v-model="leadership"
                  :disabled="submitStatus === 'submitting'"
                  class="w-full appearance-none pl-3 pr-10 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500"
                >
                  <option v-for="opt in leadershipOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
                <ChevronDownIcon class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <!-- Validation hint -->
            <p v-if="!participation && !leadership && (selectedGithubOrg || org)" class="text-[12px] text-amber-600 dark:text-amber-400">
              Select at least one participation or leadership level.
            </p>

            <!-- Submit error -->
            <div v-if="submitStatus === 'error'" class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
              <div class="flex items-start gap-3">
                <AlertCircleIcon class="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p class="text-sm font-medium text-red-800 dark:text-red-200">Failed to save strategy</p>
                  <p class="text-[13px] text-red-600 dark:text-red-400 mt-0.5">{{ submitError }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex justify-end mt-6 gap-2.5">
            <button
              type="button"
              @click="emit('close')"
              :disabled="submitStatus === 'submitting'"
              class="px-4 py-2 text-[13px] font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors disabled:opacity-50"
            >Cancel</button>
            <button
              type="submit"
              :disabled="!canSubmit"
              class="px-4 py-2 text-[13px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Loader2Icon v-if="submitStatus === 'submitting'" class="w-4 h-4 animate-spin" />
              {{ submitStatus === 'submitting' ? 'Saving...' : 'Save Strategy' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
