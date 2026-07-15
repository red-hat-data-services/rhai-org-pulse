<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import {
  X as XIcon,
  Target as TargetIcon,
  Loader2 as Loader2Icon,
  CheckCircle2 as CheckCircle2Icon,
  AlertCircle as AlertCircleIcon,
  ChevronDown as ChevronDownIcon,
  Building2 as Building2Icon,
  Search as SearchIcon,
  Check as CheckIcon,
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

const orgDropdownOpen = ref(false)
const orgSearch = ref('')
const orgHighlightIdx = ref(0)
const orgSearchRef = ref(null)
const orgContainerRef = ref(null)

const participationDropdownOpen = ref(false)
const leadershipDropdownOpen = ref(false)
const participationContainerRef = ref(null)
const leadershipContainerRef = ref(null)

const participationOptions = [
  { value: '', label: 'None', description: 'No participation goal' },
  { value: 'evaluating_participation', label: 'Evaluating', description: 'Exploring participation opportunities' },
  { value: 'sustaining_participation', label: 'Sustaining', description: 'Maintaining current participation' },
  { value: 'increasing_participation', label: 'Increasing', description: 'Growing participation investment' },
]

const leadershipOptions = [
  { value: '', label: 'None', description: 'No leadership goal' },
  { value: 'evaluating_leadership', label: 'Evaluating', description: 'Exploring leadership opportunities' },
  { value: 'sustaining_leadership', label: 'Sustaining', description: 'Maintaining current leadership' },
  { value: 'increasing_leadership', label: 'Increasing', description: 'Growing leadership investment' },
]

const isAddMode = computed(() => !props.org)

const availableOrgs = computed(() =>
  props.allOrgs
    .filter(o => !o.strategicParticipation && !o.strategicLeadership)
    .sort((a, b) => a.name.localeCompare(b.name))
)

const filteredOrgs = computed(() => {
  if (!orgSearch.value.trim()) return availableOrgs.value
  const q = orgSearch.value.toLowerCase()
  return availableOrgs.value.filter(o =>
    o.name.toLowerCase().includes(q) || o.githubOrg.toLowerCase().includes(q)
  )
})

const selectedOrgObj = computed(() =>
  props.allOrgs.find(o => o.githubOrg === selectedGithubOrg.value)
)

const targetGithubOrg = computed(() =>
  isAddMode.value ? selectedGithubOrg.value : props.org?.githubOrg
)

const targetOrgName = computed(() => {
  if (!isAddMode.value) return props.org?.name
  return selectedOrgObj.value?.name || selectedGithubOrg.value
})

const participationLabel = computed(() => {
  const opt = participationOptions.find(o => o.value === participation.value)
  return opt ? opt.label : 'None'
})

const leadershipLabel = computed(() => {
  const opt = leadershipOptions.find(o => o.value === leadership.value)
  return opt ? opt.label : 'None'
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
  orgDropdownOpen.value = false
  participationDropdownOpen.value = false
  leadershipDropdownOpen.value = false
  orgSearch.value = ''
}

function selectOrg(slug) {
  selectedGithubOrg.value = slug
  orgDropdownOpen.value = false
}

function toggleOrgDropdown() {
  orgDropdownOpen.value = !orgDropdownOpen.value
  if (orgDropdownOpen.value) {
    orgSearch.value = ''
    orgHighlightIdx.value = 0
    nextTick(() => orgSearchRef.value?.focus())
  }
}

function onOrgKeydown(e) {
  if (!orgDropdownOpen.value) {
    if (['ArrowDown', 'Enter', ' '].includes(e.key)) {
      e.preventDefault()
      toggleOrgDropdown()
    }
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    orgHighlightIdx.value = Math.min(orgHighlightIdx.value + 1, filteredOrgs.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    orgHighlightIdx.value = Math.max(orgHighlightIdx.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (filteredOrgs.value[orgHighlightIdx.value]) {
      selectOrg(filteredOrgs.value[orgHighlightIdx.value].githubOrg)
    }
  } else if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    orgDropdownOpen.value = false
  }
}

watch(orgSearch, () => { orgHighlightIdx.value = 0 })

function onClickOutside(e) {
  if (orgContainerRef.value && !orgContainerRef.value.contains(e.target)) orgDropdownOpen.value = false
  if (participationContainerRef.value && !participationContainerRef.value.contains(e.target)) participationDropdownOpen.value = false
  if (leadershipContainerRef.value && !leadershipContainerRef.value.contains(e.target)) leadershipDropdownOpen.value = false
}

function selectOption(type, value) {
  if (type === 'participation') {
    participation.value = value
    participationDropdownOpen.value = false
  } else {
    leadership.value = value
    leadershipDropdownOpen.value = false
  }
}

function getTierColor(value) {
  if (value.includes('increasing')) return { dot: 'bg-green-500', text: 'text-green-700 dark:text-green-400' }
  if (value.includes('sustaining')) return { dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400' }
  if (value.includes('evaluating')) return { dot: 'bg-yellow-500', text: 'text-yellow-700 dark:text-yellow-400' }
  return { dot: 'bg-gray-300 dark:bg-gray-600', text: 'text-gray-500 dark:text-gray-400' }
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
    if (orgDropdownOpen.value) { orgDropdownOpen.value = false; return }
    if (participationDropdownOpen.value) { participationDropdownOpen.value = false; return }
    if (leadershipDropdownOpen.value) { leadershipDropdownOpen.value = false; return }
    emit('close')
  }
}

watch(() => props.open, (open) => {
  if (open) {
    resetForm()
    document.addEventListener('keydown', onEscape)
    document.addEventListener('mousedown', onClickOutside)
  } else {
    document.removeEventListener('keydown', onEscape)
    document.removeEventListener('mousedown', onClickOutside)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onEscape)
  document.removeEventListener('mousedown', onClickOutside)
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
        class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-[480px] max-w-[calc(100vw-2rem)]"
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
            <!-- Org picker (add mode) -->
            <div v-if="isAddMode">
              <label class="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Organization <span class="text-red-400">*</span>
              </label>
              <div ref="orgContainerRef" class="relative" @keydown="onOrgKeydown">
                <button
                  type="button"
                  @click="toggleOrgDropdown"
                  :disabled="submitStatus === 'submitting'"
                  class="w-full flex items-center justify-between pl-3 pr-3 py-2.5 text-sm border rounded-xl bg-white dark:bg-gray-700 outline-none transition-all disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
                  :class="orgDropdownOpen
                    ? 'border-blue-500 ring-2 ring-blue-500'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'"
                >
                  <span v-if="selectedOrgObj" class="flex items-center gap-2 min-w-0">
                    <Building2Icon class="w-4 h-4 text-gray-400 shrink-0" />
                    <span class="truncate font-medium text-gray-900 dark:text-gray-100">{{ selectedOrgObj.name }}</span>
                    <span class="text-gray-400 dark:text-gray-500 shrink-0">{{ selectedOrgObj.githubOrg }}</span>
                  </span>
                  <span v-else class="text-gray-400 dark:text-gray-500">Select an organization...</span>
                  <ChevronDownIcon class="w-4 h-4 text-gray-400 shrink-0 ml-2 transition-transform" :class="{ 'rotate-180': orgDropdownOpen }" />
                </button>

                <div v-if="orgDropdownOpen" class="absolute z-50 mt-1.5 w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 shadow-xl overflow-hidden">
                  <div class="p-2 border-b border-gray-100 dark:border-gray-700">
                    <div class="relative">
                      <SearchIcon class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        ref="orgSearchRef"
                        v-model="orgSearch"
                        type="text"
                        placeholder="Search organizations..."
                        class="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>

                  <div class="max-h-[240px] overflow-y-auto py-1">
                    <div v-if="filteredOrgs.length === 0" class="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                      {{ orgSearch ? `No organizations match "${orgSearch}"` : 'All organizations already have strategic classifications.' }}
                    </div>
                    <button
                      v-for="(o, idx) in filteredOrgs"
                      :key="o.githubOrg"
                      type="button"
                      @click="selectOrg(o.githubOrg)"
                      @mouseenter="orgHighlightIdx = idx"
                      class="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                      :class="{
                        'bg-blue-50 dark:bg-blue-900/30': idx === orgHighlightIdx,
                        'bg-gray-50 dark:bg-gray-700/50': o.githubOrg === selectedGithubOrg && idx !== orgHighlightIdx,
                      }"
                    >
                      <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        :class="o.githubOrg === selectedGithubOrg ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-gray-100 dark:bg-gray-700'">
                        <Building2Icon class="w-4 h-4" :class="o.githubOrg === selectedGithubOrg ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="text-sm font-medium truncate" :class="o.githubOrg === selectedGithubOrg ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'">{{ o.name }}</span>
                          <span class="text-xs text-gray-400 dark:text-gray-500 shrink-0">{{ o.githubOrg }}</span>
                        </div>
                        <span class="text-[11px] text-gray-400 dark:text-gray-500">
                          {{ o.projectCount }} project{{ o.projectCount !== 1 ? 's' : '' }} tracked
                        </span>
                      </div>
                      <CheckIcon v-if="o.githubOrg === selectedGithubOrg" class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Org name (edit mode) -->
            <div v-else>
              <label class="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Organization
              </label>
              <div class="w-full flex items-center gap-2 px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300">
                <Building2Icon class="w-4 h-4 text-gray-400 shrink-0" />
                <span class="font-medium">{{ org?.name }}</span>
                <span class="text-gray-400 dark:text-gray-500">{{ org?.githubOrg }}</span>
              </div>
            </div>

            <!-- Participation level -->
            <div>
              <label class="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Participation Level
              </label>
              <div ref="participationContainerRef" class="relative">
                <button
                  type="button"
                  @click="participationDropdownOpen = !participationDropdownOpen; leadershipDropdownOpen = false"
                  :disabled="submitStatus === 'submitting'"
                  class="w-full flex items-center justify-between pl-3 pr-3 py-2.5 text-sm border rounded-xl bg-white dark:bg-gray-700 outline-none transition-all disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
                  :class="participationDropdownOpen
                    ? 'border-blue-500 ring-2 ring-blue-500'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'"
                >
                  <span class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full shrink-0" :class="getTierColor(participation).dot"></span>
                    <span class="font-medium text-gray-900 dark:text-gray-100">{{ participationLabel }}</span>
                  </span>
                  <ChevronDownIcon class="w-4 h-4 text-gray-400 shrink-0 ml-2 transition-transform" :class="{ 'rotate-180': participationDropdownOpen }" />
                </button>

                <div v-if="participationDropdownOpen" class="absolute z-50 mt-1.5 w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 shadow-xl overflow-hidden py-1">
                  <button
                    v-for="opt in participationOptions"
                    :key="opt.value"
                    type="button"
                    @click="selectOption('participation', opt.value)"
                    class="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    :class="{ 'bg-blue-50 dark:bg-blue-900/30': participation === opt.value }"
                  >
                    <span class="w-2.5 h-2.5 rounded-full shrink-0" :class="getTierColor(opt.value).dot"></span>
                    <div class="flex-1 min-w-0">
                      <span class="text-sm font-medium" :class="participation === opt.value ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'">{{ opt.label }}</span>
                      <p class="text-[11px] text-gray-400 dark:text-gray-500">{{ opt.description }}</p>
                    </div>
                    <CheckIcon v-if="participation === opt.value" class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Leadership level -->
            <div>
              <label class="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Leadership Level
              </label>
              <div ref="leadershipContainerRef" class="relative">
                <button
                  type="button"
                  @click="leadershipDropdownOpen = !leadershipDropdownOpen; participationDropdownOpen = false"
                  :disabled="submitStatus === 'submitting'"
                  class="w-full flex items-center justify-between pl-3 pr-3 py-2.5 text-sm border rounded-xl bg-white dark:bg-gray-700 outline-none transition-all disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
                  :class="leadershipDropdownOpen
                    ? 'border-blue-500 ring-2 ring-blue-500'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'"
                >
                  <span class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full shrink-0" :class="getTierColor(leadership).dot"></span>
                    <span class="font-medium text-gray-900 dark:text-gray-100">{{ leadershipLabel }}</span>
                  </span>
                  <ChevronDownIcon class="w-4 h-4 text-gray-400 shrink-0 ml-2 transition-transform" :class="{ 'rotate-180': leadershipDropdownOpen }" />
                </button>

                <div v-if="leadershipDropdownOpen" class="absolute z-50 mt-1.5 w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 shadow-xl overflow-hidden py-1">
                  <button
                    v-for="opt in leadershipOptions"
                    :key="opt.value"
                    type="button"
                    @click="selectOption('leadership', opt.value)"
                    class="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    :class="{ 'bg-blue-50 dark:bg-blue-900/30': leadership === opt.value }"
                  >
                    <span class="w-2.5 h-2.5 rounded-full shrink-0" :class="getTierColor(opt.value).dot"></span>
                    <div class="flex-1 min-w-0">
                      <span class="text-sm font-medium" :class="leadership === opt.value ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'">{{ opt.label }}</span>
                      <p class="text-[11px] text-gray-400 dark:text-gray-500">{{ opt.description }}</p>
                    </div>
                    <CheckIcon v-if="leadership === opt.value" class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Validation hint -->
            <p v-if="isAddMode && !participation && !leadership && selectedGithubOrg" class="text-[12px] text-amber-600 dark:text-amber-400">
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
