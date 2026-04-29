<script setup>
import { ref, computed, onMounted, watch, inject } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'
import { useAuth } from '@shared/client/composables/useAuth.js'
import { useRoster } from '@shared/client/composables/useRoster.js'
import { useGithubStats } from '@shared/client/composables/useGithubStats.js'
import { useGitlabStats } from '@shared/client/composables/useGitlabStats.js'

const nav = inject('moduleNav')
const { isAdmin } = useAuth()
const { getTeamsForPerson, teams: allTeams } = useRoster()
const { getContributions: getGithubContributions } = useGithubStats()
const { getContributions: getGitlabContributions, loadGitlabStats } = useGitlabStats()

const githubContribs = computed(() => {
  const username = person.value?.github?.username || rosterMember.value?.githubUsername
  return username ? getGithubContributions(username) : null
})

const gitlabContribs = computed(() => {
  const username = person.value?.gitlab?.username || rosterMember.value?.gitlabUsername
  return username ? getGitlabContributions(username) : null
})

const personTeams = computed(() => {
  if (!person.value) return []
  return getTeamsForPerson(person.value.name)
})

const rosterMember = computed(() => {
  if (!person.value) return null
  for (const t of allTeams.value) {
    const m = t.members.find(m => m.uid === person.value.uid)
    if (m) return m
  }
  return null
})

const personComponent = computed(() => {
  return rosterMember.value?.customFields?.component || null
})

const engineeringSpeciality = computed(() => {
  return rosterMember.value?.customFields?.engineeringSpeciality
    || rosterMember.value?.engineeringSpeciality
    || null
})

const person = ref(null)
const managerChain = ref([])
const directReports = ref([])
const jiraMetrics = ref(null)
const loading = ref(true)
const error = ref(null)

const showResolvedIssues = ref(true)
const showInProgressIssues = ref(true)
const editField = ref(null)
const editValue = ref('')
const editSaving = ref(false)

const uid = computed(() => nav.params.value?.uid)
const personName = computed(() => nav.params.value?.person)
const fromTeamKey = computed(() => nav.params.value?.teamKey)

async function loadPerson() {
  const lookupId = uid.value || personName.value
  if (!lookupId) return
  loading.value = true
  error.value = null
  try {
    const data = await apiRequest('/modules/team-tracker/registry/people/' + encodeURIComponent(lookupId))
    person.value = data.person
    managerChain.value = data.managerChain || []
    directReports.value = data.directReports || []

    if (person.value?.name) {
      try {
        jiraMetrics.value = await apiRequest(
          '/modules/team-tracker/person/' + encodeURIComponent(person.value.name) + '/metrics'
        )
      } catch {
        jiraMetrics.value = null
      }
    }
  } catch (e) {
    error.value = e.message || 'Person not found'
    person.value = null
  } finally {
    loading.value = false
  }
}

const fromTeam = computed(() => {
  if (!fromTeamKey.value) return null
  return allTeams.value.find(t => t.key === fromTeamKey.value || t.displayKey === fromTeamKey.value) || null
})

function goBack() {
  if (fromTeamKey.value) {
    nav.navigateTo('team-detail', { teamKey: fromTeamKey.value })
  } else {
    nav.navigateTo('people')
  }
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
    await apiRequest('/modules/team-tracker/registry/people/' + uid.value + '/' + editField.value, {
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
    await apiRequest('/modules/team-tracker/registry/people/' + uid.value + '/' + field, { method: 'DELETE' })
    person.value[field] = null
  } catch { /* silently fail */ }
}

async function reactivate() {
  try {
    await apiRequest('/modules/team-tracker/registry/people/' + uid.value + '/reactivate', { method: 'POST' })
    person.value.status = 'active'
    person.value.inactiveSince = null
  } catch { /* silently fail */ }
}

async function purge() {
  if (!confirm('Remove ' + person.value.name + ' from the registry? This cannot be undone.')) return
  try {
    await apiRequest('/modules/team-tracker/registry/people/' + uid.value, { method: 'DELETE' })
    goBack()
  } catch { /* silently fail */ }
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

watch([uid, personName], loadPerson)
onMounted(() => {
  loadPerson()
  loadGitlabStats()
})
</script>

<template>
  <div>
    <nav class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
      <button @click="goBack" class="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">{{ fromTeam?.displayName || 'People' }}</button>
      <span class="text-gray-300 dark:text-gray-600">›</span>
      <span class="text-gray-900 dark:text-gray-100 font-medium">{{ person ? person.name : 'Loading...' }}</span>
    </nav>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
      <p class="text-red-600 dark:text-red-400">{{ error }}</p>
      <button @click="goBack" class="mt-3 text-sm text-primary-600 dark:text-primary-400 hover:underline">Back to People</button>
    </div>

    <template v-else-if="person">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <!-- Profile Card -->
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div class="flex items-start gap-4 mb-5">
              <!-- Avatar -->
              <div class="w-14 h-14 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                <span class="text-xl font-bold text-white">{{ person.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ person.name }}</h2>
                  <span v-if="person.status === 'inactive'" class="text-xs font-normal px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">Inactive</span>
                  <span v-if="engineeringSpeciality" class="text-xs px-2.5 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium">{{ engineeringSpeciality }}</span>
                </div>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{{ person.title }}</p>
              </div>
              <div v-if="isAdmin && person.status === 'inactive'" class="flex gap-2 flex-shrink-0">
                <button @click="reactivate" class="px-3 py-1.5 text-xs bg-green-600 text-white rounded-md hover:bg-green-700">Reactivate</button>
                <button @click="purge" class="px-3 py-1.5 text-xs border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20">Purge</button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3 text-sm">
              <div class="flex items-center gap-2.5">
                <svg class="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <a :href="'mailto:' + person.email" class="text-primary-600 dark:text-primary-400 hover:underline truncate">{{ person.email }}</a>
              </div>
              <div class="flex items-center gap-2.5">
                <svg class="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
                </svg>
                <span class="text-gray-900 dark:text-gray-100 font-mono text-xs">{{ person.uid }}</span>
              </div>
              <div class="flex items-center gap-2.5">
                <svg class="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span class="text-gray-900 dark:text-gray-100">{{ person.city }}{{ person.country ? ', ' + person.country : '' }}</span>
              </div>
              <div class="flex items-center gap-2.5">
                <svg class="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="text-gray-900 dark:text-gray-100">{{ person.geo || '—' }}</span>
              </div>
              <div v-if="personComponent" class="flex items-center gap-2.5">
                <svg class="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <span class="text-gray-900 dark:text-gray-100">{{ personComponent }}</span>
              </div>
            </div>
          </div>

          <!-- Identities -->
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 uppercase tracking-wider">Identities</h3>
            <div class="space-y-4">
              <div v-for="platform in ['github', 'gitlab']" :key="platform" class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" :class="platform === 'github' ? 'bg-gray-900 dark:bg-gray-100' : 'bg-orange-600'">
                    <span class="text-xs font-bold" :class="platform === 'github' ? 'text-white dark:text-gray-900' : 'text-white'">{{ platform === 'github' ? 'GH' : 'GL' }}</span>
                  </div>
                  <div>
                    <div class="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">{{ platform }}</div>
                    <template v-if="editField === platform">
                      <div class="flex items-center gap-2 mt-1">
                        <input v-model="editValue" @keyup.enter="saveEdit" @keyup.escape="cancelEdit" class="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 dark:text-gray-100 w-40" placeholder="username" autofocus />
                        <button @click="saveEdit" :disabled="editSaving" class="text-green-600 text-xs font-medium">Save</button>
                        <button @click="cancelEdit" class="text-gray-400 text-xs">Cancel</button>
                      </div>
                    </template>
                    <template v-else-if="person[platform] && person[platform].username">
                      <a :href="(platform === 'github' ? 'https://github.com/' : 'https://gitlab.com/') + person[platform].username" target="_blank" rel="noopener" class="text-sm text-primary-600 dark:text-primary-400 hover:underline">{{ person[platform].username }}</a>
                      <span class="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{{ sourceLabel(person[platform].source) }}</span>
                    </template>
                    <template v-else>
                      <span class="text-sm text-gray-400 dark:text-gray-500">Not set</span>
                    </template>
                  </div>
                </div>
                <div v-if="isAdmin && editField !== platform" class="flex gap-2">
                  <button @click="startEdit(platform)" class="text-xs text-primary-600 dark:text-primary-400 hover:underline">{{ person[platform] && person[platform].username ? 'Edit' : 'Set' }}</button>
                  <button v-if="person[platform] && person[platform].source === 'manual'" @click="removeId(platform)" class="text-xs text-red-500 hover:underline">Remove</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Metrics -->
          <div v-if="(jiraMetrics && !jiraMetrics.nameNotFound) || githubContribs || gitlabContribs" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 uppercase tracking-wider">Metrics</h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <template v-if="jiraMetrics && !jiraMetrics.nameNotFound">
                <div>
                  <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ jiraMetrics.resolved?.issues?.length || 0 }}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">Resolved Issues</div>
                  <div class="text-[10px] text-gray-400 dark:text-gray-500">90 days</div>
                </div>
                <div>
                  <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ jiraMetrics.resolved?.storyPoints || 0 }}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">Story Points</div>
                  <div class="text-[10px] text-gray-400 dark:text-gray-500">90 days</div>
                </div>
                <div>
                  <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ jiraMetrics.cycleTime?.avgDays != null ? jiraMetrics.cycleTime.avgDays + 'd' : '—' }}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">Avg Cycle Time</div>
                </div>
              </template>
              <div v-if="person.github?.username">
                <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ githubContribs?.totalContributions ?? '—' }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">GitHub Contributions</div>
                <div class="text-[10px] text-gray-400 dark:text-gray-500">Last year</div>
              </div>
              <div v-if="person.gitlab?.username">
                <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ gitlabContribs?.totalContributions ?? '—' }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">GitLab Contributions</div>
                <div class="text-[10px] text-gray-400 dark:text-gray-500">Last year</div>
              </div>
            </div>
          </div>

          <!-- In-Progress Issues (collapsible) -->
          <div v-if="jiraMetrics?.inProgress?.issues?.length" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <button
              @click="showInProgressIssues = !showInProgressIssues"
              class="w-full px-6 py-4 flex items-center justify-between text-left"
            >
              <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                In Progress <span class="font-normal text-gray-400 normal-case tracking-normal">({{ jiraMetrics.inProgress.issues.length }})</span>
              </h3>
              <svg
                class="h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform"
                :class="{ 'rotate-180': showInProgressIssues }"
                xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            <div v-if="showInProgressIssues" class="border-t border-gray-200 dark:border-gray-700 overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Key</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Summary</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Points</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                  <tr v-for="issue in jiraMetrics.inProgress.issues" :key="issue.key" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td class="px-4 py-2 text-sm">
                      <a :href="`https://redhat.atlassian.net/browse/${issue.key}`" target="_blank" class="text-primary-600 hover:underline">{{ issue.key }}</a>
                    </td>
                    <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 max-w-md truncate">{{ issue.summary }}</td>
                    <td class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{{ issue.issueType }}</td>
                    <td class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{{ issue.status }}</td>
                    <td class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{{ issue.storyPoints || '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Resolved Issues (collapsible) -->
          <div v-if="jiraMetrics?.resolved?.issues?.length" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <button
              @click="showResolvedIssues = !showResolvedIssues"
              class="w-full px-6 py-4 flex items-center justify-between text-left"
            >
              <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                Resolved Issues <span class="font-normal text-gray-400 normal-case tracking-normal">({{ jiraMetrics.resolved.issues.length }})</span>
              </h3>
              <svg
                class="h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform"
                :class="{ 'rotate-180': showResolvedIssues }"
                xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            <div v-if="showResolvedIssues" class="border-t border-gray-200 dark:border-gray-700 overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Key</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Summary</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Points</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cycle Time</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Resolved</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                  <tr v-for="issue in jiraMetrics.resolved.issues" :key="issue.key" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td class="px-4 py-2 text-sm">
                      <a :href="`https://redhat.atlassian.net/browse/${issue.key}`" target="_blank" class="text-primary-600 hover:underline">{{ issue.key }}</a>
                    </td>
                    <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 max-w-md truncate">{{ issue.summary }}</td>
                    <td class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{{ issue.issueType }}</td>
                    <td class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{{ issue.storyPoints || '—' }}</td>
                    <td class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ issue.cycleTimeDays != null ? `${Math.round(issue.cycleTimeDays)}d` : '—' }}</td>
                    <td class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ issue.resolutionDate ? new Date(issue.resolutionDate).toLocaleDateString() : '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Metadata -->
          <div class="text-xs text-gray-400 dark:text-gray-500 flex flex-wrap gap-4">
            <span>First seen: {{ person.firstSeenAt ? new Date(person.firstSeenAt).toLocaleDateString() : '—' }}</span>
            <span>Last seen: {{ person.lastSeenAt ? new Date(person.lastSeenAt).toLocaleDateString() : '—' }}</span>
            <span v-if="person.inactiveSince">Inactive since: {{ new Date(person.inactiveSince).toLocaleDateString() }}</span>
          </div>
        </div>

        <!-- Sidebar: Teams + Manager Chain + Direct Reports -->
        <div class="space-y-6">
          <div v-if="personTeams.length > 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 uppercase tracking-wider">
              Teams <span class="font-normal text-gray-400">({{ personTeams.length }})</span>
            </h3>
            <div class="space-y-2">
              <button
                v-for="t in personTeams"
                :key="t.key"
                @click="nav.navigateTo('team-detail', { teamKey: t.key })"
                class="w-full text-left flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <svg class="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span class="text-sm text-primary-600 dark:text-primary-400 truncate">{{ t.displayName }}</span>
              </button>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 uppercase tracking-wider">Manager Chain</h3>
            <div v-if="managerChain.length === 0" class="text-sm text-gray-400 dark:text-gray-500">No managers found</div>
            <div v-else class="space-y-1">
              <div v-for="(mgr, i) in [...managerChain].reverse()" :key="mgr.uid" class="flex items-center gap-2">
                <div class="flex flex-col items-center" style="width: 16px">
                  <div v-if="i > 0" class="w-px h-3 bg-gray-300 dark:bg-gray-600"></div>
                  <div class="w-2 h-2 rounded-full" :class="i === managerChain.length - 1 ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'"></div>
                </div>
                <button @click="openPerson(mgr.uid)" class="text-sm text-primary-600 dark:text-primary-400 hover:underline truncate">{{ mgr.name }}</button>
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

          <div v-if="directReports.length > 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 uppercase tracking-wider">
              Direct Reports <span class="font-normal text-gray-400">({{ directReports.length }})</span>
            </h3>
            <div class="space-y-2">
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
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
