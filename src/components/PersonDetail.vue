<template>
  <div class="container mx-auto px-6 py-6">
    <!-- Breadcrumb -->
    <nav class="flex items-center gap-2 text-sm text-gray-500 mb-4">
      <button @click="$emit('go-dashboard')" class="hover:text-primary-600 transition-colors">Dashboard</button>
      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
      <button @click="$emit('back')" class="hover:text-primary-600 transition-colors">{{ teamName }}</button>
      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
      <span class="text-gray-900 font-medium">{{ person.name }}</span>
    </nav>

    <!-- Person header -->
    <div class="bg-white rounded-lg border border-gray-200 p-5 mb-6">
      <div class="flex items-start justify-between">
        <div>
          <h2 class="text-xl font-bold text-gray-900 mb-1">{{ person.name }}</h2>
          <div class="flex items-center gap-2 flex-wrap">
            <SpecialtyBadge :specialty="person.specialty" />
            <span v-if="person.manager" class="text-sm text-gray-500">
              Mgr: {{ person.manager }}
            </span>
            <span v-if="person.jiraComponent" class="text-sm text-gray-500">
              | {{ person.jiraComponent }}
            </span>
            <a
              v-if="githubProfileUrl"
              :href="githubProfileUrl"
              target="_blank"
              class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              title="GitHub Profile"
            >
              | <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              {{ person.githubUsername }}
            </a>
            <span v-else class="text-sm text-gray-400">| GitHub: unknown</span>
            <a
              v-if="gitlabProfileUrl"
              :href="gitlabProfileUrl"
              target="_blank"
              class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              title="GitLab Profile"
            >
              | <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 014.82 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.49h8.1l2.44-7.49a.42.42 0 01.11-.18.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.51L23 13.45a.84.84 0 01-.35.94z"/></svg>
              {{ person.gitlabUsername }}
            </a>
            <span v-else class="text-sm text-gray-400">| GitLab: unknown</span>
          </div>
          <div v-if="personTeams.length > 1" class="mt-2 flex flex-wrap gap-1">
            <span
              v-for="t in personTeams"
              :key="t.key"
              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
            >
              {{ t.displayName }}
            </span>
          </div>
        </div>
        <button
          @click="loadMetrics(true)"
          :disabled="true"
          title="Refreshes temporarily disabled — Jira is down"
          class="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          <svg class="h-4 w-4" :class="{ 'animate-spin': isLoading }" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>
    </div>

    <!-- Stale data warning -->
    <div v-if="metrics?.stale" class="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-6 flex items-start gap-3">
      <svg class="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div>
        <p class="text-amber-800 text-sm font-medium">Showing cached data</p>
        <p class="text-amber-700 text-xs mt-0.5">
          {{ metrics.staleReason || 'Unable to fetch latest data from Jira.' }}
          Data was last fetched {{ metrics.fetchedAt ? new Date(metrics.fetchedAt).toLocaleString() : 'at an unknown time' }}.
        </p>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading && !metrics" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <p class="text-red-700 text-sm">{{ error }}</p>
    </div>

    <!-- Metrics content -->
    <template v-else-if="metrics">
      <!-- Metric cards -->
      <div class="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
        <MetricCard
          label="Issues Resolved"
          :value="metrics.resolved.count"
          :subtitle="`Last ${metrics.lookbackDays} days`"
        />
        <MetricCard
          label="Story Points"
          :value="metrics.resolved.storyPoints"
          unit="pts"
          :subtitle="`Last ${metrics.lookbackDays} days`"
        />
        <MetricCard
          label="In Progress"
          :value="metrics.inProgress.count"
          :warning="metrics.inProgress.count > 5"
        />
        <MetricCard
          label="Avg Cycle Time"
          :value="metrics.cycleTime.avgDays"
          unit="days"
          :subtitle="metrics.cycleTime.medianDays != null ? `Median: ${metrics.cycleTime.medianDays}d` : ''"
        />
        <MetricCard
          label="GitHub Contributions"
          :value="githubContributions?.totalContributions ?? '—'"
          :subtitle="person.githubUsername ? 'Last year' : 'No GitHub username'"
          tooltip="Public contributions via GitHub API. May differ slightly from the GitHub profile due to week-aligned date windows."
        />
        <MetricCard
          label="GitLab Contributions"
          :value="gitlabContributions?.totalContributions ?? '—'"
          :subtitle="person.gitlabUsername ? 'Last year' : 'No GitLab username'"
          tooltip="Public contributions via GitLab calendar API."
        />
      </div>

      <!-- Fetched timestamp -->
      <p v-if="metrics.fetchedAt" class="text-xs text-gray-400 mb-4">
        Data fetched: {{ new Date(metrics.fetchedAt).toLocaleString() }}
      </p>

      <!-- Resolved Issues Table -->
      <div v-if="metrics.resolved.issues.length > 0" class="bg-white rounded-lg border border-gray-200 mb-6">
        <h3 class="px-4 py-3 text-sm font-semibold text-gray-700 border-b border-gray-200">
          Resolved Issues ({{ metrics.resolved.issues.length }})
          <span class="font-normal text-gray-400 ml-1">— last {{ metrics.lookbackDays }} days</span>
        </h3>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Key</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Summary</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Points</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cycle Time</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Resolved</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="issue in metrics.resolved.issues" :key="issue.key" class="hover:bg-gray-50">
                <td class="px-4 py-2 text-sm">
                  <a
                    :href="`https://redhat.atlassian.net/browse/${issue.key}`"
                    target="_blank"
                    class="text-primary-600 hover:underline"
                  >
                    {{ issue.key }}
                  </a>
                </td>
                <td class="px-4 py-2 text-sm text-gray-900 max-w-md truncate">{{ issue.summary }}</td>
                <td class="px-4 py-2 text-sm text-gray-500">{{ issue.issueType }}</td>
                <td class="px-4 py-2 text-sm text-gray-500">{{ issue.storyPoints || '—' }}</td>
                <td class="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
                  {{ issue.cycleTimeDays != null ? `${Math.round(issue.cycleTimeDays)}d` : '—' }}
                </td>
                <td class="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
                  {{ issue.resolutionDate ? new Date(issue.resolutionDate).toLocaleDateString() : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- In-Progress Issues Table -->
      <div v-if="metrics.inProgress.issues.length > 0" class="bg-white rounded-lg border border-gray-200">
        <h3 class="px-4 py-3 text-sm font-semibold text-gray-700 border-b border-gray-200">
          In Progress ({{ metrics.inProgress.issues.length }})
        </h3>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Key</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Summary</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Points</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="issue in metrics.inProgress.issues" :key="issue.key" class="hover:bg-gray-50">
                <td class="px-4 py-2 text-sm">
                  <a
                    :href="`https://redhat.atlassian.net/browse/${issue.key}`"
                    target="_blank"
                    class="text-primary-600 hover:underline"
                  >
                    {{ issue.key }}
                  </a>
                </td>
                <td class="px-4 py-2 text-sm text-gray-900 max-w-md truncate">{{ issue.summary }}</td>
                <td class="px-4 py-2 text-sm text-gray-500">{{ issue.issueType }}</td>
                <td class="px-4 py-2 text-sm text-gray-500">{{ issue.status }}</td>
                <td class="px-4 py-2 text-sm text-gray-500">{{ issue.storyPoints || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import SpecialtyBadge from './SpecialtyBadge.vue'
import MetricCard from './MetricCard.vue'
import { useRoster } from '../composables/useRoster'
import { useGithubStats } from '../composables/useGithubStats'
import { useGitlabStats } from '../composables/useGitlabStats'
import { getPersonMetrics } from '../services/api'

const props = defineProps({
  person: { type: Object, required: true },
  teamName: { type: String, default: '' }
})
defineEmits(['back', 'go-dashboard'])

const { getTeamsForPerson } = useRoster()
const { getContributions: getGithubContributions, refreshUserStats: refreshGithubUserStats } = useGithubStats()
const { getContributions: getGitlabContributionsFn, loadGitlabStats } = useGitlabStats()

const githubContributions = computed(() => getGithubContributions(props.person.githubUsername))
const githubProfileUrl = props.person.githubUsername
  ? `https://github.com/${props.person.githubUsername}`
  : null

const gitlabContributions = computed(() => getGitlabContributionsFn(props.person.gitlabUsername))
const gitlabProfileUrl = props.person.gitlabUsername
  ? `https://gitlab.com/${props.person.gitlabUsername}`
  : null

const metrics = ref(null)
const isLoading = ref(false)
const error = ref(null)

const personTeams = getTeamsForPerson(props.person.jiraDisplayName)

async function loadMetrics(refresh = false) {
  isLoading.value = true
  error.value = null
  try {
    const promises = [getPersonMetrics(props.person.jiraDisplayName, { refresh })]
    if (refresh && props.person.githubUsername) {
      promises.push(refreshGithubUserStats(props.person.githubUsername))
    }
    const [jiraMetrics] = await Promise.all(promises)
    metrics.value = jiraMetrics
  } catch (err) {
    error.value = err.message
    console.error('Failed to load person metrics:', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadMetrics()
  loadGitlabStats()
})
</script>
