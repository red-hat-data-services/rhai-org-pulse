<template>
  <div class="overflow-x-auto">
    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
      <thead class="bg-gray-50 dark:bg-gray-800">
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
            @click="toggleSort(col.key)"
          >
            {{ col.label }}
            <span v-if="sortKey === col.key" class="ml-1">{{ sortAsc ? '↑' : '↓' }}</span>
          </th>
        </tr>
      </thead>
      <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
        <tr
          v-for="member in sortedMembers"
          :key="member.jiraDisplayName"
          class="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
          @click="$emit('select', member)"
        >
          <td class="px-4 py-3 text-sm whitespace-nowrap">
            <a
              :href="personLink(member)"
              class="text-primary-600 hover:underline"
              @click.stop
            >
              {{ member.name }}
            </a>
          </td>
          <td v-if="primaryDisplayField" class="px-4 py-3 text-sm whitespace-nowrap">
            <DynamicFieldBadge :value="member.customFields?.[primaryDisplayField]" />
          </td>
          <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            <span v-if="getMemberMetric(member, 'nameNotFound')" class="text-gray-400 dark:text-gray-500 italic">no Jira user</span>
            <template v-else>{{ getMemberMetric(member, 'resolvedCount') ?? '—' }}</template>
          </td>
          <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            <span v-if="getMemberMetric(member, 'nameNotFound')" class="text-gray-400 dark:text-gray-500 italic">no Jira user</span>
            <template v-else>{{ getMemberMetric(member, 'resolvedPoints') ?? '—' }}</template>
          </td>
          <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            <span v-if="getMemberMetric(member, 'nameNotFound')" class="text-gray-400 dark:text-gray-500 italic">no Jira user</span>
            <template v-else>{{ getMemberMetric(member, 'avgCycleTimeDays') != null ? getMemberMetric(member, 'avgCycleTimeDays') + 'd' : '—' }}</template>
          </td>
          <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            <template v-if="getGithubContribCount(member) != null">{{ getGithubContribCount(member) }}</template>
            <span v-else-if="member.githubUsername" class="text-gray-300 dark:text-gray-600">—</span>
            <span v-else class="text-gray-300 dark:text-gray-600 italic text-xs" title="GitHub username not configured">no GitHub</span>
          </td>
          <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            <template v-if="getGitlabContribCount(member) != null">
              <span :title="getGitlabInstanceTooltip(member) || undefined">{{ getGitlabContribCount(member) }}</span>
            </template>
            <span v-else-if="member.gitlabUsername" class="text-gray-300 dark:text-gray-600">—</span>
            <span v-else class="text-gray-300 dark:text-gray-600 italic text-xs" title="GitLab username not configured">no GitLab</span>
          </td>
          <td class="px-4 py-3 text-sm whitespace-nowrap">
            <span
              v-if="getTeamCount(member) > 1"
              class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-700"
            >
              {{ getTeamCount(member) }} teams
            </span>
            <span v-else class="text-gray-400 dark:text-gray-500">1</span>
          </td>
          <td class="px-4 py-3 text-sm whitespace-nowrap">
            <button
              @click.stop="$emit('view-history', member)"
              class="text-xs text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
            >
              View History
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import DynamicFieldBadge from './DynamicFieldBadge.vue'
import { useRoster } from '@shared/client/composables/useRoster'
import { useModuleLink } from '@shared/client/composables/useModuleLink'
import { useGithubStats } from '@shared/client/composables/useGithubStats'
import { useGitlabStats } from '@shared/client/composables/useGitlabStats'

const { linkTo } = useModuleLink()
const { visibleFields, primaryDisplayField } = useRoster()
const { getContributions } = useGithubStats()
const { getContributions: getGitlabContributions } = useGitlabStats()

const props = defineProps({
  members: { type: Array, required: true },
  multiTeamMembers: { type: Set, default: () => new Set() },
  getTeamsForPerson: { type: Function, default: () => () => [] },
  memberMetrics: { type: Map, default: () => new Map() },
  teamKey: { type: String, default: null }
})
defineEmits(['select', 'view-history'])

function personLink(member) {
  if (member.uid) return linkTo('team-tracker', 'person-detail', { uid: member.uid, ...(props.teamKey && { teamKey: props.teamKey }) })
  return linkTo('team-tracker', 'person-detail', { person: member.name, ...(props.teamKey && { teamKey: props.teamKey }) })
}

const columns = computed(() => {
  const cols = [{ key: 'name', label: 'Name' }]
  if (primaryDisplayField.value) {
    const pf = visibleFields.value.find(f => f.key === primaryDisplayField.value)
    cols.push({ key: primaryDisplayField.value, label: pf?.label || primaryDisplayField.value })
  }
  cols.push(
    { key: 'resolved', label: 'Resolved (90d)' },
    { key: 'points', label: 'Points (90d)' },
    { key: 'cycleTime', label: 'Cycle Time' },
    { key: 'github', label: 'GitHub (1yr)' },
    { key: 'gitlab', label: 'GitLab (1yr)' },
    { key: 'teams', label: 'Teams' },
    { key: 'history', label: 'History' }
  )
  return cols
})

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

function getGitlabContribCount(member) {
  if (!member.gitlabUsername) return null
  return getGitlabContributions(member.gitlabUsername)?.totalContributions ?? null
}

function getGitlabInstanceTooltip(member) {
  if (!member.gitlabUsername) return ''
  const instances = getGitlabContributions(member.gitlabUsername)?.instances
  if (!instances || Object.keys(instances).length <= 1) return ''
  return Object.entries(instances)
    .map(([url, data]) => `${url.replace(/^https?:\/\//, '')}: ${data.totalContributions}`)
    .join('\n')
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
    } else if (key === 'gitlab') {
      va = getGitlabContribCount(a) ?? -1
      vb = getGitlabContribCount(b) ?? -1
    } else if (key === 'name' || key === 'manager') {
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
</script>
