<script setup>
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import {
  X as XIcon,
  FolderGit2 as FolderGit2Icon,
  Link as LinkIcon,
  Loader2 as Loader2Icon,
  CheckCircle2 as CheckCircle2Icon,
  AlertCircle as AlertCircleIcon,
  ChevronDown as ChevronDownIcon,
  Sparkles as SparklesIcon,
  Play as PlayIcon,
  History as HistoryIcon,
  Search as SearchIcon,
  Building2 as Building2Icon,
  Check as CheckIcon,
  CircleDot as CircleDotIcon,
  Star as StarIcon,
  ArrowRight as ArrowRightIcon,
} from 'lucide-vue-next'
import { apiRequest } from '@shared/client/services/api'

const MODULE_API = '/modules/upstream-pulse'

const props = defineProps({
  open: { type: Boolean, default: false },
  prefilledOrg: { type: String, default: '' },
})

const emit = defineEmits(['close', 'created', 'navigate'])

const githubOrg = ref('')
const githubRepo = ref('')
const name = ref('')
const nameManuallyEdited = ref(false)
const primaryLanguage = ref('')
const startCollection = ref(true)
const fullHistory = ref(true)

const submitStatus = ref('idle')
const submitResult = ref(null)
const submitError = ref('')
const submitErrorCode = ref(0)

const repoLookupStatus = ref('idle')
const repoInfo = ref(null)

const orgs = ref([])
const orgsLoading = ref(false)

const orgSearch = ref('')
const orgDropdownOpen = ref(false)
const orgHighlightIdx = ref(0)
const orgSearchRef = ref(null)
const orgContainerRef = ref(null)

const repoInputRef = ref(null)
const quickInput = ref('')
let lookupTimer = null

function parseGitHubInput(input) {
  const trimmed = input.trim().replace(/\/+$/, '')
  // Match https://github.com/org/repo, github.com/org/repo, or org/repo
  const urlMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/\s?#]+)/)
  if (urlMatch) return { org: urlMatch[1], repo: urlMatch[2] }
  const shortMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/)
  if (shortMatch) return { org: shortMatch[1], repo: shortMatch[2] }
  return null
}

function onQuickInput(e) {
  const val = e.target.value
  quickInput.value = val
  const parsed = parseGitHubInput(val)
  if (parsed) {
    githubOrg.value = parsed.org
    githubRepo.value = parsed.repo
    nameManuallyEdited.value = false
  }
}

const sortedOrgs = computed(() =>
  [...orgs.value].sort((a, b) => a.name.localeCompare(b.name))
)

const filteredOrgs = computed(() => {
  if (!orgSearch.value.trim()) return sortedOrgs.value
  const q = orgSearch.value.toLowerCase()
  return sortedOrgs.value.filter(o =>
    o.name.toLowerCase().includes(q) || o.githubOrg.toLowerCase().includes(q)
  )
})

const selectedOrg = computed(() => orgs.value.find(o => o.githubOrg === githubOrg.value))
const ecosystem = computed(() => selectedOrg.value?.name ?? githubOrg.value ?? 'unknown')
const repoVerified = computed(() => repoLookupStatus.value === 'found')
const canSubmit = computed(() =>
  githubOrg.value.trim() &&
  githubRepo.value.trim() &&
  name.value.trim() &&
  repoVerified.value &&
  submitStatus.value !== 'submitting'
)

function humanizeName(repo) {
  return repo.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function resetForm() {
  githubOrg.value = props.prefilledOrg || ''
  githubRepo.value = ''
  name.value = ''
  nameManuallyEdited.value = false
  primaryLanguage.value = ''
  startCollection.value = true
  fullHistory.value = true
  submitStatus.value = 'idle'
  submitResult.value = null
  submitError.value = ''
  submitErrorCode.value = 0
  repoLookupStatus.value = 'idle'
  repoInfo.value = null
  quickInput.value = ''
}

async function fetchOrgs() {
  orgsLoading.value = true
  try {
    const data = await apiRequest(`${MODULE_API}/orgs?days=0`)
    orgs.value = data.orgs || []
  } catch {
    orgs.value = []
  } finally {
    orgsLoading.value = false
  }
}

function selectOrg(slug) {
  githubOrg.value = slug
  orgDropdownOpen.value = false
  repoLookupStatus.value = 'idle'
  nextTick(() => repoInputRef.value?.focus())
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
  } else if (e.key === 'Tab') {
    orgDropdownOpen.value = false
  }
}

watch(orgSearch, () => { orgHighlightIdx.value = 0 })

function onOrgClickOutside(e) {
  if (orgContainerRef.value && !orgContainerRef.value.contains(e.target)) {
    orgDropdownOpen.value = false
  }
}

watch(orgDropdownOpen, (open) => {
  if (open) {
    document.addEventListener('mousedown', onOrgClickOutside)
  } else {
    document.removeEventListener('mousedown', onOrgClickOutside)
  }
})

watch([githubOrg, githubRepo], ([org, repo]) => {
  clearTimeout(lookupTimer)
  org = org.trim()
  repo = repo.trim()

  if (!org || !repo) {
    repoLookupStatus.value = 'idle'
    repoInfo.value = null
    if (!nameManuallyEdited.value) name.value = ''
    primaryLanguage.value = ''
    return
  }

  if (!nameManuallyEdited.value) name.value = humanizeName(repo)
  repoLookupStatus.value = 'checking'

  lookupTimer = setTimeout(async () => {
    try {
      const info = await apiRequest(
        `${MODULE_API}/repo-info?org=${encodeURIComponent(org)}&repo=${encodeURIComponent(repo)}`
      )
      repoLookupStatus.value = 'found'
      repoInfo.value = info
      if (!nameManuallyEdited.value) name.value = humanizeName(info.name)
      if (info.language) primaryLanguage.value = info.language
    } catch (err) {
      if (err.status === 404) {
        repoLookupStatus.value = 'not_found'
      } else {
        repoLookupStatus.value = 'error'
      }
      repoInfo.value = null
      primaryLanguage.value = ''
    }
  }, 600)
})

async function handleSubmit() {
  if (!canSubmit.value) return
  submitStatus.value = 'submitting'
  submitError.value = ''

  try {
    const result = await apiRequest(`${MODULE_API}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.value.trim(),
        githubOrg: githubOrg.value.trim(),
        githubRepo: githubRepo.value.trim(),
        ecosystem: ecosystem.value,
        primaryLanguage: primaryLanguage.value.trim() || undefined,
        startCollection: startCollection.value,
        fullHistory: fullHistory.value,
      }),
    })
    submitStatus.value = 'success'
    submitResult.value = result
    emit('created', result)
  } catch (err) {
    submitStatus.value = 'error'
    submitError.value = err.message || 'Unknown error'
    submitErrorCode.value = err.status || 0
  }
}

function addAnother() {
  githubRepo.value = ''
  name.value = ''
  nameManuallyEdited.value = false
  primaryLanguage.value = ''
  repoLookupStatus.value = 'idle'
  repoInfo.value = null
  submitStatus.value = 'idle'
  submitResult.value = null
}

function onBackdropClick() {
  if (submitStatus.value !== 'submitting') emit('close')
}

function onEscape(e) {
  if (e.key === 'Escape' && submitStatus.value !== 'submitting') {
    emit('close')
  }
}

function formatStars(stars) {
  return stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars
}

watch(() => props.open, (open) => {
  if (open) {
    resetForm()
    fetchOrgs()
    document.addEventListener('keydown', onEscape)
  } else {
    document.removeEventListener('keydown', onEscape)
    clearTimeout(lookupTimer)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onEscape)
  document.removeEventListener('mousedown', onOrgClickOutside)
  clearTimeout(lookupTimer)
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
              <FolderGit2Icon class="w-5 h-5 text-blue-600 dark:text-blue-400" :stroke-width="1.7" />
            </div>
            <div>
              <h3 class="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Add Project</h3>
              <p class="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">Track a new upstream repository</p>
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
              <div class="min-w-0">
                <p class="text-sm font-medium text-emerald-900 dark:text-emerald-200">Project created successfully</p>
                <p class="text-[13px] text-emerald-700 dark:text-emerald-300 mt-1">
                  <span class="font-medium">{{ submitResult.project.name }}</span>
                  ({{ submitResult.project.githubOrg }}/{{ submitResult.project.githubRepo }})
                </p>
                <div class="mt-3 space-y-1.5 text-[12px] text-emerald-700 dark:text-emerald-300">
                  <div v-if="submitResult.governance" class="flex items-center gap-1.5">
                    <SparklesIcon class="w-3.5 h-3.5" />
                    Governance collection started
                  </div>
                  <div v-if="submitResult.leadership" class="flex items-center gap-1.5">
                    <SparklesIcon class="w-3.5 h-3.5" />
                    Leadership refresh queued
                  </div>
                  <div v-if="submitResult.collection" class="flex items-center gap-1.5">
                    <PlayIcon class="w-3.5 h-3.5" />
                    Contribution collection started
                    <span v-if="submitResult.repoCreatedAt" class="text-emerald-600 dark:text-emerald-400">
                      (from {{ new Date(submitResult.repoCreatedAt).getFullYear() }})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="submitResult.jobErrors?.length" class="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 mt-3">
            <div class="flex items-start gap-2.5">
              <AlertCircleIcon class="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p class="text-[13px] font-medium text-amber-800 dark:text-amber-200">Some background jobs could not be queued</p>
                <p class="text-[12px] text-amber-600 dark:text-amber-400 mt-0.5">
                  The project was created, but {{ submitResult.jobErrors.join(', ') }}
                  job{{ submitResult.jobErrors.length > 1 ? 's' : '' }} failed to queue.
                </p>
              </div>
            </div>
          </div>

          <button
            @click="emit('navigate', { view: 'project-detail', params: { projectId: submitResult.project.id } }); emit('close')"
            class="flex items-center justify-between w-full px-3 py-2.5 mt-3 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
          >
            <span>View project &amp; track collection progress</span>
            <ArrowRightIcon class="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
          </button>

          <div class="flex justify-end mt-3 gap-2.5">
            <button
              @click="addAnother"
              class="px-4 py-2 text-[13px] font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors"
            >Add Another</button>
            <button
              @click="emit('close')"
              class="px-4 py-2 text-[13px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
            >Done</button>
          </div>
        </div>

        <!-- Form -->
        <form v-if="submitStatus !== 'success'" @submit.prevent="handleSubmit" class="px-6 pb-6">
          <div class="space-y-4">
            <!-- Quick URL input -->
            <div>
              <label class="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">GitHub URL</label>
              <div class="relative">
                <LinkIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  :value="quickInput"
                  @input="onQuickInput"
                  type="text"
                  placeholder="Paste a URL or type org/repo..."
                  :disabled="submitStatus === 'submitting'"
                  class="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>
            </div>

            <div class="relative">
              <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-gray-200 dark:border-gray-700"></div></div>
              <div class="relative flex justify-center"><span class="px-2 text-xs text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800">or fill in manually</span></div>
            </div>

            <!-- Organization combobox -->
            <div>
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
                  <span v-if="selectedOrg" class="flex items-center gap-2 min-w-0">
                    <Building2Icon class="w-4 h-4 text-gray-400 shrink-0" />
                    <span class="truncate font-medium text-gray-900 dark:text-gray-100">{{ selectedOrg.name }}</span>
                    <span class="text-gray-400 dark:text-gray-500 shrink-0">{{ selectedOrg.githubOrg }}</span>
                  </span>
                  <span v-else-if="githubOrg" class="flex items-center gap-2 min-w-0">
                    <Building2Icon class="w-4 h-4 text-gray-400 shrink-0" />
                    <span class="truncate font-medium text-gray-900 dark:text-gray-100">{{ githubOrg }}</span>
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
                      No organizations match "{{ orgSearch }}"
                    </div>
                    <button
                      v-for="(org, idx) in filteredOrgs"
                      :key="org.githubOrg"
                      type="button"
                      @click="selectOrg(org.githubOrg)"
                      @mouseenter="orgHighlightIdx = idx"
                      class="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                      :class="{
                        'bg-blue-50 dark:bg-blue-900/30': idx === orgHighlightIdx,
                        'bg-gray-50 dark:bg-gray-700/50': org.githubOrg === githubOrg && idx !== orgHighlightIdx,
                      }"
                    >
                      <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        :class="org.githubOrg === githubOrg ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-gray-100 dark:bg-gray-700'">
                        <Building2Icon class="w-4 h-4" :class="org.githubOrg === githubOrg ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="text-sm font-medium truncate" :class="org.githubOrg === githubOrg ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'">{{ org.name }}</span>
                          <span class="text-xs text-gray-400 dark:text-gray-500 shrink-0">{{ org.githubOrg }}</span>
                        </div>
                        <span class="text-[11px] text-gray-400 dark:text-gray-500">
                          {{ org.projectCount }} project{{ org.projectCount !== 1 ? 's' : '' }} tracked
                        </span>
                      </div>
                      <CheckIcon v-if="org.githubOrg === githubOrg" class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Repository -->
            <div>
              <label class="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Repository Name <span class="text-red-400">*</span>
              </label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500 select-none pointer-events-none whitespace-nowrap">{{ githubOrg || '...' }}/</span>
                <input
                  ref="repoInputRef"
                  v-model="githubRepo"
                  type="text"
                  placeholder="e.g. model-registry"
                  :disabled="submitStatus === 'submitting'"
                  :style="{ paddingLeft: `${((githubOrg || '...').length + 1) * 0.52 + 0.75}rem` }"
                  class="w-full pr-10 py-2.5 text-sm border rounded-xl outline-none transition-colors disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  :class="{
                    'border-emerald-300 dark:border-emerald-600 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500': repoLookupStatus === 'found',
                    'border-red-300 dark:border-red-600 focus:ring-2 focus:ring-red-500 focus:border-red-500': repoLookupStatus === 'not_found',
                    'border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500': repoLookupStatus !== 'found' && repoLookupStatus !== 'not_found',
                  }"
                />
                <div class="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2Icon v-if="repoLookupStatus === 'checking'" class="w-4 h-4 text-gray-400 animate-spin" />
                  <CheckCircle2Icon v-else-if="repoLookupStatus === 'found'" class="w-4 h-4 text-emerald-500" />
                  <AlertCircleIcon v-else-if="repoLookupStatus === 'not_found'" class="w-4 h-4 text-red-400" />
                </div>
              </div>

              <!-- Repo info card -->
              <div v-if="repoLookupStatus === 'found' && repoInfo" class="rounded-lg bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 px-3 py-2.5 mt-2">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <CheckCircle2Icon class="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span class="text-[13px] font-medium text-gray-900 dark:text-gray-100 truncate">{{ repoInfo.fullName }}</span>
                    </div>
                    <p v-if="repoInfo.description" class="text-[12px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 ml-[22px]">{{ repoInfo.description }}</p>
                  </div>
                  <div class="flex items-center gap-3 shrink-0 text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                    <span v-if="repoInfo.language" class="flex items-center gap-1">
                      <CircleDotIcon class="w-3 h-3" />
                      {{ repoInfo.language }}
                    </span>
                    <span class="flex items-center gap-1">
                      <StarIcon class="w-3 h-3" />
                      {{ formatStars(repoInfo.stars) }}
                    </span>
                  </div>
                </div>
              </div>
              <p v-if="repoLookupStatus === 'not_found'" class="mt-1.5 text-[12px] text-red-500 dark:text-red-400">
                Repository {{ githubOrg }}/{{ githubRepo }} was not found on GitHub.
                <a
                  :href="`https://github.com/${githubOrg}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="underline hover:text-red-700 dark:hover:text-red-300"
                >Browse {{ githubOrg }} repos</a>
              </p>
              <p v-if="repoLookupStatus === 'error'" class="mt-1.5 text-[12px] text-amber-600 dark:text-amber-400">
                Could not verify repository. You can still try to add it.
              </p>
            </div>

            <!-- Display Name -->
            <div>
              <label class="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Display Name <span class="text-red-400">*</span>
                <span v-if="!nameManuallyEdited && name" class="text-gray-400 font-normal ml-1">auto-filled</span>
              </label>
              <input
                v-model="name"
                @input="nameManuallyEdited = true"
                type="text"
                placeholder="Auto-generated from repo name"
                :disabled="submitStatus === 'submitting'"
                class="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <!-- Primary Language -->
            <div>
              <label class="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Primary Language
                <span class="text-gray-400 font-normal ml-1">
                  {{ repoLookupStatus === 'found' && repoInfo?.language ? 'from GitHub' : 'optional' }}
                </span>
              </label>
              <input
                v-model="primaryLanguage"
                type="text"
                placeholder="e.g. Python, Go, TypeScript"
                :disabled="submitStatus === 'submitting'"
                class="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <!-- Collection Options -->
            <div class="rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 p-4 space-y-3">
              <p class="text-[13px] font-medium text-gray-700 dark:text-gray-300">Collection Options</p>
              <label class="flex items-start gap-3 cursor-pointer group">
                <input
                  v-model="startCollection"
                  type="checkbox"
                  :disabled="submitStatus === 'submitting'"
                  class="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-gray-500 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                />
                <div>
                  <span class="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 flex items-center gap-1.5">
                    <PlayIcon class="w-3.5 h-3.5 text-gray-400" />
                    Start collection immediately
                  </span>
                  <p class="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">Begin collecting contributions right after creation</p>
                </div>
              </label>
              <label class="flex items-start gap-3 cursor-pointer group">
                <input
                  v-model="fullHistory"
                  type="checkbox"
                  :disabled="submitStatus === 'submitting' || !startCollection"
                  class="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-gray-500 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                />
                <div>
                  <span class="text-sm flex items-center gap-1.5" :class="startCollection ? 'text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100' : 'text-gray-400 dark:text-gray-500'">
                    <HistoryIcon class="w-3.5 h-3.5 text-gray-400" />
                    Full history
                  </span>
                  <p class="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">Collect from the repo's creation date (recommended for new projects)</p>
                </div>
              </label>
            </div>

            <!-- Submit error -->
            <div v-if="submitStatus === 'error'" class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
              <div class="flex items-start gap-3">
                <AlertCircleIcon class="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p class="text-sm font-medium text-red-800 dark:text-red-200">
                    {{ submitErrorCode === 409 ? 'Already tracked' : submitErrorCode === 404 ? 'Repository not found' : 'Failed to create project' }}
                  </p>
                  <p class="text-[13px] text-red-600 dark:text-red-400 mt-0.5">{{ submitError }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between mt-6">
            <div class="text-[12px] text-gray-400 dark:text-gray-500">
              <span v-if="repoLookupStatus === 'found' && repoInfo?.createdAt">
                Repo created {{ new Date(repoInfo.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) }}
              </span>
            </div>
            <div class="flex gap-2.5">
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
                {{ submitStatus === 'submitting' ? 'Creating...' : 'Add Project' }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
