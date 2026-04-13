<script setup>
import { ref, computed, onMounted, watch, inject } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'
import { useAuth } from '@shared/client/composables/useAuth.js'

const nav = inject('moduleNav')
const { isAdmin } = useAuth()

const person = ref(null)
const managerChain = ref([])
const directReports = ref([])
const loading = ref(true)
const error = ref(null)

const editField = ref(null)
const editValue = ref('')
const editSaving = ref(false)

const uid = computed(() => nav.params.value?.uid)

async function loadPerson() {
  if (!uid.value) return
  loading.value = true
  error.value = null
  try {
    const data = await apiRequest('/modules/team-data/people/' + uid.value)
    person.value = data.person
    managerChain.value = data.managerChain || []
    directReports.value = data.directReports || []
  } catch (e) {
    error.value = e.message || 'Person not found'
    person.value = null
  } finally {
    loading.value = false
  }
}

function goBack() {
  nav.navigateTo('people')
}

function openPerson(personUid) {
  nav.navigateTo('person-detail', { uid: personUid })
}

function startEdit(field) {
  editField.value = field
  if (field === 'github') {
    editValue.value = person.value.github ? person.value.github.username : ''
  } else {
    editValue.value = person.value.gitlab ? person.value.gitlab.username : ''
  }
}

async function saveEdit() {
  if (!editValue.value.trim() || !editField.value) return
  editSaving.value = true
  try {
    await apiRequest('/modules/team-data/people/' + uid.value + '/' + editField.value, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: editValue.value.trim() })
    })
    person.value[editField.value] = { username: editValue.value.trim(), source: 'manual' }
  } catch {
    // silently fail
  } finally {
    editSaving.value = false
    editField.value = null
    editValue.value = ''
  }
}

async function removeId(field) {
  try {
    await apiRequest('/modules/team-data/people/' + uid.value + '/' + field, { method: 'DELETE' })
    person.value[field] = null
  } catch {
    // silently fail
  }
}

async function reactivate() {
  try {
    await apiRequest('/modules/team-data/people/' + uid.value + '/reactivate', { method: 'POST' })
    person.value.status = 'active'
    person.value.inactiveSince = null
  } catch {
    // silently fail
  }
}

async function purge() {
  if (!confirm('Remove ' + person.value.name + ' from the registry? This cannot be undone.')) return
  try {
    await apiRequest('/modules/team-data/people/' + uid.value, { method: 'DELETE' })
    goBack()
  } catch {
    // silently fail
  }
}

function cancelEdit() {
  editField.value = null
  editValue.value = ''
}

function sourceLabel(source) {
  if (source === 'ldap') return 'from LDAP'
  if (source === 'manual') return 'set by admin'
  return source
}

watch(uid, loadPerson)
onMounted(loadPerson)
</script>

<template>
  <div>
    <!-- Breadcrumb -->
    <nav class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
      <button @click="goBack" class="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">People</button>
      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
      <span class="text-gray-900 dark:text-gray-100 font-medium">{{ person ? person.name : 'Loading...' }}</span>
    </nav>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
      <p class="text-red-600 dark:text-red-400">{{ error }}</p>
      <button @click="goBack" class="mt-3 text-sm text-primary-600 dark:text-primary-400 hover:underline">Back to People</button>
    </div>

    <template v-else-if="person">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Profile Card -->
        <div class="lg:col-span-2 space-y-6">
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div class="flex items-start justify-between mb-4">
              <div>
                <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  {{ person.name }}
                  <span v-if="person.status === 'inactive'" class="text-xs font-normal px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">Inactive</span>
                </h2>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{{ person.title }}</p>
              </div>
              <div v-if="isAdmin && person.status === 'inactive'" class="flex gap-2">
                <button @click="reactivate" class="px-3 py-1.5 text-xs bg-green-600 text-white rounded-md hover:bg-green-700">Reactivate</button>
                <button @click="purge" class="px-3 py-1.5 text-xs border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20">Purge</button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-gray-500 dark:text-gray-400">Email</span>
                <div><a :href="'mailto:' + person.email" class="text-primary-600 dark:text-primary-400 hover:underline">{{ person.email }}</a></div>
              </div>
              <div>
                <span class="text-gray-500 dark:text-gray-400">UID</span>
                <div class="text-gray-900 dark:text-gray-100 font-mono text-xs">{{ person.uid }}</div>
              </div>
              <div>
                <span class="text-gray-500 dark:text-gray-400">Location</span>
                <div class="text-gray-900 dark:text-gray-100">{{ person.city }}{{ person.country ? ', ' + person.country : '' }}</div>
              </div>
              <div>
                <span class="text-gray-500 dark:text-gray-400">Geo</span>
                <div class="text-gray-900 dark:text-gray-100">{{ person.geo || '—' }}</div>
              </div>
              <div>
                <span class="text-gray-500 dark:text-gray-400">Cost Center</span>
                <div class="text-gray-900 dark:text-gray-100">{{ person.costCenter || '—' }}</div>
              </div>
              <div>
                <span class="text-gray-500 dark:text-gray-400">Org</span>
                <div class="text-gray-900 dark:text-gray-100">{{ person.orgRoot || '—' }}</div>
              </div>
            </div>
          </div>

          <!-- Identity Section -->
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 uppercase tracking-wider">Identities</h3>
            <div class="space-y-4">
              <!-- GitHub -->
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-gray-900 dark:bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <svg class="w-5 h-5 text-white dark:text-gray-900" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                  </div>
                  <div>
                    <div class="text-sm font-medium text-gray-900 dark:text-gray-100">GitHub</div>
                    <template v-if="editField === 'github'">
                      <div class="flex items-center gap-2 mt-1">
                        <input v-model="editValue" @keyup.enter="saveEdit" @keyup.escape="cancelEdit" class="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 dark:text-gray-100 w-40" placeholder="username" autofocus />
                        <button @click="saveEdit" :disabled="editSaving" class="text-green-600 text-xs font-medium">Save</button>
                        <button @click="cancelEdit" class="text-gray-400 text-xs">Cancel</button>
                      </div>
                    </template>
                    <template v-else-if="person.github && person.github.username">
                      <a :href="'https://github.com/' + person.github.username" target="_blank" rel="noopener" class="text-sm text-primary-600 dark:text-primary-400 hover:underline">{{ person.github.username }}</a>
                      <span class="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{{ sourceLabel(person.github.source) }}</span>
                    </template>
                    <template v-else>
                      <span class="text-sm text-gray-400 dark:text-gray-500">Not set</span>
                    </template>
                  </div>
                </div>
                <div v-if="isAdmin && editField !== 'github'" class="flex gap-2">
                  <button @click="startEdit('github')" class="text-xs text-primary-600 dark:text-primary-400 hover:underline">{{ person.github && person.github.username ? 'Edit' : 'Set' }}</button>
                  <button v-if="person.github && person.github.source === 'manual'" @click="removeId('github')" class="text-xs text-red-500 hover:underline">Remove</button>
                </div>
              </div>

              <!-- GitLab -->
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center flex-shrink-0">
                    <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 014.82 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0118.6 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.51L23 13.45a.84.84 0 01-.35.94z"/></svg>
                  </div>
                  <div>
                    <div class="text-sm font-medium text-gray-900 dark:text-gray-100">GitLab</div>
                    <template v-if="editField === 'gitlab'">
                      <div class="flex items-center gap-2 mt-1">
                        <input v-model="editValue" @keyup.enter="saveEdit" @keyup.escape="cancelEdit" class="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 dark:text-gray-100 w-40" placeholder="username" autofocus />
                        <button @click="saveEdit" :disabled="editSaving" class="text-green-600 text-xs font-medium">Save</button>
                        <button @click="cancelEdit" class="text-gray-400 text-xs">Cancel</button>
                      </div>
                    </template>
                    <template v-else-if="person.gitlab && person.gitlab.username">
                      <a :href="'https://gitlab.com/' + person.gitlab.username" target="_blank" rel="noopener" class="text-sm text-primary-600 dark:text-primary-400 hover:underline">{{ person.gitlab.username }}</a>
                      <span class="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{{ sourceLabel(person.gitlab.source) }}</span>
                    </template>
                    <template v-else>
                      <span class="text-sm text-gray-400 dark:text-gray-500">Not set</span>
                    </template>
                  </div>
                </div>
                <div v-if="isAdmin && editField !== 'gitlab'" class="flex gap-2">
                  <button @click="startEdit('gitlab')" class="text-xs text-primary-600 dark:text-primary-400 hover:underline">{{ person.gitlab && person.gitlab.username ? 'Edit' : 'Set' }}</button>
                  <button v-if="person.gitlab && person.gitlab.source === 'manual'" @click="removeId('gitlab')" class="text-xs text-red-500 hover:underline">Remove</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Metadata -->
          <div class="text-xs text-gray-400 dark:text-gray-500 flex flex-wrap gap-4">
            <span>First seen: {{ person.firstSeenAt ? new Date(person.firstSeenAt).toLocaleDateString() : '—' }}</span>
            <span>Last seen: {{ person.lastSeenAt ? new Date(person.lastSeenAt).toLocaleDateString() : '—' }}</span>
            <span v-if="person.inactiveSince">Inactive since: {{ new Date(person.inactiveSince).toLocaleDateString() }}</span>
          </div>
        </div>

        <!-- Org Position Sidebar -->
        <div class="space-y-6">
          <!-- Manager Chain -->
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 uppercase tracking-wider">Manager Chain</h3>
            <div v-if="managerChain.length === 0" class="text-sm text-gray-400 dark:text-gray-500">No managers found</div>
            <div v-else class="space-y-1">
              <div v-for="(mgr, i) in [...managerChain].reverse()" :key="mgr.uid" class="flex items-center gap-2">
                <div class="flex flex-col items-center" :style="{ width: '16px' }">
                  <div v-if="i > 0" class="w-px h-3 bg-gray-300 dark:bg-gray-600"></div>
                  <div class="w-2 h-2 rounded-full" :class="i === managerChain.length - 1 ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'"></div>
                </div>
                <button @click="openPerson(mgr.uid)" class="text-sm text-primary-600 dark:text-primary-400 hover:underline truncate">{{ mgr.name }}</button>
                <span class="text-[10px] text-gray-400 dark:text-gray-500 truncate hidden sm:inline">{{ mgr.title }}</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="flex flex-col items-center" style="width: 16px">
                  <div class="w-px h-3 bg-gray-300 dark:bg-gray-600"></div>
                  <div class="w-2.5 h-2.5 rounded-full bg-gray-900 dark:bg-gray-100 ring-2 ring-primary-500"></div>
                </div>
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ person.name }}</span>
              </div>
            </div>
          </div>

          <!-- Direct Reports -->
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 uppercase tracking-wider">
              Direct Reports
              <span v-if="directReports.length > 0" class="font-normal text-gray-400 dark:text-gray-500">({{ directReports.length }})</span>
            </h3>
            <div v-if="directReports.length === 0" class="text-sm text-gray-400 dark:text-gray-500">No direct reports</div>
            <div v-else class="space-y-2">
              <button
                v-for="dr in directReports"
                :key="dr.uid"
                @click="openPerson(dr.uid)"
                class="w-full text-left flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div class="min-w-0">
                  <div class="text-sm text-primary-600 dark:text-primary-400 truncate">{{ dr.name }}</div>
                  <div class="text-[10px] text-gray-400 dark:text-gray-500 truncate">{{ dr.title }}</div>
                </div>
                <div class="flex gap-1 flex-shrink-0 ml-2">
                  <span class="w-2 h-2 rounded-full" :class="dr.github && dr.github.username ? 'bg-green-400' : 'bg-gray-300 dark:bg-gray-600'" :title="dr.github && dr.github.username ? 'GitHub: ' + dr.github.username : 'No GitHub'"></span>
                  <span class="w-2 h-2 rounded-full" :class="dr.gitlab && dr.gitlab.username ? 'bg-orange-400' : 'bg-gray-300 dark:bg-gray-600'" :title="dr.gitlab && dr.gitlab.username ? 'GitLab: ' + dr.gitlab.username : 'No GitLab'"></span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
