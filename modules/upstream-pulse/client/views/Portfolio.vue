<template>
  <div>
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Portfolio</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Organizations and projects your team is tracking</p>
      </div>
      <div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
        <button
          v-for="opt in periodOptions"
          :key="opt.value"
          @click="selectedDays = opt.value"
          class="px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200"
          :class="selectedDays === opt.value
            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-24">
      <div class="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 dark:border-gray-700 border-t-primary-600 mb-4"></div>
      <p class="text-sm text-gray-500 dark:text-gray-400">Loading portfolio...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Error loading portfolio</h3>
      <p class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>
    </div>

    <!-- Content -->
    <template v-else>
      <!-- Organizations -->
      <section class="mb-10">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Organizations
            <span class="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">({{ sortedOrgs.length }})</span>
          </h3>
        </div>

        <div v-if="orgs.length === 0" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 p-8 text-center">
          <Building2Icon :size="40" class="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p class="text-sm text-gray-500 dark:text-gray-400">No organizations configured yet</p>
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <OrgActivityCard
            v-for="org in sortedOrgs"
            :key="org.githubOrg"
            :org-name="org.name"
            :team-contributions="org.contributionCount || 0"
            :total-contributions="org.totalContributions || 0"
            :team-share-percent="org.teamSharePercent || 0"
            :percent-change="org.percentChange || 0"
            :active-team-members="org.activeTeamMembers || 0"
            :leadership-count="org.leadershipCount || 0"
            :maintainer-count="org.maintainerCount || 0"
            :project-count="org.projectCount || 0"
            :show-trend="selectedDays !== '0'"
          />
        </div>
      </section>

      <!-- Projects -->
      <section>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Projects
            <span class="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">({{ filteredProjects.length }})</span>
          </h3>
          <div class="relative max-w-xs w-full">
            <SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              v-model="searchInput"
              type="text"
              placeholder="Search by name, org, or repo..."
              class="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
            />
          </div>
        </div>

        <div v-if="filteredProjects.length === 0" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 p-8 text-center">
          <FolderIcon :size="40" class="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ searchQuery ? 'No projects match your search' : 'No projects configured yet' }}
          </p>
        </div>

        <div v-else class="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700/60">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-750">
              <tr>
                <th
                  v-for="col in columns"
                  :key="col.field"
                  @click="handleSort(col.field)"
                  class="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  :class="col.align === 'right' ? 'text-right' : 'text-left'"
                >
                  <div class="flex items-center" :class="col.align === 'right' ? 'justify-end' : ''">
                    {{ col.label }}
                    <span class="ml-1 text-gray-400">
                      <template v-if="sortField === col.field">
                        {{ sortDirection === 'asc' ? '↑' : '↓' }}
                      </template>
                      <template v-else>↕</template>
                    </span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="project in paginatedProjects"
                :key="project.id"
                class="group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <td class="px-6 py-4">
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ project.name }}</p>
                    <a
                      :href="`https://github.com/${project.githubOrg}/${project.githubRepo}`"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-0.5 mt-0.5"
                      @click.stop
                    >
                      {{ project.githubOrg }}/{{ project.githubRepo }}
                      <ExternalLinkIcon :size="12" />
                    </a>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="text-sm text-gray-700 dark:text-gray-300">{{ project.githubOrg }}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                    :class="project.trackingEnabled
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-400'"
                  >
                    {{ project.trackingEnabled ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td class="px-6 py-4 text-right">
                  <span class="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                    {{ project.teamContributions.toLocaleString() }}
                  </span>
                  <div class="hidden group-hover:flex items-center justify-end gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>{{ project.commits }} <span class="text-gray-400 dark:text-gray-500">commits</span></span>
                    <span>{{ project.prs }} <span class="text-gray-400 dark:text-gray-500">PRs</span></span>
                    <span>{{ project.reviews }} <span class="text-gray-400 dark:text-gray-500">reviews</span></span>
                    <span>{{ project.issues }} <span class="text-gray-400 dark:text-gray-500">issues</span></span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3">
            <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>Showing {{ startIdx + 1 }}–{{ Math.min(startIdx + pageSize, filteredProjects.length) }} of {{ filteredProjects.length }}</span>
              <span class="text-gray-300 dark:text-gray-600">|</span>
              <label class="flex items-center gap-1">
                Rows:
                <select
                  v-model.number="pageSize"
                  class="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded px-1.5 py-0.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option v-for="size in pageSizeOptions" :key="size" :value="size">{{ size }}</option>
                </select>
              </label>
            </div>
            <div class="flex items-center gap-1">
              <button
                @click="currentPage = Math.max(1, currentPage - 1)"
                :disabled="currentPage <= 1"
                class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-600 dark:text-gray-400"
              >
                <ChevronLeftIcon :size="16" />
              </button>
              <span class="px-3 text-sm text-gray-600 dark:text-gray-400">{{ currentPage }} / {{ totalPages }}</span>
              <button
                @click="currentPage = Math.min(totalPages, currentPage + 1)"
                :disabled="currentPage >= totalPages"
                class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-600 dark:text-gray-400"
              >
                <ChevronRightIcon :size="16" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import {
  Search as SearchIcon,
  Folder as FolderIcon,
  Building2 as Building2Icon,
  ExternalLink as ExternalLinkIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon
} from 'lucide-vue-next'
import { apiRequest } from '@shared/client/services/api'
import OrgActivityCard from '../components/OrgActivityCard.vue'

const MODULE_API = '/modules/upstream-pulse'

const periodOptions = [
  { label: '30d', value: '30' },
  { label: '60d', value: '60' },
  { label: '90d', value: '90' },
  { label: 'All', value: '0' },
]

const pageSizeOptions = [10, 25, 50]

const columns = [
  { label: 'Project', field: 'name', align: 'left' },
  { label: 'Organization', field: 'githubOrg', align: 'left' },
  { label: 'Status', field: 'trackingEnabled', align: 'left' },
  { label: 'Team Contributions', field: 'teamContributions', align: 'right' }
]

const selectedDays = ref('0')
const loading = ref(true)
const error = ref(null)
const orgs = ref([])
const projects = ref([])
const topProjects = ref([])

const searchInput = ref('')
const searchQuery = ref('')
const sortField = ref('teamContributions')
const sortDirection = ref('desc')
const currentPage = ref(1)
const pageSize = ref(10)

let searchTimer = null
watch(searchInput, (val) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchQuery.value = val
    currentPage.value = 1
  }, 300)
})

watch(pageSize, () => { currentPage.value = 1 })

const sortedOrgs = computed(() =>
  [...orgs.value]
    .filter(o => (o.contributionCount || 0) > 0 || (o.leadershipCount || 0) > 0 || (o.maintainerCount || 0) > 0 || (o.projectCount || 0) > 0)
    .sort((a, b) => (b.contributionCount || 0) - (a.contributionCount || 0))
)

const mergedProjects = computed(() => {
  const metricsById = new Map()
  for (const p of topProjects.value) {
    metricsById.set(p.id, p)
  }
  return projects.value.map(p => {
    const m = metricsById.get(p.id)
    const contribs = m?.contributions || {}
    return {
      ...p,
      teamContributions: contribs.all?.team || 0,
      commits: contribs.commits?.team || 0,
      prs: contribs.pullRequests?.team || 0,
      reviews: contribs.reviews?.team || 0,
      issues: contribs.issues?.team || 0
    }
  })
})

const filteredProjects = computed(() => {
  if (!searchQuery.value.trim()) return sortedProjectsList.value
  const q = searchQuery.value.toLowerCase()
  return sortedProjectsList.value.filter(p =>
    p.name?.toLowerCase().includes(q) ||
    p.githubOrg?.toLowerCase().includes(q) ||
    p.githubRepo?.toLowerCase().includes(q)
  )
})

const sortedProjectsList = computed(() => {
  return [...mergedProjects.value].sort((a, b) => {
    if (sortField.value === 'trackingEnabled') {
      const cmp = (a.trackingEnabled === b.trackingEnabled) ? 0 : a.trackingEnabled ? -1 : 1
      return sortDirection.value === 'asc' ? cmp : -cmp
    }
    if (sortField.value === 'teamContributions') {
      const cmp = a.teamContributions - b.teamContributions
      return sortDirection.value === 'asc' ? cmp : -cmp
    }
    const aStr = (a[sortField.value] || '')
    const bStr = (b[sortField.value] || '')
    const cmp = String(aStr).localeCompare(String(bStr))
    return sortDirection.value === 'asc' ? cmp : -cmp
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredProjects.value.length / pageSize.value)))
const startIdx = computed(() => (Math.min(currentPage.value, totalPages.value) - 1) * pageSize.value)
const paginatedProjects = computed(() => filteredProjects.value.slice(startIdx.value, startIdx.value + pageSize.value))

function handleSort(field) {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDirection.value = field === 'teamContributions' ? 'desc' : 'asc'
  }
  currentPage.value = 1
}

async function loadData() {
  loading.value = true
  error.value = null
  try {
    const [orgsData, projectsData, dashData] = await Promise.all([
      apiRequest(`${MODULE_API}/orgs?days=${selectedDays.value}`),
      apiRequest(`${MODULE_API}/projects`),
      apiRequest(`${MODULE_API}/dashboard?days=${selectedDays.value}`)
    ])
    orgs.value = orgsData.orgs || []
    projects.value = projectsData.projects || []
    topProjects.value = dashData.topProjects || []
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

watch(selectedDays, () => loadData())
onMounted(() => loadData())
</script>
