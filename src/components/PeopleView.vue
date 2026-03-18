<template>
  <div class="container mx-auto px-6 py-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-bold text-gray-900">People</h2>
        <p class="text-sm text-gray-500">{{ filteredPeople.length }} people</p>
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

      <!-- Specialty -->
      <div v-if="availableSpecialties.length > 0">
        <label class="block text-xs font-medium text-gray-500 uppercase mb-1">Specialty</label>
        <div class="space-y-1 max-h-48 overflow-y-auto">
          <label
            v-for="s in availableSpecialties"
            :key="s"
            class="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="checkbox"
              :value="s"
              v-model="selectedSpecialties"
              class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span class="text-sm text-gray-700 whitespace-nowrap">{{ s }}</span>
          </label>
        </div>
      </div>

      <!-- Search -->
      <div class="flex-1 min-w-[200px] self-end">
        <label class="block text-xs font-medium text-gray-500 uppercase mb-1">Search</label>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Filter by name..."
          class="w-full text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
        />
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
            <td class="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{{ person.name }}</td>
            <td class="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">{{ person.orgName }}</td>
            <td class="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">{{ person.teamName || '—' }}</td>
            <td class="px-4 py-2 text-sm whitespace-nowrap">
              <SpecialtyBadge :specialty="person.specialty" />
            </td>
            <td class="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
              {{ person.metrics?.resolvedCount ?? '—' }}
            </td>
            <td class="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
              {{ person.metrics?.resolvedPoints ?? '—' }}
            </td>
            <td class="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
              {{ person.metrics?.avgCycleTimeDays != null ? person.metrics.avgCycleTimeDays + 'd' : '—' }}
            </td>
            <td class="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
              <template v-if="person.githubContributions != null">{{ person.githubContributions }}</template>
              <span v-else-if="person.githubUsername" class="text-gray-300">—</span>
              <span v-else class="text-gray-300 italic text-xs" title="GitHub username not configured">no GitHub</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import SpecialtyBadge from './SpecialtyBadge.vue'
import { useRoster } from '../composables/useRoster'
import { useGithubStats } from '../composables/useGithubStats'
import { getAllPeopleMetrics } from '../services/api'

const { orgs } = useRoster()
const { getContributions } = useGithubStats()

const selectedOrgKeys = ref([])
const selectedTeamKeys = ref([])
const selectedSpecialties = ref([])
const searchQuery = ref('')
const sortKey = ref('resolvedCount')
const sortAsc = ref(false)
const loading = ref(false)
const peopleMetrics = ref({})

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'orgName', label: 'Org' },
  { key: 'teamName', label: 'Team' },
  { key: 'specialty', label: 'Specialty' },
  { key: 'resolvedCount', label: 'Resolved (90d)' },
  { key: 'resolvedPoints', label: 'Points (90d)' },
  { key: 'avgCycleTimeDays', label: 'Cycle Time' },
  { key: 'githubContributions', label: 'GitHub (1yr)' }
]

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

const availableSpecialties = computed(() => {
  const set = new Set()
  for (const p of allPeople.value) {
    if (p.specialty) set.add(p.specialty)
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
        const metrics = peopleMetrics.value[member.jiraDisplayName || member.name] || null

        people.push({
          ...member,
          orgKey: org.key,
          orgName: org.displayName,
          teamKey: `${org.key}::${teamName}`,
          teamName: team.displayName === 'Unassigned' ? '' : team.displayName,
          metrics,
          githubContributions: ghData?.totalContributions ?? null
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

  if (selectedSpecialties.value.length > 0) {
    const specSet = new Set(selectedSpecialties.value)
    people = people.filter(p => specSet.has(p.specialty))
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
    sortAsc.value = key === 'name' || key === 'orgName' || key === 'teamName' || key === 'specialty'
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
    } else {
      va = (a[key] || '').toLowerCase()
      vb = (b[key] || '').toLowerCase()
    }
    if (va < vb) return -1 * asc
    if (va > vb) return 1 * asc
    return 0
  })
})

onMounted(async () => {
  loading.value = true
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
