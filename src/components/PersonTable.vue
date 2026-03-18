<template>
  <div class="overflow-x-auto">
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
      <tbody class="bg-white divide-y divide-gray-200">
        <tr
          v-for="member in sortedMembers"
          :key="member.jiraDisplayName"
          class="hover:bg-gray-50 cursor-pointer"
          @click="$emit('select', member)"
        >
          <td class="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">
            {{ member.name }}
          </td>
          <td class="px-4 py-2 text-sm whitespace-nowrap">
            <SpecialtyBadge :specialty="member.specialty" />
          </td>
          <td class="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
            {{ member.manager || '—' }}
          </td>
          <td class="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
            {{ member.jiraComponent || '—' }}
          </td>
          <td class="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
            {{ getMemberMetric(member, 'resolvedCount') ?? '—' }}
          </td>
          <td class="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
            {{ getMemberMetric(member, 'resolvedPoints') ?? '—' }}
          </td>
          <td class="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
            {{ getMemberMetric(member, 'avgCycleTimeDays') != null ? getMemberMetric(member, 'avgCycleTimeDays') + 'd' : '—' }}
          </td>
          <td class="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
            <template v-if="getGithubContribCount(member) != null">{{ getGithubContribCount(member) }}</template>
            <span v-else-if="member.githubUsername" class="text-gray-300">—</span>
            <span v-else class="text-gray-300 italic text-xs" title="GitHub username not configured">no GitHub</span>
          </td>
          <td class="px-4 py-2 text-sm whitespace-nowrap">
            <span
              v-if="getTeamCount(member) > 1"
              class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-700"
            >
              {{ getTeamCount(member) }} teams
            </span>
            <span v-else class="text-gray-400">1</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import SpecialtyBadge from './SpecialtyBadge.vue'
import { useGithubStats } from '../composables/useGithubStats'

const { getContributions } = useGithubStats()

const props = defineProps({
  members: { type: Array, required: true },
  multiTeamMembers: { type: Set, default: () => new Set() },
  getTeamsForPerson: { type: Function, default: () => () => [] },
  memberMetrics: { type: Map, default: () => new Map() }
})
defineEmits(['select'])

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'specialty', label: 'Specialty' },
  { key: 'manager', label: 'Manager' },
  { key: 'jiraComponent', label: 'Component' },
  { key: 'resolved', label: 'Resolved (90d)' },
  { key: 'points', label: 'Points (90d)' },
  { key: 'cycleTime', label: 'Cycle Time' },
  { key: 'github', label: 'GitHub (1yr)' },
  { key: 'teams', label: 'Teams' }
]

const sortKey = ref('name')
const sortAsc = ref(true)

function toggleSort(key) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  } else {
    sortKey.value = key
    sortAsc.value = true
  }
}

function getTeamCount(member) {
  return props.getTeamsForPerson(member.jiraDisplayName).length || 1
}

function getMemberMetric(member, field) {
  const m = props.memberMetrics.get(member.jiraDisplayName)
  return m?.[field] ?? null
}

function getGithubContribCount(member) {
  if (!member.githubUsername) return null
  return getContributions(member.githubUsername)?.totalContributions ?? null
}

const sortedMembers = computed(() => {
  const key = sortKey.value
  const asc = sortAsc.value ? 1 : -1

  return [...props.members].sort((a, b) => {
    let va, vb
    if (key === 'teams') {
      va = getTeamCount(a)
      vb = getTeamCount(b)
    } else if (key === 'resolved') {
      va = getMemberMetric(a, 'resolvedCount') ?? -1
      vb = getMemberMetric(b, 'resolvedCount') ?? -1
    } else if (key === 'points') {
      va = getMemberMetric(a, 'resolvedPoints') ?? -1
      vb = getMemberMetric(b, 'resolvedPoints') ?? -1
    } else if (key === 'cycleTime') {
      va = getMemberMetric(a, 'avgCycleTimeDays') ?? -1
      vb = getMemberMetric(b, 'avgCycleTimeDays') ?? -1
    } else if (key === 'github') {
      va = getGithubContribCount(a) ?? -1
      vb = getGithubContribCount(b) ?? -1
    } else {
      va = (a[key] || '').toLowerCase()
      vb = (b[key] || '').toLowerCase()
    }
    if (va < vb) return -1 * asc
    if (va > vb) return 1 * asc
    return 0
  })
})
</script>
