<template>
  <div>
    <!-- Header -->
    <div class="mb-4">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Overview of your team's open source impact</p>
    </div>

    <!-- Skeleton loading (initial load only) -->
    <div v-if="loading && !dashboard">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCardSkeleton v-for="i in 4" :key="'ss'+i" />
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <ContributionCardSkeleton v-for="i in 4" :key="'cs'+i" />
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <OrgCardSkeleton v-for="i in 2" :key="'os'+i" />
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        <ProjectCardSkeleton v-for="i in 3" :key="'ps'+i" />
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-6">
        <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-5 w-36 mb-4"></div>
        <ContributorRowSkeleton v-for="i in 5" :key="'cr'+i" />
      </div>
    </div>

    <!-- Unreachable state -->
    <div v-else-if="connectionError" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-10 text-center">
      <div class="w-14 h-14 mx-auto mb-4 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
        <ActivityIcon :size="28" class="text-amber-500" />
      </div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Upstream Pulse is unreachable</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">{{ connectionError }}</p>
      <p class="text-xs text-gray-500 dark:text-gray-500">Check the connection in Settings or verify the Upstream Pulse service is running.</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
      <div class="w-12 h-12 mx-auto mb-3 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
        <AlertCircleIcon :size="24" class="text-red-500" />
      </div>
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Error loading dashboard</h3>
      <p class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>
    </div>

    <!-- Fallback: no state matched -->
    <div v-else-if="!dashboard">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCardSkeleton v-for="i in 4" :key="'fss'+i" />
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <ContributionCardSkeleton v-for="i in 4" :key="'fcs'+i" />
      </div>
    </div>

    <!-- Dashboard content -->
    <template v-else>
      <!-- Floating sticky navigation -->
      <div class="sticky top-16 z-[9] -mx-6 lg:-mx-8 px-6 lg:px-8 pt-2 pb-5 bg-gray-50 dark:bg-gray-900">
        <nav class="relative flex items-center justify-between bg-white dark:bg-gray-800 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_-2px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_16px_-2px_rgba(0,0,0,0.35)] ring-1 ring-gray-950/[0.05] dark:ring-white/[0.08] px-2.5 py-2 overflow-hidden">
          <div v-if="loading" class="absolute inset-x-0 bottom-0 h-[3px] bg-blue-100/50 dark:bg-blue-900/30">
            <div class="h-full w-2/5 bg-blue-500 rounded-full shadow-[0_0_8px_2px_rgba(59,130,246,0.5)] animate-[slideRight_1.2s_ease-in-out_infinite]"></div>
          </div>
          <div class="flex items-center gap-1 overflow-x-auto min-w-0">
            <button
              v-for="s in sections"
              :key="s.id"
              @click="scrollToSection(s.id)"
              class="px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200"
              :class="activeSection === s.id
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50'"
            >{{ s.label }}</button>
          </div>
          <div class="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-3 shrink-0"></div>
          <div class="flex items-center gap-2.5 shrink-0">
            <div class="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-700/60 rounded-lg p-0.5">
              <button
                v-for="opt in periodOptions"
                :key="opt.value"
                @click="selectedDays = opt.value"
                class="px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200"
                :class="selectedDays === opt.value
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
              >{{ opt.label }}</button>
            </div>
            <div v-if="periodLabel" class="hidden xl:flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-750/40 pl-2 pr-2.5 py-1 rounded-lg">
              <CalendarIcon :size="12" />
              <span>{{ periodLabel }}</span>
            </div>
          </div>
        </nav>
      </div>

      <!-- Content with refetch dim -->
      <div class="transition-opacity duration-300" :class="{ 'opacity-40 pointer-events-none': loading }">

      <!-- Summary Stats -->
      <div id="section-overview" class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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

      <!-- Top Organizations -->
      <section v-if="orgActivity.length" id="section-organizations" class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Top Organizations</h3>
          <button
            @click="nav.navigateTo('portfolio')"
            class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors"
          >
            View all organizations &rarr;
          </button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <OrgActivityCard
            v-for="activity in orgActivity.slice(0, DASHBOARD_ORG_LIMIT)"
            :key="activity.org"
            :org-name="activity.orgName"
            :strategic-participation="activity.strategicParticipation"
            :strategic-leadership="activity.strategicLeadership"
            :team-contributions="activity.total || 0"
            :total-contributions="activity.totalContributions || 0"
            :team-share-percent="activity.teamSharePercent || 0"
            :percent-change="activity.percentChange || 0"
            :active-team-members="activity.activeTeamMembers || 0"
            :leadership-count="activity.leadershipCount || 0"
            :maintainer-count="activity.maintainerCount || 0"
            :show-trend="selectedDays !== '0'"
            :clickable="true"
            @click="nav.navigateTo('org-detail', { org: activity.org })"
          />
        </div>
      </section>

      <!-- Top Projects -->
      <section v-if="topProjects.length" id="section-projects" class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2.5">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Top Projects</h3>
            <button
              v-if="isAdmin"
              @click="showAddProject = true"
              class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-800/40 border border-blue-200 dark:border-blue-800 rounded-md transition-colors"
            >
              <PlusIcon :size="13" :stroke-width="2.5" />
              Add
            </button>
          </div>
          <button
            v-if="topProjects.length > 6"
            @click="nav.navigateTo('portfolio')"
            class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors"
          >
            View all {{ topProjects.length }} projects &rarr;
          </button>
          <p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ topProjects.length }} tracked projects</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <ProjectCard
            v-for="project in topProjects.slice(0, 6)"
            :key="project.id"
            :name="project.name"
            :github-org="project.githubOrg"
            :github-repo="project.githubRepo"
            :contributions="project.contributions"
            :active-contributors="project.activeContributors || 0"
            :clickable="true"
            @click="nav.navigateTo('project-detail', { projectId: project.id })"
          />
        </div>
      </section>

      <!-- Top Contributors -->
      <section id="section-contributors" class="mb-8">
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
                <!-- Contributor row -->
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
                <!-- Hover breakdown -->
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

            <!-- Show more / less toggle -->
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

      <!-- Team Leadership -->
      <section id="section-leadership" class="mb-8">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Team Leadership</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">Team influence in upstream governance</p>
        </div>

        <!-- Leadership Strategy -->
        <div v-if="orgActivity.length" class="mb-6">
          <h4 class="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">Leadership Strategy</h4>
          <LeadershipStrategy
            :org-activity="orgActivity"
            @org-click="(org) => nav.navigateTo('org-detail', { org })"
          />
        </div>

        <div v-if="!leadership && !communityOrgs.length" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-8 text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400">No leadership data available</p>
        </div>

        <template v-else>
          <!-- Sub-section: Community Leaders -->
          <div v-if="governanceLeaders.length" class="mb-6">
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-6">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Community Leaders</h3>
                <p class="text-sm text-gray-400 dark:text-gray-500">{{ totalGovernancePositions }} {{ totalGovernancePositions === 1 ? 'position' : 'positions' }} across {{ communityOrgs.length }} {{ communityOrgs.length === 1 ? 'org' : 'orgs' }}</p>
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
                  <div class="pl-16 pr-4 pb-3 pt-1">
                    <div class="flex flex-wrap gap-1.5">
                      <span
                        v-for="detail in leader.roleDetails"
                        :key="detail.role + detail.org"
                        class="text-[11px] font-medium px-2 py-0.5 rounded-full"
                        :class="positionBadge(detail.role)"
                      >{{ detail.role }} · {{ detail.org }}</span>
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

          <!-- Sub-section: Code Maintainership -->
          <div v-if="leadership">
            <h4 class="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">Code Maintainership</h4>

            <div class="grid grid-cols-1 gap-4 mb-4" :class="dashGovernanceCards.length >= 3 ? 'sm:grid-cols-3' : dashGovernanceCards.length === 2 ? 'sm:grid-cols-2' : ''">
              <LeadershipCard
                v-for="card in dashGovernanceCards"
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

            <!-- Top maintainers ranked by roles -->
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
        </template>
      </section>

      </div><!-- /refetch dim wrapper -->
    </template>

    <AddProjectModal
      :open="showAddProject"
      @close="showAddProject = false"
      @created="onProjectCreated"
      @navigate="({ view, params }) => nav.navigateTo(view, params)"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, inject } from 'vue'
import {
  Activity as ActivityIcon,
  AlertCircle as AlertCircleIcon,
  Calendar as CalendarIcon,
  ChevronDown as ChevronDownIcon,
  ChevronUp as ChevronUpIcon,
  ExternalLink as ExternalLinkIcon,
  Eye as EyeIcon,
  GitCommit as GitCommitIcon,
  GitPullRequest as GitPullRequestIcon,
  Layers as LayersIcon,
  MessageSquare as MessageSquareIcon,
  Plus as PlusIcon,
  ShieldCheck as ShieldCheckIcon,
  TrendingUp as TrendingUpIcon,
  Users as UsersIcon,
} from 'lucide-vue-next'
import { apiRequest } from '@shared/client/services/api'
import { useAuth } from '@shared/client/composables/useAuth'
import StatCard from '../components/StatCard.vue'
import ContributionTypeCard from '../components/ContributionTypeCard.vue'
import LeadershipCard from '../components/LeadershipCard.vue'
import ContributionTrendChart from '../components/ContributionTrendChart.vue'
import OrgActivityCard from '../components/OrgActivityCard.vue'
import ProjectCard from '../components/ProjectCard.vue'
import LeadershipStrategy from '../components/LeadershipStrategy.vue'
import AddProjectModal from '../components/AddProjectModal.vue'
import { StatCardSkeleton, ContributionCardSkeleton, OrgCardSkeleton, ProjectCardSkeleton, ContributorRowSkeleton } from '../components/SkeletonLoaders.vue'
import { useGovernanceCards, uniqueRoles } from '../composables/useGovernanceCards.js'

const nav = inject('moduleNav')
const { isAdmin } = useAuth()
const showAddProject = ref(false)
const MODULE_API = '/modules/upstream-pulse'

const DASHBOARD_ORG_LIMIT = 4

const periodOptions = [
  { label: '30d', value: '30' },
  { label: '60d', value: '60' },
  { label: '90d', value: '90' },
  { label: 'All', value: '0' },
]

const selectedDays = ref('30')
const loading = ref(true)
const error = ref(null)
const connectionError = ref(null)
const dashboard = ref(null)
const contributors = ref([])
const contributorsExpanded = ref(false)
const orgActivity = ref([])
const topProjects = ref([])
const leadership = ref(null)
const membersExpanded = ref(false)
const activeSection = ref('overview')

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

const sections = computed(() => {
  const s = [{ id: 'overview', label: 'Overview' }]
  if (orgActivity.value.length) s.push({ id: 'organizations', label: 'Organizations' })
  if (topProjects.value.length) s.push({ id: 'projects', label: 'Projects' })
  s.push({ id: 'contributors', label: 'Contributors' })
  s.push({ id: 'leadership', label: 'Leadership' })
  return s
})

const SCROLL_OFFSET = 140

function scrollToSection(id) {
  const el = document.getElementById(`section-${id}`)
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET
  window.scrollTo({ top, behavior: 'smooth' })
}

let scrollTicking = false
function onScrollSpy() {
  if (scrollTicking) return
  scrollTicking = true
  requestAnimationFrame(() => {
    scrollTicking = false
    const ids = sections.value.map(s => s.id)
    for (let i = ids.length - 1; i >= 0; i--) {
      const el = document.getElementById(`section-${ids[i]}`)
      if (el && el.getBoundingClientRect().top <= SCROLL_OFFSET + 20) {
        activeSection.value = ids[i]
        return
      }
    }
    if (ids.length) activeSection.value = ids[0]
  })
}

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

const governanceExpanded = ref(false)

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

const projectCoveragePercent = computed(() => {
  if (!leadership.value?.summary || !dashboard.value?.summary) return 0
  const covered = leadership.value.summary.projectsWithTeamLeadership || 0
  const total = dashboard.value.summary.trackedProjects || 1
  return Math.min((covered / total) * 100, 100)
})

const { governanceCards: dashGovernanceCards } = useGovernanceCards(leadership, dashboard, projectCoveragePercent)

async function loadData() {
  loading.value = true
  error.value = null
  connectionError.value = null

  try {
    const [dashData, contribData, leaderData] = await Promise.all([
      apiRequest(`${MODULE_API}/dashboard?days=${selectedDays.value}`),
      apiRequest(`${MODULE_API}/contributors?days=${selectedDays.value}&limit=10`),
      apiRequest(`${MODULE_API}/leadership`).catch(() => null),
    ])

    dashboard.value = dashData
    contributors.value = contribData.contributors || dashData.topContributors || []
    orgActivity.value = dashData.orgActivity || []
    topProjects.value = dashData.topProjects || []
    leadership.value = leaderData
  } catch (err) {
    if (err.status === 502 || err.message?.includes('unreachable') || err.message?.includes('ECONNREFUSED')) {
      connectionError.value = err.message || 'Unable to connect to Upstream Pulse'
    } else {
      error.value = err.message || 'An unexpected error occurred'
    }
  } finally {
    loading.value = false
  }
}

function onProjectCreated() {
  loadData()
}

watch(selectedDays, () => loadData())

onMounted(() => {
  window.addEventListener('scroll', onScrollSpy, { passive: true })
  loadData()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScrollSpy)
})
</script>

<style scoped>
@keyframes slideRight {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}
</style>
