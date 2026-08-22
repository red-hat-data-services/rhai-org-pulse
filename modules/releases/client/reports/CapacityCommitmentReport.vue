<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Program Level Release Report</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Key deadlines and capacity overview for a selected release</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
      Loading releases...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-12">
      <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
    </div>

    <template v-else>
      <!-- Selection & filter bar -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-6 px-5 py-4">
        <template v-if="hasSelection">
          <div class="flex items-start justify-between gap-4">
            <div class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              Showing data for
              <span class="font-semibold text-gray-900 dark:text-gray-100">{{ familyNarrative }}</span>,
              <span class="font-semibold text-gray-900 dark:text-gray-100">version {{ selection.version }}</span>,
              covering the
              <span class="font-semibold text-gray-900 dark:text-gray-100">{{ phaseNarrative }}</span>
              {{ selection.phases.size === 1 ? 'phase' : 'phases' }}
              of the release lifecycle.
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                @click="openModal"
                class="px-3 py-1.5 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors"
              >Select Release</button>
            </div>
          </div>

          <!-- Filter line -->
          <div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50">
            <ReportFilterNarrative
              :filters="filters"
              no-filter-text="Showing all features and initiatives."
              filter-prefix="Showing features filtered by"
            />
          </div>
        </template>
        <template v-else>
          <div class="text-center py-6">
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Select a release version and product family to view key milestone deadlines across the release lifecycle.
            </p>
            <button
              @click="openModal"
              class="px-4 py-2 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors"
            >Select Release</button>
          </div>
        </template>
      </div>

      <!-- Key Milestones -->
      <div v-if="hasSelection">
        <button
          @click="milestonesOpen = !milestonesOpen"
          class="flex items-center gap-2 mb-3 group"
        >
          <svg
            class="w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200"
            :class="milestonesOpen ? 'rotate-90' : ''"
            fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">Key Milestones</h3>
        </button>
      </div>
      <div v-if="hasSelection && milestonesOpen" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div
          v-for="card in deadlineCards"
          :key="card.phase"
          class="bg-white dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm"
        >
          <div class="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 flex items-center gap-2">
            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">{{ selection.version }}</span>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ card.phaseLabel }} Key Deadlines</h3>
          </div>

          <div v-if="!card.hasData" class="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
            No milestone dates configured for this phase.
          </div>

          <!-- Single family layout -->
          <table v-else-if="card.isSingleFamily" class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100 dark:border-gray-800">
                <th class="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Milestone</th>
                <th class="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                <th class="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Days Away</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in card.rows"
                :key="row.key"
                class="border-b border-gray-100 dark:border-gray-800 last:border-0"
                :class="row.isNext ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''"
              >
                <td class="px-4 py-2.5">
                  <div class="flex items-center gap-2">
                    <span v-if="row.isPast" class="text-gray-400 dark:text-gray-500">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </span>
                    <span v-if="row.isNext" class="w-1 h-5 rounded-full bg-primary-500 shrink-0"></span>
                    <span :class="row.isPast ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100 font-medium'">
                      {{ row.label }}
                    </span>
                  </div>
                </td>
                <td class="px-4 py-2.5 tabular-nums" :class="row.isPast ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'">
                  {{ row.dateFormatted }}
                </td>
                <td class="px-4 py-2.5 tabular-nums" :class="row.daysClass">
                  {{ row.daysLabel }}
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Multi family layout -->
          <table v-else class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100 dark:border-gray-800">
                <th class="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Milestone</th>
                <th
                  v-for="f in card.families"
                  :key="f"
                  class="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >{{ f.toUpperCase() }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in card.rows"
                :key="row.key"
                class="border-b border-gray-100 dark:border-gray-800 last:border-0"
              >
                <td class="px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium">
                  {{ row.label }}
                </td>
                <td
                  v-for="f in card.families"
                  :key="f"
                  class="px-4 py-2.5"
                >
                  <template v-if="row.cells[f].dateFormatted !== '—'">
                    <div class="tabular-nums" :class="row.cells[f].isPast ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'">
                      {{ row.cells[f].dateFormatted }}
                    </div>
                    <div class="text-[11px] tabular-nums" :class="row.cells[f].daysClass">
                      {{ row.cells[f].daysLabel }}
                    </div>
                  </template>
                  <span v-else class="text-gray-300 dark:text-gray-600">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Feature Status Charts -->
      <div v-if="hasSelection" class="mt-6">
        <button
          @click="chartsOpen = !chartsOpen"
          class="flex items-center gap-2 mb-3 group"
        >
          <svg
            class="w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200"
            :class="chartsOpen ? 'rotate-90' : ''"
            fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">Feature Status Charts</h3>
        </button>

        <template v-if="chartsOpen">
        <!-- Tab bar -->
        <div class="border-b border-gray-200 dark:border-gray-700 mb-4">
          <nav class="flex gap-6 -mb-px">
            <button
              v-for="tab in analysisTabs"
              :key="tab.id"
              @click="activeAnalysisTab = tab.id"
              class="pb-2.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2"
              :class="activeAnalysisTab === tab.id
                ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
            >{{ tab.label }}</button>
          </nav>
        </div>

        <!-- Tab: Features & Initiatives by Status -->
        <div v-if="activeAnalysisTab === 'status-charts'" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div v-if="featuresLoading" class="col-span-full text-center py-12 text-sm text-gray-400 dark:text-gray-500">
            Loading features...
          </div>

          <template v-else>
            <div
              v-for="card in featureStatusCards"
              :key="card.phase"
              class="inline-block bg-white dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
            >
              <div class="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 flex items-center gap-2">
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">{{ selection.version }}</span>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ card.phase }} Feature &amp; Initiative Status</h3>
              </div>

              <div v-if="card.total === 0" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                No features found for this phase.
              </div>

              <div v-else class="p-5">
                <div class="inline-flex items-center gap-8">
                  <!-- Doughnut with center total -->
                  <div class="relative w-36 h-36 flex-shrink-0">
                    <Doughnut :data="card.chartData" :options="makeDoughnutOptions(card)" />
                    <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span class="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none">{{ card.total }}</span>
                      <span class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">features</span>
                    </div>
                  </div>
                  <!-- Legend -->
                  <div class="flex-1 space-y-1.5">
                    <button
                      v-for="item in card.distribution"
                      :key="item.status"
                      @click="openFeatureList(item.status, card.phase)"
                      class="w-full flex items-center gap-2 text-sm rounded-md px-2 py-1 -mx-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer text-left"
                    >
                      <span
                        class="w-3 h-3 rounded-full flex-shrink-0"
                        :style="{ backgroundColor: STATUS_COLORS[item.status] || '#d1d5db' }"
                      ></span>
                      <span class="text-gray-700 dark:text-gray-300">{{ item.status }}</span>
                      <span class="ml-auto whitespace-nowrap font-semibold tabular-nums text-gray-900 dark:text-gray-100">{{ item.count }} <span class="font-normal text-gray-400 dark:text-gray-500">({{ Math.round(item.count / card.total * 100) }}%)</span></span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Tab: Features & Initiatives by Color Status -->
        <div v-if="activeAnalysisTab === 'color-status'" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div v-if="featuresLoading" class="col-span-full text-center py-12 text-sm text-gray-400 dark:text-gray-500">
            Loading features...
          </div>

          <template v-else>
            <div
              v-for="card in colorStatusCards"
              :key="card.phase"
              class="inline-block bg-white dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
            >
              <div class="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 flex items-center gap-2">
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">{{ selection.version }}</span>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ card.phase }} Color Status</h3>
              </div>

              <div v-if="card.total === 0" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                No features found for this phase.
              </div>

              <div v-else class="p-5">
                <div class="inline-flex items-center gap-8">
                  <!-- Doughnut with center total -->
                  <div class="relative w-36 h-36 flex-shrink-0">
                    <Doughnut :data="card.chartData" :options="makeDoughnutOptions(card, 'colorStatus')" />
                    <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span class="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none">{{ card.total }}</span>
                      <span class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">features</span>
                    </div>
                  </div>
                  <!-- Legend -->
                  <div class="flex-1 space-y-1.5">
                    <button
                      v-for="item in card.distribution"
                      :key="item.status"
                      @click="openFeatureList(item.status, card.phase, 'colorStatus')"
                      class="w-full flex items-center gap-2 text-sm rounded-md px-2 py-1 -mx-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer text-left"
                    >
                      <span
                        class="w-3 h-3 rounded-full flex-shrink-0"
                        :style="{ backgroundColor: COLOR_STATUS_COLORS[item.status] || '#d1d5db' }"
                      ></span>
                      <span class="text-gray-700 dark:text-gray-300">{{ item.status }}</span>
                      <span class="ml-auto whitespace-nowrap font-semibold tabular-nums text-gray-900 dark:text-gray-100">{{ item.count }} <span class="font-normal text-gray-400 dark:text-gray-500">({{ Math.round(item.count / card.total * 100) }}%)</span></span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
        </template>
      </div>

      <!-- Risk Assessment section -->
      <div v-if="hasSelection" class="mt-8">
        <div class="flex items-start justify-between gap-4 mb-3">
          <button
            @click="riskOpen = !riskOpen"
            class="flex items-center gap-2 group"
          >
            <svg
              class="w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200"
              :class="riskOpen ? 'rotate-90' : ''"
              fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">Risk Assessment</h3>
          </button>
          <button
            v-if="riskOpen"
            @click="riskInfoOpen = !riskInfoOpen"
            class="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors"
            :class="riskInfoOpen
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
            :aria-expanded="riskInfoOpen"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            How to read this
          </button>
        </div>

        <template v-if="riskOpen">
        <!-- Risk interpretation guide -->
        <div v-if="riskInfoOpen" class="mb-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-500/20 rounded-lg px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
          <div class="flex items-start justify-between gap-3 mb-3">
            <h4 class="font-semibold text-gray-900 dark:text-gray-100">How to interpret risk data</h4>
            <button @click="riskInfoOpen = false" class="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded" aria-label="Close">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="space-y-3">
            <div>
              <span class="font-medium text-gray-900 dark:text-gray-100">Risk levels</span>
              <div class="mt-1 space-y-1">
                <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0"></span><span><span class="font-medium">Red</span> — feature has high-severity flags (blocked, significantly behind schedule, or well below expected velocity).</span></div>
                <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-yellow-500 shrink-0"></span><span><span class="font-medium">Yellow</span> — feature has medium-severity flags (moderately below expected velocity for the current milestone).</span></div>
                <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0"></span><span><span class="font-medium">Green</span> — no risk flags detected. Feature is progressing as expected.</span></div>
              </div>
            </div>
            <div>
              <span class="font-medium text-gray-900 dark:text-gray-100">Flag categories</span>
              <div class="mt-1 space-y-1">
                <div><span class="font-medium">Behind Schedule</span> — feature is still in an early status (New, Refinement) after a code freeze milestone has passed.</div>
                <div><span class="font-medium">Velocity Risk</span> — feature completion percentage is below what's expected for the current point in the release cycle.</div>
                <div><span class="font-medium">Blocked</span> — feature has unresolved blocking dependencies that must be cleared before it can proceed.</div>
                <div><span class="font-medium">Planning Incomplete</span> — feature has unresolved planning hard blockers (missing components, PM, release type, epics, or RFE).</div>
              </div>
            </div>
            <p class="text-gray-500 dark:text-gray-400 text-xs">Risk levels are computed automatically by the health pipeline based on milestone dates, feature progress, and dependency data from Jira. They refresh periodically via the scheduled sync. Detailed per-feature risk data is available on the <a href="#" @click.prevent="nav.navigateTo('execute', { tab: 'feature-list' })" class="text-primary-600 dark:text-primary-400 hover:underline">Feature List</a>.</p>
          </div>
        </div>

        <!-- Loading state -->
        <div v-if="healthLoading" class="text-center py-12 text-sm text-gray-400 dark:text-gray-500">
          Loading risk data...
        </div>

        <!-- No data state -->
        <div v-else-if="!healthData" class="text-center py-12 text-sm text-gray-400 dark:text-gray-500">
          No health data available for this release.
        </div>

        <template v-else>
          <!-- Risk tab bar -->
          <div class="border-b border-gray-200 dark:border-gray-700 mb-4">
            <nav class="flex gap-6 -mb-px">
              <button
                v-for="tab in riskTabs"
                :key="tab.id"
                @click="activeRiskTab = tab.id"
                class="pb-2.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2"
                :class="activeRiskTab === tab.id
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
              >{{ tab.label }}</button>
            </nav>
          </div>

          <!-- Tab: Risk Overview -->
          <div v-if="activeRiskTab === 'risk-overview'" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div
              v-for="card in riskCards"
              :key="card.phase"
              class="inline-block bg-white dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
            >
              <div class="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 flex items-center gap-2">
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">{{ selection.version }}</span>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ card.phase }} Risk Assessment</h3>
              </div>

              <div v-if="card.total === 0" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                No features found for this phase.
              </div>

              <div v-else class="p-5">
                <div class="inline-flex items-center gap-8">
                  <!-- Doughnut with center total -->
                  <div class="relative w-36 h-36 flex-shrink-0">
                    <Doughnut :data="card.chartData" :options="makeRiskDoughnutOptions(card)" />
                    <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span class="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none">{{ card.total }}</span>
                      <span class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">features</span>
                    </div>
                  </div>
                  <!-- Legend -->
                  <div class="flex-1 space-y-1.5">
                    <button
                      v-for="item in card.distribution"
                      :key="item.status"
                      @click="openFeatureList(item.status, card.phase, 'riskLevel')"
                      class="w-full flex items-center gap-2 text-sm rounded-md px-2 py-1 -mx-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer text-left"
                    >
                      <span
                        class="w-3 h-3 rounded-full flex-shrink-0"
                        :style="{ backgroundColor: RISK_COLORS[item.status] || '#d1d5db' }"
                      ></span>
                      <span class="text-gray-700 dark:text-gray-300">{{ item.status }}</span>
                      <span class="ml-auto whitespace-nowrap font-semibold tabular-nums text-gray-900 dark:text-gray-100">{{ item.count }} <span class="font-normal text-gray-400 dark:text-gray-500">({{ Math.round(item.count / card.total * 100) }}%)</span></span>
                    </button>
                  </div>
                </div>

                <!-- Flag category breakdown -->
                <div v-if="card.flagCounts.length > 0" class="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-for="flag in card.flagCounts"
                      :key="flag.category"
                      class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                      :class="flag.severity === 'high'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'"
                    >
                      {{ FLAG_LABELS[flag.category] || flag.category }}
                      <span class="font-semibold">{{ flag.count }}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Tab: At-Risk Features -->
          <div v-if="activeRiskTab === 'at-risk-features'">
            <div v-if="atRiskFeatures.length === 0" class="bg-white dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
              No features are currently flagged as at-risk.
            </div>
            <template v-else>
              <!-- Search + column config -->
              <div class="mb-3 flex items-center gap-2">
                <input
                  v-model="riskSearchQuery"
                  type="text"
                  placeholder="Search by key, summary, or owner..."
                  class="w-full max-w-sm px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
                <div class="relative ml-auto">
                  <button
                    @click.stop="riskColumnSettingsOpen = !riskColumnSettingsOpen"
                    class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    title="Configure columns"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                    </svg>
                  </button>
                  <div
                    v-if="riskColumnSettingsOpen"
                    class="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg z-10"
                    @click.stop
                  >
                    <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                      <span class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Columns</span>
                      <button
                        @click="resetRiskColumns"
                        class="text-[11px] text-primary-600 dark:text-primary-400 hover:underline"
                      >Reset</button>
                    </div>
                    <div class="py-1">
                      <div
                        v-for="(colKey, idx) in riskColumnOrder"
                        :key="colKey"
                        draggable="true"
                        @dragstart="onRiskColDragStart($event, idx)"
                        @dragover.prevent="onRiskColDragOver($event, idx)"
                        @drop="onRiskColDrop(idx)"
                        @dragend="riskColDragIdx = -1"
                        class="flex items-center gap-2 px-3 py-1.5 text-sm cursor-grab active:cursor-grabbing select-none"
                        :class="riskColDragOverIdx === idx ? 'border-t-2 border-primary-500' : ''"
                      >
                        <span class="text-gray-400 dark:text-gray-500 text-xs shrink-0">&#x2807;</span>
                        <label class="flex items-center gap-2 flex-1 cursor-pointer">
                          <input
                            type="checkbox"
                            :checked="riskActiveColumnKeys.has(colKey)"
                            :disabled="colKey === 'key'"
                            @change="toggleRiskColumn(colKey)"
                            class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                          />
                          <span class="text-gray-700 dark:text-gray-300" :class="colKey === 'key' ? 'opacity-50' : ''">{{ RISK_AVAILABLE_COLUMNS.find(c => c.key === colKey).label }}</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="filteredAtRiskFeatures.length === 0" class="bg-white dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                No features match your search.
              </div>
              <div v-else class="bg-white dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div class="overflow-x-auto">
                <table class="text-sm w-full" style="table-layout:fixed">
                  <colgroup>
                    <col v-for="col in riskVisibleColumns" :key="col.key" :style="{ width: riskColStyle(col.key) }" />
                  </colgroup>
                  <thead class="sticky top-0 bg-gray-50 dark:bg-gray-800/90">
                    <tr class="border-b border-gray-200 dark:border-gray-700">
                      <th
                        v-for="col in riskVisibleColumns"
                        :key="col.key"
                        class="relative px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                      >{{ col.label }}<span
                          class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-gray-300 dark:bg-gray-600 hover:bg-primary-400 dark:hover:bg-primary-500 transition-colors"
                          @mousedown.prevent="startRiskColResize($event, col.key)"
                        ></span></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="f in filteredAtRiskFeatures"
                      :key="f.key"
                      class="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                    >
                      <td
                        v-for="col in riskVisibleColumns"
                        :key="col.key"
                        class="px-4 py-2.5 truncate"
                        :class="col.key === 'summary' ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'"
                      >
                        <span v-if="col.key === 'key'" class="inline-flex items-center gap-1.5">
                          <a
                            href="#"
                            class="text-primary-600 hover:text-primary-700 dark:text-primary-400 cursor-pointer font-medium"
                            @click.prevent="navigateToFeature(f.key)"
                          >{{ f.key }}</a>
                          <a
                            :href="'https://redhat.atlassian.net/browse/' + f.key"
                            target="_blank"
                            rel="noopener"
                            class="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 shrink-0"
                            title="Open in Jira"
                            @click.stop
                          >
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                          </a>
                        </span>
                        <span v-else-if="col.key === 'summary'">{{ f.summary || '—' }}</span>
                        <span v-else-if="col.key === 'riskLevel'" class="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <span
                            class="w-2 h-2 rounded-full inline-block"
                            :style="{ backgroundColor: RISK_COLORS[f.riskLevel] || '#d1d5db' }"
                          ></span>
                          <span class="text-gray-700 dark:text-gray-300">{{ f.riskLevel }}</span>
                        </span>
                        <span v-else-if="col.key === 'phase'" class="whitespace-nowrap">{{ f.phase }}</span>
                        <span v-else-if="col.key === 'flagCategories'">
                          <span class="flex flex-wrap gap-1">
                            <span
                              v-for="cat in f.flagCategories"
                              :key="cat"
                              class="px-1.5 py-0.5 rounded text-[10px] font-medium"
                              :class="f.flags.find(fl => fl.category === cat)?.severity === 'high'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'"
                            >{{ FLAG_LABELS[cat] || cat }}</span>
                          </span>
                        </span>
                        <span v-else-if="col.key === 'completionPct'" class="whitespace-nowrap">{{ f.completionPct != null ? f.completionPct + '%' : '—' }}</span>
                        <span v-else-if="col.key === 'deliveryOwner'">{{ f.deliveryOwner || f.pm || '—' }}</span>
                        <span v-else-if="col.key === 'pm'">{{ f.pm || '—' }}</span>
                        <span v-else>{{ f[col.key] || '—' }}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            </template>
          </div>

          <!-- Tab: Blockers & Dependencies -->
          <div v-if="activeRiskTab === 'blockers'" class="space-y-3">
            <div v-if="blockedFeatures.length === 0" class="bg-white dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
              No features are currently blocked by unresolved dependencies.
            </div>
            <div
              v-for="feat in blockedFeatures"
              :key="feat.key"
              class="bg-white dark:bg-gray-900/50 rounded-lg border border-red-200 dark:border-red-500/20 overflow-hidden"
            >
              <!-- Feature header row -->
              <div class="px-4 py-2.5 bg-red-50/50 dark:bg-red-500/5 border-b border-red-100 dark:border-red-500/10 flex items-center gap-3">
                <span class="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></span>
                <button
                  @click="navigateToFeature(feat.key)"
                  class="text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium text-sm"
                >{{ feat.key }}</button>
                <span class="text-sm text-gray-700 dark:text-gray-300 truncate">{{ feat.summary }}</span>
                <span v-if="feat.phase" class="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">{{ feat.phase }}</span>
              </div>

              <!-- Blocker list -->
              <div class="px-4 py-2.5">
                <div v-if="feat.blockers.length > 0" class="space-y-1.5">
                  <div v-for="b in feat.blockers" :key="b.key" class="flex items-center gap-2 text-sm">
                    <svg class="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    <a
                      :href="'https://redhat.atlassian.net/browse/' + b.key"
                      target="_blank"
                      rel="noopener"
                      class="text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
                    >{{ b.key }}</a>
                    <span class="text-gray-600 dark:text-gray-400 truncate">{{ b.summary }}</span>
                    <span
                      class="ml-auto text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap"
                      :class="b.status === 'In Progress' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : b.status === 'New' || b.status === 'Backlog' || b.status === 'To Do' ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        : b.status === 'Review' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'"
                    >{{ b.status }}</span>
                  </div>
                </div>
                <p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ feat.blockerMessage }}</p>
              </div>
            </div>
          </div>
        </template>
        </template>
      </div>
    </template>

    <!-- Modal -->
    <Teleport to="body">
      <div v-if="modalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 dark:bg-black/60" @click="cancelModal"></div>
        <div
          class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
          @keydown.escape="cancelModal"
        >
          <!-- Modal header -->
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Select Release</h3>
            <button
              @click="cancelModal"
              class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Product Family -->
          <div class="mb-5">
            <label class="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Product Family</label>
            <div class="flex flex-wrap gap-2">
              <button
                @click="toggleAllFamilies"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                :class="isAllFamiliesDraft
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600'"
              >All</button>
              <button
                v-for="f in availableFamilies"
                :key="f"
                @click="toggleFamily(f)"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                :class="draft.families.has(f)
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600'"
              >{{ f.toUpperCase() }}</button>
            </div>
          </div>

          <!-- Version -->
          <div class="mb-5">
            <label class="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Version</label>
            <div v-if="draftVersions.length > 0" class="flex flex-wrap gap-2">
              <button
                v-for="v in draftVersions"
                :key="v"
                @click="selectVersion(v)"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                :class="draft.version === v
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600'"
              >{{ v }}</button>
            </div>
            <p v-else class="text-xs text-gray-400 dark:text-gray-500">Select a product family first.</p>
          </div>

          <!-- Phase -->
          <div class="mb-6">
            <label class="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Phase</label>
            <div v-if="draftPhases.length > 0" class="flex flex-wrap gap-2">
              <button
                v-for="p in draftPhases"
                :key="p"
                @click="togglePhase(p)"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                :class="draft.phases.has(p)
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600'"
              >{{ p }}</button>
            </div>
            <p v-else class="text-xs text-gray-400 dark:text-gray-500">Select a version first.</p>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              @click="cancelModal"
              class="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >Cancel</button>
            <button
              @click="applyModal"
              :disabled="!canApply"
              class="px-4 py-2 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >Apply</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Filter modal -->
    <ReportFilterModal :filters="filters" :available-filter-values="availableFilterValues" />

    <!-- Feature list modal -->
    <Teleport to="body">
      <div v-if="featureListStatus" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 dark:bg-black/60" @click="closeFeatureList"></div>
        <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-h-[80vh] flex flex-col" :style="{ maxWidth: featureListMaxWidth }">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <div class="flex items-center gap-3">
              <span
                class="w-3 h-3 rounded-full"
                :style="{ backgroundColor: featureListDotColor }"
              ></span>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ featureListStatus }}</h3>
              <span class="text-sm text-gray-500 dark:text-gray-400">({{ featuresForStatus.length }})</span>
              <span v-if="featureListPhase" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">{{ selection.version }} {{ featureListPhase }}</span>
            </div>
            <div class="flex items-center gap-2">
              <!-- Column settings toggle -->
              <div class="relative">
                <button
                  @click.stop="columnSettingsOpen = !columnSettingsOpen"
                  class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                  title="Configure columns"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                  </svg>
                </button>
                <!-- Column settings dropdown -->
                <div
                  v-if="columnSettingsOpen"
                  class="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg z-10"
                  @click.stop
                >
                  <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <span class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Columns</span>
                    <button
                      @click="resetColumns"
                      class="text-[11px] text-primary-600 dark:text-primary-400 hover:underline"
                    >Reset</button>
                  </div>
                  <div class="py-1">
                    <div
                      v-for="(colKey, idx) in columnOrder"
                      :key="colKey"
                      draggable="true"
                      @dragstart="onColDragStart($event, idx)"
                      @dragover.prevent="onColDragOver($event, idx)"
                      @drop="onColDrop(idx)"
                      @dragend="colDragIdx = -1"
                      class="flex items-center gap-2 px-3 py-1.5 text-sm cursor-grab active:cursor-grabbing select-none"
                      :class="colDragOverIdx === idx ? 'border-t-2 border-primary-500' : ''"
                    >
                      <span class="text-gray-400 dark:text-gray-500 text-xs shrink-0">&#x2807;</span>
                      <label class="flex items-center gap-2 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          :checked="activeColumnKeys.has(colKey)"
                          :disabled="colKey === 'key'"
                          @change="toggleColumn(colKey)"
                          class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                        />
                        <span class="text-gray-700 dark:text-gray-300" :class="colKey === 'key' ? 'opacity-50' : ''">{{ AVAILABLE_COLUMNS.find(c => c.key === colKey).label }}</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <button
                @click="closeFeatureList"
                class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Table -->
          <div class="overflow-auto flex-1">
            <table class="text-sm" style="table-layout:fixed" :style="{ width: tableWidth }">
              <colgroup>
                <col v-for="col in visibleColumns" :key="col.key" :style="{ width: (columnWidths[col.key] || 150) + 'px' }" />
              </colgroup>
              <thead class="sticky top-0 bg-gray-50 dark:bg-gray-800/90">
                <tr class="border-b border-gray-200 dark:border-gray-700">
                  <th
                    v-for="col in visibleColumns"
                    :key="col.key"
                    class="relative px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                  >{{ col.label }}<span
                      class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-gray-300 dark:bg-gray-600 hover:bg-primary-400 dark:hover:bg-primary-500 transition-colors"
                      @mousedown.prevent="startColResize($event, col.key)"
                    ></span></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="f in featuresForStatus"
                  :key="f.key"
                  class="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td
                    v-for="col in visibleColumns"
                    :key="col.key"
                    class="px-4 py-2.5 truncate"
                    :class="col.cellClass || 'text-gray-600 dark:text-gray-400'"
                  >
                    <span v-if="col.key === 'key'" class="inline-flex items-center gap-1.5">
                      <a
                        href="#"
                        class="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                        @click.prevent="navigateToFeature(f.key)"
                      >{{ f.key }}</a>
                      <a
                        :href="'https://issues.redhat.com/browse/' + f.key"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
                        title="Open in Jira"
                        @click.stop
                      >
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                    </span>
                    <span v-else-if="col.key === 'summary'" class="text-gray-900 dark:text-gray-100">{{ f.summary || '—' }}</span>
                    <span v-else-if="col.key === 'fixVersions'">{{ (f.fixVersions || []).join(', ') || '—' }}</span>
                    <span v-else-if="col.key === 'components'">{{ (f.components || []).join(', ') || '—' }}</span>
                    <span v-else-if="col.key === 'labels'">{{ (f.labels || []).join(', ') || '—' }}</span>
                    <span v-else-if="col.key === 'completionPct'">{{ f.completionPct != null ? f.completionPct + '%' : '—' }}</span>
                    <span v-else>{{ f[col.key] || '—' }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, inject } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'
import { useReportFilters } from './composables/useReportFilters.js'
import { useReleaseSelector } from '../composables/useReleaseSelector.js'
import ReportFilterModal from './components/ReportFilterModal.vue'
import ReportFilterNarrative from './components/ReportFilterNarrative.vue'

ChartJS.register(ArcElement, Tooltip)

// ── Constants ──

const MILESTONES = [
  { key: 'featureFreeze', label: 'Feature Freeze' },
  { key: 'codeFreeze', label: 'Code Freeze' },
  { key: 'ga', label: 'Release Date' }
]
const analysisTabs = [
  { id: 'status-charts', label: 'Features & Initiatives by Status' },
  { id: 'color-status', label: 'Features & Initiatives by Color Status' }
]
const riskTabs = [
  { id: 'risk-overview', label: 'Risk Overview' },
  { id: 'at-risk-features', label: 'At-Risk Features' },
  { id: 'blockers', label: 'Blockers & Dependencies' }
]

const FILTER_FIELDS = [
  { key: 'team', label: 'Team' },
  { key: 'components', label: 'Component' },
  { key: 'labels', label: 'Label' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'issueType', label: 'Type' },
  { key: 'priority', label: 'Priority' }
]

const filters = useReportFilters({
  storageKeyPrefix: 'capacity-report',
  filterFields: FILTER_FIELDS
})

const RISK_COLORS = {
  'Green': '#22c55e',
  'Yellow': '#eab308',
  'Red': '#ef4444'
}

const FLAG_LABELS = {
  'MILESTONE_MISS': 'Behind Schedule',
  'VELOCITY_LAG': 'Velocity Risk',
  'BLOCKED': 'Blocked',
  'PLANNING_INCOMPLETE': 'Planning Incomplete'
}

// ── Release selector (shared composable) ──

const {
  modalOpen,
  selection,
  draft,
  parsedReleases,
  availableFamilies,
  draftVersions,
  draftPhases,
  isAllFamiliesDraft,
  hasSelection,
  canApply,
  fetchRegistry,
  restoreSelection,
  openModal,
  cancelModal,
  applyModal,
  toggleAllFamilies,
  toggleFamily,
  selectVersionDraft: selectVersion,
  togglePhase,
  familyNarrative,
  phaseNarrative,
  PHASE_ORDER
} = useReleaseSelector({ storageKey: 'tt_cache:capacity-report-selection' })

// ── Core state ──

const nav = inject('moduleNav')
const loading = ref(true)
const error = ref(null)
const activeAnalysisTab = ref('status-charts')

const milestonesOpen = ref(true)
const chartsOpen = ref(true)
const riskOpen = ref(true)

// ── Data loading ──

async function loadData() {
  loading.value = true
  error.value = null
  try {
    await fetchRegistry()
    restoreSelection()
  } catch (e) {
    error.value = e.message || 'Failed to load releases'
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

// ── Escape / click-outside ──

function handleEscape(e) {
  if (e.key !== 'Escape') return
  if (filters.filterModalOpen.value) { filters.closeFilterModal(); return }
  if (columnSettingsOpen.value) { columnSettingsOpen.value = false; return }
  if (riskColumnSettingsOpen.value) { riskColumnSettingsOpen.value = false; return }
  if (featureListStatus.value) { closeFeatureList(); return }
  if (modalOpen.value) cancelModal()
}

function handleClickOutside() {
  if (columnSettingsOpen.value) columnSettingsOpen.value = false
  if (riskColumnSettingsOpen.value) riskColumnSettingsOpen.value = false
}
onMounted(() => {
  document.addEventListener('keydown', handleEscape)
  document.addEventListener('click', handleClickOutside)
})
onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
  document.removeEventListener('click', handleClickOutside)
  var tooltipEl = document.getElementById('capacity-chart-tooltip')
  if (tooltipEl) tooltipEl.remove()
})

// ── Deadline cards ──

const deadlineCards = computed(() => {
  if (!hasSelection.value) return []

  const sortedPhases = [...selection.phases].sort((a, b) => PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b))
  const sortedFamilies = [...selection.families].sort()
  const single = sortedFamilies.length === 1

  return sortedPhases.map(phase => {
    const familyReleases = {}
    for (const family of sortedFamilies) {
      familyReleases[family] = parsedReleases.value.find(r =>
        r.family === family && r.version === selection.version && r.phase === phase
      ) || null
    }

    const rows = []
    let foundNext = false

    for (const { key, label } of MILESTONES) {
      if (single) {
        const rel = familyReleases[sortedFamilies[0]]
        const dateStr = rel?.milestones?.[key] || null
        if (!dateStr) continue
        const days = daysFromNow(dateStr)
        const isPast = days !== null && days < 0
        const isNext = !isPast && !foundNext
        if (isNext) foundNext = true
        rows.push({
          key, label, dateFormatted: formatDate(dateStr), days, isPast, isNext,
          daysLabel: formatDaysLabel(days),
          daysClass: getDaysClass(days, isPast, isNext)
        })
      } else {
        const cells = {}
        let hasAny = false
        for (const family of sortedFamilies) {
          const rel = familyReleases[family]
          const dateStr = rel?.milestones?.[key] || null
          const days = daysFromNow(dateStr)
          const isPast = days !== null && days < 0
          if (dateStr) hasAny = true
          cells[family] = {
            dateFormatted: dateStr ? formatDate(dateStr) : '—',
            days, isPast,
            daysLabel: formatDaysLabel(days),
            daysClass: getDaysClass(days, isPast, false)
          }
        }
        if (!hasAny) continue
        rows.push({ key, label, cells })
      }
    }

    return {
      phase,
      phaseLabel: phase,
      families: sortedFamilies,
      isSingleFamily: single,
      rows,
      hasData: rows.length > 0
    }
  })
})

// ── Feature status chart ──

const STATUS_COLORS = {
  'New': '#9ca3af',
  'Backlog': '#a1a1aa',
  'To Do': '#d4d4d8',
  'Refinement': '#a78bfa',
  'In Progress': '#3b82f6',
  'Review': '#f59e0b',
  'Release Pending': '#10b981',
  'Closed': '#6366f1'
}

const allFeatures = ref([])
const featuresLoading = ref(false)
const knownComponents = ref([])
const knownTeams = ref([])

async function fetchFeatures() {
  featuresLoading.value = true
  try {
    const data = await apiRequest('/modules/releases/execution/features')
    allFeatures.value = data.features || []
  } catch (e) {
    console.error('[capacity-report] Failed to fetch features:', e)
    allFeatures.value = []
  } finally {
    featuresLoading.value = false
  }
}

async function fetchFieldOptions() {
  try {
    const [components, teams] = await Promise.all([
      apiRequest('/modules/team-tracker/field-options/component'), // eslint-disable-line org-pulse/no-cross-module-imports
      apiRequest('/modules/team-tracker/field-options/jiraTeam') // eslint-disable-line org-pulse/no-cross-module-imports
    ])
    knownComponents.value = components.values || []
    knownTeams.value = teams.values || []
  } catch (e) {
    error.value = e.message || 'Failed to load field options'
  }
}

onMounted(fetchFeatures)
onMounted(fetchFieldOptions)

// ── Feature filtering ──

const filteredAllFeatures = computed(() => filters.filterItems(allFeatures.value))

const availableFilterValues = computed(() => {
  if (!hasSelection.value) return {}
  const result = {}
  const sortedPhases = [...selection.phases].sort((a, b) => PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b))
  for (const field of FILTER_FIELDS) {
    const values = new Set()
    if (field.key === 'components') {
      knownComponents.value.forEach(v => values.add(v))
    } else if (field.key === 'team') {
      knownTeams.value.forEach(v => values.add(v))
    }
    for (const phase of sortedPhases) {
      const features = matchAllFeaturesForPhase(phase)
      for (const f of features) {
        const val = f[field.key]
        if (Array.isArray(val)) {
          val.forEach(v => { if (v) values.add(v) })
        } else if (val) {
          values.add(val)
        }
      }
    }
    result[field.key] = [...values].sort()
  }
  return result
})

// Restore modal state when returning from feature detail
watch(featuresLoading, (loading) => {
  if (loading) return
  const params = nav?.params?.value || {}
  if (params.modalStatus && params.modalPhase) {
    openFeatureList(params.modalStatus, params.modalPhase, params.modalField)
    if (params.modalField === 'colorStatus') activeAnalysisTab.value = 'color-status'
    if (params.modalField === 'riskLevel') activeRiskTab.value = 'risk-overview'
    nav.updateParams({ modalStatus: undefined, modalPhase: undefined, modalField: undefined })
  }
})

function normalizeFixVersion(v) {
  return String(v).replace(/[\s.-]+/g, ' ').replace(/\s*release$/i, '').trim().toLowerCase()
}

function buildExpectedVersions(version, families, phases) {
  const patterns = []
  for (const family of families) {
    for (const phase of phases) {
      const f = family.toUpperCase()
      const p = phase.toUpperCase()
      // New format: "3.5 GA RHOAI RELEASE" → normalized: "3 5 ga rhoai"
      patterns.push(normalizeFixVersion(version + ' ' + p + ' ' + f))
      // Legacy format: "rhoai-3.5.EA1" → normalized: "rhoai 3 5 ea1"
      patterns.push(normalizeFixVersion(f + '-' + version + '.' + p))
      patterns.push(normalizeFixVersion(f + '-' + version + ' ' + p))
      patterns.push(normalizeFixVersion(f + '-' + version + p))
      // GA can also be the bare version: "rhoai-3.5" → normalized: "rhoai 3 5"
      if (p === 'GA') {
        patterns.push(normalizeFixVersion(f + '-' + version))
      }
    }
  }
  return [...new Set(patterns)]
}

function matchFeaturesFromSource(source, phase) {
  if (source.length === 0) return []
  const expected = buildExpectedVersions(
    selection.version,
    [...selection.families],
    [phase]
  )
  return source.filter(f =>
    f.fixVersions && f.fixVersions.some(v => expected.includes(normalizeFixVersion(v)))
  )
}

function matchAllFeaturesForPhase(phase) {
  return matchFeaturesFromSource(allFeatures.value, phase)
}

function matchFeaturesForPhase(phase) {
  return matchFeaturesFromSource(filteredAllFeatures.value, phase)
}

function buildDistribution(features) {
  const counts = {}
  for (const f of features) {
    const status = f.status || 'Unknown'
    counts[status] = (counts[status] || 0) + 1
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => ({ status, count }))
}

const featureStatusCards = computed(() => {
  if (!hasSelection.value) return []
  const sortedPhases = [...selection.phases].sort((a, b) => PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b))

  return sortedPhases.map(phase => {
    const features = matchFeaturesForPhase(phase)
    const distribution = buildDistribution(features)
    const total = features.length
    const chartData = distribution.length > 0 ? {
      labels: distribution.map(d => d.status),
      datasets: [{
        data: distribution.map(d => d.count),
        backgroundColor: distribution.map(d => STATUS_COLORS[d.status] || '#d1d5db'),
        borderWidth: 0,
        hoverOffset: 4
      }]
    } : null

    return { phase, features, distribution, total, chartData }
  })
})

// ── Color status charts ──

const COLOR_STATUS_COLORS = {
  'Green': '#22c55e',
  'Yellow': '#eab308',
  'Red': '#ef4444',
  'Not Set': '#d1d5db'
}

function buildColorDistribution(features) {
  const counts = {}
  for (const f of features) {
    const color = f.colorStatus || 'Not Set'
    counts[color] = (counts[color] || 0) + 1
  }
  const order = ['Green', 'Yellow', 'Red', 'Not Set']
  return order
    .filter(c => counts[c])
    .map(c => ({ status: c, count: counts[c] }))
}

const colorStatusCards = computed(() => {
  if (!hasSelection.value) return []
  const sortedPhases = [...selection.phases].sort((a, b) => PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b))

  return sortedPhases.map(phase => {
    const features = matchFeaturesForPhase(phase)
    const distribution = buildColorDistribution(features)
    const total = features.length
    const chartData = distribution.length > 0 ? {
      labels: distribution.map(d => d.status),
      datasets: [{
        data: distribution.map(d => d.count),
        backgroundColor: distribution.map(d => COLOR_STATUS_COLORS[d.status] || '#d1d5db'),
        borderWidth: 0,
        hoverOffset: 4
      }]
    } : null

    return { phase, features, distribution, total, chartData }
  })
})

// ── Health / risk data ──

const healthData = ref(null)
const healthLoading = ref(false)
const activeRiskTab = ref('risk-overview')
const riskSearchQuery = ref('')
const riskInfoOpen = ref(false)

async function fetchHealth() {
  if (!hasSelection.value || !selection.version) return
  healthLoading.value = true
  try {
    var data = await apiRequest('/modules/releases/planning/releases/' + selection.version + '/health')
    healthData.value = data
  } catch (e) {
    console.error('[capacity-report] Failed to fetch health data:', e)
    healthData.value = null
  } finally {
    healthLoading.value = false
  }
}

watch(() => selection.version, (newVersion) => {
  if (newVersion && hasSelection.value) {
    fetchHealth()
  } else {
    healthData.value = null
  }
})

// Also fetch on initial selection restore
watch(hasSelection, (val) => {
  if (val && !healthData.value && !healthLoading.value) {
    fetchHealth()
  }
})

const riskCards = computed(() => {
  if (!hasSelection.value || !healthData.value) return []
  var healthFeatures = healthData.value.features || []
  var healthByKey = {}
  for (var hf of healthFeatures) {
    healthByKey[hf.key] = hf
  }

  var sortedPhases = [...selection.phases].sort((a, b) => PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b))

  return sortedPhases.map(phase => {
    var phaseFeatures = matchFeaturesForPhase(phase)
    var phaseKeys = new Set(phaseFeatures.map(f => f.key))

    // Cross-reference with health data
    var matchedHealth = healthFeatures.filter(hf => phaseKeys.has(hf.key))
    var total = matchedHealth.length

    // Build risk distribution
    var riskCounts = { 'Green': 0, 'Yellow': 0, 'Red': 0 }
    for (var hf of matchedHealth) {
      var level = hf.risk?.level || 'green'
      var label = level.charAt(0).toUpperCase() + level.slice(1)
      if (riskCounts[label] !== undefined) {
        riskCounts[label]++
      }
    }

    var distribution = ['Green', 'Yellow', 'Red']
      .filter(r => riskCounts[r] > 0)
      .map(r => ({ status: r, count: riskCounts[r] }))

    var chartData = distribution.length > 0 ? {
      labels: distribution.map(d => d.status),
      datasets: [{
        data: distribution.map(d => d.count),
        backgroundColor: distribution.map(d => RISK_COLORS[d.status] || '#d1d5db'),
        borderWidth: 0,
        hoverOffset: 4
      }]
    } : null

    // Aggregate flag categories with max severity
    var flagMap = {}
    for (var hf2 of matchedHealth) {
      var flags = hf2.risk?.flags || []
      for (var flag of flags) {
        if (!flagMap[flag.category]) {
          flagMap[flag.category] = { category: flag.category, count: 0, severity: flag.severity }
        }
        flagMap[flag.category].count++
        if (flag.severity === 'high') flagMap[flag.category].severity = 'high'
      }
    }
    var flagCounts = Object.values(flagMap).sort((a, b) => b.count - a.count)

    // Build features array for modal — exec features tagged with risk level
    var featuresWithRisk = phaseFeatures.map(f => {
      var h = healthByKey[f.key]
      var level = h && h.risk ? (h.risk.level || 'green') : 'green'
      var riskLevel = level.charAt(0).toUpperCase() + level.slice(1)
      return Object.assign({}, f, { _riskLevel: riskLevel })
    })

    return { phase, features: featuresWithRisk, distribution, total, chartData, flagCounts }
  })
})

const atRiskFeatures = computed(() => {
  if (!hasSelection.value || !healthData.value) return []
  var healthFeatures = healthData.value.features || []
  var sortedPhases = [...selection.phases].sort((a, b) => PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b))

  // Build a set of keys per phase for phase lookup
  var keyToPhase = {}
  for (var phase of sortedPhases) {
    var phaseFeatures = matchFeaturesForPhase(phase)
    for (var pf of phaseFeatures) {
      keyToPhase[pf.key] = phase
    }
  }

  var result = []
  for (var hf of healthFeatures) {
    if (!keyToPhase[hf.key]) continue
    var risk = hf.risk || {}
    var effectiveLevel = risk.override ? risk.override.riskOverride : (risk.level || 'green')
    var normalized = effectiveLevel.charAt(0).toUpperCase() + effectiveLevel.slice(1)
    if (normalized !== 'Red' && normalized !== 'Yellow') continue

    var flags = risk.flags || []
    var categories = [...new Set(flags.map(f => f.category))]

    result.push({
      key: hf.key,
      summary: hf.summary || '',
      riskLevel: normalized,
      phase: keyToPhase[hf.key],
      flagCount: flags.length,
      flagCategories: categories,
      flags: flags,
      completionPct: hf.completionPct != null ? hf.completionPct : null,
      deliveryOwner: hf.deliveryOwner || hf.assignee || '',
      pm: hf.pm || ''
    })
  }

  // Sort: red first, then yellow; within same level by flag count descending
  var levelOrder = { 'Red': 0, 'Yellow': 1 }
  result.sort((a, b) => {
    var levelDiff = (levelOrder[a.riskLevel] || 99) - (levelOrder[b.riskLevel] || 99)
    if (levelDiff !== 0) return levelDiff
    return b.flagCount - a.flagCount
  })

  return result
})

const filteredAtRiskFeatures = computed(() => {
  var q = riskSearchQuery.value.toLowerCase().trim()
  if (!q) return atRiskFeatures.value
  return atRiskFeatures.value.filter(f =>
    f.key.toLowerCase().includes(q) ||
    (f.summary || '').toLowerCase().includes(q) ||
    (f.deliveryOwner || '').toLowerCase().includes(q) ||
    (f.pm || '').toLowerCase().includes(q)
  )
})

const CLOSED_STATUSES = ['Closed', 'Done', 'Resolved', 'Cancelled']

// ── At-risk table columns ──

const RISK_COLUMNS_STORAGE_KEY = 'tt_cache:capacity-report-risk-columns'
const RISK_WIDTHS_STORAGE_KEY = 'tt_cache:capacity-report-risk-col-widths'

const RISK_AVAILABLE_COLUMNS = [
  { key: 'key', label: 'Key' },
  { key: 'summary', label: 'Summary' },
  { key: 'riskLevel', label: 'Risk' },
  { key: 'phase', label: 'Phase' },
  { key: 'flagCategories', label: 'Flags' },
  { key: 'completionPct', label: 'Completion' },
  { key: 'deliveryOwner', label: 'Owner' },
  { key: 'pm', label: 'PM' }
]
const RISK_DEFAULT_COLUMN_KEYS = ['key', 'summary', 'riskLevel', 'phase', 'flagCategories', 'completionPct', 'deliveryOwner']
const RISK_ALL_COLUMN_KEYS = RISK_AVAILABLE_COLUMNS.map(c => c.key)
const RISK_DEFAULT_COL_WIDTHS = { key: 150, summary: 300, riskLevel: 90, phase: 80, flagCategories: 200, completionPct: 110, deliveryOwner: 160, pm: 140 }

const riskColumnOrder = ref([...RISK_ALL_COLUMN_KEYS])
const riskActiveColumnKeys = ref(new Set(RISK_DEFAULT_COLUMN_KEYS))
const riskColumnSettingsOpen = ref(false)
const riskColumnWidths = reactive({ ...RISK_DEFAULT_COL_WIDTHS })

function loadRiskColumnPrefs() {
  try {
    var stored = localStorage.getItem(RISK_COLUMNS_STORAGE_KEY)
    if (!stored) return
    var parsed = JSON.parse(stored)
    if (parsed.order && parsed.active) {
      var validOrder = parsed.order.filter(k => RISK_ALL_COLUMN_KEYS.includes(k))
      for (var k of RISK_ALL_COLUMN_KEYS) {
        if (!validOrder.includes(k)) validOrder.push(k)
      }
      riskColumnOrder.value = validOrder
      riskActiveColumnKeys.value = new Set(parsed.active.filter(k => RISK_ALL_COLUMN_KEYS.includes(k)))
      riskActiveColumnKeys.value.add('key')
    }
  } catch { /* ignore */ }
}

function saveRiskColumnPrefs() {
  localStorage.setItem(RISK_COLUMNS_STORAGE_KEY, JSON.stringify({
    order: riskColumnOrder.value,
    active: [...riskActiveColumnKeys.value]
  }))
}

loadRiskColumnPrefs()

function loadRiskColumnWidths() {
  try {
    var stored = localStorage.getItem(RISK_WIDTHS_STORAGE_KEY)
    if (stored) Object.assign(riskColumnWidths, JSON.parse(stored))
  } catch { /* ignore */ }
}
loadRiskColumnWidths()

function saveRiskColumnWidths() {
  localStorage.setItem(RISK_WIDTHS_STORAGE_KEY, JSON.stringify({ ...riskColumnWidths }))
}

const riskVisibleColumns = computed(() => {
  return riskColumnOrder.value
    .filter(k => riskActiveColumnKeys.value.has(k))
    .map(k => RISK_AVAILABLE_COLUMNS.find(c => c.key === k))
    .filter(Boolean)
})

const riskTableWidth = computed(() => {
  var total = 0
  for (var col of riskVisibleColumns.value) {
    total += riskColumnWidths[col.key] || 150
  }
  return total
})

function riskColStyle(colKey) {
  var w = riskColumnWidths[colKey] || 150
  var total = riskTableWidth.value
  // Use proportional widths so columns expand to fill the container
  return (w / total * 100) + '%'
}

function toggleRiskColumn(colKey) {
  if (colKey === 'key') return
  var next = new Set(riskActiveColumnKeys.value)
  if (next.has(colKey)) { next.delete(colKey) } else { next.add(colKey) }
  riskActiveColumnKeys.value = next
  saveRiskColumnPrefs()
}

function resetRiskColumns() {
  riskColumnOrder.value = [...RISK_ALL_COLUMN_KEYS]
  riskActiveColumnKeys.value = new Set(RISK_DEFAULT_COLUMN_KEYS)
  saveRiskColumnPrefs()
  Object.assign(riskColumnWidths, RISK_DEFAULT_COL_WIDTHS)
  saveRiskColumnWidths()
}

// Risk column drag reorder
const riskColDragIdx = ref(-1)
const riskColDragOverIdx = ref(-1)

function onRiskColDragStart(event, idx) {
  riskColDragIdx.value = idx
  event.dataTransfer.effectAllowed = 'move'
}

function onRiskColDragOver(_event, idx) {
  riskColDragOverIdx.value = idx
}

function onRiskColDrop(targetIdx) {
  var fromIdx = riskColDragIdx.value
  if (fromIdx < 0 || fromIdx === targetIdx) {
    riskColDragIdx.value = -1
    riskColDragOverIdx.value = -1
    return
  }
  var next = [...riskColumnOrder.value]
  var item = next.splice(fromIdx, 1)[0]
  next.splice(targetIdx, 0, item)
  riskColumnOrder.value = next
  riskColDragIdx.value = -1
  riskColDragOverIdx.value = -1
  saveRiskColumnPrefs()
}

// Risk column resize
var riskResizeCol = null
var riskResizeStartX = 0
var riskResizeStartW = 0

function startRiskColResize(event, colKey) {
  riskResizeCol = colKey
  riskResizeStartX = event.clientX
  riskResizeStartW = riskColumnWidths[colKey] || 150
  document.addEventListener('mousemove', onRiskColResizeMove)
  document.addEventListener('mouseup', onRiskColResizeEnd)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onRiskColResizeMove(event) {
  if (!riskResizeCol) return
  var diff = event.clientX - riskResizeStartX
  riskColumnWidths[riskResizeCol] = Math.max(60, riskResizeStartW + diff)
}

function onRiskColResizeEnd() {
  document.removeEventListener('mousemove', onRiskColResizeMove)
  document.removeEventListener('mouseup', onRiskColResizeEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  if (riskResizeCol) saveRiskColumnWidths()
  riskResizeCol = null
}

const blockedFeatures = computed(() => {
  if (!hasSelection.value || !healthData.value) return []
  var healthFeatures = healthData.value.features || []
  var featuresByKey = {}
  for (var f of allFeatures.value) {
    featuresByKey[f.key] = f
  }

  var result = []
  for (var hf of healthFeatures) {
    var flags = (hf.risk && hf.risk.flags) || []
    var blockedFlag = flags.find(function (f) { return f.category === 'BLOCKED' })
    if (!blockedFlag) continue

    var execFeature = featuresByKey[hf.key]
    var blockers = []

    if (execFeature && execFeature.issueLinks) {
      blockers = execFeature.issueLinks
        .filter(function (link) {
          return link.type === 'Depend' &&
            link.direction === 'inward' &&
            !CLOSED_STATUSES.includes(link.linkedStatus)
        })
        .map(function (link) {
          return { key: link.linkedKey, summary: link.linkedSummary || '', status: link.linkedStatus || 'Unknown' }
        })
    }

    // Fallback: parse blocker keys from flag message if no issueLinks data
    if (blockers.length === 0 && blockedFlag.message) {
      var keyPattern = /[A-Z][A-Z0-9]+-\d+/g
      var matches = blockedFlag.message.match(keyPattern)
      if (matches) {
        blockers = matches.map(function (k) {
          return { key: k, summary: '', status: 'Unknown' }
        })
      }
    }

    // Determine phase from atRiskFeatures or health data
    var atRisk = atRiskFeatures.value.find(function (r) { return r.key === hf.key })

    result.push({
      key: hf.key,
      summary: hf.summary || '',
      phase: atRisk ? atRisk.phase : '',
      deliveryOwner: hf.deliveryOwner || hf.assignee || '',
      pm: hf.pm || '',
      blockerMessage: blockedFlag.message || '',
      blockers: blockers
    })
  }

  result.sort(function (a, b) {
    return b.blockers.length - a.blockers.length || a.key.localeCompare(b.key)
  })

  return result
})

function makeRiskDoughnutOptions(card) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '60%',
    onClick: function (_event, elements) {
      if (elements.length > 0) {
        var idx = elements[0].index
        var item = card.distribution[idx]
        if (item) openFeatureList(item.status, card.phase, 'riskLevel')
      }
    },
    onHover: function (event, elements) {
      event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default'
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: function (context) {
          var tooltipEl = document.getElementById('capacity-chart-tooltip')
          if (!tooltipEl) {
            tooltipEl = document.createElement('div')
            tooltipEl.id = 'capacity-chart-tooltip'
            tooltipEl.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;background:rgba(0,0,0,0.8);color:#fff;border-radius:6px;padding:6px 10px;font-size:12px;white-space:nowrap;transition:opacity 0.15s;'
            document.body.appendChild(tooltipEl)
          }

          var model = context.tooltip
          if (model.opacity === 0) {
            tooltipEl.style.opacity = '0'
            return
          }

          if (model.body) {
            var idx = model.dataPoints[0].dataIndex
            var item = card.distribution[idx]
            var pct = card.total > 0 ? Math.round(item.count / card.total * 100) : 0
            tooltipEl.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;background:' + (RISK_COLORS[item.status] || '#d1d5db') + '"></span>' + item.status + ': ' + item.count + ' (' + pct + '%)'
          }

          var canvas = context.chart.canvas
          var rect = canvas.getBoundingClientRect()
          tooltipEl.style.opacity = '1'
          tooltipEl.style.left = rect.left + model.caretX + 'px'
          tooltipEl.style.top = rect.top + model.caretY + 'px'
          tooltipEl.style.transform = 'translate(-50%, -120%)'
        }
      }
    }
  }
}

// ── Feature list modal ──

const featureListStatus = ref(null)
const columnSettingsOpen = ref(false)

const COLUMNS_STORAGE_KEY = 'tt_cache:capacity-report-columns'
const AVAILABLE_COLUMNS = [
  { key: 'key', label: 'Key' },
  { key: 'summary', label: 'Summary' },
  { key: 'issueType', label: 'Type' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'priority', label: 'Priority' },
  { key: 'pm', label: 'PM' },
  { key: 'team', label: 'Team' },
  { key: 'components', label: 'Components' },
  { key: 'fixVersions', label: 'Fix Versions' },
  { key: 'health', label: 'Health' },
  { key: 'completionPct', label: 'Completion' },
  { key: 'colorStatus', label: 'Color Status' },
  { key: 'labels', label: 'Labels' },
  { key: 'architect', label: 'Architect' }
]
const DEFAULT_COLUMN_KEYS = ['key', 'summary', 'assignee', 'priority']
const ALL_COLUMN_KEYS = AVAILABLE_COLUMNS.map(c => c.key)

// Column order includes all columns (visible + hidden), in user-chosen order
const columnOrder = ref([...ALL_COLUMN_KEYS])
const activeColumnKeys = ref(new Set(DEFAULT_COLUMN_KEYS))

function loadColumnPrefs() {
  try {
    const stored = localStorage.getItem(COLUMNS_STORAGE_KEY)
    if (!stored) return
    const parsed = JSON.parse(stored)
    if (parsed.order && parsed.active) {
      // Merge in any new columns added since the prefs were saved
      const validOrder = parsed.order.filter(k => ALL_COLUMN_KEYS.includes(k))
      for (const k of ALL_COLUMN_KEYS) {
        if (!validOrder.includes(k)) validOrder.push(k)
      }
      columnOrder.value = validOrder
      activeColumnKeys.value = new Set(parsed.active.filter(k => ALL_COLUMN_KEYS.includes(k)))
      // Key is always visible
      activeColumnKeys.value.add('key')
    }
  } catch { /* ignore */ }
}

function saveColumnPrefs() {
  localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify({
    order: columnOrder.value,
    active: [...activeColumnKeys.value]
  }))
}

loadColumnPrefs()

const featureListMaxWidth = computed(() => {
  const count = activeColumnKeys.value.size
  // ~200px per column, clamped between 600px and 95vw
  return Math.min(window.innerWidth * 0.95, Math.max(600, count * 200)) + 'px'
})

const visibleColumns = computed(() => {
  return columnOrder.value
    .filter(k => activeColumnKeys.value.has(k))
    .map(k => AVAILABLE_COLUMNS.find(c => c.key === k))
    .filter(Boolean)
})

function toggleColumn(colKey) {
  if (colKey === 'key') return
  const next = new Set(activeColumnKeys.value)
  if (next.has(colKey)) {
    next.delete(colKey)
  } else {
    next.add(colKey)
  }
  activeColumnKeys.value = next
  saveColumnPrefs()
}

function resetColumns() {
  columnOrder.value = [...ALL_COLUMN_KEYS]
  activeColumnKeys.value = new Set(DEFAULT_COLUMN_KEYS)
  saveColumnPrefs()
  Object.assign(columnWidths, DEFAULT_COL_WIDTHS)
  saveColumnWidths()
}

// Column drag reorder
const colDragIdx = ref(-1)
const colDragOverIdx = ref(-1)

function onColDragStart(event, idx) {
  colDragIdx.value = idx
  event.dataTransfer.effectAllowed = 'move'
}

function onColDragOver(_event, idx) {
  colDragOverIdx.value = idx
}

function onColDrop(targetIdx) {
  const fromIdx = colDragIdx.value
  if (fromIdx < 0 || fromIdx === targetIdx) {
    colDragIdx.value = -1
    colDragOverIdx.value = -1
    return
  }
  const next = [...columnOrder.value]
  const item = next.splice(fromIdx, 1)[0]
  next.splice(targetIdx, 0, item)
  columnOrder.value = next
  colDragIdx.value = -1
  colDragOverIdx.value = -1
  saveColumnPrefs()
}

// Column resize
const DEFAULT_COL_WIDTHS = { key: 130, summary: 300, issueType: 100, assignee: 140, priority: 100, pm: 140, team: 140, components: 160, fixVersions: 160, health: 90, completionPct: 110, colorStatus: 120, labels: 160, architect: 140 }
const WIDTHS_STORAGE_KEY = 'tt_cache:capacity-report-col-widths'
const columnWidths = reactive({ ...DEFAULT_COL_WIDTHS })

function loadColumnWidths() {
  try {
    const stored = localStorage.getItem(WIDTHS_STORAGE_KEY)
    if (stored) Object.assign(columnWidths, JSON.parse(stored))
  } catch { /* ignore */ }
}
loadColumnWidths()

function saveColumnWidths() {
  localStorage.setItem(WIDTHS_STORAGE_KEY, JSON.stringify({ ...columnWidths }))
}

const tableWidth = computed(() => {
  let total = 0
  for (const col of visibleColumns.value) {
    total += columnWidths[col.key] || 150
  }
  return total + 'px'
})

let resizeCol = null
let resizeStartX = 0
let resizeStartW = 0

function startColResize(event, colKey) {
  resizeCol = colKey
  resizeStartX = event.clientX
  resizeStartW = columnWidths[colKey] || 150
  document.addEventListener('mousemove', onColResizeMove)
  document.addEventListener('mouseup', onColResizeEnd)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onColResizeMove(event) {
  if (!resizeCol) return
  const diff = event.clientX - resizeStartX
  columnWidths[resizeCol] = Math.max(60, resizeStartW + diff)
}

function onColResizeEnd() {
  document.removeEventListener('mousemove', onColResizeMove)
  document.removeEventListener('mouseup', onColResizeEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  if (resizeCol) saveColumnWidths()
  resizeCol = null
}

const featureListPhase = ref(null)
const featureListFilterField = ref('status')

const featuresForStatus = computed(() => {
  if (!featureListStatus.value) return []
  const field = featureListFilterField.value
  if (field === 'riskLevel') {
    const card = riskCards.value.find(c => c.phase === featureListPhase.value)
    if (!card) return []
    return card.features
      .filter(f => f._riskLevel === featureListStatus.value)
      .sort((a, b) => (a.key || '').localeCompare(b.key || ''))
  }
  const cards = field === 'colorStatus' ? colorStatusCards.value : featureStatusCards.value
  const card = cards.find(c => c.phase === featureListPhase.value)
  if (!card) return []
  return card.features
    .filter(f => {
      if (field === 'colorStatus') return (f.colorStatus || 'Not Set') === featureListStatus.value
      return (f.status || 'Unknown') === featureListStatus.value
    })
    .sort((a, b) => (a.key || '').localeCompare(b.key || ''))
})

const featureListDotColor = computed(() => {
  if (!featureListStatus.value) return '#d1d5db'
  if (featureListFilterField.value === 'riskLevel') return RISK_COLORS[featureListStatus.value] || '#d1d5db'
  if (featureListFilterField.value === 'colorStatus') return COLOR_STATUS_COLORS[featureListStatus.value] || '#d1d5db'
  return STATUS_COLORS[featureListStatus.value] || '#d1d5db'
})

function openFeatureList(status, phase, field) {
  featureListStatus.value = status
  featureListPhase.value = phase || null
  featureListFilterField.value = field || 'status'
  columnSettingsOpen.value = false
}

function closeFeatureList() {
  featureListStatus.value = null
  featureListPhase.value = null
  featureListFilterField.value = 'status'
  columnSettingsOpen.value = false
}

function navigateToFeature(key) {
  const params = {
    key,
    from: 'capacity-report',
    modalStatus: featureListStatus.value,
    modalPhase: featureListPhase.value,
    modalField: featureListFilterField.value
  }
  closeFeatureList()
  nav.navigateTo('feature-detail', params)
}

function makeDoughnutOptions(card, field) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '60%',
    onClick: function (_event, elements) {
      if (elements.length > 0) {
        var idx = elements[0].index
        var item = card.distribution[idx]
        if (item) openFeatureList(item.status, card.phase, field)
      }
    },
    onHover: function (event, elements) {
      event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default'
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: function (context) {
          var tooltipEl = document.getElementById('capacity-chart-tooltip')
          if (!tooltipEl) {
            tooltipEl = document.createElement('div')
            tooltipEl.id = 'capacity-chart-tooltip'
            tooltipEl.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;background:rgba(0,0,0,0.8);color:#fff;border-radius:6px;padding:6px 10px;font-size:12px;white-space:nowrap;transition:opacity 0.15s;'
            document.body.appendChild(tooltipEl)
          }

          var model = context.tooltip
          if (model.opacity === 0) {
            tooltipEl.style.opacity = '0'
            return
          }

          if (model.body) {
            var idx = model.dataPoints[0].dataIndex
            var item = card.distribution[idx]
            var pct = card.total > 0 ? Math.round(item.count / card.total * 100) : 0
            tooltipEl.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;background:' + (STATUS_COLORS[item.status] || '#d1d5db') + '"></span>' + item.status + ': ' + item.count + ' (' + pct + '%)'
          }

          var canvas = context.chart.canvas
          var rect = canvas.getBoundingClientRect()
          tooltipEl.style.opacity = '1'
          tooltipEl.style.left = rect.left + model.caretX + 'px'
          tooltipEl.style.top = rect.top + model.caretY + 'px'
          tooltipEl.style.transform = 'translate(-50%, -120%)'
        }
      }
    }
  }
}

// ── Helpers ──

function toLocalDate(dateStr) {
  if (!dateStr) return null
  // Date-only strings (YYYY-MM-DD) are parsed as UTC by JS Date constructor,
  // which shifts dates back one day in western timezones. Construct as local.
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? null : d
}

function formatDate(dateStr) {
  const d = toLocalDate(dateStr)
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysFromNow(dateStr) {
  const d = toLocalDate(dateStr)
  if (!d) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - today.getTime()) / 86400000)
}

function formatDaysLabel(days) {
  if (days === null) return '—'
  if (days === 0) return 'Today'
  if (days < 0) return Math.abs(days) + ' days ago'
  return days + ' days'
}

function getDaysClass(days, isPast, isNext) {
  if (days === null) return 'text-gray-300 dark:text-gray-600'
  if (isPast) return 'text-gray-400 dark:text-gray-500'
  if (days === 0) return 'font-semibold text-primary-600 dark:text-primary-400'
  if (isNext) return 'font-semibold text-gray-900 dark:text-gray-100'
  return 'text-gray-600 dark:text-gray-300'
}
</script>
