<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-bold text-gray-900">People</h2>
        <p class="text-sm text-gray-500">{{ filteredPeople.length }} people</p>
      </div>
      <div class="w-72">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search by name..."
          class="w-full text-sm border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
        />
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-lg border border-gray-200 p-4 mb-6 flex flex-wrap items-start gap-6">
      <!-- Orgs -->
      <div>
        <label class="block text-xs font-medium text-gray-500 uppercase mb-1">Orgs</label>
        <div class="space-y-1 max-h-48 overflow-y-auto">
          <label
            v-for="org in orgs"
            :key="org.key"
            class="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="checkbox"
              :value="org.key"
              v-model="selectedOrgKeys"
              class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span class="text-sm text-gray-700">{{ org.displayName }}</span>
          </label>
        </div>
      </div>

      <!-- Teams -->
      <div v-if="availableTeams.length > 0">
        <div class="flex items-center gap-2 mb-1">
          <label class="block text-xs font-medium text-gray-500 uppercase">Teams</label>
          <button
            v-if="availableTeams.length > 1"
            @click="toggleAllTeams"
            class="text-xs text-primary-600 hover:text-primary-800"
          >
            {{ selectedTeamKeys.length === availableTeams.length ? 'Clear' : 'All' }}
          </button>
        </div>
        <div class="space-y-1 max-h-48 overflow-y-auto">
          <label
            v-for="team in availableTeams"
            :key="team.key"
            class="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="checkbox"
              :value="team.key"
              v-model="selectedTeamKeys"
              class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span class="text-sm text-gray-700 whitespace-nowrap">{{ team.displayName }} ({{ team.members.length }})</span>
          </label>
        </div>
      </div>

      <!-- Primary display field filter -->
      <div v-if="primaryDisplayField && availablePrimaryValues.length > 0">
        <label class="block text-xs font-medium text-gray-500 uppercase mb-1">{{ primaryFieldLabel }}</label>
        <div class="space-y-1 max-h-48 overflow-y-auto">
          <label
            v-for="val in availablePrimaryValues"
            :key="val"
            class="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="checkbox"
              :value="val"
              v-model="selectedPrimaryValues"
              class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span class="text-sm text-gray-700 whitespace-nowrap">{{ val }}</span>
          </label>
        </div>
      </div>

    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Table -->
    <div v-else class="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
              @click="toggleSort(col.key)"
            >
              <span class="inline-flex items-center gap-1">
                {{ col.label }}
                <svg v-if="sortKey === col.key" class="h-3 w-3" :class="sortAsc ? '' : 'rotate-180'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                </svg>
              </span>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr
            v-for="person in sortedPeople"
            :key="person.uid"
            class="hover:bg-gray-50"
          >
            <td class="px-4 py-2 text-sm whitespace-nowrap">
              <button
                @click="nav.navigateTo('person-detail', { teamKey: person.teamKey, person: person.jiraDisplayName || person.name })"
                class="text-primary-600 hover:text-primary-800 font-medium hover:underline text-left"
              >{{ person.name }}</button>
            </td>
            <td class="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">{{ person.orgName }}</td>
            <td class="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">{{ person.teamName || '—' }}</td>
            <td v-if="primaryDisplayField" class="px-4 py-2 text-sm whitespace-nowrap">
              <DynamicFieldBadge :value="person.customFields?.[primaryDisplayField]" />
            </td>
            <td
              v-for="field in nonPrimaryVisibleFields"
              :key="'cf-' + field.key"
              class="px-4 py-2 text-sm text-gray-500 whitespace-nowrap"
            >
              {{ person.customFields?.[field.key] || '—' }}
            </td>
            <td class="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
              <span v-if="person.metrics?.nameNotFound" class="text-gray-400 italic">no Jira user</span>
              <template v-else>{{ person.metrics?.resolvedCount ?? '—' }}</template>
            </td>
            <td class="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
              <span v-if="person.metrics?.nameNotFound" class="text-gray-400 italic">no Jira user</span>
              <template v-else>{{ person.metrics?.resolvedPoints ?? '—' }}</template>
            </td>
            <td class="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
              <span v-if="person.metrics?.nameNotFound" class="text-gray-400 italic">no Jira user</span>
              <template v-else>{{ person.metrics?.avgCycleTimeDays != null ? person.metrics.avgCycleTimeDays + 'd' : '—' }}</template>
            </td>
            <td class="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
              <template v-if="person.githubContributions != null">{{ person.githubContributions }}</template>
              <span v-else-if="person.githubUsername" class="text-gray-300">—</span>
              <span v-else class="text-gray-300 italic text-xs" title="GitHub username not configured">no GitHub</span>
            </td>
            <td class="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
              <template v-if="person.gitlabContributions != null">{{ person.gitlabContributions }}</template>
              <span v-else-if="person.gitlabUsername" class="text-gray-300">—</span>
              <span v-else class="text-gray-300 italic text-xs" title="GitLab username not configured">no GitLab</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, inject } from 'vue'
import DynamicFieldBadge from '../components/DynamicFieldBadge.vue'
import { useRoster } from '@shared/client/composables/useRoster'
import { useGithubStats } from '@shared/client/composables/useGithubStats'
import { useGitlabStats } from '@shared/client/composables/useGitlabStats'
import { getAllPeopleMetrics } from '@shared/client/services/api'

const nav = inject('moduleNav')
const { orgs, visibleFields, primaryDisplayField } = useRoster()
const { getContributions } = useGithubStats()
const { getContributions: getGitlabContributions, loadGitlabStats } = useGitlabStats()

const selectedOrgKeys = ref([])
const selectedTeamKeys = ref([])
const selectedPrimaryValues = ref([])
const searchQuery = ref('')
const sortKey = ref('resolvedCount')
const sortAsc = ref(false)
const loading = ref(false)
const peopleMetrics = ref({})

const primaryFieldLabel = computed(() => {
  if (!primaryDisplayField.value) return ''
  const f = visibleFields.value.find(vf => vf.key === primaryDisplayField.value)
  return f?.label || primaryDisplayField.value
})

const nonPrimaryVisibleFields = computed(() => {
  return visibleFields.value.filter(f => f.key !== primaryDisplayField.value)
})

const columns = computed(() => {
  const cols = [
    { key: 'name', label: 'Name' },
    { key: 'orgName', label: 'Org' },
    { key: 'teamName', label: 'Team' }
  ]
  if (primaryDisplayField.value) {
    cols.push({ key: primaryDisplayField.value, label: primaryFieldLabel.value })
  }
  for (const field of nonPrimaryVisibleFields.value) {
    cols.push({ key: field.key, label: field.label })
  }
  cols.push(
    { key: 'resolvedCount', label: 'Resolved (90d)' },
    { key: 'resolvedPoints', label: 'Points (90d)' },
    { key: 'avgCycleTimeDays', label: 'Cycle Time' },
    { key: 'githubContributions', label: 'GitHub (1yr)' },
    { key: 'gitlabContributions', label: 'GitLab (1yr)' }
  )
  return cols
})

// Reset team filter when orgs change
watch(selectedOrgKeys, () => {
  selectedTeamKeys.value = []
})

const availableTeams = computed(() => {
  if (selectedOrgKeys.value.length === 0) return []
  const teams = []
  for (const orgKey of selectedOrgKeys.value) {
    const org = orgs.value.find(o => o.key === orgKey)
    if (!org?.teams) continue
    for (const [name, team] of Object.entries(org.teams)) {
      teams.push({
        key: `${orgKey}::${name}`,
        displayName: selectedOrgKeys.value.length > 1
          ? `${org.displayName} — ${team.displayName}`
          : team.displayName,
        members: team.members
      })
    }
  }
  return teams.sort((a, b) => a.displayName.localeCompare(b.displayName))
})

const availablePrimaryValues = computed(() => {
  if (!primaryDisplayField.value) return []
  const set = new Set()
  for (const p of allPeople.value) {
    const val = p.customFields?.[primaryDisplayField.value]
    if (val) set.add(val)
  }
  return [...set].sort()
})

function toggleAllTeams() {
  if (selectedTeamKeys.value.length === availableTeams.value.length) {
    selectedTeamKeys.value = []
  } else {
    selectedTeamKeys.value = availableTeams.value.map(t => t.key)
  }
}

const allPeople = computed(() => {
  const seen = new Set()
  const people = []

  for (const org of orgs.value) {
    if (!org.teams) continue
    for (const [teamName, team] of Object.entries(org.teams)) {
      for (const member of team.members) {
        const uniqueKey = `${member.uid || member.name}::${org.key}::${teamName}`
        if (seen.has(uniqueKey)) continue
        seen.add(uniqueKey)

        const ghData = member.githubUsername ? getContributions(member.githubUsername) : null
        const glData = member.gitlabUsername ? getGitlabContributions(member.gitlabUsername) : null
        const metrics = peopleMetrics.value[member.jiraDisplayName || member.name] || null

        people.push({
          ...member,
          orgKey: org.key,
          orgName: org.displayName,
          teamKey: `${org.key}::${teamName}`,
          teamName: team.displayName === 'Unassigned' ? '' : team.displayName,
          metrics,
          githubContributions: ghData?.totalContributions ?? null,
          gitlabContributions: glData?.totalContributions ?? null
        })
      }
    }
  }

  return people
})

const filteredPeople = computed(() => {
  let people = allPeople.value

  if (selectedOrgKeys.value.length > 0) {
    const orgSet = new Set(selectedOrgKeys.value)
    people = people.filter(p => orgSet.has(p.orgKey))
  }

  if (selectedTeamKeys.value.length > 0) {
    const teamSet = new Set(selectedTeamKeys.value)
    people = people.filter(p => teamSet.has(p.teamKey))
  }

  if (selectedPrimaryValues.value.length > 0 && primaryDisplayField.value) {
    const valSet = new Set(selectedPrimaryValues.value)
    people = people.filter(p => valSet.has(p.customFields?.[primaryDisplayField.value]))
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    people = people.filter(p => p.name.toLowerCase().includes(q))
  }

  // Deduplicate by person name within the filtered scope
  const seen = new Set()
  return people.filter(p => {
    if (seen.has(p.name)) return false
    seen.add(p.name)
    return true
  })
})

function toggleSort(key) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  } else {
    sortKey.value = key
    sortAsc.value = key === 'name' || key === 'orgName' || key === 'teamName'
  }
}

const sortedPeople = computed(() => {
  const key = sortKey.value
  const asc = sortAsc.value ? 1 : -1

  return [...filteredPeople.value].sort((a, b) => {
    let va, vb
    if (key === 'resolvedCount' || key === 'resolvedPoints' || key === 'avgCycleTimeDays') {
      va = a.metrics?.[key] ?? -1
      vb = b.metrics?.[key] ?? -1
    } else if (key === 'githubContributions') {
      va = a.githubContributions ?? -1
      vb = b.githubContributions ?? -1
    } else if (key === 'gitlabContributions') {
      va = a.gitlabContributions ?? -1
      vb = b.gitlabContributions ?? -1
    } else if (key === 'name' || key === 'orgName' || key === 'teamName') {
      va = (a[key] || '').toLowerCase()
      vb = (b[key] || '').toLowerCase()
    } else {
      // Custom field sort
      va = (a.customFields?.[key] || '').toLowerCase()
      vb = (b.customFields?.[key] || '').toLowerCase()
    }
    if (va < vb) return -1 * asc
    if (va > vb) return 1 * asc
    return 0
  })
})

onMounted(async () => {
  loading.value = true
  loadGitlabStats()
  try {
    await getAllPeopleMetrics((data) => {
      peopleMetrics.value = data
      loading.value = false
    })
  } catch (err) {
    console.error('Failed to load people metrics:', err)
  } finally {
    loading.value = false
  }
})
</script>
