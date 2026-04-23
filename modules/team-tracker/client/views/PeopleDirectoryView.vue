<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const nav = inject('moduleNav')

const people = ref([])
const stats = ref(null)
const syncStatus = ref(null)
const orgDisplayNames = ref({})
const loading = ref(true)
const search = ref('')
const selectedOrgs = ref([])
const selectedGeos = ref([])
const sortField = ref('name')
const sortAsc = ref(true)


async function loadData() {
  loading.value = true
  try {
    const [peopleRes, statsRes, syncRes] = await Promise.all([
      apiRequest('/modules/team-tracker/registry/people'),
      apiRequest('/modules/team-tracker/registry/stats'),
      apiRequest('/modules/team-tracker/ipa/sync/status')
    ])
    people.value = peopleRes.people || []
    stats.value = statsRes
    syncStatus.value = syncRes
    orgDisplayNames.value = statsRes.orgDisplayNames || {}
  } catch {
    people.value = []
  } finally {
    loading.value = false
  }
}

function orgName(uid) {
  return orgDisplayNames.value[uid] || uid
}

const orgs = computed(() => {
  const set = new Set()
  for (const p of people.value) {
    if (p.orgRoot) set.add(p.orgRoot)
  }
  return Array.from(set)
    .map(uid => ({ uid, name: orgName(uid) }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const geos = computed(() => {
  const set = new Set()
  for (const p of people.value) {
    if (p.geo) set.add(p.geo)
  }
  return Array.from(set).sort()
})

const filteredStats = computed(() => {
  const list = filtered.value
  const ghCount = list.filter(p => p.github && p.github.username).length
  const glCount = list.filter(p => p.gitlab && p.gitlab.username).length
  return {
    total: list.length,
    github: ghCount,
    gitlab: glCount
  }
})

const filtered = computed(() => {
  let list = people.value.filter(p => p.status === 'active')

  if (selectedOrgs.value.length > 0) {
    const orgSet = new Set(selectedOrgs.value)
    list = list.filter(p => orgSet.has(p.orgRoot))
  }
  if (selectedGeos.value.length > 0) {
    const geoSet = new Set(selectedGeos.value)
    list = list.filter(p => geoSet.has(p.geo))
  }
  if (search.value) {
    const term = search.value.toLowerCase()
    list = list.filter(p => {
      const searchable = [
        p.name, p.email, p.uid,
        p.github ? p.github.username : '',
        p.gitlab ? p.gitlab.username : ''
      ].join(' ').toLowerCase()
      return searchable.includes(term)
    })
  }

  list = [...list].sort((a, b) => {
    let av = a[sortField.value] || ''
    let bv = b[sortField.value] || ''
    if (sortField.value === 'orgDisplayName') {
      av = a.orgDisplayName || ''
      bv = b.orgDisplayName || ''
    }
    if (sortField.value === 'teams') {
      av = (a.teams || []).join(', ')
      bv = (b.teams || []).join(', ')
    }
    const cmp = String(av).localeCompare(String(bv))
    return sortAsc.value ? cmp : -cmp
  })

  return list
})

function toggleSort(field) {
  if (sortField.value === field) {
    sortAsc.value = !sortAsc.value
  } else {
    sortField.value = field
    sortAsc.value = true
  }
}

function sortIcon(field) {
  if (sortField.value !== field) return ''
  return sortAsc.value ? ' \u25B2' : ' \u25BC'
}

function openPerson(uid) {
  nav.navigateTo('person-detail', { uid })
}


function exportCsv() {
  const rows = [['Org', 'Name', 'UID', 'Email', 'Title', 'Geo', 'Location', 'Team(s)', 'GitHub', 'GitLab']]
  for (const p of filtered.value) {
    rows.push([
      p.orgDisplayName || '', p.name, p.uid, p.email, p.title, p.geo || '',
      p.location || '', (p.teams || []).join(', '),
      p.github ? p.github.username : '', p.gitlab ? p.gitlab.username : ''
    ])
  }
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'people-' + new Date().toISOString().slice(0, 10) + '.csv'
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(loadData)
</script>

<template>
  <div>
    <!-- Stats header -->
    <div v-if="!loading && people.length > 0" class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ filteredStats.total }}</div>
        <div class="text-xs text-gray-500 dark:text-gray-400">People</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div class="text-2xl font-bold text-green-600">{{ filteredStats.github }} <span class="text-sm font-normal text-gray-400">/ {{ filteredStats.total }}</span></div>
        <div class="text-xs text-gray-500 dark:text-gray-400">GitHub IDs <span class="text-green-600 font-medium">{{ filteredStats.total ? Math.round(filteredStats.github / filteredStats.total * 100) : 0 }}%</span></div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div class="text-2xl font-bold text-orange-600">{{ filteredStats.gitlab }} <span class="text-sm font-normal text-gray-400">/ {{ filteredStats.total }}</span></div>
        <div class="text-xs text-gray-500 dark:text-gray-400">GitLab IDs <span class="text-orange-600 font-medium">{{ filteredStats.total ? Math.round(filteredStats.gitlab / filteredStats.total * 100) : 0 }}%</span></div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!loading && people.length === 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
      <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">No People Yet</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400">Configure IPA org roots and run a sync in the module settings to populate the registry.</p>
    </div>

    <!-- Search + Filters + Table -->
    <div v-else-if="!loading" class="space-y-4">
      <div class="flex flex-col sm:flex-row gap-3">
        <div class="flex-1 relative">
          <input
            v-model="search"
            type="text"
            placeholder="Search by name, email, UID, GitHub, or GitLab..."
            class="w-full pl-4 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <button @click="exportCsv" class="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex-shrink-0">Export CSV</button>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex flex-wrap items-start gap-6">
        <!-- Orgs -->
        <div v-if="orgs.length > 0">
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Orgs</label>
          <div class="space-y-1 max-h-48 overflow-y-auto">
            <label
              v-for="org in orgs"
              :key="org.uid"
              class="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
            >
              <input
                type="checkbox"
                :value="org.uid"
                v-model="selectedOrgs"
                class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ org.name }}</span>
            </label>
          </div>
        </div>

        <!-- Geos -->
        <div v-if="geos.length > 0">
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Geo</label>
          <div class="space-y-1 max-h-48 overflow-y-auto">
            <label
              v-for="geo in geos"
              :key="geo"
              class="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
            >
              <input
                type="checkbox"
                :value="geo"
                v-model="selectedGeos"
                class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ geo }}</span>
            </label>
          </div>
        </div>

        <span class="text-sm text-gray-500 dark:text-gray-400 self-center ml-auto">{{ filtered.length }} results</span>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th @click="toggleSort('orgDisplayName')" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-200">Org{{ sortIcon('orgDisplayName') }}</th>
                <th @click="toggleSort('name')" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-200">Name{{ sortIcon('name') }}</th>
                <th @click="toggleSort('title')" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 hidden md:table-cell">Title{{ sortIcon('title') }}</th>
                <th @click="toggleSort('geo')" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 hidden lg:table-cell">Geo{{ sortIcon('geo') }}</th>
                <th @click="toggleSort('location')" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 hidden lg:table-cell">Location{{ sortIcon('location') }}</th>
                <th @click="toggleSort('teams')" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 hidden md:table-cell">Team(s){{ sortIcon('teams') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="p in filtered"
                :key="p.uid"
                class="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                @click="openPerson(p.uid)"
              >
                <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{{ p.orgDisplayName }}</td>
                <td class="px-4 py-3">
                  <div class="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline">{{ p.name }}</div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">{{ p.title }}</td>
                <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">{{ p.geo }}</td>
                <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">{{ p.location }}</td>
                <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">{{ (p.teams || []).join(', ') || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>
  </div>
</template>
