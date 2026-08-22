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
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">RHAI Sustaining (CVEs)</h2>
        <p v-if="data?.lastRefreshed" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Last refreshed: {{ formatDate(data.lastRefreshed) }}
        </p>
      </div>
      <a
        href="https://drive.google.com/file/d/1af_JSj48byj_Quhw4bVJiO9eJ1pgdjY2/view?usp=drive_link"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-700 hover:bg-primary-100 dark:hover:bg-primary-900/50"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
        Video Demo
      </a>
      <button
        @click="handleRefresh"
        :disabled="refreshing"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors"
        :class="refreshing
          ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'
          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'"
      >
        <RefreshCw :size="14" :class="{ 'animate-spin': refreshing }" />
        {{ refreshing ? 'Refreshing...' : 'Refresh from Jira' }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center items-center py-24">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
      <button @click="handleRefresh" class="mt-2 text-sm text-red-600 dark:text-red-400 underline hover:no-underline">
        Try refreshing from Jira
      </button>
    </div>

    <!-- Empty state -->
    <div v-else-if="!data" class="text-center py-24">
      <Shield :size="48" class="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
      <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No CVE data yet</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Click "Refresh from Jira" to load CVE sustaining data.</p>
      <button
        @click="handleRefresh"
        :disabled="refreshing"
        class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm"
      >
        {{ refreshing ? 'Loading...' : 'Refresh from Jira' }}
      </button>
    </div>

    <!-- Data -->
    <div v-else class="space-y-6">
      <!-- Filter bar -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-3">
        <ReportFilterNarrative
          :filters="filters"
          no-filter-text="Showing all open CVEs."
          filter-prefix="Showing open CVEs filtered by"
        />
      </div>

      <!-- Total count banner -->
      <div class="bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-700 dark:to-orange-700 rounded-lg px-6 py-4 text-white shadow">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs font-semibold uppercase tracking-widest text-red-200">Open CVEs{{ filters.hasActiveFilters.value ? ' (filtered)' : '' }}</p>
            <a :href="agg.totalOpen_jql.value" target="_blank" rel="noopener noreferrer"
              class="text-3xl font-extrabold hover:underline decoration-dotted cursor-pointer inline-flex items-center gap-1.5"
              title="View open CVEs in Jira">
              {{ agg.totalOpen.value.toLocaleString() }}
              <svg class="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          </div>
          <div class="text-right">
            <p class="text-xs font-semibold uppercase tracking-widest text-red-200">Total (all statuses)</p>
            <a :href="data.totalAll_jql" target="_blank" rel="noopener noreferrer"
              class="text-3xl font-extrabold hover:underline decoration-dotted cursor-pointer inline-flex items-center gap-1.5"
              title="View all CVEs in Jira">
              {{ data.totalAll.toLocaleString() }}
              <svg class="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          </div>
        </div>
      </div>

      <!-- SLA Compliance (quarter-over-quarter) -->
      <section v-if="slaQuarters.length" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div class="mb-4">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">CVE SLA Compliance</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Resolved on or before due date. Only CVEs with both a due date and resolution date are evaluated.</p>
        </div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <a v-for="(q, idx) in slaQuarters" :key="q.label"
            :href="q.total_jql" target="_blank" rel="noopener noreferrer"
            class="rounded-lg border hover:shadow-md transition-shadow cursor-pointer flex overflow-hidden"
            :class="slaCardClasses(q.pct)"
            :title="`${q.label}: ${q.metSla} / ${q.total} CVEs met SLA — click to view in Jira`">
            <div class="flex items-center justify-center px-3 bg-black/5 dark:bg-white/5 border-r border-current/10 min-w-[60px]">
              <p class="text-xs font-bold uppercase tracking-wide opacity-70 text-center leading-tight">{{ q.label }}</p>
            </div>
            <div class="flex-1 p-4 text-center">
              <p class="text-3xl font-extrabold">{{ q.pct }}%</p>
              <div v-if="idx === slaQuarters.length - 1 && slaQuarters.length >= 2" class="mt-0.5">
                <span class="text-[10px] font-semibold" :class="slaDeltaClass">
                  {{ slaDelta > 0 ? '+' : '' }}{{ slaDelta }}pp {{ slaDelta >= 0 ? '&#9650;' : '&#9660;' }}
                </span>
              </div>
              <p class="text-xs mt-1 opacity-60">{{ q.metSla }} / {{ q.total }} met SLA</p>
            </div>
          </a>
        </div>
      </section>

      <!-- Fix Availability at Release -->
      <section v-if="fixAvail.metrics" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Summary Metrics</h3>
          <select v-if="fixAvail.releases?.length > 1" v-model="fixAvailRelease"
            class="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500">
            <option v-for="r in fixAvail.releases" :key="r" :value="r">{{ r }}</option>
          </select>
        </div>

        <!--  Summary Metrics cards -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div v-for="card in summaryMetricCards" :key="card.label" class="border-l-4 border-l-red-500 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div class="flex items-center gap-1.5 mb-2">
              <span class="text-xs font-medium text-gray-600 dark:text-gray-400">{{ card.label }}</span>
              <span class="relative group">
                <HelpCircle :size="13" class="text-gray-400 dark:text-gray-500 cursor-help" />
                <span class="absolute bottom-full left-0 mb-1.5 w-64 p-2 text-[10px] text-white bg-gray-900 dark:bg-gray-700 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  {{ card.tooltip }}
                </span>
              </span>
            </div>
            <p class="text-3xl font-extrabold text-gray-900 dark:text-gray-100">{{ card.value }}</p>
          </div>
        </div>

        <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-5 mb-3">Fix Availability at Release</h4>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="border-l-4 border-l-red-500 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div class="flex items-center gap-1.5 mb-2">
              <span class="text-xs font-medium text-gray-600 dark:text-gray-400">% CVEs with No Fix at Release</span>
              <span class="relative group">
                <HelpCircle :size="13" class="text-gray-400 dark:text-gray-500 cursor-help" />
                <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-64 p-2 text-[10px] text-white bg-gray-900 dark:bg-gray-700 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  Percentage of CVEs (discovered at or before release) where no fix existed at release date (FIX_DATE &gt; RELEASE_DATE, NO-RH-VEX, or NOT-FOUND in FIX_DATE field)
                </span>
              </span>
            </div>
            <p class="text-3xl font-extrabold text-gray-900 dark:text-gray-100">{{ fixAvail.metrics.pctNoFix }}%</p>
            <div class="mt-2 h-1.5 rounded-full overflow-hidden flex bg-gray-200 dark:bg-gray-600">
              <div class="bg-blue-500 rounded-full" :style="{ width: fixAvail.metrics.pctNoFix + '%' }"></div>
              <div class="bg-red-400 flex-1"></div>
            </div>
          </div>
          <div class="border-l-4 border-l-red-500 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div class="flex items-center gap-1.5 mb-2">
              <span class="text-xs font-medium text-gray-600 dark:text-gray-400">% CVEs with Fix at Release</span>
              <span class="relative group">
                <HelpCircle :size="13" class="text-gray-400 dark:text-gray-500 cursor-help" />
                <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-64 p-2 text-[10px] text-white bg-gray-900 dark:bg-gray-700 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  Percentage of CVEs (discovered at or before release) where a fix already existed at release date (FIX_DATE &le; RELEASE_DATE). A fix is available but may or may not be available through Red Hat.
                </span>
              </span>
            </div>
            <p class="text-3xl font-extrabold text-gray-900 dark:text-gray-100">{{ fixAvail.metrics.pctWithFix }}%</p>
            <div class="mt-2 h-1.5 rounded-full overflow-hidden flex bg-gray-200 dark:bg-gray-600">
              <div class="bg-blue-500 rounded-full" :style="{ width: fixAvail.metrics.pctWithFix + '%' }"></div>
              <div class="bg-red-400 flex-1"></div>
            </div>
          </div>
          <div class="border-l-4 border-l-red-500 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div class="flex items-center gap-1.5 mb-2">
              <span class="text-xs font-medium text-gray-600 dark:text-gray-400">% with RH Fix Version</span>
              <span class="relative group">
                <HelpCircle :size="13" class="text-gray-400 dark:text-gray-500 cursor-help" />
                <span class="absolute bottom-full right-0 mb-1.5 w-72 p-2 text-[10px] text-white bg-gray-900 dark:bg-gray-700 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  Of CVEs with fix at release, this percentage has the fix-version field populated in VEX data, indicating Red Hat tracked a specific package version containing the fix.
                </span>
              </span>
            </div>
            <p class="text-3xl font-extrabold text-gray-900 dark:text-gray-100">{{ fixAvail.metrics.pctFixVersion }}%</p>
            <div class="mt-2 h-1.5 rounded-full overflow-hidden flex bg-gray-200 dark:bg-gray-600">
              <div class="bg-blue-500 rounded-full" :style="{ width: fixAvail.metrics.pctFixVersion + '%' }"></div>
              <div class="bg-red-400 flex-1"></div>
            </div>
          </div>
        </div>

        <p class="text-xs text-gray-400 dark:text-gray-500 mt-3 text-right">
          {{ fixAvail.metrics.totalCves.toLocaleString() }} CVEs evaluated &middot; Release {{ fixAvail.selected }}
        </p>
      </section>

      <!-- 2. CVEs by Due Date -->
      <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">CVEs by Due Date</h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button v-for="bucket in dueDateBuckets" :key="bucket.key"
            class="rounded-lg border p-4 text-center hover:shadow-md transition-shadow cursor-pointer block w-full" :class="bucket.classes"
            :title="`${bucket.label}: ${bucket.count} issues — click to view list`"
            @click="drillDownByDueDate(bucket.key, bucket.label, bucket.jql)">
            <p class="text-3xl font-extrabold">{{ bucket.pct }}%</p>
            <p class="text-[10px] font-semibold uppercase tracking-wide mt-1 opacity-80">{{ bucket.label }}</p>
            <p class="text-xs mt-1 opacity-60">{{ bucket.count }} issues</p>
          </button>
        </div>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-3 text-right">
          {{ agg.cvesByDueDate.value.total.toLocaleString() }} issues
        </p>
      </section>

      <!-- 1. RHAI Open CVEs (bar chart) -->
      <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">RHAI Open CVEs</h3>
        <div style="height: 340px;">
          <Bar :data="openCvesChartData" :options="openCvesChartOptions" />
        </div>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">
          Issues by Components &middot; {{ agg.openCvesByComponent.value.length }}
        </p>
      </section>

      <!-- 4. Open RHAI CVEs across all versions (pie) + 6. False Positive by VEX (doughnut) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Open RHAI CVEs across all versions</h3>
          <div style="height: 300px;">
            <Pie :data="versionPieData" :options="versionPieOptions" />
          </div>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">
            {{ agg.totalOpen.value.toLocaleString() }} issues &middot; Issues by Target Version
          </p>
        </section>

        <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            False Positive by VEX Justification
            <span v-if="filters.hasActiveFilters.value" class="text-[10px] font-normal text-gray-400 dark:text-gray-500 ml-1">(all data)</span>
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">All resolved false positives across all statuses</p>
          <div style="height: 380px;">
            <Doughnut :data="vexDoughnutData" :options="vexPieOptions" />
          </div>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">
            {{ data.falsePositivesByVex.total.toLocaleString() }} issues &middot; Issues by VEX Justification
          </p>
        </section>
      </div>

      <!-- 3. CVEs across all versions (table) -->
      <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 overflow-x-auto">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">CVEs across all versions</h3>
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="text-left py-2 pr-3 font-semibold text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-800 z-10">Components</th>
              <th v-for="ver in agg.cvesAcrossVersions.value.versions" :key="ver" class="text-right py-2 px-2 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap cursor-pointer select-none hover:text-gray-900 dark:hover:text-gray-100" @click="toggleVersionTableSort(ver)">
                {{ ver }} <span class="text-[9px] ml-0.5" :class="versionSortIcon(ver).active ? 'text-gray-900 dark:text-gray-100' : 'text-gray-300 dark:text-gray-600'">{{ versionSortIcon(ver).char }}</span>
              </th>
              <th class="text-right py-2 pl-3 font-bold text-gray-900 dark:text-gray-100 cursor-pointer select-none hover:text-primary-600 dark:hover:text-primary-400" @click="toggleVersionTableSort('total')">
                Total <span class="text-[9px] ml-0.5" :class="versionSortIcon('total').active ? 'text-gray-900 dark:text-gray-100' : 'text-gray-300 dark:text-gray-600'">{{ versionSortIcon('total').char }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in sortedVersionTableRows" :key="row.component" class="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
              <td class="py-1.5 pr-3 text-gray-800 dark:text-gray-200 sticky left-0 bg-white dark:bg-gray-800 z-10">{{ row.component }}</td>
              <td v-for="ver in agg.cvesAcrossVersions.value.versions" :key="ver" class="text-right py-1.5 px-2 tabular-nums">
                <button v-if="row.cells[ver]" class="font-semibold text-blue-600 dark:text-blue-400 underline decoration-dotted hover:decoration-solid cursor-pointer" @click="drillDownByMatrixCell(row.component, ver, row.cellJqls[ver])">{{ row.cells[ver] }}</button>
                <span v-else class="text-gray-400 dark:text-gray-500">0</span>
              </td>
              <td class="text-right py-1.5 pl-3 font-bold tabular-nums">
                <button v-if="row.total" class="font-semibold text-blue-600 dark:text-blue-400 underline decoration-dotted hover:decoration-solid cursor-pointer" @click="drillDownByMatrixRow(row.component, row.total_jql)">{{ row.total }}</button>
                <span v-else class="font-semibold text-gray-600 dark:text-gray-400">0</span>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t-2 border-gray-300 dark:border-gray-600">
              <td class="py-2 pr-3 font-bold text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-800 z-10">Total</td>
              <td v-for="ver in agg.cvesAcrossVersions.value.versions" :key="ver" class="text-right py-2 px-2 font-bold tabular-nums">
                <button v-if="agg.cvesAcrossVersions.value.columnTotals[ver]" class="font-semibold text-blue-600 dark:text-blue-400 underline decoration-dotted hover:decoration-solid cursor-pointer" @click="drillDownByMatrixColumn(ver, agg.cvesAcrossVersions.value.columnJqls[ver])">{{ agg.cvesAcrossVersions.value.columnTotals[ver] }}</button>
                <span v-else class="font-semibold text-gray-600 dark:text-gray-400">0</span>
              </td>
              <td class="text-right py-2 pl-3 font-bold tabular-nums">
                <button v-if="agg.cvesAcrossVersions.value.grandTotal" class="font-semibold text-blue-600 dark:text-blue-400 underline decoration-dotted hover:decoration-solid cursor-pointer" @click="openDrillDown('All CVEs', filteredIssues, agg.cvesAcrossVersions.value.grandTotal_jql)">{{ agg.cvesAcrossVersions.value.grandTotal }}</button>
                <span v-else class="font-semibold text-gray-600 dark:text-gray-400">0</span>
              </td>
            </tr>
          </tfoot>
        </table>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-3 text-right">
          Issues by Target Version &middot; {{ agg.cvesAcrossVersions.value.versions.length }} versions &middot; Components {{ agg.cvesAcrossVersions.value.rows.length }}
        </p>
      </section>

      <!-- 5. CVEs by RHAI Sustaining (assignee x status table) -->
      <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 overflow-x-auto">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">CVEs by Assignee</h3>
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="text-left py-2 pr-3 font-semibold text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-800 z-10">Status</th>
              <th v-for="a in agg.cvesByAssigneeStatus.value.assignees" :key="a" class="text-right py-2 px-2 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">{{ a }}</th>
              <th class="text-right py-2 pl-3 font-bold text-gray-900 dark:text-gray-100">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in agg.cvesByAssigneeStatus.value.rows" :key="row.status" class="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
              <td class="py-1.5 pr-3 sticky left-0 bg-white dark:bg-gray-800 z-10">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide" :class="statusBadgeClass(row.status)">
                  {{ row.status }}
                </span>
              </td>
              <td v-for="a in agg.cvesByAssigneeStatus.value.assignees" :key="a" class="text-right py-1.5 px-2 tabular-nums">
                <button v-if="row.cells[a]" class="font-semibold text-blue-600 dark:text-blue-400 underline decoration-dotted hover:decoration-solid cursor-pointer" @click="drillDownByAssigneeStatus(row.status, a, row.cellJqls[a])">{{ row.cells[a] }}</button>
                <span v-else class="text-gray-400 dark:text-gray-500">0</span>
              </td>
              <td class="text-right py-1.5 pl-3 font-bold tabular-nums">
                <button v-if="row.total" class="font-semibold text-blue-600 dark:text-blue-400 underline decoration-dotted hover:decoration-solid cursor-pointer" @click="drillDownByStatus(row.status, row.total_jql)">{{ row.total }}</button>
                <span v-else class="font-semibold text-gray-600 dark:text-gray-400">0</span>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t-2 border-gray-300 dark:border-gray-600">
              <td class="py-2 pr-3 font-bold text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-800 z-10">Total</td>
              <td v-for="a in agg.cvesByAssigneeStatus.value.assignees" :key="a" class="text-right py-2 px-2 font-bold tabular-nums">
                <button v-if="agg.cvesByAssigneeStatus.value.columnTotals[a]" class="font-semibold text-blue-600 dark:text-blue-400 underline decoration-dotted hover:decoration-solid cursor-pointer" @click="drillDownByAssignee(a, agg.cvesByAssigneeStatus.value.columnJqls[a])">{{ agg.cvesByAssigneeStatus.value.columnTotals[a] }}</button>
                <span v-else class="font-semibold text-gray-600 dark:text-gray-400">0</span>
              </td>
              <td class="text-right py-2 pl-3 font-bold tabular-nums">
                <button v-if="agg.cvesByAssigneeStatus.value.grandTotal" class="font-semibold text-blue-600 dark:text-blue-400 underline decoration-dotted hover:decoration-solid cursor-pointer" @click="openDrillDown('All CVEs', filteredIssues, agg.cvesByAssigneeStatus.value.grandTotal_jql)">{{ agg.cvesByAssigneeStatus.value.grandTotal }}</button>
                <span v-else class="font-semibold text-gray-600 dark:text-gray-400">0</span>
              </td>
            </tr>
          </tfoot>
        </table>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-3 text-right">
          {{ agg.cvesByAssigneeStatus.value.grandTotal }} issues &middot; Issues by Assignee + Status
        </p>
      </section>

      <!-- 7. Created vs Resolved (line chart) -->
      <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Created vs Resolved Chart around CVEs
          <span v-if="filters.hasActiveFilters.value" class="text-[10px] font-normal text-gray-400 dark:text-gray-500 ml-1">(all data)</span>
        </h3>
        <div style="height: 300px;">
          <Line :data="createdVsResolvedData" :options="createdResolvedOptions" />
        </div>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">
          Time (24 weeks) &middot; Created / Resolved
        </p>
      </section>

      <!-- 8. Unresolved (line chart) -->
      <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Unresolved
          <span v-if="filters.hasActiveFilters.value" class="text-[10px] font-normal text-gray-400 dark:text-gray-500 ml-1">(all data)</span>
        </h3>
        <div style="height: 300px;">
          <Line :data="unresolvedData" :options="unresolvedOptions" />
        </div>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">
          Time series &middot; 24 weeks &middot; Unresolved
        </p>
      </section>

      <!-- 9. RHAI False Positives (multi-series line) -->
      <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
          RHAI False Positives
          <span v-if="filters.hasActiveFilters.value" class="text-[10px] font-normal text-gray-400 dark:text-gray-500 ml-1">(all data)</span>
        </h3>
        <div style="height: 300px;">
          <Line :data="falsePositivesTrendData" :options="falsePositivesOptions" />
        </div>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">
          Created (6 months) &middot; Time series
        </p>
      </section>
    </div>

    <!-- Filter modal -->
    <ReportFilterModal :filters="filters" :available-filter-values="availableFilterValues" />

    <!-- Issue list drill-down modal -->
    <CveIssueListModal
      :visible="drillDown.visible"
      :title="drillDown.title"
      :issues="drillDown.issues"
      :jql="drillDown.jql"
      :dot-color="drillDown.dotColor"
      @close="closeDrillDown"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject, watch } from 'vue'
import { ArrowLeft, RefreshCw, Shield, HelpCircle } from 'lucide-vue-next'
import { Bar, Pie, Doughnut, Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js'
import { useCveSustaining } from './composables/useCveSustaining'
import { useReportFilters } from './composables/useReportFilters.js'
import { useCveAggregation } from './composables/useCveAggregation.js'
import ReportFilterModal from './components/ReportFilterModal.vue'
import ReportFilterNarrative from './components/ReportFilterNarrative.vue'
import CveIssueListModal from './components/CveIssueListModal.vue'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Filler, Tooltip, Legend)

const nav = inject('moduleNav')
const { data, loading, error, refreshing, loadData, refresh } = useCveSustaining()

// ─── Filters ──────────────────────────────────────────────────────────────────

const CVE_FILTER_FIELDS = [
  { key: 'component', label: 'Component' },
  { key: 'versions', label: 'Target Version' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'status', label: 'Status' }
]

const filters = useReportFilters({
  storageKeyPrefix: 'cve-sustaining',
  filterFields: CVE_FILTER_FIELDS
})

const openIssueRecords = computed(() => data.value?.openIssueRecords || [])
const jiraSearchBase = computed(() => data.value?.jiraSearchBase || '')

const filteredIssues = computed(() => filters.filterItems(openIssueRecords.value))

const agg = useCveAggregation(filteredIssues, jiraSearchBase, filters.activeFilterDisplay)

const availableFilterValues = computed(() => {
  const issues = openIssueRecords.value
  if (issues.length === 0) return {}
  return {
    component: [...new Set(issues.map(i => i.component))].sort(),
    versions: [...new Set(issues.flatMap(i => i.versions))].sort(),
    assignee: [...new Set(issues.map(i => i.assignee))].sort(),
    status: [...new Set(issues.map(i => i.status))].sort()
  }
})

// ─── Drill-down modal ─────────────────────────────────────────────────────────

const drillDown = ref({ visible: false, title: '', issues: [], jql: '', dotColor: '' })

function openDrillDown(title, issues, jql, dotColor) {
  drillDown.value = { visible: true, title, issues, jql: jql || '', dotColor: dotColor || '' }
}

function closeDrillDown() {
  drillDown.value = { visible: false, title: '', issues: [], jql: '', dotColor: '' }
}

function drillDownByComponent(componentName) {
  const issues = filteredIssues.value.filter(i => i.component === componentName || (componentName === 'None' && i.component === 'None'))
  const item = agg.openCvesByComponent.value.find(c => c.component === componentName)
  openDrillDown(componentName, issues, item?.jql)
}

function drillDownByVersion(versionName) {
  const issues = filteredIssues.value.filter(i => i.versions.includes(versionName) || (versionName === 'None' && i.versions.includes('None')))
  const item = agg.openCvesByVersion.value.find(v => v.version === versionName)
  openDrillDown(versionName, issues, item?.jql)
}

function drillDownByDueDate(bucketKey, label, jql) {
  const now = new Date()
  const issues = filteredIssues.value.filter(i => {
    if (!i.duedate) return bucketKey === 'none'
    const due = new Date(i.duedate)
    const diffDays = Math.floor((due - now) / (1000 * 60 * 60 * 24))
    if (bucketKey === 'passed') return diffDays < 0
    if (bucketKey === 'lt30') return diffDays >= 0 && diffDays < 30
    if (bucketKey === '30-90') return diffDays >= 30 && diffDays <= 90
    if (bucketKey === 'gt90') return diffDays > 90
    return false
  })
  openDrillDown(label, issues, jql)
}

function drillDownByMatrixCell(componentName, versionName, jql) {
  const issues = filteredIssues.value.filter(i =>
    i.components.includes(componentName) && i.versions.includes(versionName)
  )
  openDrillDown(`${componentName} / ${versionName}`, issues, jql)
}

function drillDownByMatrixRow(componentName, jql) {
  const issues = filteredIssues.value.filter(i => i.components.includes(componentName))
  openDrillDown(componentName, issues, jql)
}

function drillDownByMatrixColumn(versionName, jql) {
  const issues = filteredIssues.value.filter(i => i.versions.includes(versionName))
  openDrillDown(versionName, issues, jql)
}

function drillDownByAssigneeStatus(status, assignee, jql) {
  const issues = filteredIssues.value.filter(i => i.status === status && i.assignee === assignee)
  openDrillDown(`${status} / ${assignee}`, issues, jql)
}

function drillDownByStatus(status, jql) {
  const issues = filteredIssues.value.filter(i => i.status === status)
  openDrillDown(status, issues, jql)
}

function drillDownByAssignee(assignee, jql) {
  const issues = filteredIssues.value.filter(i => i.assignee === assignee)
  openDrillDown(assignee, issues, jql)
}

function handleEscape(e) {
  if (e.key !== 'Escape') return
  if (filters.filterModalOpen.value) { filters.closeFilterModal(); return }
  if (drillDown.value.visible) closeDrillDown()
}

onMounted(() => document.addEventListener('keydown', handleEscape))
onUnmounted(() => document.removeEventListener('keydown', handleEscape))

// ─── Navigation & data ────────────────────────────────────────────────────────

function goBack() {
  nav.navigateTo('reports')
}

async function handleRefresh() {
  await refresh()
}

onMounted(() => {
  loadData()
  loadFixAvailability()
})

// ─── Fix Availability at Release ──────────────────────────────────────────────

const fixAvail = ref({ releases: [], selected: null, metrics: null })
const fixAvailRelease = ref(null)

async function loadFixAvailability(release) {
  try {
    const qs = release ? `?release=${encodeURIComponent(release)}` : ''
    const res = await fetch(`/api/modules/releases/cve-sustaining/fix-availability${qs}`)
    if (!res.ok) return
    const payload = await res.json()
    fixAvail.value = payload
    if (!fixAvailRelease.value && payload.selected) fixAvailRelease.value = payload.selected
  } catch { /* no data available */ }
}

watch(fixAvailRelease, (newVal, oldVal) => {
  if (newVal && oldVal && newVal !== oldVal) loadFixAvailability(newVal)
})

const summaryMetricCards = computed(() => {
  const m = fixAvail.value?.metrics
  if (!m) return []
  return [
    { label: 'Total CVEs at Release', value: (m.totalCves || 0).toLocaleString(), tooltip: 'Total CVE rows discovered at or before the release date, matching any active filters.' },
    { label: 'CVEs with Fix Available at Release', value: (m.cvesWithFixAtRelease || 0).toLocaleString(), tooltip: 'CVEs where a fix already existed at release date (FIX_DATE ≤ RELEASE_DATE). Fix may be upstream or in other ecosystems.' },
    { label: 'Unique CVEs', value: (m.uniqueCves || 0).toLocaleString(), tooltip: 'Distinct CVE IDs discovered at or before release. A single CVE can appear in multiple containers/packages.' },
    { label: 'Number of Containers with CVEs', value: (m.containersWithCves || 0).toLocaleString(), tooltip: 'Unique containers (by SHA) that have at least one CVE discovered at or before release.' },
    { label: 'Avg CVEs per Container', value: (m.avgCvesPerContainer || 0).toLocaleString(), tooltip: 'Average number of CVEs per container (total CVEs / unique containers).' },
    { label: 'Container Freshness Score', value: (m.freshnessScore || 0) + '%', tooltip: 'Percentage of containers built within 30 days of the release date. Higher is better — indicates containers are up to date at release.' }
  ]
})

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

// ─── CVEs across versions table sort ─────────────────────────────────────────

const versionTableSort = ref({ column: 'component', direction: 'asc' })

function toggleVersionTableSort(column) {
  if (versionTableSort.value.column === column) {
    versionTableSort.value.direction = versionTableSort.value.direction === 'asc' ? 'desc' : 'asc'
  } else {
    versionTableSort.value = { column, direction: 'desc' }
  }
}

function versionSortIcon(column) {
  if (versionTableSort.value.column !== column) return { char: '▲▼', active: false }
  return { char: versionTableSort.value.direction === 'asc' ? '▲' : '▼', active: true }
}

const sortedVersionTableRows = computed(() => {
  const raw = agg.cvesAcrossVersions.value.rows
  if (!raw || !raw.length) return []
  const col = versionTableSort.value.column
  const dir = versionTableSort.value.direction === 'asc' ? 1 : -1
  return [...raw].sort((a, b) => {
    if (col === 'component') return dir * a.component.localeCompare(b.component)
    if (col === 'total') return dir * (a.total - b.total)
    return dir * ((a.cells[col] || 0) - (b.cells[col] || 0))
  })
})

// ─── Due Date Buckets ────────────────────────────────────────────────────────

const dueDateBuckets = computed(() => {
  const dd = agg.cvesByDueDate.value
  if (!dd) return []
  return [
    { key: 'passed', label: 'Due Date Passed', pct: dd.passed.pct, count: dd.passed.count, jql: dd.passed.jql, classes: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
    { key: 'lt30', label: 'Due Date in Less Than 30 Days', pct: dd.lessThan30.pct, count: dd.lessThan30.count, jql: dd.lessThan30.jql, classes: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' },
    { key: '30-90', label: 'Due Date Between 30 and 90 Days', pct: dd.between30And90.pct, count: dd.between30And90.count, jql: dd.between30And90.jql, classes: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
    { key: 'gt90', label: 'Due Date More Than 90 Days', pct: dd.moreThan90.pct, count: dd.moreThan90.count, jql: dd.moreThan90.jql, classes: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
    { key: 'none', label: 'None (No due date)', pct: dd.none.pct, count: dd.none.count, jql: dd.none.jql, classes: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700' }
  ]
})

// ─── SLA Compliance ──────────────────────────────────────────────────────────

const slaQuarters = computed(() => data.value?.slaCompliance?.quarters || [])

const slaDelta = computed(() => {
  const q = slaQuarters.value
  if (q.length < 2) return 0
  return q[q.length - 1].pct - q[q.length - 2].pct
})

const slaDeltaClass = computed(() => {
  if (slaDelta.value > 0) return 'text-emerald-600 dark:text-emerald-400'
  if (slaDelta.value < 0) return 'text-red-600 dark:text-red-400'
  return 'text-gray-500 dark:text-gray-400'
})

function slaCardClasses(pct) {
  if (pct >= 80) return 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
  if (pct >= 60) return 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
  return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
}

// ─── Chart Colors ────────────────────────────────────────────────────────────

const CHART_COLORS = [
  'rgba(99, 102, 241, 0.8)',
  'rgba(239, 68, 68, 0.8)',
  'rgba(245, 158, 11, 0.8)',
  'rgba(16, 185, 129, 0.8)',
  'rgba(59, 130, 246, 0.8)',
  'rgba(139, 92, 246, 0.8)',
  'rgba(236, 72, 153, 0.8)',
  'rgba(20, 184, 166, 0.8)',
  'rgba(249, 115, 22, 0.8)',
  'rgba(107, 114, 128, 0.8)',
  'rgba(168, 85, 247, 0.8)',
  'rgba(6, 182, 212, 0.8)',
  'rgba(132, 204, 22, 0.8)',
  'rgba(244, 63, 94, 0.8)',
  'rgba(34, 197, 94, 0.8)',
  'rgba(251, 191, 36, 0.8)',
  'rgba(167, 139, 250, 0.8)',
  'rgba(56, 189, 248, 0.8)',
  'rgba(251, 146, 60, 0.8)',
  'rgba(156, 163, 175, 0.8)'
]

// ─── 1. Open CVEs Bar Chart ─────────────────────────────────────────────────

const openCvesChartData = computed(() => {
  const items = agg.openCvesByComponent.value
  const top = items.slice(0, 20)
  return {
    labels: top.map(i => truncateLabel(i.component, 18)),
    datasets: [{
      label: 'Issue Count',
      data: top.map(i => i.count),
      backgroundColor: top.map((_, idx) => CHART_COLORS[idx % CHART_COLORS.length]),
      borderWidth: 0,
      borderRadius: 3
    }]
  }
})

const openCvesChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'x',
  onClick: (_event, elements) => {
    if (elements.length > 0) {
      const idx = elements[0].index
      const items = agg.openCvesByComponent.value
      const item = items[idx]
      if (item) drillDownByComponent(item.component)
    }
  },
  onHover: (event, elements) => {
    event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default'
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const items = agg.openCvesByComponent.value
          const item = items[ctx.dataIndex]
          return item ? `${ctx.raw} issues (${item.pct}%) — click to view list` : `${ctx.raw} issues`
        }
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { color: '#9ca3af', font: { size: 11 } },
      grid: { color: 'rgba(156, 163, 175, 0.15)' },
      title: { display: true, text: 'Issue Count', color: '#9ca3af', font: { size: 11 } }
    },
    x: {
      ticks: { color: '#9ca3af', font: { size: 10 }, maxRotation: 45, minRotation: 30 },
      grid: { display: false }
    }
  }
}))

// ─── 4. Version Pie Chart ────────────────────────────────────────────────────

const versionPieData = computed(() => {
  const items = agg.openCvesByVersion.value
  return {
    labels: items.map(i => `${i.version} (${i.count} / ${i.pct}%)`),
    datasets: [{
      data: items.map(i => i.count),
      backgroundColor: items.map((_, idx) => CHART_COLORS[idx % CHART_COLORS.length]),
      borderWidth: 2,
      borderColor: '#fff'
    }]
  }
})

// ─── 6. VEX Justification Doughnut (unfiltered — uses allIssues data) ──────

const vexDoughnutData = computed(() => {
  const items = data.value?.falsePositivesByVex?.items || []
  return {
    labels: items.map(i => `${i.justification} (${i.count} / ${i.pct}%)`),
    datasets: [{
      data: items.map(i => i.count),
      backgroundColor: items.map((_, idx) => CHART_COLORS[idx % CHART_COLORS.length]),
      borderWidth: 2,
      borderColor: '#fff'
    }]
  }
})

const PIE_LEGEND = {
  display: true,
  position: 'right',
  labels: { padding: 8, font: { size: 10 }, color: '#6b7280', usePointStyle: true, pointStyle: 'circle', boxWidth: 8 }
}

const PIE_LEGEND_BOTTOM = {
  display: true,
  position: 'bottom',
  labels: { padding: 10, font: { size: 11 }, color: '#6b7280', usePointStyle: true, pointStyle: 'circle', boxWidth: 8 }
}

const versionPieOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  onClick: (_event, elements) => {
    if (elements.length > 0) {
      const item = agg.openCvesByVersion.value[elements[0].index]
      if (item) drillDownByVersion(item.version)
    }
  },
  onHover: (event, elements) => { event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default' },
  plugins: {
    legend: PIE_LEGEND,
    tooltip: { callbacks: { label: (ctx) => `${ctx.raw} issues — click to view list` } }
  }
}))

const vexPieOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  onClick: (_event, elements) => {
    if (elements.length > 0) {
      const items = data.value?.falsePositivesByVex?.items || []
      const item = items[elements[0].index]
      if (item?.jql) window.open(item.jql, '_blank', 'noopener,noreferrer')
    }
  },
  onHover: (event, elements) => { event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default' },
  plugins: {
    legend: PIE_LEGEND_BOTTOM,
    tooltip: { callbacks: { label: (ctx) => `${ctx.raw} issues — click to view in Jira` } }
  }
}))

// ─── 7. Created vs Resolved Line Chart (unfiltered) ─────────────────────────

const createdVsResolvedData = computed(() => {
  const series = data.value?.createdVsResolved || []
  return {
    labels: series.map(s => s.label),
    datasets: [
      {
        label: 'Created',
        data: series.map(s => s.created),
        borderColor: 'rgba(239, 68, 68, 1)',
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: 'rgba(239, 68, 68, 1)'
      },
      {
        label: 'Resolved',
        data: series.map(s => s.resolved),
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: 'rgba(34, 197, 94, 1)'
      }
    ]
  }
})

// ─── 8. Unresolved Line Chart (unfiltered) ───────────────────────────────────

const unresolvedData = computed(() => {
  const series = data.value?.unresolved || []
  return {
    labels: series.map(s => s.label),
    datasets: [{
      label: 'Unresolved',
      data: series.map(s => s.unresolved),
      borderColor: 'rgba(59, 130, 246, 1)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointBackgroundColor: 'rgba(59, 130, 246, 1)'
    }]
  }
})

// ─── 9. False Positives Trend (unfiltered) ────────────────────────────────────

const FP_COLORS = {
  'Not a bug': 'rgba(239, 68, 68, 1)',
  'Duplicate': 'rgba(249, 115, 22, 1)',
  "Won't Do": 'rgba(251, 191, 36, 1)',
  'Obsolete': 'rgba(168, 85, 247, 1)',
  "Can't Do": 'rgba(6, 182, 212, 1)'
}

const falsePositivesTrendData = computed(() => {
  const fpData = data.value?.falsePositivesTrend
  if (!fpData) return { labels: [], datasets: [] }

  return {
    labels: fpData.months.map(m => m.label),
    datasets: fpData.resolutionTypes.map(type => ({
      label: type,
      data: fpData.months.map(m => m.series[type] || 0),
      borderColor: FP_COLORS[type] || 'rgba(107, 114, 128, 1)',
      backgroundColor: 'transparent',
      tension: 0.3,
      pointRadius: 3,
      pointBackgroundColor: FP_COLORS[type] || 'rgba(107, 114, 128, 1)'
    }))
  }
})

// ─── Shared Chart Options ───────────────────────────────────────────────────

function makeTimeSeriesOptions(jqlLookup) {
  return computed(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    onClick: (_event, elements) => {
      if (elements.length > 0 && jqlLookup) {
        const el = elements[0]
        const url = jqlLookup(el.datasetIndex, el.index)
        if (url) window.open(url, '_blank', 'noopener,noreferrer')
      }
    },
    onHover: (event, elements) => {
      event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default'
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: { padding: 12, font: { size: 11 }, color: '#6b7280', usePointStyle: true, pointStyle: 'circle' }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: '#9ca3af', font: { size: 11 } },
        grid: { color: 'rgba(156, 163, 175, 0.15)' }
      },
      x: {
        ticks: { color: '#9ca3af', font: { size: 10 }, maxRotation: 45, minRotation: 30 },
        grid: { display: false }
      }
    }
  }))
}

const createdResolvedOptions = makeTimeSeriesOptions((dsIndex, pointIndex) => {
  const series = data.value?.createdVsResolved || []
  const point = series[pointIndex]
  if (!point) return null
  return dsIndex === 0 ? point.created_jql : point.resolved_jql
})

const unresolvedOptions = makeTimeSeriesOptions((_dsIndex, pointIndex) => {
  const series = data.value?.unresolved || []
  return series[pointIndex]?.jql || null
})

const falsePositivesOptions = makeTimeSeriesOptions()

// ─── Helpers ────────────────────────────────────────────────────────────────

function statusBadgeClass(status) {
  const s = (status || '').toUpperCase()
  if (s === 'NEW') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
  if (s === 'IN PROGRESS') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
  if (s === 'REVIEW') return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
  if (s === 'RESOLVED') return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
  if (s === 'CLOSED') return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
}

function truncateLabel(str, max) {
  if (!str || str.length <= max) return str
  return str.slice(0, max) + '...'
}
</script>
