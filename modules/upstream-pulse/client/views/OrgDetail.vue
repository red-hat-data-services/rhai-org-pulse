<template>
  <div>
    <!-- Breadcrumb -->
    <nav class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
      <button @click="nav.navigateTo('portfolio')" class="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Portfolio</button>
      <ChevronRightIcon :size="14" class="text-gray-400 dark:text-gray-500" />
      <span class="text-gray-900 dark:text-gray-100 font-medium">{{ displayName }}</span>
    </nav>

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1 flex-wrap">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ displayName }}</h2>

          <!-- Engagement Status Badge with Tooltip -->
          <div v-if="dashboard" class="relative group/engagement">
            <span
              :class="engagementStatus.classes"
              class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border"
            >
              {{ engagementStatus.label }}
            </span>
            <div class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover/engagement:opacity-100 group-hover/engagement:visible transition-all duration-200 pointer-events-none whitespace-nowrap z-50">
              {{ engagementStatus.description }}
              <div class="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-700"></div>
            </div>
          </div>

          <!-- Strategic Leadership Badge with Tooltip -->
          <div v-if="strategicLeadership" class="relative group/leadership">
            <span
              class="px-3 py-1 rounded-full text-xs font-semibold"
              :class="getStrategicBadgeClass(strategicLeadership)"
            >
              {{ getStrategicLabel(strategicLeadership, 'leadership') }}
            </span>
            <div class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover/leadership:opacity-100 group-hover/leadership:visible transition-all duration-200 pointer-events-none whitespace-nowrap z-50">
              {{ getStrategicDescription(strategicLeadership) }}
              <div class="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-700"></div>
            </div>
          </div>

          <!-- Strategic Participation Badge with Tooltip -->
          <div v-if="strategicParticipation" class="relative group/participation">
            <span
              class="px-3 py-1 rounded-full text-xs font-semibold"
              :class="getStrategicBadgeClass(strategicParticipation)"
            >
              {{ getStrategicLabel(strategicParticipation, 'participation') }}
            </span>
            <div class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover/participation:opacity-100 group-hover/participation:visible transition-all duration-200 pointer-events-none whitespace-nowrap z-50">
              {{ getStrategicDescription(strategicParticipation) }}
              <div class="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-700"></div>
            </div>
          </div>
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Team engagement in {{ displayName }} projects</p>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            v-for="opt in periodOptions"
            :key="opt.value"
            @click="selectedDays = opt.value"
            class="px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200"
            :class="selectedDays === opt.value
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'"
          >
            {{ opt.label }}
          </button>
        </div>
        <div v-if="dashboard?.summary" class="hidden lg:flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg">
          <CalendarIcon :size="14" />
          <span>{{ periodLabel }}</span>
        </div>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCardSkeleton v-for="i in 4" :key="'ss'+i" />
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <ContributionCardSkeleton v-for="i in 4" :key="'cs'+i" />
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        <ProjectCardSkeleton v-for="i in 3" :key="'ps'+i" />
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
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Error loading organization</h3>
      <p class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>
    </div>

    <!-- Content -->
    <template v-else-if="dashboard">
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
          label="Tracked Projects"
          :value="dashboard.summary.trackedProjects"
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
      <section v-if="leadership || communityOrgs.length" class="mb-8">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Team Leadership</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">Team influence in {{ displayName }}</p>
        </div>

        <!-- Community Leaders -->
        <div v-if="governanceLeaders.length" class="mb-6">
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Community Leaders</h3>
              <p class="text-sm text-gray-400 dark:text-gray-500">{{ totalGovernancePositions }} {{ totalGovernancePositions === 1 ? 'position' : 'positions' }}</p>
            </div>
            <div class="space-y-1">
              <div
                v-for="(leader, i) in visibleGovernanceLeaders"
                :key="leader.id"
                class="group"
              >
                <div class="flex items-center gap-4 py-3 border-b border-gray-50 dark:border-gray-700/30 last:border-0">
                  <span class="w-6 text-center text-sm font-medium text-gray-400 dark:text-gray-500 tabular-nums">{{ i + 1 }}</span>
                  <img
                    v-if="leader.avatarUrl"
                    :src="leader.avatarUrl"
                    :alt="leader.name"
                    class="w-10 h-10 rounded-full shrink-0"
                  />
                  <div v-else class="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0">
                    {{ (leader.name || '?').charAt(0).toUpperCase() }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-gray-900 dark:text-gray-100 truncate">{{ leader.name }}</p>
                    <a
                      v-if="leader.githubUsername"
                      :href="'https://github.com/' + leader.githubUsername"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center gap-1"
                    >
                      @{{ leader.githubUsername }}
                      <ExternalLinkIcon :size="12" />
                    </a>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ leader.positionCount }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{{ leader.positionCount === 1 ? 'position' : 'positions' }}</p>
                  </div>
                </div>
                <div class="hidden group-hover:block pl-16 pr-4 pb-3">
                  <div class="flex flex-wrap gap-1.5">
                    <span
                      v-for="detail in leader.roleDetails"
                      :key="detail.role + detail.org"
                      class="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      :class="positionBadge(detail.role)"
                    >{{ detail.role }}</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              v-if="governanceLeaders.length > 5"
              @click="governanceExpanded = !governanceExpanded"
              class="flex items-center gap-1.5 mx-auto mt-4 px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <template v-if="governanceExpanded">
                Show Less
                <ChevronUpIcon :size="16" />
              </template>
              <template v-else>
                View All ({{ Math.min(governanceLeaders.length, 10) }})
                <ChevronDownIcon :size="16" />
              </template>
            </button>
          </div>
        </div>

        <!-- Code Maintainership -->
        <div v-if="leadership">
          <h4 class="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">Code Maintainership</h4>

          <div class="grid grid-cols-1 gap-4 mb-4" :class="orgGovernanceCards.length >= 3 ? 'sm:grid-cols-3' : orgGovernanceCards.length === 2 ? 'sm:grid-cols-2' : ''">
            <LeadershipCard
              v-for="card in orgGovernanceCards"
              :key="card.positionType"
              :label="card.label"
              :icon="card.positionType === 'reviewer' ? EyeIcon : card.positionType === 'coverage' ? LayersIcon : ShieldCheckIcon"
              :color="card.positionType === 'reviewer' ? 'text-green-600 dark:text-green-400' : card.positionType === 'coverage' ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'"
              :bgColor="card.positionType === 'reviewer' ? 'bg-green-50 dark:bg-green-900/20' : card.positionType === 'coverage' ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-blue-50 dark:bg-blue-900/20'"
              :barColor="card.positionType === 'reviewer' ? 'bg-green-600' : card.positionType === 'coverage' ? 'bg-purple-600' : 'bg-blue-600'"
              :team="card.team"
              :total="card.total"
              :percent="card.percent"
              :percentThreshold="card.percentThreshold"
            />
          </div>

          <!-- Top maintainers -->
          <div v-if="rankedMembers.length" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-6">
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Top Maintainers</h3>
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
                <div class="text-right shrink-0 w-16">
                  <p class="font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ uniqueProjectCount(member) }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ uniqueProjectCount(member) === 1 ? 'project' : 'projects' }}</p>
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
        </div>
      </section>

      <!-- Top Projects -->
      <section v-if="orgProjects.length" class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Projects
            <span class="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">({{ orgProjects.length }})</span>
          </h3>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="project in orgProjects"
            :key="project.id"
            class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-200 cursor-pointer"
            @click="nav.navigateTo('project-detail', { projectId: project.id, org: githubOrg })"
          >
            <div class="flex items-start justify-between mb-3">
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-gray-900 dark:text-gray-100 truncate">{{ project.name }}</p>
                <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{{ project.githubOrg }}/{{ project.githubRepo }}</p>
              </div>
            </div>
            <div class="flex items-baseline gap-2 mb-1">
              <span class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ (project.teamContributions || 0).toLocaleString() }}</span>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400">Team Contributions</p>
          </div>
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
        <ImpactBanner :contributions="dashboard.contributions" />
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, inject } from 'vue'
import {
  Activity as ActivityIcon,
  AlertCircle as AlertCircleIcon,
  Calendar as CalendarIcon,
  ChevronDown as ChevronDownIcon,
  ChevronRight as ChevronRightIcon,
  ChevronUp as ChevronUpIcon,
  ExternalLink as ExternalLinkIcon,
  Eye as EyeIcon,
  GitCommit as GitCommitIcon,
  GitPullRequest as GitPullRequestIcon,
  Layers as LayersIcon,
  MessageSquare as MessageSquareIcon,
  ShieldCheck as ShieldCheckIcon,
  TrendingUp as TrendingUpIcon,
  Users as UsersIcon,
} from 'lucide-vue-next'
import { apiRequest } from '@shared/client/services/api'
import { StatCardSkeleton, ContributionCardSkeleton, ProjectCardSkeleton, ContributorRowSkeleton } from '../components/SkeletonLoaders.vue'
import StatCard from '../components/StatCard.vue'
import ContributionTypeCard from '../components/ContributionTypeCard.vue'
import LeadershipCard from '../components/LeadershipCard.vue'
import ContributionTrendChart from '../components/ContributionTrendChart.vue'
import ImpactBanner from '../components/ImpactBanner.vue'
import { useGovernanceCards, uniqueRoles } from '../composables/useGovernanceCards.js'

const nav = inject('moduleNav')

const MODULE_API = '/modules/upstream-pulse'

const periodOptions = [
  { label: '30d', value: '30' },
  { label: '60d', value: '60' },
  { label: '90d', value: '90' },
  { label: 'All', value: '0' },
]

const githubOrg = computed(() => nav.params.value?.org || '')
const displayName = ref('')
const strategicParticipation = ref(null)
const strategicLeadership = ref(null)
const orgLeadershipCount = ref(0)
const orgMaintainerCount = ref(0)

const selectedDays = ref('30')
const loading = ref(true)
const error = ref(null)
const connectionError = ref(null)
const dashboard = ref(null)
const contributors = ref([])
const contributorsExpanded = ref(false)
const leadership = ref(null)
const membersExpanded = ref(false)
const governanceExpanded = ref(false)
const orgProjects = ref([])

function getStrategicLabel(strategic, _type) {
  if (!strategic) return ''
  const labels = {
    'evaluating_participation': 'Evaluating Participation',
    'sustaining_participation': 'Sustaining Participation',
    'increasing_participation': 'Increasing Participation',
    'evaluating_leadership': 'Evaluating Leadership',
    'sustaining_leadership': 'Sustaining Leadership',
    'increasing_leadership': 'Increasing Leadership',
  }
  return labels[strategic] || strategic
}

function getStrategicBadgeClass(strategic) {
  const classes = {
    'evaluating_participation': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    'sustaining_participation': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    'increasing_participation': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    'evaluating_leadership': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    'sustaining_leadership': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    'increasing_leadership': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  }
  return classes[strategic] || ''
}

function getStrategicDescription(strategic) {
  const descriptions = {
    'evaluating_participation': 'Red Hat is evaluating whether to increase participation in this project',
    'sustaining_participation': 'Red Hat is sustaining current participation levels in this project',
    'increasing_participation': 'Red Hat is actively increasing participation in this project',
    'evaluating_leadership': 'Red Hat is evaluating whether to pursue leadership positions in this project',
    'sustaining_leadership': 'Red Hat is sustaining current leadership presence in this project',
    'increasing_leadership': 'Red Hat is actively pursuing more leadership positions in this project',
  }
  return descriptions[strategic] || ''
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


function uniqueProjectCount(member) {
  if (!member.roles?.length) return 0
  return new Set(member.roles.map(r => r.projectId)).size
}

const rankedMembers = computed(() => {
  if (!leadership.value?.members) return []
  return [...leadership.value.members].sort((a, b) => (b.roles?.length || 0) - (a.roles?.length || 0))
})

const visibleMembers = computed(() => {
  if (membersExpanded.value) return rankedMembers.value.slice(0, 10)
  return rankedMembers.value.slice(0, 5)
})

const communityOrgs = computed(() => {
  const byOrg = dashboard.value?.leadership?.byOrg
  if (!byOrg?.length) return []
  return byOrg.filter(org => org.positions?.some(p => p.teamCount > 0))
})

function positionTypeOrder(type) {
  if (type.includes('steering') || type.includes('tsc')) return 0
  if (type.includes('committee')) return 1
  if (type.includes('project_lead') || type.includes('lead_-_')) return 2
  if (type.includes('chair')) return 3
  if (type.includes('lead')) return 4
  if (type.includes('core')) return 5
  return 6
}

function positionBadge(role) {
  const r = role.toLowerCase()
  if (r.includes('steering') || r.includes('tsc'))
    return 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
  if (r.includes('chair') || r.includes('lead'))
    return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
  return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
}

const GOVERNANCE_TYPES = new Set([
  'steering_committee', 'tsc_member', 'core_member',
  'wg_chair', 'sig_chair', 'wg_tech_lead', 'sig_tech_lead',
  'sig_lead', 'project_lead',
])

const governanceLeaders = computed(() => {
  const people = new Map()
  for (const org of communityOrgs.value) {
    for (const pos of org.positions || []) {
      const posType = pos.positionType || ''
      if (!GOVERNANCE_TYPES.has(posType) && !posType.includes('lead') && !posType.includes('chair') && !posType.includes('steering') && !posType.includes('tsc') && !posType.includes('core')) continue
      for (const member of pos.members || []) {
        if (!people.has(member.id)) {
          people.set(member.id, {
            ...member,
            topPrestige: positionTypeOrder(posType),
            positionCount: 0,
            orgs: new Set(),
            roleDetails: [],
          })
        }
        const person = people.get(member.id)
        person.positionCount++
        person.orgs.add(org.orgName)
        person.roleDetails.push({ role: pos.roleTitle, org: org.orgName })
        const prestige = positionTypeOrder(posType)
        if (prestige < person.topPrestige) {
          person.topPrestige = prestige
        }
      }
    }
  }
  return Array.from(people.values())
    .map(p => ({ ...p, orgs: Array.from(p.orgs) }))
    .sort((a, b) => a.topPrestige - b.topPrestige || b.positionCount - a.positionCount)
})

const visibleGovernanceLeaders = computed(() => {
  if (governanceExpanded.value) return governanceLeaders.value.slice(0, 10)
  return governanceLeaders.value.slice(0, 5)
})

const totalGovernancePositions = computed(() => {
  let count = 0
  for (const org of communityOrgs.value) {
    for (const pos of org.positions || []) {
      count += pos.teamCount || 0
    }
  }
  return count
})

const engagementStatus = computed(() => {
  const leadershipCount = orgLeadershipCount.value
  const maintainerCount = orgMaintainerCount.value
  const teamContributions = dashboard.value?.contributions?.all?.team || 0

  const hasGovernance = leadershipCount > 0 || maintainerCount > 0
  const highGovernance = leadershipCount >= 3 || maintainerCount >= 5

  if (teamContributions === 0 && !hasGovernance) {
    return {
      label: 'New Entrant',
      classes: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600',
      description: 'No contributions or governance positions yet'
    }
  }
  if (highGovernance) {
    return {
      label: 'Established Leader',
      classes: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700',
      description: 'Significant influence with 3+ leadership positions or 5+ maintainers'
    }
  }
  if (hasGovernance) {
    return {
      label: 'Core Contributor',
      classes: 'text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700',
      description: 'Active participation with leadership or maintainer positions'
    }
  }
  return {
    label: 'Active',
    classes: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600',
    description: 'Contributing code without formal governance positions'
  }
})

const projectCoveragePercent = computed(() => {
  if (!leadership.value?.summary || !dashboard.value?.summary) return 0
  const covered = leadership.value.summary.projectsWithTeamLeadership || 0
  const total = dashboard.value.summary.trackedProjects || 1
  return Math.min((covered / total) * 100, 100)
})

const { governanceCards: orgGovernanceCards } = useGovernanceCards(leadership, dashboard, projectCoveragePercent)

async function loadData() {
  loading.value = true
  error.value = null
  connectionError.value = null
  const org = githubOrg.value
  if (!org) {
    error.value = 'No organization specified'
    loading.value = false
    return
  }

  try {
    const [dashData, contribData, leaderData, orgsData, projectsData] = await Promise.all([
      apiRequest(`${MODULE_API}/dashboard?days=${selectedDays.value}&githubOrg=${encodeURIComponent(org)}`),
      apiRequest(`${MODULE_API}/contributors?days=${selectedDays.value}&limit=10&githubOrg=${encodeURIComponent(org)}`),
      apiRequest(`${MODULE_API}/leadership?githubOrg=${encodeURIComponent(org)}`).catch(() => null),
      apiRequest(`${MODULE_API}/orgs?days=${selectedDays.value}`),
      apiRequest(`${MODULE_API}/projects?githubOrg=${encodeURIComponent(org)}`),
    ])

    dashboard.value = dashData
    contributors.value = contribData.contributors || dashData.topContributors || []
    leadership.value = leaderData

    const match = orgsData.orgs?.find(o => o.githubOrg === org)
    displayName.value = match?.name || org
    strategicParticipation.value = match?.strategicParticipation || null
    strategicLeadership.value = match?.strategicLeadership || null
    orgLeadershipCount.value = match?.leadershipCount || 0
    orgMaintainerCount.value = match?.maintainerCount || 0

    const topProjects = dashData.topProjects || []
    const metricsById = new Map()
    for (const p of topProjects) {
      metricsById.set(p.id, p)
    }
    orgProjects.value = (projectsData.projects || []).map(p => {
      const m = metricsById.get(p.id)
      return {
        ...p,
        teamContributions: m?.contributions?.all?.team || 0,
      }
    }).sort((a, b) => b.teamContributions - a.teamContributions)
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
onMounted(() => loadData())
</script>
