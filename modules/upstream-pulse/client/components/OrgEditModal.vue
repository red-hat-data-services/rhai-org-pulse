<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import {
  X as XIcon,
  Loader2 as Loader2Icon,
  CheckCircle2 as CheckCircle2Icon,
  AlertCircle as AlertCircleIcon,
  ChevronDown as ChevronDownIcon,
  Building2 as Building2Icon,
  Search as SearchIcon,
  Check as CheckIcon,
  Plus as PlusIcon,
} from 'lucide-vue-next'
import { apiRequest } from '@shared/client/services/api'

const MODULE_API = '/modules/upstream-pulse'

const props = defineProps({
  open: { type: Boolean, default: false },
  org: { type: Object, default: null },
  allOrgs: { type: Array, default: () => [] },
  mode: { type: String, default: 'auto' },
})

const emit = defineEmits(['close', 'saved'])

const internalMode = ref('auto')

const effectiveMode = computed(() => {
  if (internalMode.value !== 'auto') return internalMode.value
  if (props.mode !== 'auto') return props.mode
  return props.org ? 'edit' : 'create'
})

const selectedGithubOrg = ref('')
const orgName = ref('')
const governanceModel = ref('none')
const participation = ref('')
const leadership = ref('')

const orgLookupStatus = ref('idle')
const orgInfo = ref(null)
const nameManuallyEdited = ref(false)
let orgLookupTimer = null

const submitStatus = ref('idle')
const submitError = ref('')

const orgDropdownOpen = ref(false)
const orgSearch = ref('')
const orgHighlightIdx = ref(0)
const orgSearchRef = ref(null)
const orgContainerRef = ref(null)

const governanceDropdownOpen = ref(false)
const governanceContainerRef = ref(null)
const participationDropdownOpen = ref(false)
const leadershipDropdownOpen = ref(false)
const participationContainerRef = ref(null)
const leadershipContainerRef = ref(null)

const governanceOptions = [
  { value: 'owners', label: 'OWNERS', description: 'Uses OWNERS files for maintainer tracking' },
  { value: 'codeowners', label: 'CODEOWNERS', description: 'Uses CODEOWNERS files for maintainer tracking' },
  { value: 'none', label: 'None', description: 'No automated governance tracking' },
]

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

const isCreateMode = computed(() => effectiveMode.value === 'create')
const isAddStrategyMode = computed(() => effectiveMode.value === 'addStrategy')
const isEditMode = computed(() => effectiveMode.value === 'edit')

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

const targetGithubOrg = computed(() => {
  if (isEditMode.value) return props.org?.githubOrg
  return selectedGithubOrg.value
})

const targetOrgName = computed(() => {
  if (isEditMode.value) return props.org?.name
  if (isAddStrategyMode.value) return selectedOrgObj.value?.name || selectedGithubOrg.value
  return orgName.value || selectedGithubOrg.value
})

const participationLabel = computed(() => {
  const opt = participationOptions.find(o => o.value === participation.value)
  return opt ? opt.label : 'None'
})

const leadershipLabel = computed(() => {
  const opt = leadershipOptions.find(o => o.value === leadership.value)
  return opt ? opt.label : 'None'
})

const governanceLabel = computed(() => {
  const opt = governanceOptions.find(o => o.value === governanceModel.value)
  return opt ? opt.label : 'None'
})

const canSubmit = computed(() => {
  if (submitStatus.value === 'submitting') return false
  if (isCreateMode.value) return selectedGithubOrg.value && orgName.value && orgLookupStatus.value === 'found' && !alreadyExists.value
  if (isAddStrategyMode.value) return !!selectedGithubOrg.value
  return !!targetGithubOrg.value
})

const alreadyExists = computed(() =>
  isCreateMode.value &&
  selectedGithubOrg.value &&
  props.allOrgs.some(o => o.githubOrg === selectedGithubOrg.value.toLowerCase())
)

function toTitleCase(str) {
  return str.replace(/(^|[-_\s])(\w)/g, (_, sep, ch) => (sep === '-' || sep === '_' ? ' ' : sep) + ch.toUpperCase())
}

function parseGitHubOrgUrl(input) {
  const trimmed = input.trim().replace(/\/+$/, '')
  const urlMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s?#]+)/)
  if (urlMatch) return urlMatch[1].toLowerCase()
  if (/^[a-zA-Z0-9_.-]+$/.test(trimmed)) return trimmed.toLowerCase()
  return null
}

function onGithubOrgInput(e) {
  const raw = e.target ? e.target.value : selectedGithubOrg.value
  const parsed = parseGitHubOrgUrl(raw)
  if (parsed && parsed !== selectedGithubOrg.value) {
    selectedGithubOrg.value = parsed
  }
  if (!nameManuallyEdited.value && selectedGithubOrg.value) {
    orgName.value = toTitleCase(selectedGithubOrg.value)
  }
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

watch(selectedGithubOrg, (slug) => {
  clearTimeout(orgLookupTimer)
  if (!isCreateMode.value) return

  if (!slug || slug.trim().length < 2) {
    orgLookupStatus.value = 'idle'
    orgInfo.value = null
    return
  }

  orgLookupStatus.value = 'checking'
  orgLookupTimer = setTimeout(async () => {
    try {
      const data = await apiRequest(`${MODULE_API}/org-info?org=${encodeURIComponent(slug.trim())}`)
      orgLookupStatus.value = 'found'
      orgInfo.value = data
      if (!nameManuallyEdited.value) {
        orgName.value = data.name || toTitleCase(slug)
      }
    } catch (err) {
      orgLookupStatus.value = err.status === 404 ? 'not_found' : 'error'
      orgInfo.value = null
    }
  }, 600)
})

function switchToCreateMode() {
  internalMode.value = 'create'
  selectedGithubOrg.value = ''
  orgName.value = ''
  governanceModel.value = 'none'
  orgDropdownOpen.value = false
}

function resetForm() {
  internalMode.value = 'auto'
  selectedGithubOrg.value = ''
  orgName.value = props.org?.name || ''
  governanceModel.value = props.org?.governanceModel || 'none'
  participation.value = props.org?.strategicParticipation || ''
  leadership.value = props.org?.strategicLeadership || ''
  submitStatus.value = 'idle'
  submitError.value = ''
  orgDropdownOpen.value = false
  orgSearch.value = ''
  governanceDropdownOpen.value = false
  participationDropdownOpen.value = false
  leadershipDropdownOpen.value = false
  orgLookupStatus.value = 'idle'
  orgInfo.value = null
  nameManuallyEdited.value = false
  clearTimeout(orgLookupTimer)
}

function selectOption(type, value) {
  if (type === 'governance') {
    governanceModel.value = value
    governanceDropdownOpen.value = false
  } else if (type === 'participation') {
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

function getGovernanceColor(value) {
  if (value === 'owners') return { dot: 'bg-violet-500', text: 'text-violet-700 dark:text-violet-400' }
  if (value === 'codeowners') return { dot: 'bg-cyan-500', text: 'text-cyan-700 dark:text-cyan-400' }
  return { dot: 'bg-gray-300 dark:bg-gray-600', text: 'text-gray-500 dark:text-gray-400' }
}

async function handleSubmit() {
  if (!canSubmit.value) return
  submitStatus.value = 'submitting'
  submitError.value = ''

  try {
    if (isCreateMode.value) {
      await apiRequest(`${MODULE_API}/orgs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubOrg: selectedGithubOrg.value.toLowerCase(),
          name: orgName.value,
          governanceModel: governanceModel.value,
          strategicParticipation: participation.value || null,
          strategicLeadership: leadership.value || null,
        }),
      })
    } else if (isAddStrategyMode.value) {
      await apiRequest(`${MODULE_API}/orgs/${encodeURIComponent(selectedGithubOrg.value)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategicParticipation: participation.value || null,
          strategicLeadership: leadership.value || null,
        }),
      })
    } else {
      await apiRequest(`${MODULE_API}/orgs/${encodeURIComponent(targetGithubOrg.value)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orgName.value,
          governanceModel: governanceModel.value,
          strategicParticipation: participation.value || null,
          strategicLeadership: leadership.value || null,
        }),
      })
    }
    submitStatus.value = 'success'
    setTimeout(() => emit('saved'), 600)
  } catch (err) {
    submitStatus.value = 'error'
    submitError.value = err.message || 'Failed to save organization'
  }
}

function onBackdropClick() {
  if (submitStatus.value !== 'submitting') emit('close')
}

function onEscape(e) {
  if (e.key === 'Escape' && submitStatus.value !== 'submitting') {
    if (orgDropdownOpen.value) { orgDropdownOpen.value = false; return }
    if (governanceDropdownOpen.value) { governanceDropdownOpen.value = false; return }
    if (participationDropdownOpen.value) { participationDropdownOpen.value = false; return }
    if (leadershipDropdownOpen.value) { leadershipDropdownOpen.value = false; return }
    emit('close')
  }
}

function onClickOutside(e) {
  if (orgContainerRef.value && !orgContainerRef.value.contains(e.target)) orgDropdownOpen.value = false
  if (governanceContainerRef.value && !governanceContainerRef.value.contains(e.target)) governanceDropdownOpen.value = false
  if (participationContainerRef.value && !participationContainerRef.value.contains(e.target)) participationDropdownOpen.value = false
  if (leadershipContainerRef.value && !leadershipContainerRef.value.contains(e.target)) leadershipDropdownOpen.value = false
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
  clearTimeout(orgLookupTimer)
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
              <Building2Icon class="w-5 h-5 text-blue-600 dark:text-blue-400" :stroke-width="1.7" />
            </div>
            <div>
              <h3 class="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                {{ isCreateMode ? 'Add Organization' : isAddStrategyMode ? 'Add to Strategy' : 'Edit Organization' }}
              </h3>
              <p class="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">
                {{ isCreateMode ? 'Register a new upstream organization' : isAddStrategyMode ? 'Set strategic goals for an existing organization' : `Update settings for ${org?.name}` }}
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
                <p class="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                  {{ isCreateMode ? 'Organization added successfully' : isAddStrategyMode ? 'Strategy updated successfully' : 'Organization updated successfully' }}
                </p>
                <p class="text-[13px] text-emerald-700 dark:text-emerald-300 mt-1">
                  <span class="font-medium">{{ targetOrgName }}</span> has been saved.
                </p>
                <p class="text-[12px] text-emerald-600 dark:text-emerald-400 mt-2">
                  You can add projects for this organization from the Dashboard or Portfolio page.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Form -->
        <form v-if="submitStatus !== 'success'" @submit.prevent="handleSubmit" class="px-6 pb-6">
          <div class="space-y-4">
            <!-- Org picker (addStrategy mode) -->
            <div v-if="isAddStrategyMode">
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
                    <div v-if="filteredOrgs.length === 0" class="px-4 py-5 text-center">
                      <p class="text-sm text-gray-400 dark:text-gray-500">
                        {{ orgSearch ? `No organizations match "${orgSearch}"` : 'All organizations already have strategic classifications.' }}
                      </p>
                      <button
                        type="button"
                        @click="switchToCreateMode(); orgDropdownOpen = false"
                        class="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                      >
                        <PlusIcon :size="14" />
                        Create new organization
                      </button>
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
              <p class="mt-2 text-[12px] text-gray-400 dark:text-gray-500">
                Organization not listed?
                <button type="button" @click="switchToCreateMode" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium">
                  Create new organization
                </button>
              </p>
            </div>

            <!-- GitHub Org slug (create mode) -->
            <div v-else-if="isCreateMode">
              <label class="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                GitHub Organization <span class="text-red-400">*</span>
              </label>
              <div class="relative">
                <input
                  v-model="selectedGithubOrg"
                  type="text"
                  placeholder="Paste GitHub URL or type org slug..."
                  :disabled="submitStatus === 'submitting'"
                  class="w-full pl-3 pr-10 py-2.5 text-sm border rounded-xl outline-none transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:bg-gray-50 dark:disabled:bg-gray-800"
                  :class="{
                    'border-emerald-300 dark:border-emerald-600 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500': orgLookupStatus === 'found',
                    'border-red-300 dark:border-red-600 focus:ring-2 focus:ring-red-500 focus:border-red-500': orgLookupStatus === 'not_found',
                    'border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500': orgLookupStatus !== 'found' && orgLookupStatus !== 'not_found',
                  }"
                  @input="onGithubOrgInput"
                />
                <div class="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2Icon v-if="orgLookupStatus === 'checking'" class="w-4 h-4 text-gray-400 animate-spin" />
                  <CheckCircle2Icon v-else-if="orgLookupStatus === 'found'" class="w-4 h-4 text-emerald-500" />
                  <AlertCircleIcon v-else-if="orgLookupStatus === 'not_found'" class="w-4 h-4 text-red-400" />
                </div>
              </div>

              <!-- Org info card -->
              <div v-if="orgLookupStatus === 'found' && orgInfo" class="rounded-lg bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 px-3 py-2.5 mt-2">
                <div class="flex items-start gap-3">
                  <img v-if="orgInfo.avatarUrl" :src="orgInfo.avatarUrl" :alt="orgInfo.name" class="w-10 h-10 rounded-lg shrink-0" />
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <CheckCircle2Icon class="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span class="text-[13px] font-medium text-gray-900 dark:text-gray-100 truncate">{{ orgInfo.name }}</span>
                      <span v-if="orgInfo.type !== 'Organization'" class="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium shrink-0">User account</span>
                    </div>
                    <p v-if="orgInfo.description" class="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 ml-[22px]">{{ orgInfo.description }}</p>
                    <span class="text-[11px] text-gray-400 dark:text-gray-500 ml-[22px]">{{ orgInfo.publicRepos }} public repos</span>
                  </div>
                </div>
              </div>

              <!-- Not found message -->
              <p v-if="orgLookupStatus === 'not_found'" class="mt-1.5 text-[12px] text-red-500 dark:text-red-400">
                Organization "{{ selectedGithubOrg }}" was not found on GitHub.
              </p>

              <!-- Already exists warning -->
              <p v-if="alreadyExists" class="mt-1.5 text-[12px] text-amber-600 dark:text-amber-400">
                This organization is already being tracked.
              </p>
            </div>

            <!-- GitHub Org slug (edit mode, read-only) -->
            <div v-else>
              <label class="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                GitHub Organization
              </label>
              <div class="w-full flex items-center gap-2 px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
                <Building2Icon class="w-4 h-4 text-gray-400 shrink-0" />
                <span>{{ org?.githubOrg }}</span>
              </div>
            </div>

            <!-- Display name (create + edit modes only) -->
            <div v-if="!isAddStrategyMode">
              <label class="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Display Name <span v-if="isCreateMode" class="text-red-400">*</span>
                <span v-if="isCreateMode && !nameManuallyEdited && orgName" class="text-gray-400 font-normal ml-1">auto-filled</span>
              </label>
              <input
                v-model="orgName"
                type="text"
                :placeholder="isCreateMode ? 'e.g. Kubernetes' : org?.name"
                :disabled="submitStatus === 'submitting'"
                class="w-full px-3 py-2.5 text-sm border rounded-xl bg-white dark:bg-gray-700 outline-none transition-all disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                @input="nameManuallyEdited = true"
              />
            </div>

            <!-- Governance model (create + edit modes only) -->
            <div v-if="!isAddStrategyMode">
              <label class="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Governance Model
              </label>
              <div ref="governanceContainerRef" class="relative">
                <button
                  type="button"
                  @click="governanceDropdownOpen = !governanceDropdownOpen; participationDropdownOpen = false; leadershipDropdownOpen = false"
                  :disabled="submitStatus === 'submitting'"
                  class="w-full flex items-center justify-between pl-3 pr-3 py-2.5 text-sm border rounded-xl bg-white dark:bg-gray-700 outline-none transition-all disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
                  :class="governanceDropdownOpen
                    ? 'border-blue-500 ring-2 ring-blue-500'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'"
                >
                  <span class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full shrink-0" :class="getGovernanceColor(governanceModel).dot"></span>
                    <span class="font-medium text-gray-900 dark:text-gray-100">{{ governanceLabel }}</span>
                  </span>
                  <ChevronDownIcon class="w-4 h-4 text-gray-400 shrink-0 ml-2 transition-transform" :class="{ 'rotate-180': governanceDropdownOpen }" />
                </button>

                <div v-if="governanceDropdownOpen" class="absolute z-50 mt-1.5 w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 shadow-xl overflow-hidden py-1">
                  <button
                    v-for="opt in governanceOptions"
                    :key="opt.value"
                    type="button"
                    @click="selectOption('governance', opt.value)"
                    class="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    :class="{ 'bg-blue-50 dark:bg-blue-900/30': governanceModel === opt.value }"
                  >
                    <span class="w-2.5 h-2.5 rounded-full shrink-0" :class="getGovernanceColor(opt.value).dot"></span>
                    <div class="flex-1 min-w-0">
                      <span class="text-sm font-medium" :class="governanceModel === opt.value ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'">{{ opt.label }}</span>
                      <p class="text-[11px] text-gray-400 dark:text-gray-500">{{ opt.description }}</p>
                    </div>
                    <CheckIcon v-if="governanceModel === opt.value" class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  </button>
                </div>
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
                  @click="participationDropdownOpen = !participationDropdownOpen; leadershipDropdownOpen = false; governanceDropdownOpen = false"
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
                  @click="leadershipDropdownOpen = !leadershipDropdownOpen; participationDropdownOpen = false; governanceDropdownOpen = false"
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


            <!-- Submit error -->
            <div v-if="submitStatus === 'error'" class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
              <div class="flex items-start gap-3">
                <AlertCircleIcon class="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p class="text-sm font-medium text-red-800 dark:text-red-200">Failed to save organization</p>
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
              {{ submitStatus === 'submitting' ? 'Saving...' : isCreateMode ? 'Add Organization' : isAddStrategyMode ? 'Add to Strategy' : 'Save Changes' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
