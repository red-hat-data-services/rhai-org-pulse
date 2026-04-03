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
        :disabled="loading"
        @click="refreshAnalysis"
      >
        {{ loading ? 'Refreshing...' : 'Refresh' }}
      </button>
    </div>

    <div v-if="error" class="rounded-lg border border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm">
      {{ error }}
    </div>

    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Loading release analytics...</div>

    <template v-if="!loading && analysis">
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

      <!-- Release selector -->
      <div class="flex items-center gap-3">
        <label for="release-select" class="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">Release</label>
        <select
          id="release-select"
          v-model="activeRelease"
          class="block w-full max-w-md rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:focus:border-blue-400 dark:focus:ring-blue-400 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%236b7280%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat pr-9"
        >
          <option v-for="tab in releaseTabs" :key="tab.key" :value="tab.key">
            {{ tab.label }} ({{ tab.issueCount }} issues)
          </option>
        </select>
        <span v-if="selectedRelease" class="text-xs text-gray-500 dark:text-gray-400 shrink-0">
          {{ selectedRelease.daysRemaining }}d remaining
        </span>
      </div>

      <div v-if="!projectGroups.length" class="text-sm text-gray-500 dark:text-gray-400">
        No issues found for the selected release.
      </div>

      <!-- ═══ LAYER 1 — Project ═══ -->
      <div class="space-y-3">
        <div
          v-for="project in projectGroups"
          :key="project.projectKey"
          class="rounded-xl border border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-900/40 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)] overflow-hidden"
        >
          <button
            class="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
            @click="toggleProject(project.projectKey)"
          >
            <div class="flex items-center gap-3 min-w-0">
              <span class="text-gray-400 dark:text-gray-500 transition-transform text-xs" :class="{ 'rotate-90': expandedProjects.has(project.projectKey) }">▸</span>
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
          <div v-if="expandedProjects.has(project.projectKey)" class="border-t border-gray-100 dark:border-gray-800">

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
                @click="toggleComponent(project.projectKey, comp.name)"
              >
                <div class="flex items-center gap-2.5 min-w-0 flex-wrap">
                  <span class="text-gray-400 dark:text-gray-500 transition-transform text-[10px]" :class="{ 'rotate-90': isComponentExpanded(project.projectKey, comp.name) }">▸</span>
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
              <div v-if="isComponentExpanded(project.projectKey, comp.name)" class="pl-10 pb-2">

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
                    @click="toggleStrategic(project.projectKey, comp.name, si.key)"
                  >
                    <div class="flex items-center gap-2 min-w-0 flex-wrap">
                      <span class="text-gray-400 dark:text-gray-500 transition-transform text-[10px]" :class="{ 'rotate-90': isStrategicExpanded(project.projectKey, comp.name, si.key) }">▸</span>
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
                  <div v-if="isStrategicExpanded(project.projectKey, comp.name, si.key) && si.children.length" class="px-4 pb-2 pl-12">
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
                  <div v-else-if="isStrategicExpanded(project.projectKey, comp.name, si.key) && !si.children.length" class="px-4 pb-2 pl-12">
                    <p class="text-[10px] text-gray-400 dark:text-gray-500 italic">No child issues in this release.</p>
                  </div>
                </div>

                <!-- Other issues in this component (not strategic and not children of strategic) -->
                <div v-if="comp.otherItems.length" class="border-t border-gray-100/60 dark:border-gray-800/60">
                  <button
                    class="w-full flex items-center justify-between gap-3 px-4 py-2 pl-6 text-left hover:bg-gray-50/40 dark:hover:bg-gray-800/20 transition-colors"
                    @click="toggleStrategic(project.projectKey, comp.name, '__other__')"
                  >
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="text-gray-400 dark:text-gray-500 transition-transform text-[10px]" :class="{ 'rotate-90': isStrategicExpanded(project.projectKey, comp.name, '__other__') }">▸</span>
                      <span class="font-medium text-gray-500 dark:text-gray-400 text-xs italic">Other items</span>
                      <span class="text-[10px] text-gray-400 dark:text-gray-500">{{ comp.otherItems.length }}</span>
                    </div>
                    <div class="grid grid-cols-3 gap-1.5 text-[10px] shrink-0">
                      <span class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><span class="h-1 w-1 rounded-full bg-emerald-500" />{{ comp.otherCounts.done }}</span>
                      <span class="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400"><span class="h-1 w-1 rounded-full bg-blue-500" />{{ comp.otherCounts.doing }}</span>
                      <span class="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400"><span class="h-1 w-1 rounded-full bg-gray-400" />{{ comp.otherCounts.to_do }}</span>
                    </div>
                  </button>

                  <div v-if="isStrategicExpanded(project.projectKey, comp.name, '__other__')" class="px-4 pb-2 pl-12">
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
    </template>
  </div>
</template>

<script setup>
import { computed, ref, reactive } from 'vue'
import { useReleaseAnalysis } from '../composables/useReleaseAnalysis'

const STRATEGIC_TYPES = new Set(['feature', 'initiative', 'spike'])

const activeRelease = ref('')
const expandedProjects = reactive(new Set())
const expandedComponents = reactive(new Set())
const expandedStrategic = reactive(new Set())

function initActiveRelease() {
  const tabs = releaseTabs.value
  if (tabs.length && !activeRelease.value) activeRelease.value = tabs[0].key
}

const { loading, error, analysis, refreshAnalysis } = useReleaseAnalysis({
  onLoaded: initActiveRelease
})

function normalizeType(t) { return (t || '').toLowerCase().trim() }


const releaseTabs = computed(() => {
  const releases = analysis.value?.releases || []
  return releases.map(r => ({
    key: r.releaseNumber,
    label: r.releaseNumber,
    issueCount: r.issues?.length || 0
  }))
})

const selectedRelease = computed(() => {
  if (!analysis.value?.releases) return null
  return analysis.value.releases.find(r => r.releaseNumber === activeRelease.value) || null
})

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
const projectGroups = computed(() => {
  const release = selectedRelease.value
  if (!release?.issues?.length) return []

  const daysRemaining = release.daysRemaining ?? 0

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
})

// ── Expand / collapse ──

function toggleProject(projectKey) {
  if (expandedProjects.has(projectKey)) {
    expandedProjects.delete(projectKey)
    const prefix = `${projectKey}::`
    for (const k of [...expandedComponents]) { if (k.startsWith(prefix)) expandedComponents.delete(k) }
    for (const k of [...expandedStrategic]) { if (k.startsWith(prefix)) expandedStrategic.delete(k) }
  } else {
    expandedProjects.add(projectKey)
  }
}

function componentId(projectKey, compName) { return `${projectKey}::${compName}` }

function toggleComponent(projectKey, compName) {
  const k = componentId(projectKey, compName)
  if (expandedComponents.has(k)) {
    expandedComponents.delete(k)
    const prefix = `${k}::`
    for (const sk of [...expandedStrategic]) { if (sk.startsWith(prefix)) expandedStrategic.delete(sk) }
  } else {
    expandedComponents.add(k)
  }
}

function isComponentExpanded(projectKey, compName) {
  return expandedComponents.has(componentId(projectKey, compName))
}

function strategicKey(projectKey, compName, itemKey) { return `${projectKey}::${compName}::${itemKey}` }

function toggleStrategic(projectKey, compName, itemKey) {
  const k = strategicKey(projectKey, compName, itemKey)
  if (expandedStrategic.has(k)) expandedStrategic.delete(k)
  else expandedStrategic.add(k)
}

function isStrategicExpanded(projectKey, compName, itemKey) {
  return expandedStrategic.has(strategicKey(projectKey, compName, itemKey))
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


</script>
