<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'
import { useAuth } from '@shared/client/composables/useAuth.js'
import StatsHeader from '../components/StatsHeader.vue'

const nav = inject('moduleNav')
const { isAdmin } = useAuth()

const people = ref([])
const stats = ref(null)
const syncStatus = ref(null)
const loading = ref(true)
const search = ref('')
const filterOrg = ref('')
const filterGeo = ref('')
const filterStatus = ref('active')
const filterMissing = ref('')
const sortField = ref('name')
const sortAsc = ref(true)

const editingGithub = ref(null)
const editingGitlab = ref(null)
const editValue = ref('')
const editSaving = ref(false)

async function loadData() {
  loading.value = true
  try {
    const [peopleRes, statsRes, syncRes] = await Promise.all([
      apiRequest('/modules/team-data/people'),
      apiRequest('/modules/team-data/stats'),
      apiRequest('/modules/team-data/sync/status')
    ])
    people.value = peopleRes.people || []
    stats.value = statsRes
    syncStatus.value = syncRes
  } catch {
    people.value = []
  } finally {
    loading.value = false
  }
}

const orgs = computed(() => {
  const set = new Set()
  for (const p of people.value) {
    if (p.orgRoot) set.add(p.orgRoot)
  }
  return Array.from(set).sort()
})

const geos = computed(() => {
  const set = new Set()
  for (const p of people.value) {
    if (p.geo) set.add(p.geo)
  }
  return Array.from(set).sort()
})

const filtered = computed(() => {
  let list = people.value

  if (filterStatus.value) {
    list = list.filter(p => p.status === filterStatus.value)
  }
  if (filterOrg.value) {
    list = list.filter(p => p.orgRoot === filterOrg.value)
  }
  if (filterGeo.value) {
    list = list.filter(p => p.geo === filterGeo.value)
  }
  if (filterMissing.value === 'github') {
    list = list.filter(p => !p.github || !p.github.username)
  } else if (filterMissing.value === 'gitlab') {
    list = list.filter(p => !p.gitlab || !p.gitlab.username)
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
    if (sortField.value === 'github') {
      av = a.github ? a.github.username || '' : ''
      bv = b.github ? b.github.username || '' : ''
    }
    if (sortField.value === 'gitlab') {
      av = a.gitlab ? a.gitlab.username || '' : ''
      bv = b.gitlab ? b.gitlab.username || '' : ''
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

function startEditGithub(uid) {
  editingGithub.value = uid
  editingGitlab.value = null
  const p = people.value.find(x => x.uid === uid)
  editValue.value = p && p.github ? p.github.username : ''
}

function startEditGitlab(uid) {
  editingGitlab.value = uid
  editingGithub.value = null
  const p = people.value.find(x => x.uid === uid)
  editValue.value = p && p.gitlab ? p.gitlab.username : ''
}

async function saveEdit(uid, platform) {
  if (!editValue.value.trim()) return
  editSaving.value = true
  try {
    await apiRequest('/modules/team-data/people/' + uid + '/' + platform, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: editValue.value.trim() })
    })
    const p = people.value.find(x => x.uid === uid)
    if (p) {
      p[platform] = { username: editValue.value.trim(), source: 'manual' }
    }
  } catch {
    // silently fail
  } finally {
    editSaving.value = false
    editingGithub.value = null
    editingGitlab.value = null
    editValue.value = ''
  }
}

function cancelEdit() {
  editingGithub.value = null
  editingGitlab.value = null
  editValue.value = ''
}

function exportCsv() {
  const rows = [['Name', 'UID', 'Email', 'Title', 'Org', 'Geo', 'GitHub', 'GitLab', 'Status']]
  for (const p of filtered.value) {
    rows.push([
      p.name, p.uid, p.email, p.title, p.orgRoot || '', p.geo || '',
      p.github ? p.github.username : '', p.gitlab ? p.gitlab.username : '',
      p.status
    ])
  }
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'team-data-' + new Date().toISOString().slice(0, 10) + '.csv'
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(loadData)
</script>

<template>
  <div>
    <StatsHeader :stats="stats" :sync-status="syncStatus" />

    <!-- Empty state -->
    <div v-if="!loading && people.length === 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
      <div class="text-gray-400 dark:text-gray-500 mb-2">
        <svg class="w-12 h-12 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
      <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">No People Yet</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400">Configure org roots and run a sync in the module settings to populate the registry.</p>
    </div>

    <!-- Search + Filters -->
    <div v-else-if="!loading" class="space-y-4">
      <div class="flex flex-col sm:flex-row gap-3">
        <div class="flex-1 relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="search"
            type="text"
            placeholder="Search by name, email, UID, GitHub, or GitLab..."
            class="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <button
          @click="exportCsv"
          class="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 flex-shrink-0"
        >
          <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      <div class="flex flex-wrap gap-2">
        <select v-model="filterOrg" class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <option value="">All Orgs</option>
          <option v-for="org in orgs" :key="org" :value="org">{{ org }}</option>
        </select>
        <select v-model="filterGeo" class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <option value="">All Geos</option>
          <option v-for="geo in geos" :key="geo" :value="geo">{{ geo }}</option>
        </select>
        <select v-model="filterStatus" class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select v-model="filterMissing" class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <option value="">All IDs</option>
          <option value="github">Missing GitHub</option>
          <option value="gitlab">Missing GitLab</option>
        </select>
        <span class="text-sm text-gray-500 dark:text-gray-400 self-center ml-auto">{{ filtered.length }} results</span>
      </div>

      <!-- Table -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th @click="toggleSort('name')" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-200">Name{{ sortIcon('name') }}</th>
                <th @click="toggleSort('title')" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 hidden md:table-cell">Title{{ sortIcon('title') }}</th>
                <th @click="toggleSort('orgRoot')" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 hidden lg:table-cell">Org{{ sortIcon('orgRoot') }}</th>
                <th @click="toggleSort('geo')" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 hidden lg:table-cell">Geo{{ sortIcon('geo') }}</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">GitHub</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">GitLab</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="p in filtered"
                :key="p.uid"
                class="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                @click="openPerson(p.uid)"
              >
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <span v-if="p.status === 'inactive'" class="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" title="Inactive"></span>
                    <div>
                      <div class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ p.name }}</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400 md:hidden">{{ p.title }}</div>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">{{ p.title }}</td>
                <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">{{ p.orgRoot }}</td>
                <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">{{ p.geo }}</td>
                <td class="px-4 py-3 text-sm" @click.stop>
                  <template v-if="editingGithub === p.uid">
                    <div class="flex items-center gap-1">
                      <input v-model="editValue" @keyup.enter="saveEdit(p.uid, 'github')" @keyup.escape="cancelEdit" class="w-28 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-800 dark:text-gray-100" placeholder="username" />
                      <button @click="saveEdit(p.uid, 'github')" :disabled="editSaving" class="text-green-600 hover:text-green-700 text-xs font-medium">Save</button>
                      <button @click="cancelEdit" class="text-gray-400 hover:text-gray-600 text-xs">Cancel</button>
                    </div>
                  </template>
                  <template v-else-if="p.github && p.github.username">
                    <a :href="'https://github.com/' + p.github.username" target="_blank" rel="noopener" class="text-primary-600 dark:text-primary-400 hover:underline">{{ p.github.username }}</a>
                    <span v-if="p.github.source === 'manual'" class="ml-1 text-[10px] text-gray-400" title="Set by admin">M</span>
                  </template>
                  <template v-else>
                    <span class="text-gray-300 dark:text-gray-600">&mdash;</span>
                    <button v-if="isAdmin" @click="startEditGithub(p.uid)" class="ml-1 text-[10px] text-primary-500 hover:text-primary-700 opacity-0 group-hover:opacity-100" style="opacity: 1">set</button>
                  </template>
                </td>
                <td class="px-4 py-3 text-sm" @click.stop>
                  <template v-if="editingGitlab === p.uid">
                    <div class="flex items-center gap-1">
                      <input v-model="editValue" @keyup.enter="saveEdit(p.uid, 'gitlab')" @keyup.escape="cancelEdit" class="w-28 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-800 dark:text-gray-100" placeholder="username" />
                      <button @click="saveEdit(p.uid, 'gitlab')" :disabled="editSaving" class="text-green-600 hover:text-green-700 text-xs font-medium">Save</button>
                      <button @click="cancelEdit" class="text-gray-400 hover:text-gray-600 text-xs">Cancel</button>
                    </div>
                  </template>
                  <template v-else-if="p.gitlab && p.gitlab.username">
                    <a :href="'https://gitlab.com/' + p.gitlab.username" target="_blank" rel="noopener" class="text-primary-600 dark:text-primary-400 hover:underline">{{ p.gitlab.username }}</a>
                    <span v-if="p.gitlab.source === 'manual'" class="ml-1 text-[10px] text-gray-400" title="Set by admin">M</span>
                  </template>
                  <template v-else>
                    <span class="text-gray-300 dark:text-gray-600">&mdash;</span>
                    <button v-if="isAdmin" @click="startEditGitlab(p.uid)" class="ml-1 text-[10px] text-primary-500 hover:text-primary-700">set</button>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>
  </div>
</template>
