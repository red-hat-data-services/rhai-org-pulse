<template>
  <div>
    <!-- Breadcrumb -->
    <nav class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
      <button @click="nav.navigateTo('portfolio')" class="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Portfolio</button>
      <template v-if="fromOrg">
        <ChevronRightIcon :size="14" class="text-gray-400 dark:text-gray-500" />
        <button @click="nav.navigateTo('org-detail', { org: fromOrg })" class="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">{{ orgDisplayName || fromOrg }}</button>
      </template>
      <ChevronRightIcon :size="14" class="text-gray-400 dark:text-gray-500" />
      <span class="text-gray-900 dark:text-gray-100 font-medium">{{ projectName }}</span>
    </nav>

    <StickyPageHeader
      v-model="selectedDays"
      :title="projectName"
      :loading="loading"
    >
      <template v-if="projectInfo?.githubOrg && projectInfo?.githubRepo" #subtitle-extra>
        <a
          :href="`https://github.com/${projectInfo.githubOrg}/${projectInfo.githubRepo}`"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 mt-0.5"
        >
          {{ projectInfo.githubOrg }}/{{ projectInfo.githubRepo }}
          <ExternalLinkIcon :size="12" />
        </a>
      </template>
      <template #extra>
        <div v-if="dashboard?.summary" class="hidden lg:flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-750/40 pl-2 pr-2.5 py-1 rounded-lg">
          <CalendarIcon :size="12" />
          <span>{{ periodLabel }}</span>
        </div>
      </template>
    </StickyPageHeader>

    <!-- Collection progress banner -->
    <div v-if="showJobsBanner" class="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">
      <div class="px-5 py-4">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-start gap-3 min-w-0">
            <div v-if="hasActiveJobs" class="mt-0.5 w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <Loader2Icon class="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
            <div v-else class="mt-0.5 w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
              <CheckCircle2Icon class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
                {{ hasActiveJobs ? 'Data collection in progress' : 'Collection complete' }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {{ hasActiveJobs
                  ? 'Gathering contribution history from GitHub. This may take a few minutes for repos with extensive history.'
                  : 'All background jobs for this project have finished.' }}
              </p>
            </div>
          </div>
          <button
            v-if="!hasActiveJobs"
            @click="jobsBannerDismissed = true"
            class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
          >
            <XCircleIcon class="w-4 h-4" />
          </button>
        </div>

        <!-- Job status list -->
        <div class="mt-3 ml-11 space-y-1.5">
          <div
            v-for="job in projectJobs"
            :key="job.id"
            class="flex items-center gap-2 text-xs"
          >
            <Loader2Icon v-if="RUNNING_STATUSES.has(job.status)" class="w-3 h-3 text-blue-500 animate-spin shrink-0" />
            <CheckCircle2Icon v-else-if="job.status === 'completed'" class="w-3 h-3 text-emerald-500 shrink-0" />
            <XCircleIcon v-else-if="job.status === 'failed'" class="w-3 h-3 text-red-500 shrink-0" />
            <div v-else class="w-3 h-3 rounded-full border-2 border-gray-300 dark:border-gray-500 shrink-0"></div>
            <span class="font-medium text-gray-700 dark:text-gray-300">{{ jobLabel(job.jobType) }}</span>
            <span :class="jobStatusClass(job.status)">
              {{ RUNNING_STATUSES.has(job.status) ? 'running' : job.status }}
            </span>
            <span v-if="job.recordsProcessed && job.status === 'completed'" class="text-gray-400 dark:text-gray-500">
              — {{ job.recordsProcessed.toLocaleString() }} records
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading skeleton (initial load only) -->
    <div v-if="loading && !dashboard">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCardSkeleton v-for="i in 4" :key="'ss'+i" />
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <ContributionCardSkeleton v-for="i in 4" :key="'cs'+i" />
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-6">
        <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-5 w-36 mb-4"></div>
        <ContributorRowSkeleton v-for="i in 5" :key="'cr'+i" />
      </div>
    </div>

    <!-- Unreachable -->
    <div v-else-if="connectionError" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-10 text-center">
      <div class="w-14 h-14 mx-auto mb-4 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
        <ActivityIcon :size="28" class="text-amber-500" />
      </div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Upstream Pulse is unreachable</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">{{ connectionError }}</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
      <div class="w-12 h-12 mx-auto mb-3 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
        <AlertCircleIcon :size="24" class="text-red-500" />
      </div>
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Error loading project</h3>
      <p class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>
    </div>

    <!-- Content -->
    <template v-else-if="dashboard">
      <div class="transition-opacity duration-300" :class="{ 'opacity-40 pointer-events-none': loading }">
      <!-- Summary Stats -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Team Contributions"
          :value="dashboard.contributions?.all?.team || 0"
          :trend="dashboard.trends?.contributions"
          :icon="GitCommitIcon"
        />
        <StatCard
          label="Team's Share"
          :value="formatPercent(dashboard.contributions?.all?.teamPercent)"
          suffix="%"
          :sub-value="`${(dashboard.contributions?.all?.team || 0).toLocaleString()} of ${(dashboard.contributions?.all?.total || 0).toLocaleString()}`"
          :icon="TrendingUpIcon"
        />
        <StatCard
          label="Active Contributors"
          :value="dashboard.summary.activeContributors"
          :trend="dashboard.trends?.activeContributors"
          :icon="UsersIcon"
        />
        <StatCard
          label="Total Activity"
          :value="dashboard.contributions?.all?.total || 0"
          :icon="ActivityIcon"
        />
      </div>

      <!-- Contribution Breakdown -->
      <section class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Contribution Breakdown</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">Team vs Total contributions by type</p>
        </div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <ContributionTypeCard
            label="Commits"
            :icon="GitCommitIcon"
            color="text-blue-600 dark:text-blue-400"
            bgColor="bg-blue-50 dark:bg-blue-900/20"
            barColor="bg-blue-600"
            :team="dashboard.contributions?.commits?.team || 0"
            :total="dashboard.contributions?.commits?.total || 0"
            :percent="dashboard.contributions?.commits?.teamPercent || 0"
          />
          <ContributionTypeCard
            label="Pull Requests"
            :icon="GitPullRequestIcon"
            color="text-purple-600 dark:text-purple-400"
            bgColor="bg-purple-50 dark:bg-purple-900/20"
            barColor="bg-purple-600"
            :team="dashboard.contributions?.pullRequests?.team || 0"
            :total="dashboard.contributions?.pullRequests?.total || 0"
            :percent="dashboard.contributions?.pullRequests?.teamPercent || 0"
          />
          <ContributionTypeCard
            label="Code Reviews"
            :icon="MessageSquareIcon"
            color="text-green-600 dark:text-green-400"
            bgColor="bg-green-50 dark:bg-green-900/20"
            barColor="bg-green-600"
            :team="dashboard.contributions?.reviews?.team || 0"
            :total="dashboard.contributions?.reviews?.total || 0"
            :percent="dashboard.contributions?.reviews?.teamPercent || 0"
          />
          <ContributionTypeCard
            label="Issues"
            :icon="AlertCircleIcon"
            color="text-orange-600 dark:text-orange-400"
            bgColor="bg-orange-50 dark:bg-orange-900/20"
            barColor="bg-orange-500"
            :team="dashboard.contributions?.issues?.team || 0"
            :total="dashboard.contributions?.issues?.total || 0"
            :percent="dashboard.contributions?.issues?.teamPercent || 0"
          />
        </div>
      </section>

      <!-- Contribution Trend -->
      <section v-if="dashboard.dailyBreakdown?.length" class="mb-8">
        <ContributionTrendChart :daily-breakdown="dashboard.dailyBreakdown" />
      </section>

      <!-- Team Leadership -->
      <section v-if="leadership" class="mb-8">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Team Leadership</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">Team maintainership in this project</p>
        </div>

        <div class="grid grid-cols-1 gap-4 mb-4" :class="governanceCards.length > 1 ? 'sm:grid-cols-2' : ''">
          <LeadershipCard
            v-for="card in governanceCards"
            :key="card.positionType"
            :label="card.label"
            :icon="card.positionType === 'reviewer' ? EyeIcon : ShieldCheckIcon"
            :color="card.positionType === 'reviewer' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'"
            :bgColor="card.positionType === 'reviewer' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-blue-50 dark:bg-blue-900/20'"
            :barColor="card.positionType === 'reviewer' ? 'bg-green-600' : 'bg-blue-600'"
            :team="card.team"
            :total="card.total"
            :percent="card.total > 0 ? (card.team / card.total) * 100 : 0"
            :percentThreshold="card.positionType === 'reviewer' ? 5 : 10"
          />
        </div>

        <!-- Top maintainers -->
        <div v-if="rankedMembers.length" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-6">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Maintainers</h3>
          <div class="space-y-1">
            <div
              v-for="(member, i) in visibleMembers"
              :key="member.id"
              class="flex items-center gap-4 py-3 border-b border-gray-50 dark:border-gray-700/30 last:border-0"
            >
              <span class="w-6 text-center text-sm font-medium text-gray-400 dark:text-gray-500 tabular-nums">{{ i + 1 }}</span>
              <img
                v-if="member.githubUsername"
                :src="`https://github.com/${member.githubUsername}.png?size=80`"
                :alt="member.name"
                class="w-10 h-10 rounded-full shrink-0"
              />
              <div v-else class="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0">
                {{ (member.name || member.githubUsername || '?').charAt(0).toUpperCase() }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-medium text-gray-900 dark:text-gray-100 truncate">{{ member.name || member.githubUsername }}</p>
                <a
                  v-if="member.githubUsername"
                  :href="'https://github.com/' + member.githubUsername"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center gap-1"
                >
                  @{{ member.githubUsername }}
                  <ExternalLinkIcon :size="12" />
                </a>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <span
                  v-for="role in uniqueRoles(member)"
                  :key="role"
                  class="text-[11px] font-medium px-2 py-0.5 rounded-full"
                  :class="role === 'Reviewer'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'"
                >{{ role }}</span>
              </div>
            </div>
          </div>

          <button
            v-if="rankedMembers.length > 5"
            @click="membersExpanded = !membersExpanded"
            class="flex items-center gap-1.5 mx-auto mt-4 px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
          >
            <template v-if="membersExpanded">
              Show Less
              <ChevronUpIcon :size="16" />
            </template>
            <template v-else>
              View All ({{ Math.min(rankedMembers.length, 10) }})
              <ChevronDownIcon :size="16" />
            </template>
          </button>
        </div>
      </section>

      <!-- Top Contributors -->
      <section class="mb-8">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-6">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Top Contributors</h3>

          <div v-if="!contributors.length" class="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
            No contributor data available
          </div>

          <div v-else>
            <div class="space-y-1">
              <div
                v-for="(c, i) in visibleContributors"
                :key="c.id || i"
                class="group"
              >
                <div class="flex items-center gap-4 py-3 border-b border-gray-50 dark:border-gray-700/30 last:border-0">
                  <span class="w-6 text-center text-sm font-medium text-gray-400 dark:text-gray-500 tabular-nums">{{ i + 1 }}</span>
                  <img
                    v-if="c.avatarUrl || c.githubUsername"
                    :src="c.avatarUrl || `https://github.com/${c.githubUsername}.png?size=80`"
                    :alt="c.name"
                    class="w-10 h-10 rounded-full shrink-0"
                  />
                  <div v-else class="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0">
                    {{ (c.name || c.githubUsername || '?').charAt(0).toUpperCase() }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-gray-900 dark:text-gray-100 truncate">{{ c.name || c.githubUsername }}</p>
                    <a
                      v-if="c.githubUsername"
                      :href="'https://github.com/' + c.githubUsername"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                    >
                      @{{ c.githubUsername }}
                      <ExternalLinkIcon :size="12" />
                    </a>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ getTotal(c).toLocaleString() }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">contributions</p>
                  </div>
                </div>
                <div class="hidden group-hover:block pl-16 pr-4 pb-3">
                  <div class="grid grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <p class="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{{ getField(c, 'commits') }}</p>
                      <p class="text-gray-500 dark:text-gray-400">Commits</p>
                    </div>
                    <div>
                      <p class="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{{ getField(c, 'prs') }}</p>
                      <p class="text-gray-500 dark:text-gray-400">PRs</p>
                    </div>
                    <div>
                      <p class="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{{ getField(c, 'reviews') }}</p>
                      <p class="text-gray-500 dark:text-gray-400">Reviews</p>
                    </div>
                    <div>
                      <p class="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{{ getField(c, 'issues') }}</p>
                      <p class="text-gray-500 dark:text-gray-400">Issues</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              v-if="contributors.length > 5"
              @click="contributorsExpanded = !contributorsExpanded"
              class="flex items-center gap-1.5 mx-auto mt-4 px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <template v-if="contributorsExpanded">
                Show Less
                <ChevronUpIcon :size="16" />
              </template>
              <template v-else>
                View All ({{ contributors.length }})
                <ChevronDownIcon :size="16" />
              </template>
            </button>
          </div>
        </div>
      </section>

      <!-- Impact Banner -->
      <section class="mb-8">
        <div class="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 rounded-xl p-6 text-white">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p class="text-blue-100 text-sm">{{ projectName }} — Team Impact</p>
              <p class="text-3xl font-bold">
                {{ (dashboard.contributions?.all?.team || 0).toLocaleString() }} contributions
              </p>
              <p class="text-blue-200 mt-1">
                {{ formatPercent(dashboard.contributions?.all?.teamPercent) }}% of all project activity
              </p>
            </div>
            <div class="flex gap-6">
              <div class="text-center">
                <p class="text-2xl font-bold">{{ (dashboard.contributions?.commits?.team || 0).toLocaleString() }}</p>
                <p class="text-blue-200 text-sm">Commits</p>
              </div>
              <div class="text-center">
                <p class="text-2xl font-bold">{{ (dashboard.contributions?.pullRequests?.team || 0).toLocaleString() }}</p>
                <p class="text-blue-200 text-sm">PRs</p>
              </div>
              <div class="text-center">
                <p class="text-2xl font-bold">{{ (dashboard.contributions?.reviews?.team || 0).toLocaleString() }}</p>
                <p class="text-blue-200 text-sm">Reviews</p>
              </div>
              <div class="text-center">
                <p class="text-2xl font-bold">{{ (dashboard.contributions?.issues?.team || 0).toLocaleString() }}</p>
                <p class="text-blue-200 text-sm">Issues</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      </div><!-- /refetch dim wrapper -->
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, inject } from 'vue'
import {
  Activity as ActivityIcon,
  AlertCircle as AlertCircleIcon,
  Calendar as CalendarIcon,
  CheckCircle2 as CheckCircle2Icon,
  ChevronDown as ChevronDownIcon,
  ChevronRight as ChevronRightIcon,
  ChevronUp as ChevronUpIcon,
  ExternalLink as ExternalLinkIcon,
  Eye as EyeIcon,
  GitCommit as GitCommitIcon,
  GitPullRequest as GitPullRequestIcon,
  Loader2 as Loader2Icon,
  MessageSquare as MessageSquareIcon,
  ShieldCheck as ShieldCheckIcon,
  TrendingUp as TrendingUpIcon,
  Users as UsersIcon,
  XCircle as XCircleIcon,
} from 'lucide-vue-next'
import { apiRequest } from '@shared/client/services/api'
import { StatCardSkeleton, ContributionCardSkeleton, ContributorRowSkeleton } from '../components/SkeletonLoaders.vue'
import StatCard from '../components/StatCard.vue'
import ContributionTypeCard from '../components/ContributionTypeCard.vue'
import LeadershipCard from '../components/LeadershipCard.vue'
import ContributionTrendChart from '../components/ContributionTrendChart.vue'
import StickyPageHeader from '../components/StickyPageHeader.vue'
import { useGovernanceCards, uniqueRoles } from '../composables/useGovernanceCards.js'

const nav = inject('moduleNav')

const MODULE_API = '/modules/upstream-pulse'

const projectId = computed(() => nav.params.value?.projectId || '')
const fromOrg = computed(() => nav.params.value?.org || '')

const selectedDays = ref('30')
const loading = ref(true)
const error = ref(null)
const connectionError = ref(null)
const dashboard = ref(null)
const contributors = ref([])
const contributorsExpanded = ref(false)
const leadership = ref(null)
const membersExpanded = ref(false)
const projectInfo = ref(null)
const orgDisplayName = ref('')

const projectName = computed(() => projectInfo.value?.name || 'Project')

const projectJobs = ref([])
const jobsBannerDismissed = ref(false)
let jobPollTimer = null

const RUNNING_STATUSES = new Set(['active', 'running', 'pending', 'waiting'])
const activeJobs = computed(() =>
  projectJobs.value.filter(j => RUNNING_STATUSES.has(j.status))
)
const hasActiveJobs = computed(() => activeJobs.value.length > 0)
const showJobsBanner = computed(() => projectJobs.value.length > 0 && !jobsBannerDismissed.value)

const JOB_TYPE_LABELS = {
  sync: 'Contribution Collection',
  full_sync: 'Full Collection',
  governance_refresh: 'Governance Scan',
  leadership_refresh: 'Leadership Refresh',
}

function jobLabel(jobType) {
  return JOB_TYPE_LABELS[jobType] || jobType
}

function jobStatusClass(status) {
  if (status === 'completed') return 'text-emerald-600 dark:text-emerald-400'
  if (status === 'failed') return 'text-red-600 dark:text-red-400'
  if (RUNNING_STATUSES.has(status)) return 'text-blue-600 dark:text-blue-400'
  return 'text-gray-500 dark:text-gray-400'
}

async function loadProjectJobs() {
  const pid = projectId.value
  if (!pid) return
  try {
    const data = await apiRequest(`${MODULE_API}/project-jobs?projectId=${encodeURIComponent(pid)}`)
    projectJobs.value = data.jobs || []
    if (hasActiveJobs.value) {
      scheduleJobPoll()
    }
  } catch {
    // Non-critical — don't surface errors for job polling
  }
}

function scheduleJobPoll() {
  clearTimeout(jobPollTimer)
  jobPollTimer = setTimeout(async () => {
    await loadProjectJobs()
    if (hasActiveJobs.value) {
      loadData()
    }
  }, 8000)
}

const visibleContributors = computed(() => {
  if (contributorsExpanded.value) return contributors.value
  return contributors.value.slice(0, 5)
})

const periodLabel = computed(() => {
  if (!dashboard.value?.summary) return ''
  const { periodStart, periodEnd } = dashboard.value.summary
  if (periodStart === 'All time') return 'All time'
  return `${periodStart} – ${periodEnd}`
})

function formatPercent(val) {
  if (val == null) return '0'
  return Number(val).toFixed(1)
}

function getTotal(c) {
  return c.total ?? c.contributions?.total ?? 0
}

function getField(c, field) {
  const fieldMap = { commits: 'commits', prs: 'pullRequests', reviews: 'reviews', issues: 'issues' }
  return c[fieldMap[field]] ?? c.contributions?.[field] ?? 0
}

const { governanceCards } = useGovernanceCards(leadership)

const rankedMembers = computed(() => {
  if (!leadership.value?.members) return []
  return [...leadership.value.members].sort((a, b) => (b.roles?.length || 0) - (a.roles?.length || 0))
})

const visibleMembers = computed(() => {
  if (membersExpanded.value) return rankedMembers.value.slice(0, 10)
  return rankedMembers.value.slice(0, 5)
})

async function loadData() {
  loading.value = true
  error.value = null
  connectionError.value = null
  const pid = projectId.value
  if (!pid) {
    error.value = 'No project specified'
    loading.value = false
    return
  }

  try {
    const [dashData, contribData, leaderData, projectsData] = await Promise.all([
      apiRequest(`${MODULE_API}/dashboard?days=${selectedDays.value}&projectId=${encodeURIComponent(pid)}`),
      apiRequest(`${MODULE_API}/contributors?days=${selectedDays.value}&limit=10&projectId=${encodeURIComponent(pid)}`),
      apiRequest(`${MODULE_API}/leadership?projectId=${encodeURIComponent(pid)}`).catch(() => null),
      apiRequest(`${MODULE_API}/projects`),
    ])

    dashboard.value = dashData
    contributors.value = contribData.contributors || dashData.topContributors || []
    leadership.value = leaderData

    const match = projectsData.projects?.find(p => p.id === pid)
    projectInfo.value = match || null

    if (fromOrg.value && !orgDisplayName.value) {
      try {
        const orgsData = await apiRequest(`${MODULE_API}/orgs?days=0`)
        const orgMatch = orgsData.orgs?.find(o => o.githubOrg === fromOrg.value)
        orgDisplayName.value = orgMatch?.name || fromOrg.value
      } catch {
        orgDisplayName.value = fromOrg.value
      }
    }
  } catch (err) {
    if (err.status === 502 || err.message?.includes('unreachable') || err.message?.includes('ECONNREFUSED')) {
      connectionError.value = err.message
    } else {
      error.value = err.message
    }
  } finally {
    loading.value = false
  }
}

watch(selectedDays, () => loadData())
onMounted(() => {
  loadData()
  loadProjectJobs()
})
onBeforeUnmount(() => {
  clearTimeout(jobPollTimer)
})
</script>
