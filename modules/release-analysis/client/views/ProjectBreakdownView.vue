<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Component Breakdown</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Release data organized by Jira project, component, and strategic deliverables.
        </p>
      </div>
      <button
        class="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
        :disabled="loading || refreshing"
        @click="refreshAnalysis"
      >
        {{ loading ? 'Loading...' : refreshing ? 'Updating...' : 'Refresh' }}
      </button>
    </div>

    <div
      v-if="refreshing && analysis"
      class="flex items-center gap-2 rounded-lg border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/60 dark:bg-indigo-900/20 px-4 py-2.5 text-sm text-indigo-700 dark:text-indigo-300"
    >
      <svg class="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Updating data in the background — you can keep working with the current data.
    </div>

    <div v-if="error" class="rounded-lg border border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm">
      {{ error }}
    </div>

    <div v-if="(loading || refreshing) && !analysis" class="text-sm text-gray-500 dark:text-gray-400">Loading release analytics...</div>

    <template v-if="analysis">
      <div
        v-if="analysis.warning"
        class="rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-800 px-4 py-3 text-sm"
      >
        {{ analysis.warning }}
      </div>

      <div class="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
        <p>
          Generated: {{ formatDateTime(analysis.generatedAt) }} |
          Baseline window: {{ analysis.baselineDays }}d |
          Capacity mode: {{ (analysis.capacityMode || '').toUpperCase() }}
        </p>
      </div>

      <ReleaseFilterBar
        :selected-versions="selectedVersions"
        :visible-versions="visibleVersions"
        :filtered-count="enrichedReleases.length"
        :total-count="allReleases.length"
        :toggle-version="toggleVersion"
        :clear-versions="clearVersions"
        :reset-filters="resetFilters"
      />

      <div v-if="!enrichedReleases.length" class="text-sm text-gray-500 dark:text-gray-400">
        No releases match the current filters.
      </div>

      <article
        v-for="release in enrichedReleases"
        :key="release.releaseNumber"
        class="rounded-xl border border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-900/40 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)] flex flex-col gap-4"
      >
        <!-- Release header -->
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
          <div class="flex items-center gap-3 min-w-0">
            <p class="font-bold text-gray-900 dark:text-gray-100 text-base">{{ release.releaseNumber }}</p>
            <span
              v-if="release.codeFreezeDate"
              class="inline-flex items-center gap-1.5 rounded-full border border-pink-200 dark:border-pink-700/50 bg-pink-50 dark:bg-pink-900/30 px-2.5 py-1 text-[11px] font-medium text-pink-700 dark:text-pink-300 shadow-sm"
            >
              <svg class="h-3.5 w-3.5 text-pink-500 dark:text-pink-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clip-rule="evenodd" /></svg>
              Code Freeze · {{ formatDueDate(release.codeFreezeDate) }}
            </span>
            <span
              class="inline-flex items-center gap-1.5 rounded-full border border-purple-200 dark:border-purple-700/50 bg-purple-50 dark:bg-purple-900/30 px-2.5 py-1 text-[11px] font-medium text-purple-700 dark:text-purple-300 shadow-sm"
            >
              <svg class="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clip-rule="evenodd" /></svg>
              Release · {{ formatDueDate(release.dueDate) }}
            </span>
          </div>
          <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">
            {{ release.issues?.length || 0 }} issues
          </span>
        </div>

        <div v-if="!release.projectGroups.length" class="text-sm text-gray-500 dark:text-gray-400">
          No issues found for this release.
        </div>

        <!-- ═══ LAYER 1 — Project ═══ -->
        <div class="space-y-3">
          <div
            v-for="project in release.projectGroups"
            :key="`${release.releaseNumber}::${project.projectKey}`"
            class="rounded-xl border border-gray-200/80 dark:border-gray-700/80 bg-gray-50/50 dark:bg-gray-800/30 overflow-hidden"
          >
          <button
            class="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
            @click="toggleProject(release.releaseNumber, project.projectKey)"
          >
            <div class="flex items-center gap-3 min-w-0">
              <span class="text-gray-400 dark:text-gray-500 transition-transform text-xs" :class="{ 'rotate-90': isProjectExpanded(release.releaseNumber, project.projectKey) }">▸</span>
              <span class="font-semibold text-gray-900 dark:text-gray-100 text-sm uppercase tracking-wide">{{ project.projectKey }}</span>
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ project.allIssues.length }} issue{{ project.allIssues.length !== 1 ? 's' : '' }}</span>
              <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="confidenceBadgeClass(project.forecast.level)">
                <span class="h-2 w-2 rounded-full" :class="confidenceDotClass(project.forecast.level)" />
                {{ project.forecast.paceStatus }}
              </span>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <div class="grid grid-cols-3 gap-1.5 text-[10px]">
                <span class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />{{ project.counts.done }}</span>
                <span class="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400"><span class="h-1.5 w-1.5 rounded-full bg-blue-500" />{{ project.counts.doing }}</span>
                <span class="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400"><span class="h-1.5 w-1.5 rounded-full bg-gray-400" />{{ project.counts.to_do }}</span>
              </div>
              <div class="flex h-2 w-24 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 ring-1 ring-inset ring-gray-200/60 dark:ring-gray-700/60">
                <div class="h-full bg-emerald-500" :style="{ width: pct(project.counts.done, project.allIssues.length) }" />
                <div class="h-full bg-blue-500" :style="{ width: pct(project.counts.doing, project.allIssues.length) }" />
                <div class="h-full bg-gray-400" :style="{ width: pct(project.counts.to_do, project.allIssues.length) }" />
              </div>
            </div>
          </button>

          <!-- Expanded project → confidence detail strip + component list -->
          <div v-if="isProjectExpanded(release.releaseNumber, project.projectKey)" class="border-t border-gray-100 dark:border-gray-800">

            <!-- Project-level capacity forecast -->
            <div class="px-4 py-2.5 pl-10 bg-gray-50/60 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800">
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5 text-[11px]">
                <div>
                  <span class="text-gray-400 dark:text-gray-500">Feature Velocity (V) — 6mo avg</span>
                  <p class="font-semibold text-gray-700 dark:text-gray-300">{{ project.forecast.velocity }} <span class="font-normal text-gray-400 dark:text-gray-500">issues / 14d</span></p>
                </div>
                <div>
                  <span class="text-gray-400 dark:text-gray-500">Remaining Issues (RI)</span>
                  <p class="font-semibold text-gray-700 dark:text-gray-300">{{ project.forecast.remaining }} <span class="font-normal text-gray-400 dark:text-gray-500">not done</span></p>
                </div>
                <div>
                  <span class="text-gray-400 dark:text-gray-500">Sprint (14d window) Remaining (W)</span>
                  <p class="font-semibold text-gray-700 dark:text-gray-300">{{ project.forecast.windowsRemaining }} <span class="font-normal text-gray-400 dark:text-gray-500">({{ project.forecast.T }}d ÷ 14)</span></p>
                </div>
                <div>
                  <span class="text-gray-400 dark:text-gray-500">Capacity (C = V x W)</span>
                  <p class="font-semibold text-gray-700 dark:text-gray-300">{{ project.forecast.totalCapacity }} <span class="font-normal text-gray-400 dark:text-gray-500">projected</span></p>
                </div>
              </div>
              <div class="mt-2 text-xs space-y-1">
                <div class="flex items-center gap-3">
                  <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold" :class="confidenceBadgeClass(project.forecast.level)">
                    <span class="h-2 w-2 rounded-full" :class="confidenceDotClass(project.forecast.level)" />
                    {{ project.forecast.paceStatus }}
                  </span>
                  <span v-if="project.forecast.riskSource === 'components'" class="text-red-600 dark:text-red-400">
                    At Risk Due To: {{ project.atRiskComponents.join(', ') }}
                  </span>
                  <span v-else-if="project.forecast.remaining > 0 && project.forecast.delta < 0" class="text-red-600 dark:text-red-400">
                    At Risk Because: Capacity Required: {{ project.forecast.remaining }} but Projected {{ project.forecast.totalCapacity }}
                  </span>
                  <span v-else-if="project.forecast.remaining > 0" class="text-emerald-600 dark:text-emerald-400">
                    On Track: Capacity Required: {{ project.forecast.remaining }}; Projected {{ project.forecast.totalCapacity }}
                  </span>
                  <span v-else class="text-emerald-600 dark:text-emerald-400 font-medium">All issues resolved</span>
                </div>
                <div v-if="project.forecast.riskSource === 'components' && project.forecast.remaining > 0" class="pl-[calc(2.5rem+0.75rem)] text-gray-500 dark:text-gray-400">
                  Overall Capacity: Required {{ project.forecast.remaining }}; Projected {{ project.forecast.totalCapacity }}
                  <span class="font-semibold" :class="project.forecast.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'">
                    ({{ project.forecast.delta >= 0 ? '+' : '' }}{{ project.forecast.delta }})
                  </span>
                </div>
              </div>
            </div>

            <!-- ═══ LAYER 2 — Component ═══ -->
            <div
              v-for="comp in project.components"
              :key="comp.name"
              class="border-b border-gray-100/70 dark:border-gray-800/70 last:border-b-0"
            >
              <button
                class="w-full flex items-center justify-between gap-3 px-4 py-2.5 pl-10 text-left hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                @click="toggleComponent(release.releaseNumber, project.projectKey, comp.name)"
              >
                <div class="flex items-center gap-2.5 min-w-0 flex-wrap">
                  <span class="text-gray-400 dark:text-gray-500 transition-transform text-[10px]" :class="{ 'rotate-90': isComponentExpanded(release.releaseNumber, project.projectKey, comp.name) }">▸</span>
                  <span class="font-medium text-gray-700 dark:text-gray-300 text-sm">{{ comp.name }}</span>
                  <span class="text-xs text-gray-400 dark:text-gray-500">{{ comp.allIssues.length }} issue{{ comp.allIssues.length !== 1 ? 's' : '' }}</span>
                  <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" :class="confidenceBadgeClass(comp.forecast.level)">
                    <span class="h-1.5 w-1.5 rounded-full" :class="confidenceDotClass(comp.forecast.level)" />
                    {{ comp.forecast.paceStatus }}
                  </span>
                </div>
                <div class="grid grid-cols-3 gap-1.5 text-[10px] shrink-0">
                  <span class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />{{ comp.counts.done }}</span>
                  <span class="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400"><span class="h-1.5 w-1.5 rounded-full bg-blue-500" />{{ comp.counts.doing }}</span>
                  <span class="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400"><span class="h-1.5 w-1.5 rounded-full bg-gray-400" />{{ comp.counts.to_do }}</span>
                </div>
              </button>

              <!-- Expanded component content -->
              <div v-if="isComponentExpanded(release.releaseNumber, project.projectKey, comp.name)" class="pl-10 pb-2">

                <!-- Component-level capacity forecast -->
                <div class="mx-4 mt-2 mb-2 rounded-lg bg-gray-50/80 dark:bg-gray-800/40 border border-gray-200/60 dark:border-gray-700/40 px-4 py-2.5">
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5 text-[11px]">
                    <div>
                      <span class="text-gray-400 dark:text-gray-500">Feature Velocity (V) — 6mo avg</span>
                      <p class="font-semibold text-gray-700 dark:text-gray-300">{{ comp.forecast.velocity }} <span class="font-normal text-gray-400 dark:text-gray-500">issues / 14d</span></p>
                    </div>
                    <div>
                      <span class="text-gray-400 dark:text-gray-500">Remaining Issues (RI)</span>
                      <p class="font-semibold text-gray-700 dark:text-gray-300">{{ comp.forecast.remaining }} <span class="font-normal text-gray-400 dark:text-gray-500">not done</span></p>
                    </div>
                    <div>
                      <span class="text-gray-400 dark:text-gray-500">Sprint (14d window) Remaining (W)</span>
                      <p class="font-semibold text-gray-700 dark:text-gray-300">{{ comp.forecast.windowsRemaining }} <span class="font-normal text-gray-400 dark:text-gray-500">({{ comp.forecast.T }}d ÷ 14)</span></p>
                    </div>
                    <div>
                      <span class="text-gray-400 dark:text-gray-500">Capacity (C = V x W)</span>
                      <p class="font-semibold text-gray-700 dark:text-gray-300">{{ comp.forecast.totalCapacity }} <span class="font-normal text-gray-400 dark:text-gray-500">projected</span></p>
                    </div>
                  </div>
                  <div class="mt-2 flex items-center gap-3 text-xs">
                    <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold" :class="confidenceBadgeClass(comp.forecast.level)">
                      <span class="h-2 w-2 rounded-full" :class="confidenceDotClass(comp.forecast.level)" />
                      {{ comp.forecast.paceStatus }}
                    </span>
                    <span v-if="comp.forecast.remaining > 0" class="text-gray-500 dark:text-gray-400">
                      Needs {{ comp.forecast.remaining }}; Projected {{ comp.forecast.totalCapacity }}
                      <span class="font-semibold" :class="comp.forecast.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'">
                        ({{ comp.forecast.delta >= 0 ? '+' : '' }}{{ comp.forecast.delta }})
                      </span>
                    </span>
                    <span v-else class="text-emerald-600 dark:text-emerald-400 font-medium">All issues resolved</span>
                  </div>
                </div>

                <!-- ═══ LAYER 3 — Strategic items inside this component ═══ -->
                <div
                  v-for="si in comp.strategicItems"
                  :key="si.key"
                  class="border-t border-gray-100/60 dark:border-gray-800/60"
                >
                  <button
                    class="w-full flex items-center justify-between gap-3 px-4 py-2 pl-6 text-left hover:bg-gray-50/40 dark:hover:bg-gray-800/20 transition-colors"
                    @click="toggleStrategic(release.releaseNumber, project.projectKey, comp.name, si.key)"
                  >
                    <div class="flex items-center gap-2 min-w-0 flex-wrap">
                      <span class="text-gray-400 dark:text-gray-500 transition-transform text-[10px]" :class="{ 'rotate-90': isStrategicExpanded(release.releaseNumber, project.projectKey, comp.name, si.key) }">▸</span>
                      <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider" :class="issueTypePillClass(si.issueType)">{{ si.issueType }}</span>
                      <a :href="si.link" target="_blank" rel="noopener" class="text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium" @click.stop>{{ si.key }}</a>
                      <span class="text-xs text-gray-700 dark:text-gray-300 truncate">{{ si.summary }}</span>
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                      <span class="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium" :class="statusBadgeClass(si.statusBucket)">
                        <span class="h-1.5 w-1.5 rounded-full" :class="statusDotClass(si.statusBucket)" />
                        {{ si.status }}
                      </span>
                      <span class="text-xs font-medium tabular-nums" :class="childProgressColor(si.childCounts)">
                        {{ si.childCounts.done }}/{{ si.children.length }} Done
                      </span>
                    </div>
                  </button>

                  <!-- ═══ LAYER 4 — Tactical children ═══ -->
                  <div v-if="isStrategicExpanded(release.releaseNumber, project.projectKey, comp.name, si.key) && si.children.length" class="px-4 pb-2 pl-12">
                    <div class="overflow-x-auto rounded-lg border border-gray-200/80 dark:border-gray-700/80">
                      <table class="min-w-full text-sm">
                        <thead class="bg-gray-50 dark:bg-gray-800/60 text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          <tr>
                            <th class="px-3 py-1.5 font-medium">Key</th>
                            <th class="px-3 py-1.5 font-medium">Summary</th>
                            <th class="px-3 py-1.5 font-medium">Status</th>
                            <th class="px-3 py-1.5 font-medium">Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="child in si.children" :key="child.key" class="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
                            <td class="px-3 py-1.5 whitespace-nowrap">
                              <a :href="child.link" target="_blank" rel="noopener" class="text-blue-600 dark:text-blue-400 hover:underline font-medium text-xs">{{ child.key }}</a>
                            </td>
                            <td class="px-3 py-1.5 max-w-xs"><span class="line-clamp-1 text-xs text-gray-700 dark:text-gray-300">{{ child.summary }}</span></td>
                            <td class="px-3 py-1.5 whitespace-nowrap">
                              <span class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium" :class="statusBadgeClass(child.statusBucket)">
                                <span class="h-1 w-1 rounded-full" :class="statusDotClass(child.statusBucket)" />
                                {{ child.status }}
                              </span>
                            </td>
                            <td class="px-3 py-1.5 text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ child.issueType || '—' }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div v-else-if="isStrategicExpanded(release.releaseNumber, project.projectKey, comp.name, si.key) && !si.children.length" class="px-4 pb-2 pl-12">
                    <p class="text-[10px] text-gray-400 dark:text-gray-500 italic">No child issues in this release.</p>
                  </div>
                </div>

                <!-- Other issues in this component (not strategic and not children of strategic) -->
                <div v-if="comp.otherItems.length" class="border-t border-gray-100/60 dark:border-gray-800/60">
                  <button
                    class="w-full flex items-center justify-between gap-3 px-4 py-2 pl-6 text-left hover:bg-gray-50/40 dark:hover:bg-gray-800/20 transition-colors"
                    @click="toggleStrategic(release.releaseNumber, project.projectKey, comp.name, '__other__')"
                  >
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="text-gray-400 dark:text-gray-500 transition-transform text-[10px]" :class="{ 'rotate-90': isStrategicExpanded(release.releaseNumber, project.projectKey, comp.name, '__other__') }">▸</span>
                      <span class="font-medium text-gray-500 dark:text-gray-400 text-xs italic">Other items</span>
                      <span class="text-[10px] text-gray-400 dark:text-gray-500">{{ comp.otherItems.length }}</span>
                    </div>
                    <div class="grid grid-cols-3 gap-1.5 text-[10px] shrink-0">
                      <span class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><span class="h-1 w-1 rounded-full bg-emerald-500" />{{ comp.otherCounts.done }}</span>
                      <span class="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400"><span class="h-1 w-1 rounded-full bg-blue-500" />{{ comp.otherCounts.doing }}</span>
                      <span class="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400"><span class="h-1 w-1 rounded-full bg-gray-400" />{{ comp.otherCounts.to_do }}</span>
                    </div>
                  </button>

                  <div v-if="isStrategicExpanded(release.releaseNumber, project.projectKey, comp.name, '__other__')" class="px-4 pb-2 pl-12">
                    <div class="overflow-x-auto rounded-lg border border-gray-200/80 dark:border-gray-700/80">
                      <table class="min-w-full text-sm">
                        <thead class="bg-gray-50 dark:bg-gray-800/60 text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          <tr>
                            <th class="px-3 py-1.5 font-medium">Key</th>
                            <th class="px-3 py-1.5 font-medium">Summary</th>
                            <th class="px-3 py-1.5 font-medium">Status</th>
                            <th class="px-3 py-1.5 font-medium">Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="issue in comp.otherItems" :key="issue.key" class="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
                            <td class="px-3 py-1.5 whitespace-nowrap">
                              <a :href="issue.link" target="_blank" rel="noopener" class="text-blue-600 dark:text-blue-400 hover:underline font-medium text-xs">{{ issue.key }}</a>
                            </td>
                            <td class="px-3 py-1.5 max-w-xs"><span class="line-clamp-1 text-xs text-gray-700 dark:text-gray-300">{{ issue.summary }}</span></td>
                            <td class="px-3 py-1.5 whitespace-nowrap">
                              <span class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium" :class="statusBadgeClass(issue.statusBucket)">
                                <span class="h-1 w-1 rounded-full" :class="statusDotClass(issue.statusBucket)" />
                                {{ issue.status }}
                              </span>
                            </td>
                            <td class="px-3 py-1.5 text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ issue.issueType || '—' }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </article>

    </template>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { useReleaseAnalysis } from '../composables/useReleaseAnalysis'
import { useReleaseFilter } from '../composables/useReleaseFilter'
import ReleaseFilterBar from '../components/ReleaseFilterBar.vue'

const STRATEGIC_TYPES = new Set(['feature', 'initiative', 'spike'])

const expandedProjects = reactive(new Set())
const expandedComponents = reactive(new Set())
const expandedStrategic = reactive(new Set())

const { loading, refreshing, error, analysis, refreshAnalysis } = useReleaseAnalysis()

function normalizeType(t) { return (t || '').toLowerCase().trim() }

const allReleases = computed(() => analysis.value?.releases || [])

const {
  selectedVersions,
  visibleVersions,
  filteredReleases,
  toggleVersion,
  clearVersions,
  resetFilters
} = useReleaseFilter(allReleases)

const enrichedReleases = computed(() =>
  filteredReleases.value.map(r => ({
    ...r,
    projectGroups: buildProjectGroups(r)
  }))
)

/**
 * Computes calendar days from today to the given ISO date string.
 * Returns 0 if the date is in the past or invalid.
 */
function daysUntil(isoDate) {
  if (!isoDate) return 0
  const target = new Date(isoDate + 'T00:00:00')
  if (isNaN(target.getTime())) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.ceil((target - today) / (1000 * 60 * 60 * 24)))
}

/**
 * Returns the effective deadline date for the Component Breakdown tab.
 * Uses codeFreezeDate when available, otherwise falls back to dueDate.
 */
function effectiveDeadline(release) {
  return release?.codeFreezeDate || release?.dueDate || null
}

const FORECAST_WINDOW = 14

/**
 * Looks up historical velocity for the given component names from the backend data.
 * For a single component, returns its 2-week average; for multiple (project-level),
 * sums all unique component velocities.
 */
function lookupHistoricalVelocity(componentNames) {
  const cv = analysis.value?.componentVelocity || {}
  let total = 0
  const seen = new Set()
  for (const name of componentNames) {
    if (seen.has(name)) continue
    seen.add(name)
    const entry = cv[name]
    if (entry) total += entry.velocity
  }
  return Math.round(total * 10) / 10
}

function computeForecast(issues, daysRemaining, componentNames) {
  // V — Historical Component Velocity: average issues resolved per 2-week window
  //     over the past 6 months, sourced from the backend.
  const velocity = lookupHistoricalVelocity(componentNames || [])

  // W — Remaining Work: all not-done issues (To-Do + In-Progress)
  let remaining = 0
  for (const issue of issues) {
    if (issue.statusBucket !== 'done') remaining++
  }

  // T — Time remaining in days
  const T = Math.max(0, daysRemaining)

  // Windows remaining = T / 14
  const windowsRemaining = T / FORECAST_WINDOW

  // C — Total Capacity = V × (T / 14)
  const totalCapacity = velocity * windowsRemaining

  // Delta: positive means surplus, negative means deficit
  const delta = totalCapacity - remaining

  // Pace assessment
  let paceStatus, level
  if (remaining === 0) {
    paceStatus = 'Complete'
    level = 'High'
  } else if (totalCapacity >= remaining) {
    paceStatus = 'On Track'
    level = 'High'
  } else {
    paceStatus = 'At Risk'
    level = 'Low'
  }

  const pctRaw = remaining === 0 ? 100 : (totalCapacity === 0 ? 0 : (totalCapacity / remaining) * 100)
  const pct = Math.min(100, Math.round(pctRaw))

  return {
    velocity,
    remaining,
    windowsRemaining: +windowsRemaining.toFixed(1),
    totalCapacity: +totalCapacity.toFixed(1),
    delta: +delta.toFixed(1),
    paceStatus,
    level,
    pct,
    T
  }
}

const BUCKET_ORDER = { to_do: 0, doing: 1, done: 2 }
function sortIssuesRemainingFirst(issues) {
  return [...issues].sort((a, b) => (BUCKET_ORDER[a.statusBucket] ?? 1) - (BUCKET_ORDER[b.statusBucket] ?? 1))
}

function countByBucket(issues) {
  const counts = { done: 0, doing: 0, to_do: 0 }
  for (const i of issues) {
    if (i.statusBucket === 'done') counts.done++
    else if (i.statusBucket === 'doing') counts.doing++
    else counts.to_do++
  }
  return counts
}

/**
 * Builds the 4-layer hierarchy:
 *   Layer 1 — Project
 *   Layer 2 — Component (multi-component issues appear in each)
 *     Layer 3 — Strategic items (Feature / Initiative / Spike)
 *       Layer 4 — Tactical children of the strategic item
 *     + "Other items" for unlinked issues
 */
function buildProjectGroups(release) {
  if (!release?.issues?.length) return []

  const daysRemaining = daysUntil(effectiveDeadline(release))

  // Global index: which issue keys are strategic items in this release?
  const strategicMap = {}
  for (const issue of release.issues) {
    if (STRATEGIC_TYPES.has(normalizeType(issue.issueType))) {
      strategicMap[issue.key] = issue
    }
  }

  // Global index: children whose parentKey points to a strategic item
  const childKeySet = new Set()
  const childrenByParent = {}
  for (const issue of release.issues) {
    if (issue.parentKey && strategicMap[issue.parentKey]) {
      childKeySet.add(issue.key)
      if (!childrenByParent[issue.parentKey]) childrenByParent[issue.parentKey] = []
      childrenByParent[issue.parentKey].push(issue)
    }
  }

  // Group by project → component
  const projectMap = {}
  for (const issue of release.issues) {
    const pk = issue.projectKey || 'UNKNOWN'
    if (!projectMap[pk]) projectMap[pk] = { projectKey: pk, allIssues: [], componentMap: {} }
    projectMap[pk].allIssues.push(issue)

    const comps = issue.components?.length ? issue.components : ['(No component)']
    for (const compName of comps) {
      if (!projectMap[pk].componentMap[compName]) projectMap[pk].componentMap[compName] = []
      projectMap[pk].componentMap[compName].push(issue)
    }
  }

  return Object.values(projectMap)
    .map(p => {
      const components = Object.entries(p.componentMap)
        .map(([name, issues]) => {
          // Within this component, split into strategic + their children + other
          const compStrategic = issues.filter(i => strategicMap[i.key])
          const compStrategicKeys = new Set(compStrategic.map(i => i.key))

          const strategicItems = compStrategic
            .map(si => {
              const children = sortIssuesRemainingFirst(
                childrenByParent[si.key] || []
              )
              return {
                key: si.key, summary: si.summary, issueType: si.issueType,
                status: si.status, statusBucket: si.statusBucket, link: si.link,
                childrenTotal: si.childrenTotal || children.length,
                childrenDone: si.childrenDone ?? null,
                childrenRemaining: si.childrenRemaining ?? null,
                children,
                childCounts: countByBucket(children)
              }
            })
            .sort((a, b) => {
              const typeOrder = { Feature: 0, Initiative: 1, Spike: 2 }
              const ta = typeOrder[a.issueType] ?? 3, tb = typeOrder[b.issueType] ?? 3
              if (ta !== tb) return ta - tb
              return a.key.localeCompare(b.key)
            })

          const otherItems = sortIssuesRemainingFirst(
            issues.filter(i => !compStrategicKeys.has(i.key) && !childKeySet.has(i.key))
          )

          return {
            name,
            allIssues: issues,
            counts: countByBucket(issues),
            forecast: computeForecast(issues, daysRemaining, [name]),
            strategicItems,
            otherItems,
            otherCounts: countByBucket(otherItems)
          }
        })
        .sort((a, b) => {
          if (a.name === '(No component)') return 1
          if (b.name === '(No component)') return -1
          return a.name.localeCompare(b.name)
        })

      const projectComponentNames = Object.keys(p.componentMap)
      const projectForecast = computeForecast(p.allIssues, daysRemaining, projectComponentNames)

      const atRiskComponents = components.filter(c => c.forecast.paceStatus === 'At Risk')
      const ownRisk = projectForecast.paceStatus === 'At Risk'

      if (atRiskComponents.length > 0 && !ownRisk) {
        projectForecast.paceStatus = 'At Risk'
        projectForecast.level = 'Low'
        projectForecast.riskSource = 'components'
      }

      return {
        projectKey: p.projectKey,
        allIssues: p.allIssues,
        counts: countByBucket(p.allIssues),
        forecast: projectForecast,
        atRiskComponents: atRiskComponents.map(c => c.name),
        components
      }
    })
    .sort((a, b) => a.projectKey.localeCompare(b.projectKey))
}

// ── Expand / collapse ──

function projectId(releaseNumber, projectKey) { return `${releaseNumber}::${projectKey}` }

function isProjectExpanded(releaseNumber, projectKey) {
  return expandedProjects.has(projectId(releaseNumber, projectKey))
}

function toggleProject(releaseNumber, projectKey) {
  const key = projectId(releaseNumber, projectKey)
  if (expandedProjects.has(key)) {
    expandedProjects.delete(key)
    const prefix = `${key}::`
    for (const k of [...expandedComponents]) { if (k.startsWith(prefix)) expandedComponents.delete(k) }
    for (const k of [...expandedStrategic]) { if (k.startsWith(prefix)) expandedStrategic.delete(k) }
  } else {
    expandedProjects.add(key)
  }
}

function componentId(releaseNumber, projectKey, compName) { return `${releaseNumber}::${projectKey}::${compName}` }

function toggleComponent(releaseNumber, projectKey, compName) {
  const k = componentId(releaseNumber, projectKey, compName)
  if (expandedComponents.has(k)) {
    expandedComponents.delete(k)
    const prefix = `${k}::`
    for (const sk of [...expandedStrategic]) { if (sk.startsWith(prefix)) expandedStrategic.delete(sk) }
  } else {
    expandedComponents.add(k)
  }
}

function isComponentExpanded(releaseNumber, projectKey, compName) {
  return expandedComponents.has(componentId(releaseNumber, projectKey, compName))
}

function strategicKey(releaseNumber, projectKey, compName, itemKey) { return `${releaseNumber}::${projectKey}::${compName}::${itemKey}` }

function toggleStrategic(releaseNumber, projectKey, compName, itemKey) {
  const k = strategicKey(releaseNumber, projectKey, compName, itemKey)
  if (expandedStrategic.has(k)) expandedStrategic.delete(k)
  else expandedStrategic.add(k)
}

function isStrategicExpanded(releaseNumber, projectKey, compName, itemKey) {
  return expandedStrategic.has(strategicKey(releaseNumber, projectKey, compName, itemKey))
}

// ── Styling helpers ──

function pct(part, total) {
  if (!total || part <= 0) return '0%'
  return `${Math.min(100, (part / total) * 100)}%`
}

function confidenceBadgeClass(level) {
  if (level === 'High') return 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
  return 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
}

function confidenceDotClass(level) {
  if (level === 'High') return 'bg-emerald-500'
  return 'bg-red-500'
}


function statusBadgeClass(bucket) {
  if (bucket === 'done') return 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
  if (bucket === 'doing') return 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
  return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
}

function statusDotClass(bucket) {
  if (bucket === 'done') return 'bg-emerald-500'
  if (bucket === 'doing') return 'bg-blue-500'
  return 'bg-gray-400'
}

function issueTypePillClass(type) {
  const t = normalizeType(type)
  if (t === 'feature') return 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
  if (t === 'initiative') return 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
  if (t === 'spike') return 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
  return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
}

function childProgressColor(counts) {
  const total = counts.done + counts.doing + counts.to_do
  if (total === 0) return 'text-gray-400 dark:text-gray-500'
  if (counts.done === total) return 'text-emerald-600 dark:text-emerald-400'
  if (counts.done / total > 0.5) return 'text-blue-600 dark:text-blue-400'
  return 'text-gray-500 dark:text-gray-400'
}

// ── Formatting ──

function formatDateTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

function formatDueDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}


</script>
