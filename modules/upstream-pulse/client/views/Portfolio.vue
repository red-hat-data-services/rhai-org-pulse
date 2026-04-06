<template>
  <div>
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Portfolio</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Organizations and projects your team is tracking</p>
      </div>
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
    </div>

    <!-- Loading -->
    <div v-if="loading">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCardSkeleton v-for="i in 4" :key="'ss'+i" />
      </div>
      <section class="mb-10">
        <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-5 w-32 mb-4"></div>
        <div v-if="orgViewMode === 'grid'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <OrgCardSkeleton v-for="i in 4" :key="'os'+i" />
        </div>
        <div v-else class="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700/60">
          <table class="min-w-full">
            <thead class="bg-gray-50 dark:bg-gray-750">
              <tr>
                <th v-for="i in 8" :key="i" class="px-6 py-3">
                  <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-3 w-16"></div>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <TableRowSkeleton v-for="i in 6" :key="'otr'+i" :cols="8" />
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-5 w-28 mb-4"></div>
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700/60">
          <table class="min-w-full">
            <thead class="bg-gray-50 dark:bg-gray-750">
              <tr>
                <th class="px-6 py-3"><div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-3 w-16"></div></th>
                <th class="px-6 py-3"><div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-3 w-20"></div></th>
                <th class="px-6 py-3"><div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-3 w-12"></div></th>
                <th class="px-6 py-3"><div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-3 w-24 ml-auto"></div></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <TableRowSkeleton v-for="i in 6" :key="'tr'+i" :cols="4" />
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Error loading portfolio</h3>
      <p class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>
    </div>

    <!-- Content -->
    <template v-else>
      <!-- Summary Stats Banner -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-4">
          <div class="flex items-center gap-2 mb-2">
            <div class="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <ActivityIcon :size="14" class="text-blue-600 dark:text-blue-400" />
            </div>
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Total Contributions</span>
          </div>
          <span class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ summaryStats.totalContributions.toLocaleString() }}</span>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-4">
          <div class="flex items-center gap-2 mb-2">
            <div class="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <UsersIcon :size="14" class="text-emerald-600 dark:text-emerald-400" />
            </div>
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Active Members</span>
          </div>
          <span class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ summaryStats.totalActiveMembers.toLocaleString() }}</span>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-4">
          <div class="flex items-center gap-2 mb-2">
            <div class="p-1.5 bg-violet-50 dark:bg-violet-900/20 rounded-lg">
              <Building2Icon :size="14" class="text-violet-600 dark:text-violet-400" />
            </div>
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Active Orgs</span>
          </div>
          <span class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ summaryStats.activeOrgCount }}</span>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-4">
          <div class="flex items-center gap-2 mb-2">
            <div class="p-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <PercentIcon :size="14" class="text-amber-600 dark:text-amber-400" />
            </div>
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Avg Team Share</span>
          </div>
          <span class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ summaryStats.avgTeamShare }}%</span>
        </div>
      </div>

      <!-- Organizations -->
      <section class="mb-10">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Organizations
            <span class="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">({{ filteredOrgs.length }})</span>
          </h3>
          <div class="flex items-center gap-2">
            <div class="relative">
              <SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                v-model="orgSearchInput"
                type="text"
                placeholder="Search organizations..."
                class="w-52 pl-9 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              />
            </div>
            <div data-sort-dropdown class="relative flex items-center rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 overflow-visible">
              <button
                @click="orgSortOpen = !orgSortOpen"
                class="flex items-center gap-1.5 pl-3 pr-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-l-lg"
              >
                <span class="text-gray-400 dark:text-gray-500 text-xs whitespace-nowrap">Sort by</span>
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ orgSortOptions.find(o => o.value === orgSortField)?.label }}</span>
                <ChevronDownIcon :size="14" class="text-gray-400 dark:text-gray-500" />
              </button>
              <button
                @click="toggleOrgSortDirection"
                class="px-2 py-1.5 border-l border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400 rounded-r-lg"
                :title="orgSortDirection === 'asc' ? 'Ascending' : 'Descending'"
              >
                <ArrowUpIcon v-if="orgSortDirection === 'asc'" :size="14" />
                <ArrowDownIcon v-else :size="14" />
              </button>
              <div
                v-if="orgSortOpen"
                class="absolute top-full right-0 mt-1 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-20 py-1"
              >
                <button
                  v-for="opt in orgSortOptions"
                  :key="opt.value"
                  @click="orgSortField = opt.value; orgSortOpen = false"
                  class="w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between"
                  :class="orgSortField === opt.value
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'"
                >
                  {{ opt.label }}
                  <CheckIcon v-if="orgSortField === opt.value" :size="14" class="text-blue-600 dark:text-blue-400" />
                </button>
              </div>
            </div>
            <div class="flex items-center border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
              <button
                @click="orgViewMode = 'grid'"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all duration-200"
                :class="orgViewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'"
              >
                <LayoutGridIcon :size="14" />
                Cards
              </button>
              <button
                @click="orgViewMode = 'table'"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-l border-gray-200 dark:border-gray-600 transition-all duration-200"
                :class="orgViewMode === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'"
              >
                <ListIcon :size="14" />
                Table
              </button>
            </div>
          </div>
        </div>

        <div v-if="orgs.length === 0" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 p-8 text-center">
          <Building2Icon :size="40" class="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p class="text-sm text-gray-500 dark:text-gray-400">No organizations configured yet</p>
        </div>

        <div v-else-if="filteredOrgs.length === 0" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 p-8 text-center">
          <SearchIcon :size="40" class="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p class="text-sm text-gray-500 dark:text-gray-400">No organizations match your search</p>
        </div>

        <template v-else>
          <!-- Card view -->
          <TransitionGroup
            v-if="orgViewMode === 'grid'"
            name="card-list"
            tag="div"
            class="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <OrgActivityCard
              v-for="org in paginatedOrgs"
              :key="org.githubOrg"
              :org-name="org.name"
              :team-contributions="org.contributionCount || 0"
              :total-contributions="org.totalContributions || 0"
              :team-share-percent="org.teamSharePercent || 0"
              :percent-change="org.percentChange || 0"
              :active-team-members="org.activeTeamMembers || 0"
              :leadership-count="org.leadershipCount || 0"
              :maintainer-count="org.maintainerCount || 0"
              :project-count="org.projectCount || 0"
              :show-trend="selectedDays !== '0'"
              :clickable="true"
              @click="nav.navigateTo('org-detail', { org: org.githubOrg })"
            />
          </TransitionGroup>

          <!-- Table view -->
          <div v-else class="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700/60">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-750">
                <tr>
                  <th
                    v-for="col in orgTableColumns"
                    :key="col.field"
                    @click="handleOrgTableSort(col.field)"
                    class="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    :class="col.align === 'right' ? 'text-right' : 'text-left'"
                  >
                    <div class="flex items-center gap-1" :class="col.align === 'right' ? 'justify-end' : ''">
                      {{ col.label }}
                      <component
                        :is="orgSortField === col.field
                          ? (orgSortDirection === 'asc' ? ChevronUpIcon : ChevronDownIcon)
                          : ChevronsUpDownIcon"
                        :size="14"
                        class="shrink-0"
                        :class="orgSortField === col.field ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'"
                      />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr
                  v-for="org in paginatedOrgs"
                  :key="org.githubOrg"
                  class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                  @click="nav.navigateTo('org-detail', { org: org.githubOrg })"
                >
                  <td class="px-6 py-4">
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ org.name }}</span>
                  </td>
                  <td class="px-6 py-4 text-right">
                    <span class="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ (org.contributionCount || 0).toLocaleString() }}</span>
                    <span
                      v-if="selectedDays !== '0' && org.percentChange"
                      class="ml-1.5 text-[11px] font-medium"
                      :class="org.percentChange > 0 ? 'text-emerald-600 dark:text-emerald-400' : org.percentChange < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'"
                    >{{ org.percentChange > 0 ? '↑' : '↓' }}{{ Math.abs(org.percentChange).toFixed(1) }}%</span>
                  </td>
                  <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <div class="w-16 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                        <div class="bg-blue-600 h-1.5 rounded-full" :style="{ width: Math.min(org.teamSharePercent || 0, 100) + '%' }"></div>
                      </div>
                      <span class="text-sm text-gray-700 dark:text-gray-300 tabular-nums">{{ Number(org.teamSharePercent || 0).toFixed(1) }}%</span>
                    </div>
                  </td>
                  <td class="px-6 py-4 text-right text-sm text-gray-700 dark:text-gray-300 tabular-nums">{{ org.activeTeamMembers || 0 }}</td>
                  <td class="px-6 py-4 text-right text-sm text-gray-700 dark:text-gray-300 tabular-nums">{{ org.leadershipCount || 0 }}</td>
                  <td class="px-6 py-4 text-right text-sm text-gray-700 dark:text-gray-300 tabular-nums">{{ org.maintainerCount || 0 }}</td>
                  <td class="px-6 py-4 text-right text-sm text-gray-700 dark:text-gray-300 tabular-nums">{{ org.projectCount || 0 }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Org Pagination -->
          <div v-if="orgTotalPages > 1" class="flex items-center justify-between mt-4 px-1">
            <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>Showing {{ orgStartIdx + 1 }}–{{ Math.min(orgStartIdx + orgPageSize, filteredOrgs.length) }} of {{ filteredOrgs.length }}</span>
              <span class="text-gray-300 dark:text-gray-600">|</span>
              <label class="flex items-center gap-1">
                Rows:
                <select
                  v-model.number="orgPageSize"
                  class="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded px-1.5 py-0.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option v-for="size in orgPageSizeOptions" :key="size" :value="size">{{ size }}</option>
                </select>
              </label>
            </div>
            <div class="flex items-center gap-1">
              <button
                @click="orgCurrentPage = Math.max(1, orgCurrentPage - 1)"
                :disabled="orgCurrentPage <= 1"
                class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-600 dark:text-gray-400"
              >
                <ChevronLeftIcon :size="16" />
              </button>
              <span class="px-3 text-sm text-gray-600 dark:text-gray-400">{{ orgCurrentPage }} / {{ orgTotalPages }}</span>
              <button
                @click="orgCurrentPage = Math.min(orgTotalPages, orgCurrentPage + 1)"
                :disabled="orgCurrentPage >= orgTotalPages"
                class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-600 dark:text-gray-400"
              >
                <ChevronRightIcon :size="16" />
              </button>
            </div>
          </div>
        </template>
      </section>

      <!-- Projects -->
      <section>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Projects
            <span class="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">({{ filteredProjects.length }})</span>
          </h3>
          <div class="flex items-center gap-2">
            <div class="relative">
              <SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                v-model="searchInput"
                type="text"
                placeholder="Search by name, org, or repo..."
                class="w-64 pl-9 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              />
            </div>
            <button
              v-if="isAdmin"
              @click="showAddProject = true"
              class="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition-colors whitespace-nowrap"
            >
              <PlusIcon :size="15" />
              Add Project
            </button>
          </div>
        </div>

        <div v-if="filteredProjects.length === 0" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 p-8 text-center">
          <FolderIcon :size="40" class="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ searchQuery ? 'No projects match your search' : 'No projects configured yet' }}
          </p>
        </div>

        <div v-else class="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700/60">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-750">
              <tr>
                <th
                  v-for="col in projectColumns"
                  :key="col.field"
                  @click="handleProjectSort(col.field)"
                  class="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  :class="col.align === 'right' ? 'text-right' : 'text-left'"
                >
                  <div class="flex items-center gap-1" :class="col.align === 'right' ? 'justify-end' : ''">
                    {{ col.label }}
                    <component
                      :is="projectSortField === col.field
                        ? (projectSortDirection === 'asc' ? ChevronUpIcon : ChevronDownIcon)
                        : ChevronsUpDownIcon"
                      :size="14"
                      class="shrink-0"
                      :class="projectSortField === col.field ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'"
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="project in paginatedProjects"
                :key="project.id"
                class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                @click="nav.navigateTo('project-detail', { projectId: project.id })"
              >
                <td class="px-6 py-4">
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ project.name }}</p>
                    <a
                      :href="`https://github.com/${project.githubOrg}/${project.githubRepo}`"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-0.5 mt-0.5"
                      @click.stop
                    >
                      {{ project.githubOrg }}/{{ project.githubRepo }}
                      <ExternalLinkIcon :size="12" />
                    </a>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="text-sm text-gray-700 dark:text-gray-300">{{ project.githubOrg }}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                    :class="project.trackingEnabled
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-400'"
                  >
                    {{ project.trackingEnabled ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td class="px-6 py-4 text-right">
                  <span class="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                    {{ project.teamContributions.toLocaleString() }}
                  </span>
                  <div class="flex items-center justify-end gap-2 mt-1.5">
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{{ project.commits }} commits</span>
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{{ project.prs }} PRs</span>
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{{ project.reviews }} reviews</span>
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{{ project.issues }} issues</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Project Pagination -->
          <div v-if="projectTotalPages > 1" class="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3">
            <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>Showing {{ projectStartIdx + 1 }}–{{ Math.min(projectStartIdx + projectPageSize, filteredProjects.length) }} of {{ filteredProjects.length }}</span>
              <span class="text-gray-300 dark:text-gray-600">|</span>
              <label class="flex items-center gap-1">
                Rows:
                <select
                  v-model.number="projectPageSize"
                  class="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded px-1.5 py-0.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option v-for="size in projectPageSizeOptions" :key="size" :value="size">{{ size }}</option>
                </select>
              </label>
            </div>
            <div class="flex items-center gap-1">
              <button
                @click="projectCurrentPage = Math.max(1, projectCurrentPage - 1)"
                :disabled="projectCurrentPage <= 1"
                class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-600 dark:text-gray-400"
              >
                <ChevronLeftIcon :size="16" />
              </button>
              <span class="px-3 text-sm text-gray-600 dark:text-gray-400">{{ projectCurrentPage }} / {{ projectTotalPages }}</span>
              <button
                @click="projectCurrentPage = Math.min(projectTotalPages, projectCurrentPage + 1)"
                :disabled="projectCurrentPage >= projectTotalPages"
                class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-600 dark:text-gray-400"
              >
                <ChevronRightIcon :size="16" />
              </button>
            </div>
          </div>
        </div>
      </section>
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
  Search as SearchIcon,
  Folder as FolderIcon,
  Building2 as Building2Icon,
  ExternalLink as ExternalLinkIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ChevronUp as ChevronUpIcon,
  ChevronDown as ChevronDownIcon,
  ChevronsUpDown as ChevronsUpDownIcon,
  Plus as PlusIcon,
  Activity as ActivityIcon,
  Users as UsersIcon,
  Percent as PercentIcon,
  LayoutGrid as LayoutGridIcon,
  List as ListIcon,
  ArrowUp as ArrowUpIcon,
  ArrowDown as ArrowDownIcon,
  Check as CheckIcon,
} from 'lucide-vue-next'
import { apiRequest } from '@shared/client/services/api'
import { useAuth } from '@shared/client/composables/useAuth'
import OrgActivityCard from '../components/OrgActivityCard.vue'
import AddProjectModal from '../components/AddProjectModal.vue'
import { OrgCardSkeleton, StatCardSkeleton, TableRowSkeleton } from '../components/SkeletonLoaders.vue'

const nav = inject('moduleNav')
const { isAdmin } = useAuth()
const showAddProject = ref(false)

const MODULE_API = '/modules/upstream-pulse'

const periodOptions = [
  { label: '30d', value: '30' },
  { label: '60d', value: '60' },
  { label: '90d', value: '90' },
  { label: 'All', value: '0' },
]

const orgSortOptions = [
  { label: 'Contributions', value: 'contributionCount' },
  { label: 'Team Share', value: 'teamSharePercent' },
  { label: 'Active Members', value: 'activeTeamMembers' },
  { label: 'Name', value: 'name' },
]

const orgTableColumns = [
  { label: 'Organization', field: 'name', align: 'left' },
  { label: 'Contributions', field: 'contributionCount', align: 'right' },
  { label: 'Team Share', field: 'teamSharePercent', align: 'right' },
  { label: 'Members', field: 'activeTeamMembers', align: 'right' },
  { label: 'Leaders', field: 'leadershipCount', align: 'right' },
  { label: 'Maintainers', field: 'maintainerCount', align: 'right' },
  { label: 'Projects', field: 'projectCount', align: 'right' },
]

const orgPageSizeOptions = [6, 12, 24]
const projectPageSizeOptions = [10, 25, 50]

const projectColumns = [
  { label: 'Project', field: 'name', align: 'left' },
  { label: 'Organization', field: 'githubOrg', align: 'left' },
  { label: 'Status', field: 'trackingEnabled', align: 'left' },
  { label: 'Team Contributions', field: 'teamContributions', align: 'right' },
]

const selectedDays = ref('30')
const loading = ref(true)
const error = ref(null)
const orgs = ref([])
const projects = ref([])
const topProjects = ref([])

const orgSortOpen = ref(false)
const orgSearchInput = ref('')
const orgSearchQuery = ref('')
const orgSortField = ref('contributionCount')
const orgSortDirection = ref('desc')
const orgViewMode = ref('grid')
const orgCurrentPage = ref(1)
const orgPageSize = ref(6)

const searchInput = ref('')
const searchQuery = ref('')
const projectSortField = ref('teamContributions')
const projectSortDirection = ref('desc')
const projectCurrentPage = ref(1)
const projectPageSize = ref(10)

let orgSearchTimer = null
watch(orgSearchInput, (val) => {
  clearTimeout(orgSearchTimer)
  orgSearchTimer = setTimeout(() => {
    orgSearchQuery.value = val
    orgCurrentPage.value = 1
  }, 300)
})

let searchTimer = null
watch(searchInput, (val) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchQuery.value = val
    projectCurrentPage.value = 1
  }, 300)
})

watch(orgPageSize, () => { orgCurrentPage.value = 1 })
watch(projectPageSize, () => { projectCurrentPage.value = 1 })
watch(orgSortField, (field) => {
  orgSortDirection.value = field === 'name' ? 'asc' : 'desc'
  orgCurrentPage.value = 1
})

function toggleOrgSortDirection() {
  orgSortDirection.value = orgSortDirection.value === 'asc' ? 'desc' : 'asc'
}

function handleOrgTableSort(field) {
  if (orgSortField.value === field) {
    orgSortDirection.value = orgSortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    orgSortField.value = field
    orgSortDirection.value = field === 'name' ? 'asc' : 'desc'
  }
  orgCurrentPage.value = 1
}

const activeOrgs = computed(() =>
  orgs.value.filter(o =>
    (o.contributionCount || 0) > 0 ||
    (o.leadershipCount || 0) > 0 ||
    (o.maintainerCount || 0) > 0 ||
    (o.projectCount || 0) > 0
  )
)

const summaryStats = computed(() => {
  const active = activeOrgs.value
  const totalContributions = active.reduce((sum, o) => sum + (o.contributionCount || 0), 0)
  const totalActiveMembers = active.reduce((sum, o) => sum + (o.activeTeamMembers || 0), 0)
  const avgTeamShare = active.length > 0
    ? (active.reduce((sum, o) => sum + (o.teamSharePercent || 0), 0) / active.length).toFixed(1)
    : '0.0'
  return { totalContributions, totalActiveMembers, activeOrgCount: active.length, avgTeamShare }
})

const sortedOrgsList = computed(() => {
  return [...activeOrgs.value].sort((a, b) => {
    const field = orgSortField.value
    if (field === 'name') {
      const cmp = (a.name || '').localeCompare(b.name || '')
      return orgSortDirection.value === 'asc' ? cmp : -cmp
    }
    const cmp = (a[field] || 0) - (b[field] || 0)
    return orgSortDirection.value === 'asc' ? cmp : -cmp
  })
})

const filteredOrgs = computed(() => {
  if (!orgSearchQuery.value.trim()) return sortedOrgsList.value
  const q = orgSearchQuery.value.toLowerCase()
  return sortedOrgsList.value.filter(o =>
    o.name?.toLowerCase().includes(q) || o.githubOrg?.toLowerCase().includes(q)
  )
})

const orgTotalPages = computed(() => Math.max(1, Math.ceil(filteredOrgs.value.length / orgPageSize.value)))
const orgStartIdx = computed(() => (Math.min(orgCurrentPage.value, orgTotalPages.value) - 1) * orgPageSize.value)
const paginatedOrgs = computed(() => filteredOrgs.value.slice(orgStartIdx.value, orgStartIdx.value + orgPageSize.value))

const mergedProjects = computed(() => {
  const metricsById = new Map()
  for (const p of topProjects.value) {
    metricsById.set(p.id, p)
  }
  return projects.value.map(p => {
    const m = metricsById.get(p.id)
    const contribs = m?.contributions || {}
    return {
      ...p,
      teamContributions: contribs.all?.team || 0,
      commits: contribs.commits?.team || 0,
      prs: contribs.pullRequests?.team || 0,
      reviews: contribs.reviews?.team || 0,
      issues: contribs.issues?.team || 0,
    }
  })
})

const sortedProjectsList = computed(() => {
  return [...mergedProjects.value].sort((a, b) => {
    if (projectSortField.value === 'trackingEnabled') {
      const cmp = (a.trackingEnabled === b.trackingEnabled) ? 0 : a.trackingEnabled ? -1 : 1
      return projectSortDirection.value === 'asc' ? cmp : -cmp
    }
    if (projectSortField.value === 'teamContributions') {
      const cmp = a.teamContributions - b.teamContributions
      return projectSortDirection.value === 'asc' ? cmp : -cmp
    }
    const aStr = (a[projectSortField.value] || '')
    const bStr = (b[projectSortField.value] || '')
    const cmp = String(aStr).localeCompare(String(bStr))
    return projectSortDirection.value === 'asc' ? cmp : -cmp
  })
})

const filteredProjects = computed(() => {
  if (!searchQuery.value.trim()) return sortedProjectsList.value
  const q = searchQuery.value.toLowerCase()
  return sortedProjectsList.value.filter(p =>
    p.name?.toLowerCase().includes(q) ||
    p.githubOrg?.toLowerCase().includes(q) ||
    p.githubRepo?.toLowerCase().includes(q)
  )
})

const projectTotalPages = computed(() => Math.max(1, Math.ceil(filteredProjects.value.length / projectPageSize.value)))
const projectStartIdx = computed(() => (Math.min(projectCurrentPage.value, projectTotalPages.value) - 1) * projectPageSize.value)
const paginatedProjects = computed(() => filteredProjects.value.slice(projectStartIdx.value, projectStartIdx.value + projectPageSize.value))

function handleProjectSort(field) {
  if (projectSortField.value === field) {
    projectSortDirection.value = projectSortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    projectSortField.value = field
    projectSortDirection.value = field === 'teamContributions' ? 'desc' : 'asc'
  }
  projectCurrentPage.value = 1
}

async function loadData() {
  loading.value = true
  error.value = null
  try {
    const [orgsData, projectsData] = await Promise.all([
      apiRequest(`${MODULE_API}/orgs?days=${selectedDays.value}`),
      apiRequest(`${MODULE_API}/projects`),
    ])
    orgs.value = orgsData.orgs || []
    projects.value = projectsData.projects || []
    loading.value = false

    apiRequest(`${MODULE_API}/dashboard?days=${selectedDays.value}`)
      .then(dashData => { topProjects.value = dashData.topProjects || [] })
      .catch(() => {})
  } catch (err) {
    error.value = err.message
    loading.value = false
  }
}

function onProjectCreated() {
  loadData()
}

function onClickOutside(e) {
  if (orgSortOpen.value && !e.target.closest('[data-sort-dropdown]')) {
    orgSortOpen.value = false
  }
}

watch(selectedDays, () => loadData())
onMounted(() => {
  loadData()
  document.addEventListener('click', onClickOutside)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>
