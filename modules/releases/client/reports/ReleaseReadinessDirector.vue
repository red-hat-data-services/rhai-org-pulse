<template>
  <div>
    <!-- Header -->
    <div class="flex items-center gap-3 mb-4">
      <button
        @click="goBack"
        class="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
        title="Back to Reports"
      >
        <ArrowLeft :size="18" />
      </button>
      <div class="flex-1">
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">RHOAI Release Readiness</h2>
      </div>
    </div>

    <!-- Release Schedule Bar (from Product Pages) -->
    <div v-if="releaseSchedule" class="rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 dark:from-blue-700 dark:via-indigo-700 dark:to-violet-700 px-6 py-5 shadow-lg text-white mb-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-xs font-bold uppercase tracking-widest text-blue-200 mb-1">Viewing Release</p>
          <h3 class="text-3xl font-extrabold tracking-tight leading-none">{{ selectedVersion }}</h3>
        </div>
        <div class="flex flex-wrap gap-3">
          <div v-if="releaseSchedule.code_freeze_date" class="flex flex-col items-center bg-white/15 backdrop-blur-sm rounded-xl px-5 py-2.5 min-w-[90px]">
            <span class="text-[10px] font-semibold uppercase tracking-wider text-blue-200 mb-0.5">Code Freeze</span>
            <span class="text-sm font-bold">{{ formatScheduleDate(releaseSchedule.code_freeze_date) }}</span>
          </div>
          <div v-if="releaseSchedule.ga_date" class="flex flex-col items-center bg-white/15 backdrop-blur-sm rounded-xl px-5 py-2.5 min-w-[90px]">
            <span class="text-[10px] font-semibold uppercase tracking-wider text-blue-200 mb-0.5">GA Date</span>
            <span class="text-sm font-bold">{{ formatScheduleDate(releaseSchedule.ga_date) }}</span>
          </div>
          <div class="flex flex-col items-center rounded-xl px-5 py-2.5 min-w-[90px]"
            :class="releaseSchedule.status === 'Released' ? 'bg-emerald-500/30' : 'bg-amber-500/30'">
            <span class="text-[10px] font-semibold uppercase tracking-wider text-blue-200 mb-0.5">Status</span>
            <span class="text-sm font-bold">{{ releaseSchedule.status }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Release section with version + decision status -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
      <div class="flex items-center gap-5">
        <!-- Progress Ring -->
        <div v-if="director && hasInitiativeData" class="flex-shrink-0 relative group">
          <svg width="72" height="72" viewBox="0 0 72 72" class="transform -rotate-90">
            <circle cx="36" cy="36" r="30" fill="none" stroke-width="6" class="stroke-gray-200 dark:stroke-gray-700" />
            <circle cx="36" cy="36" r="30" fill="none" stroke-width="6" stroke-linecap="round"
              :class="overallPct >= 90 ? 'stroke-green-500' : overallPct >= 50 ? 'stroke-amber-500' : 'stroke-red-500'"
              :stroke-dasharray="30 * 2 * Math.PI"
              :stroke-dashoffset="30 * 2 * Math.PI * (1 - overallPct / 100)"
              style="transition: stroke-dashoffset 0.8s ease"
            />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="text-sm font-bold text-gray-900 dark:text-gray-100">{{ overallPct }}%</span>
          </div>
          <!-- Ring tooltip -->
          <div class="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
            <p class="font-medium mb-1">Overall Completion: {{ overallPct }}%</p>
            <p class="text-gray-300 mb-1">Average of all gate completion percentages:</p>
            <ul class="text-gray-400 space-y-0.5">
              <li v-for="gate in director.gate_statuses" :key="gate.gate">{{ gate.gate }}: {{ gate.pct }}%</li>
            </ul>
          </div>
        </div>

        <!-- Version + Updated -->
        <div class="flex-1">
          <div class="flex flex-wrap items-center gap-4 mb-3">
            <div class="flex items-center gap-2">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Release:</label>
              <select
                v-model="selectedVersion"
                @change="handleVersionChange"
                class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select a version...</option>
                <option v-for="v in versions" :key="v" :value="v">{{ v }}</option>
              </select>
            </div>
            <div v-if="data" class="text-xs text-gray-400">
              Updated {{ formatDate(data.generated_at) }}
            </div>
          </div>
          <!-- Release Decision Status Buttons -->
          <div v-if="director && hasInitiativeData" class="flex flex-wrap gap-2">
            <div
              v-for="status in releaseStatuses"
              :key="status.id"
              class="relative group"
            >
              <button
                :class="releaseDecision === status.id
                  ? status.activeClass
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600'"
                class="text-xs px-3 py-1.5 rounded-md border font-semibold transition-all"
              >{{ status.label }}</button>
              <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                <p class="font-medium mb-1">{{ status.label }}</p>
                <p class="text-gray-300">{{ status.tooltip }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
    </div>

    <!-- Empty -->
    <div v-else-if="!director" class="text-center py-12">
      <Shield :size="48" class="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
      <p class="text-gray-500 dark:text-gray-400">Select a release version to view readiness status</p>
    </div>

    <!-- Director View -->
    <div v-else>

      <!-- Section 1: Product Blockers per Component -->
      <div v-if="productBlockers" class="mb-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 overflow-hidden">
          <div class="px-4 py-3 border-b border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-semibold text-red-700 dark:text-red-400">Product Release Blockers</h3>
              <a :href="productBlockers.jql_url" target="_blank" class="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">{{ productBlockers.total_open }} open ↗</a>
            </div>
          </div>
          <div v-if="productBlockers.components.length" class="p-4">
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              <a
                v-for="comp in productBlockers.components.filter(c => c.open > 0)"
                :key="comp.component"
                :href="comp.jql_url"
                target="_blank"
                class="flex items-center justify-between bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-md px-3 py-2 hover:border-red-300 dark:hover:border-red-700 transition-colors"
              >
                <span class="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{{ comp.component }}</span>
                <span class="text-xs font-bold text-red-600 dark:text-red-400 ml-2">{{ comp.open }} ↗</span>
              </a>
            </div>
          </div>
          <div v-else class="px-4 py-3">
            <p class="text-xs text-green-600 dark:text-green-400">No open product release blockers</p>
          </div>
        </div>
      </div>

      <!-- Open Issues to Validate -->
      <div class="mb-6">
        <a
          :href="openIssuesToValidate?.jql_url || '#'"
          target="_blank"
          class="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
        >
          <h3 class="text-sm font-semibold text-blue-700 dark:text-blue-400">Open Issues to Validate</h3>
          <span v-if="openIssuesToValidate" class="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium">{{ openIssuesToValidate.total }} open ↗</span>
          <span v-else class="text-xs text-blue-500 dark:text-blue-400">View in Jira ↗</span>
        </a>
      </div>

      <!-- Initiative not found warning -->
      <div v-if="!hasInitiativeData" class="mb-6">
        <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg px-4 py-3">
          <p class="text-sm font-medium text-amber-800 dark:text-amber-300">Release Test Activity Initiative not yet available in Jira</p>
          <p class="text-xs text-amber-600 dark:text-amber-400 mt-1">Overall Summary, Component Readiness Matrix, and Test Execution Phases will appear once the initiative is created in Jira for this release version.</p>
        </div>
      </div>

      <!-- Section 2: Overall Summary -->
      <div v-if="hasInitiativeData" class="mb-6">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Overall Summary</h3>
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <!-- TFA Sign Offs summary tile -->
          <a
            :href="data.tfa_signoff_jql_url || '#'"
            target="_blank"
            class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 block transition-shadow hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600"
          >
            <div class="flex items-center justify-between mb-2">
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-tight">TFA Sign Offs</p>
              <span :class="ragBadgeClass(testSignOffRag)" class="w-3 h-3 rounded-full inline-block"></span>
            </div>
            <p class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ testSignOffDone }}/{{ testSignOffTotal }}</p>
            <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-2">
              <div :class="ragBarClass(testSignOffRag)" class="h-full transition-all duration-500" :style="{ width: testSignOffPct + '%' }"></div>
            </div>
            <div class="flex items-center justify-between mt-1">
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ testSignOffPct }}% complete</p>
              <span class="text-xs text-blue-500 dark:text-blue-400">View in Jira ↗</span>
            </div>
          </a>
          <a
            v-for="gate in director.gate_statuses"
            :key="gate.gate"
            :href="gate.jql_url || (gate.epic_key ? jiraBrowseUrl(gate.epic_key) : '#')"
            target="_blank"
            class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 block transition-shadow hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600"
          >
            <div class="flex items-center justify-between mb-2">
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-tight">{{ gate.gate }}</p>
              <span :class="ragBadgeClass(gate.rag)" class="w-3 h-3 rounded-full inline-block"></span>
            </div>
            <p class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ gate.done }}/{{ gate.total }}</p>
            <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-2">
              <div :class="ragBarClass(gate.rag)" class="h-full transition-all duration-500" :style="{ width: gate.pct + '%' }"></div>
            </div>
            <div class="flex items-center justify-between mt-1">
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ gate.pct }}% complete</p>
              <span v-if="gate.gate === 'Test Execution'" class="text-xs text-blue-500 dark:text-blue-400">View in Jira ↗</span>
              <span v-else-if="gate.epic_key" class="text-xs text-blue-500 dark:text-blue-400 font-mono">{{ gate.epic_key }}</span>
            </div>
          </a>
        </div>
      </div>

      <!-- Section 3: Component Readiness Matrix -->
      <div v-if="hasInitiativeData && readinessPhases.length" class="mb-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 space-y-3">
            <div class="flex items-center justify-between flex-wrap gap-3">
              <div class="flex items-center gap-3">
                <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Component Readiness Matrix</h3>
                <div class="flex items-center gap-3 ml-4 text-xs text-gray-500 dark:text-gray-400">
                  <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> Open test failures</span>
                  <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span> In progress</span>
                  <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span> All gates complete</span>
                  <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600 inline-block"></span> Not started</span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500 dark:text-gray-400">Phase:</span>
                <div class="flex gap-1">
                  <button
                    v-for="phase in availablePhases"
                    :key="phase"
                    @click="togglePhaseFilter(phase)"
                    :class="selectedPhases.includes(phase)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-blue-400'"
                    class="text-xs px-2.5 py-1 rounded-md border font-medium transition-colors"
                  >{{ phase }}</button>
                </div>
              </div>
            </div>
            <!-- Component filter (color-coded by status) -->
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs text-gray-500 dark:text-gray-400">Components:</span>
              <button
                @click="toggleAllComponents"
                :class="selectedComponents.length === allComponents.length
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-blue-400'"
                class="text-xs px-2 py-0.5 rounded border font-medium transition-colors"
              >All</button>
              <button
                v-for="comp in allComponents"
                :key="comp"
                @click="toggleComponentFilter(comp)"
                :class="[
                  selectedComponents.includes(comp) ? componentStatusClass(comp) : 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-300 dark:border-gray-700 opacity-50',
                  'text-xs px-2 py-0.5 rounded border font-medium transition-colors'
                ]"
              >{{ comp }}</button>
            </div>
          </div>

          <!-- No phase selected message -->
          <div v-if="!selectedPhases.length" class="p-8 text-center">
            <p class="text-sm text-gray-500 dark:text-gray-400">Select the Phases above to view component readiness.</p>
          </div>

          <!-- Per-phase sections -->
          <div v-else class="p-4 space-y-6">
            <div v-for="phase in visiblePhases" :key="phase.phase">
              <div class="flex items-center gap-2 mb-3">
                <span class="text-xs font-bold uppercase tracking-wide text-blue-500">{{ phase.phase }}</span>
                <span class="flex-1 h-px bg-gray-200 dark:bg-gray-700"></span>
                <span class="text-xs text-gray-400">{{ filteredPhaseTiles(phase).length }} components</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div
                  v-for="tile in filteredPhaseTiles(phase)"
                  :key="tile.component"
                  class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 transition-all"
                >
                  <!-- Header -->
                  <div class="flex items-center justify-between mb-3">
                    <h4 class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ tile.component }}</h4>
                    <span :class="ragDotSmall(tileOverallRag(tile))"></span>
                  </div>

                  <!-- Line 1: Test Plan Sign Off + Jira key -->
                  <div class="flex items-center justify-between mb-1.5">
                    <span class="text-xs text-gray-400">Test Plan Sign Off</span>
                    <a v-if="tile.tfa?.key" :href="jiraBrowseUrl(tile.tfa.key)" target="_blank" class="text-xs text-blue-400 font-mono hover:underline">{{ tile.tfa.key }}</a>
                  </div>


                  <!-- Product Sign Off -->
                  <div v-if="tile.product_signoff" class="flex items-center justify-between mb-1.5">
                    <span class="text-xs text-gray-400">Product Sign Off</span>
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs px-1.5 py-0.5 rounded" :class="statusPillClass(tile.product_signoff.status_category)">{{ tile.product_signoff.status }}</span>
                      <a v-if="tile.product_signoff.key" :href="jiraBrowseUrl(tile.product_signoff.key)" target="_blank" class="text-xs text-blue-400 font-mono hover:underline">{{ tile.product_signoff.key }}</a>
                    </div>
                  </div>

                  <!-- Doc Sign Off -->
                  <div v-if="tile.doc_signoff" class="flex items-center justify-between mb-3">
                    <span class="text-xs text-gray-400">Doc Sign Off</span>
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs px-1.5 py-0.5 rounded" :class="statusPillClass(tile.doc_signoff.status_category)">{{ tile.doc_signoff.status }}</span>
                      <a v-if="tile.doc_signoff.key" :href="jiraBrowseUrl(tile.doc_signoff.key)" target="_blank" class="text-xs text-blue-400 font-mono hover:underline">{{ tile.doc_signoff.key }}</a>
                    </div>
                  </div>

                  <!-- Execution progress (only for TestOps) -->
                  <div v-if="tile.component === 'TestOps' && tile.execution" class="mb-2">
                    <div class="flex items-center justify-between mb-1">
                      <a v-if="tile.execution.jql_url" :href="tile.execution.jql_url" target="_blank" class="text-xs text-blue-400 hover:underline">Test Execution ↗</a>
                      <span v-else class="text-xs text-gray-400">Test Execution</span>
                      <span class="text-xs font-bold" :class="tile.execution.done_pct >= 90 ? 'text-green-400' : tile.execution.done_pct >= 50 ? 'text-amber-400' : 'text-gray-400'">{{ tile.execution.done_pct }}%</span>
                    </div>
                    <div class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all duration-500"
                        :class="tile.execution.done_pct >= 90 ? 'bg-green-500' : tile.execution.done_pct >= 50 ? 'bg-amber-500' : 'bg-blue-500'"
                        :style="{ width: tile.execution.done_pct + '%' }"
                      ></div>
                    </div>
                    <p class="text-xs text-gray-500 mt-0.5">{{ tile.execution.done }}/{{ tile.execution.total }} tasks done</p>
                  </div>

                  <!-- TFA / Failed / Skipped as stacked bars -->
                  <div class="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                    <a :href="tile.tfa?.jql_url || '#'" target="_blank" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
                      <span class="text-xs text-gray-400 w-16">TFA ↗</span>
                      <div class="flex-1 h-6 bg-gray-200 dark:bg-gray-800 rounded overflow-hidden flex">
                        <div v-if="tfaBd(tile).done" class="h-full bg-green-500 flex items-center justify-center text-xs font-bold text-white" :style="{ width: tfaBdPct(tile, 'done') + '%', minWidth: '24px' }">{{ tfaBd(tile).done }}</div>
                        <div v-if="tfaBd(tile).in_progress" class="h-full bg-amber-500 flex items-center justify-center text-xs font-bold text-white" :style="{ width: tfaBdPct(tile, 'in_progress') + '%', minWidth: '24px' }">{{ tfaBd(tile).in_progress }}</div>
                        <div v-if="tfaBd(tile).new" class="h-full bg-gray-500 flex items-center justify-center text-xs font-bold text-white" :style="{ width: tfaBdPct(tile, 'new') + '%', minWidth: '24px' }">{{ tfaBd(tile).new }}</div>
                      </div>
                    </a>
                    <a :href="tile.failed_jql_url || '#'" target="_blank" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
                      <span class="text-xs text-gray-400 w-16">Failed ↗</span>
                      <div class="flex-1 h-6 bg-gray-200 dark:bg-gray-800 rounded overflow-hidden flex">
                        <template v-if="failedBd(tile).total > 0">
                          <div v-if="failedBd(tile).done" class="h-full bg-green-500 flex items-center justify-center text-xs font-bold text-white" :style="{ width: bdPct(failedBd(tile), 'done') + '%', minWidth: '24px' }">{{ failedBd(tile).done }}</div>
                          <div v-if="failedBd(tile).in_progress" class="h-full bg-red-400 flex items-center justify-center text-xs font-bold text-white" :style="{ width: bdPct(failedBd(tile), 'in_progress') + '%', minWidth: '24px' }">{{ failedBd(tile).in_progress }}</div>
                          <div v-if="failedBd(tile).new" class="h-full bg-red-600 flex items-center justify-center text-xs font-bold text-white" :style="{ width: bdPct(failedBd(tile), 'new') + '%', minWidth: '24px' }">{{ failedBd(tile).new }}</div>
                        </template>
                        <div v-else class="h-full bg-gray-500 flex items-center justify-center text-xs font-bold text-white" style="width:100%">0</div>
                      </div>
                    </a>
                    <a v-if="tile.skipped_enabled !== false" :href="tile.skipped_jql_url || '#'" target="_blank" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
                      <span class="text-xs text-gray-400 w-16">Skipped ↗</span>
                      <div class="flex-1 h-6 bg-gray-200 dark:bg-gray-800 rounded overflow-hidden flex">
                        <template v-if="skippedBd(tile).total > 0">
                          <div v-if="skippedBd(tile).done" class="h-full bg-green-500 flex items-center justify-center text-xs font-bold text-white" :style="{ width: bdPct(skippedBd(tile), 'done') + '%', minWidth: '24px' }">{{ skippedBd(tile).done }}</div>
                          <div v-if="skippedBd(tile).in_progress" class="h-full bg-amber-400 flex items-center justify-center text-xs font-bold text-white" :style="{ width: bdPct(skippedBd(tile), 'in_progress') + '%', minWidth: '24px' }">{{ skippedBd(tile).in_progress }}</div>
                          <div v-if="skippedBd(tile).new" class="h-full bg-amber-600 flex items-center justify-center text-xs font-bold text-white" :style="{ width: bdPct(skippedBd(tile), 'new') + '%', minWidth: '24px' }">{{ skippedBd(tile).new }}</div>
                        </template>
                        <div v-else class="h-full bg-gray-500 flex items-center justify-center text-xs font-bold text-white" style="width:100%">0</div>
                      </div>
                    </a>
                    <div v-else class="flex items-center gap-2">
                      <span class="text-xs text-gray-400 w-16">Skipped</span>
                      <span class="text-xs text-gray-400 dark:text-gray-500 italic">{{ tile.skipped_label || 'Not yet enabled' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 4: Test Execution Phases (Accordion) -->
      <div v-if="hasInitiativeData" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Test Execution Phases</h3>
          <div class="flex items-center gap-2">
            <div class="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div class="h-full bg-blue-500 transition-all duration-500" :style="{ width: testExecPct + '%' }"></div>
            </div>
            <span class="text-xs font-bold text-gray-600 dark:text-gray-400">{{ testExecDone }}/{{ testExecTotal }}</span>
            <span class="text-xs text-gray-400">({{ testExecPct }}% → 100%)</span>
          </div>
        </div>
        <div class="divide-y divide-gray-100 dark:divide-gray-700">
          <div v-for="phase in director.test_timeline" :key="phase.epic_key">
            <button
              @click="togglePhase(phase.epic_key)"
              class="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            >
              <div class="flex items-center gap-3">
                <span :class="expandedPhases[phase.epic_key] ? 'rotate-90' : ''" class="transition-transform text-gray-400 text-xs">&#9654;</span>
                <span :class="phaseIconClass(phase.rag)" class="text-sm">{{ phaseIcon(phase.rag) }}</span>
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ phase.name }}</span>
              </div>
              <div class="flex items-center gap-3">
                <div class="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div :class="phaseBarColor(phase.rag)" class="h-full transition-all duration-500" :style="{ width: phasePct(phase) + '%' }"></div>
                </div>
                <span class="text-xs font-medium text-gray-600 dark:text-gray-400 w-12 text-right">{{ phase.done }}/{{ phase.total }}</span>
                <span :class="ragBadgeClass(phase.rag)" class="text-xs px-1.5 py-0.5 rounded font-medium text-white">
                  {{ phase.rag === 'GREEN' ? 'Done' : phase.rag === 'AMBER' ? 'Active' : 'Pending' }}
                </span>
              </div>
            </button>
            <div v-if="expandedPhases[phase.epic_key] && phaseTasksMap[phase.epic_key]" class="bg-gray-50 dark:bg-gray-900 px-4 pb-3">
              <div class="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                <a
                  v-for="task in phaseTasksMap[phase.epic_key]"
                  :key="task.key"
                  :href="jiraBrowseUrl(task.key)"
                  target="_blank"
                  class="flex items-center justify-between px-3 py-2 hover:bg-white dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                >
                  <div class="flex items-center gap-2 min-w-0 flex-1">
                    <span :class="ragDotSmall(componentRagFromCategory(task.status_category))" class="flex-shrink-0"></span>
                    <span class="text-xs text-gray-600 dark:text-gray-400">{{ task.summary }}</span>
                  </div>
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <span class="text-xs px-1.5 py-0.5 rounded" :class="statusPillClass(task.status_category)">{{ task.status }}</span>
                    <span class="text-xs text-blue-500 dark:text-blue-400 font-mono">{{ task.key }}</span>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>


    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, inject, onMounted } from 'vue'
import { ArrowLeft, Shield } from 'lucide-vue-next'
import { useReleaseReadiness } from './composables/useReleaseReadiness'

const moduleNav = inject('moduleNav')
const {
  data,
  loading,
  error,
  versions,
  defaultVersion,
  loadMetrics,
  loadVersions
} = useReleaseReadiness()

const selectedVersion = ref('')
const JIRA_HOST = 'https://redhat.atlassian.net'
const expandedPhases = reactive({})

onMounted(async () => {
  await loadVersions()
  if (versions.value.length > 0) {
    const initial = defaultVersion.value || versions.value[0]
    selectedVersion.value = initial
    await loadMetrics(initial)
    if (data.value && data.value.component_readiness) {
      selectedComponents.value = [...(data.value.component_readiness.all_components || [])]
    }
  }
})

function goBack() {
  if (moduleNav && moduleNav.navigateTo) moduleNav.navigateTo('reports')
}

async function handleVersionChange() {
  if (selectedVersion.value) {
    await loadMetrics(selectedVersion.value)
    if (data.value && data.value.component_readiness) {
      selectedComponents.value = [...(data.value.component_readiness.all_components || [])]
      selectedPhases.value = []
    }
  }
}

function jiraBrowseUrl(key) {
  return `${JIRA_HOST}/browse/${key}`
}

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleString() : ''
}

function formatScheduleDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function togglePhase(epicKey) {
  expandedPhases[epicKey] = !expandedPhases[epicKey]
}

// --- Data Computed ---

const director = computed(() => {
  return data.value && data.value.director_summary ? data.value.director_summary : null
})

const overallPct = computed(() => {
  if (!director.value || !director.value.gate_statuses) return 0
  const gates = director.value.gate_statuses
  if (!gates.length) return 0
  return Math.round(gates.reduce((s, g) => s + g.pct, 0) / gates.length)
})

const releaseSchedule = computed(() => {
  if (!data.value || !data.value.release_schedule) return null
  return data.value.release_schedule
})

const openIssuesToValidate = computed(() => {
  if (!data.value || !data.value.open_issues_to_validate) return null
  return data.value.open_issues_to_validate
})

const productBlockers = computed(() => {
  if (!data.value || !data.value.product_blockers) return null
  const raw = data.value.product_blockers

  const openComponents = (raw.components || [])
    .filter(c => {
      const openIssues = (c.issues || []).filter(i => i.status_category !== 'Done')
      return openIssues.length > 0
    })
    .map(c => {
      const openIssues = (c.issues || []).filter(i => i.status_category !== 'Done')
      return { ...c, open: openIssues.length, issues: openIssues }
    })

  const totalOpen = openComponents.reduce((sum, c) => sum + c.open, 0)

  let jqlUrl = raw.jql_url || ''
  if (jqlUrl && !jqlUrl.includes('statusCategory')) {
    const separator = jqlUrl.includes('?jql=') ? '%20AND%20' : ' AND '
    jqlUrl += separator + 'statusCategory%20!%3D%20Done'
  }

  return { ...raw, components: openComponents, total_open: totalOpen, jql_url: jqlUrl }
})

const testSignOffDone = computed(() => {
  if (!data.value) return 0
  return data.value.tfa_signoff_done ?? 0
})

const testSignOffTotal = computed(() => {
  if (!data.value) return 0
  return data.value.tfa_signoff_total ?? 0
})

const testSignOffPct = computed(() => {
  return testSignOffTotal.value > 0 ? Math.round((testSignOffDone.value / testSignOffTotal.value) * 100) : 0
})

const testSignOffRag = computed(() => {
  if (testSignOffPct.value >= 90) return 'GREEN'
  if (testSignOffPct.value >= 50) return 'AMBER'
  return 'RED'
})

// --- Phase filter ---

const availablePhases = computed(() => {
  if (!data.value || !data.value.component_readiness) return []
  return data.value.component_readiness.phases.map(p => p.phase)
})

const selectedPhases = ref([])

function togglePhaseFilter(phase) {
  const idx = selectedPhases.value.indexOf(phase)
  if (idx >= 0) {
    selectedPhases.value.splice(idx, 1)
  } else {
    selectedPhases.value.push(phase)
  }
}

const readinessPhases = computed(() => {
  if (!data.value || !data.value.component_readiness) return []
  return data.value.component_readiness.phases
})

const visiblePhases = computed(() => {
  if (!readinessPhases.value.length || !selectedPhases.value.length) return []
  return readinessPhases.value.filter(p => selectedPhases.value.includes(p.phase))
})

// --- TFA progress helpers ---

function tfaBd(tile) {
  return tile.tfa_breakdown || { new: 0, in_progress: 0, done: 0, total: 0 }
}

function tfaBdPct(tile, key) {
  const bd = tfaBd(tile)
  const total = bd.total || 1
  return Math.round((bd[key] / total) * 100)
}

function failedBd(tile) {
  return tile.failed_breakdown || { new: 0, in_progress: 0, done: 0, total: 0 }
}

function skippedBd(tile) {
  return tile.skipped_breakdown || { new: 0, in_progress: 0, done: 0, total: 0 }
}

function bdPct(bd, key) {
  const total = bd.total || 1
  return Math.round((bd[key] / total) * 100)
}

// --- Test Execution Phases ---

const phaseTasksMap = computed(() => {
  if (!data.value || !data.value.breakdowns) return {}
  const map = {}
  for (const bd of Object.values(data.value.breakdowns)) {
    const te = bd?.test_execution
    if (!te || !te.phases) continue
    for (const phase of te.phases) {
      if (!map[phase.epic_key]) {
        map[phase.epic_key] = phase.tasks || []
      }
    }
  }
  return map
})

const testExecDone = computed(() => {
  if (!director.value || !director.value.test_timeline) return 0
  return director.value.test_timeline.reduce((sum, p) => sum + p.done, 0)
})

const testExecTotal = computed(() => {
  if (!director.value || !director.value.test_timeline) return 0
  return director.value.test_timeline.reduce((sum, p) => sum + p.total, 0)
})

const testExecPct = computed(() => {
  return testExecTotal.value > 0 ? Math.round((testExecDone.value / testExecTotal.value) * 100) : 0
})

// --- Release Decision Status ---

const releaseStatuses = [
  { id: 'not-ready', label: 'Not Ready', activeClass: 'bg-red-600 text-white border-red-600', tooltip: 'Multiple gates below 50%. Open blockers present. Not all sign-offs complete.' },
  { id: 'in-progress', label: 'In Progress', activeClass: 'bg-blue-600 text-white border-blue-600', tooltip: 'Testing started but gates are below 80% completion. Work is actively progressing.' },
  { id: 'at-risk', label: 'At Risk', activeClass: 'bg-amber-500 text-white border-amber-500', tooltip: 'Some gates above 50% but open blockers or sign-offs pending. Timeline may slip.' },
  { id: 'on-track', label: 'On Track', activeClass: 'bg-emerald-500 text-white border-emerald-500', tooltip: 'All gates above 80%. No critical blockers. Sign-offs progressing on schedule.' },
  { id: 'ready-to-ship', label: 'Ready to Ship', activeClass: 'bg-green-600 text-white border-green-600', tooltip: 'All gates at 100%. All sign-offs done. Zero open blockers. Go for release.' },
]

const hasInitiativeData = computed(() => {
  if (!director.value) return false
  return director.value.gate_statuses && director.value.gate_statuses.length > 0
})

const releaseDecision = computed(() => {
  if (!director.value) return 'not-ready'
  const gates = director.value.gate_statuses || []
  const avgPct = gates.length ? gates.reduce((s, g) => s + g.pct, 0) / gates.length : 0
  const openBlockers = productBlockers.value?.total_open || 0
  const allGatesAbove80 = gates.every(g => g.pct >= 80)
  const allGates100 = gates.every(g => g.pct >= 100)

  if (allGates100 && openBlockers === 0) return 'ready-to-ship'
  if (allGatesAbove80 && openBlockers <= 2) return 'on-track'
  if (avgPct >= 50 && openBlockers > 0) return 'at-risk'
  if (avgPct > 0) return 'in-progress'
  return 'not-ready'
})

// --- Component Filter ---

const allComponents = computed(() => {
  if (!data.value || !data.value.component_readiness) return []
  return data.value.component_readiness.all_components || []
})

const selectedComponents = ref([])

function toggleComponentFilter(comp) {
  const idx = selectedComponents.value.indexOf(comp)
  if (idx >= 0) {
    selectedComponents.value.splice(idx, 1)
  } else {
    selectedComponents.value.push(comp)
  }
}

function toggleAllComponents() {
  if (selectedComponents.value.length === allComponents.value.length) {
    selectedComponents.value = []
  } else {
    selectedComponents.value = [...allComponents.value]
  }
}

function filteredPhaseTiles(phase) {
  if (!selectedComponents.value.length || selectedComponents.value.length === allComponents.value.length) {
    return phase.tiles
  }
  return phase.tiles.filter(t => selectedComponents.value.includes(t.component))
}

function componentStatusClass(comp) {
  if (!data.value || !data.value.component_readiness) return 'bg-gray-600 text-white border-gray-600'
  const phases = data.value.component_readiness.phases
  let failedOpen = 0
  let tfaOpen = 0
  let tfaTotal = 0
  let allProductDone = true
  for (const p of phases) {
    const tile = p.tiles.find(t => t.component === comp)
    if (!tile) continue
    failedOpen += (tile.failed_breakdown?.new || 0) + (tile.failed_breakdown?.in_progress || 0)
    if (tile.tfa_breakdown) {
      tfaOpen += tile.tfa_breakdown.new + tile.tfa_breakdown.in_progress
      tfaTotal += tile.tfa_breakdown.total
    }
    if (tile.product_signoff?.status_category !== 'Done') allProductDone = false
  }
  if (failedOpen > 0) return 'bg-red-600 text-white border-red-600'
  if (tfaOpen === 0 && tfaTotal > 0 && allProductDone) return 'bg-green-600 text-white border-green-600'
  if (tfaOpen < tfaTotal && tfaTotal > 0) return 'bg-amber-500 text-white border-amber-500'
  return 'bg-gray-600 text-white border-gray-600'
}

// --- Styling helpers ---

function componentRagFromCategory(cat) {
  if (cat === 'Done') return 'GREEN'
  if (cat === 'In Progress') return 'AMBER'
  return 'GRAY'
}

function tileOverallRag(tile) {
  const tfaOpen = tile.tfa_open_count !== undefined ? tile.tfa_open_count : (tile.tfa?.status_category === 'Done' ? 0 : 1)
  const failedOpen = (tile.failed_breakdown?.new || 0) + (tile.failed_breakdown?.in_progress || 0)
  const execPct = tile.execution?.done_pct || 0
  if (failedOpen > 0) return 'RED'
  if (tfaOpen === 0 && tile.product_signoff?.status_category === 'Done' && execPct >= 90) return 'GREEN'
  if (tfaOpen === 0 && tile.product_signoff?.status_category === 'Done') return 'AMBER'
  if (execPct > 0 || tile.tfa?.status_category === 'In Progress') return 'AMBER'
  return 'GRAY'
}

function ragDotSmall(rag) {
  const base = 'inline-block w-3 h-3 rounded-full'
  if (rag === 'GREEN') return `${base} bg-green-500`
  if (rag === 'AMBER') return `${base} bg-amber-500`
  if (rag === 'RED') return `${base} bg-red-500`
  return `${base} bg-gray-300 dark:bg-gray-600`
}

function ragBadgeClass(rag) {
  if (rag === 'GREEN') return 'bg-green-500'
  if (rag === 'AMBER') return 'bg-amber-500'
  if (rag === 'RED') return 'bg-red-500'
  return 'bg-gray-400'
}

function ragBarClass(rag) {
  if (rag === 'GREEN') return 'bg-green-500'
  if (rag === 'AMBER') return 'bg-amber-500'
  if (rag === 'RED') return 'bg-red-500'
  return 'bg-gray-400'
}

function statusPillClass(category) {
  if (category === 'Done') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
  if (['In Progress', 'In Review', 'Testing', 'Review'].includes(category)) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
  return 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
}

function phaseIcon(rag) {
  if (rag === 'GREEN') return '✓'
  if (rag === 'AMBER') return '●'
  return '○'
}

function phaseIconClass(rag) {
  if (rag === 'GREEN') return 'text-green-500'
  if (rag === 'AMBER') return 'text-blue-500'
  return 'text-gray-400'
}

function phaseBarColor(rag) {
  if (rag === 'GREEN') return 'bg-green-500'
  if (rag === 'AMBER') return 'bg-blue-500'
  return 'bg-gray-300 dark:bg-gray-600'
}

function phasePct(phase) {
  return phase.total > 0 ? Math.round((phase.done / phase.total) * 100) : 0
}
</script>
