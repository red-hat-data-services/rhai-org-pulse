<template>
  <div>
    <!-- Header -->
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <button
        @click="goBack"
        class="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
        title="Back to Reports"
      >
        <ArrowLeft :size="18" />
      </button>
      <div class="flex-1">
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">RHOAI Component Architectures (Multi-Arch)</h2>
        <p v-if="data?.fetchedAt" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Fetched: {{ formatDate(data.fetchedAt) }}
          <template v-if="sourceUrl">
            &middot;
            <a :href="sourceUrl" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400 hover:underline">
              Source: {{ data.source.owner }}/{{ data.source.repo }}
            </a>
          </template>
        </p>
      </div>
      <div v-if="branchOptions.length > 0" class="flex items-center gap-2">
        <label class="text-sm font-medium text-gray-600 dark:text-gray-400">Branch</label>
        <select
          v-model="selectedBranch"
          class="text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-1"
        >
          <option v-for="b in branchOptions" :key="b" :value="b">{{ b }}</option>
        </select>
      </div>
      <a
        href="https://gitlab.cee.redhat.com/data-hub/component-maturity/-/blob/main/src/references/multi-arch.md"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
        title="Multi-arch guidance documentation"
      >
        <BookOpen :size="14" />
        Guidance: multi-arch
      </a>
      <a
        href="#/system-health/component-maturity"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
        title="Component Maturity — Multi-architecture builds configured"
      >
        <Cpu :size="14" />
        Maturity
      </a>
      <a
        href="https://github.com/red-hat-data-services/konflux-central/blob/main/script/multi-arch-tracking/exceptions.toml"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <FileCode :size="14" />
        Exceptions
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
        {{ refreshing ? 'Refreshing...' : 'Refresh' }}
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
        Try refreshing
      </button>
    </div>

    <!-- Empty state -->
    <div v-else-if="!data" class="text-center py-24">
      <Cpu :size="48" class="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
      <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No architecture data yet</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Click "Refresh" to fetch component architecture data from GitHub.</p>
      <button
        @click="handleRefresh"
        :disabled="refreshing"
        class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm"
      >
        {{ refreshing ? 'Loading...' : 'Refresh' }}
      </button>
    </div>

    <!-- Data -->
    <div v-else class="space-y-6">
      <!-- Maturity warning banner -->
      <div v-if="data.maturity?.warning" class="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
        <AlertTriangle :size="14" class="flex-shrink-0" />
        <span>{{ data.maturity.warning }}</span>
        <span v-if="data.maturity.fetchedAt" class="text-amber-500 dark:text-amber-400">&middot; Last mapping: {{ formatDate(data.maturity.fetchedAt) }}</span>
      </div>

      <!-- No report for this branch -->
      <div v-if="currentBranchData && currentBranchData.reportAvailable === false" class="text-center py-16">
        <Cpu :size="40" class="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
        <h3 class="text-base font-medium text-gray-700 dark:text-gray-300 mb-1">No multi-arch report for {{ selectedBranch }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          The <code class="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">multi-arch-report.yaml</code> file has not been generated for this branch yet.
        </p>
      </div>

      <!-- Summary cards -->
      <div v-if="summary" class="grid grid-cols-2 lg:grid-cols-5 xl:grid-cols-7 gap-3">
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center flex flex-col justify-between">
          <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 h-8 flex items-center justify-center">Total Components</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ summary.totalComponents }}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800 p-4 text-center flex flex-col justify-between">
          <p class="text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400 h-8 flex items-center justify-center">Built on All Arches</p>
          <p class="text-2xl font-bold text-green-700 dark:text-green-300">{{ summary.fullMultiArch }}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-amber-800 p-4 text-center flex flex-col justify-between">
          <p class="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 h-8 flex items-center justify-center">Arch Exceptions</p>
          <p class="text-2xl font-bold text-amber-700 dark:text-amber-300">{{ summary.withExceptions }}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center flex flex-col justify-between">
          <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 h-8 flex items-center justify-center">Incompatible Arches</p>
          <p class="text-2xl font-bold text-gray-600 dark:text-gray-400">{{ summary.withIncompatible }}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 p-4 text-center flex flex-col justify-between">
          <p class="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 h-8 flex items-center justify-center">Missing Arches</p>
          <p class="text-2xl font-bold text-red-700 dark:text-red-300">{{ summary.withNotBuilt }}</p>
        </div>
        <div v-if="hasMaturityData" role="link" tabindex="0"
           @click="scrollToSection('not-found-in-konflux')" @keydown.enter="scrollToSection('not-found-in-konflux')"
           class="bg-white dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-amber-800 p-4 text-center flex flex-col justify-between hover:shadow-md transition-shadow cursor-pointer">
          <p class="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 h-8 flex items-center justify-center">Missing in Konflux</p>
          <p class="text-2xl font-bold text-amber-700 dark:text-amber-300">{{ emptyProductComponentCount }}</p>
        </div>
        <div v-if="hasMaturityData" role="link" tabindex="0"
           @click="scrollToSection('unknown-product-component')" @keydown.enter="scrollToSection('unknown-product-component')"
           class="bg-white dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-amber-800 p-4 text-center flex flex-col justify-between hover:shadow-md transition-shadow cursor-pointer">
          <p class="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 h-8 flex items-center justify-center">Unknown Product Component</p>
          <p class="text-2xl font-bold text-amber-700 dark:text-amber-300">{{ unmappedCount }}</p>
        </div>
      </div>

      <!-- Search bar -->
      <div v-if="currentBranchData?.reportAvailable !== false" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-3 flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search :size="14" class="text-gray-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Filter components or product components..."
            class="text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-1 flex-1"
          />
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ filteredComponents.length }} of {{ currentBranchData?.components?.length || 0 }} components
        </p>
      </div>

      <!-- Legend + Architecture matrix table -->
      <div v-if="currentBranchData?.reportAvailable !== false">
        <div class="px-4 pb-2 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-1.5">
          <span class="flex items-center gap-1">
            <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400"><Check :size="12" /></span>
            Supported
          </span>
          <span class="text-gray-300 dark:text-gray-600">|</span>
          <span class="flex items-center gap-1">
            <span class="text-xs font-medium text-gray-400 dark:text-gray-500">N/A</span>
            Incompatible
          </span>
          <span class="text-gray-300 dark:text-gray-600">|</span>
          <span class="flex items-center gap-1">
            <span class="text-xs font-medium text-amber-600 dark:text-amber-400">JIRA-123</span>
            Exception (tracked)
          </span>
          <span class="text-gray-300 dark:text-gray-600">|</span>
          <span class="flex items-center gap-1">
            <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400"><Minus :size="12" /></span>
            Not built
          </span>
          <span class="text-gray-300 dark:text-gray-600">|</span>
          <span class="flex items-center gap-1">
            <Package :size="12" class="text-gray-400" />
            Quay.io image
          </span>
          <span class="text-gray-300 dark:text-gray-600">|</span>
          <span class="flex items-center gap-1">
            <FileCode :size="12" class="text-gray-400" />
            Konflux PipelineRun config
          </span>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-900/80">
                <th v-if="hasMaturityData" class="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 sticky left-0 bg-gray-200 dark:bg-gray-900/80 z-20 min-w-[160px]">
                  Product Component
                </th>
                <th class="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 z-10" :class="hasMaturityData ? 'sticky left-[160px] bg-gray-200 dark:bg-gray-900/80' : 'sticky left-0 bg-gray-200 dark:bg-gray-900/80'">
                  <a v-if="hasMaturityData" href="https://github.com/red-hat-data-services/konflux-central" target="_blank" rel="noopener noreferrer"
                     class="text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:underline">
                    Component Image
                  </a>
                  <span v-else>Component Image</span>
                </th>
                <th v-for="arch in ARCHS" :key="arch" class="text-center px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 w-28">{{ arch }}</th>
              </tr>
            </thead>
            <tbody>
              <template v-if="hasMaturityData">
                <template v-for="(group, groupIdx) in displayGroups" :key="group.name">
                    <tr
                      v-for="(comp, compIdx) in group.components"
                      :key="comp.name"
                      :class="[
                        compIdx === 0 ? 'border-t-2 border-gray-300 dark:border-gray-600' : 'border-b border-gray-100 dark:border-gray-700/50',
                        groupIdx % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-800/30' : 'bg-white dark:bg-gray-800',
                        'hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors'
                      ]"
                    >
                      <!-- Product Component cell (first row only) -->
                      <td
                        v-if="compIdx === 0"
                        :rowspan="group.components.length"
                        class="px-4 py-2.5 align-top sticky left-0 z-20 border-r border-gray-200 dark:border-gray-700"
                        :style="{ backgroundColor: 'inherit' }"
                      >
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ group.name }}</span>
                          <a
                            :href="jiraSearchUrl(group.name)"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                            title="Search JIRA issues for this component"
                          >JIRA</a>
                          <a
                            href="#/system-health/component-maturity"
                            class="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                            title="Component Maturity (in-app)"
                          >Maturity</a>
                          <a
                            href="https://data-hub.pages.redhat.com/component-maturity/"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-gray-400 hover:text-primary-500 dark:text-gray-500 dark:hover:text-primary-400"
                            title="Component Maturity (GitLab Pages)"
                          ><ExternalLink :size="10" /></a>
                        </div>
                      </td>

                      <!-- Component cell -->
                      <td class="px-4 py-2.5 z-10" :class="hasMaturityData ? 'sticky left-[160px]' : 'sticky left-0'" :style="{ backgroundColor: 'inherit' }">
                        <div class="flex items-center gap-2">
                          <span class="font-medium text-gray-900 dark:text-gray-100">{{ comp.name }}</span>
                          <a
                            v-if="comp.image"
                            :href="quayUrl(comp.image)"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-gray-400 hover:text-primary-500 dark:text-gray-500 dark:hover:text-primary-400 transition-colors"
                            :title="`View ${comp.image} on Quay.io`"
                          >
                            <Package :size="14" />
                          </a>
                          <a
                            v-if="comp.pipelineRunFile"
                            :href="pipelineRunUrl(comp)"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-gray-400 hover:text-primary-500 dark:text-gray-500 dark:hover:text-primary-400 transition-colors"
                            title="View Konflux PipelineRun config in konflux-central"
                          >
                            <FileCode :size="14" />
                          </a>
                        </div>
                      </td>

                      <!-- Architecture cells -->
                      <td
                        v-for="arch in ARCHS"
                        :key="arch"
                        class="text-center px-4 py-2.5"
                      >
                        <span v-if="comp.architectures[arch]?.status === 'supported'" class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400" title="Supported">
                          <Check :size="14" />
                        </span>
                        <span v-else-if="comp.architectures[arch]?.status === 'incompatible'" class="text-xs font-medium text-gray-400 dark:text-gray-500" :title="'Incompatible: ' + (comp.architectures[arch]?.accelerator || 'N/A')">
                          N/A
                        </span>
                        <a
                          v-else-if="comp.architectures[arch]?.status === 'exception'"
                          :href="comp.architectures[arch]?.issueUrl || '#'"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
                          :title="comp.architectures[arch]?.reason || 'Exception'"
                        >
                          {{ comp.architectures[arch]?.issueKey || 'EXC' }}
                        </a>
                        <span v-else-if="comp.architectures[arch]?.status === 'not_built'" class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400" title="Not built for this architecture">
                          <Minus :size="14" />
                        </span>
                        <span v-else class="text-gray-300 dark:text-gray-600">&mdash;</span>
                      </td>
                    </tr>
                </template>
              </template>

              <!-- Flat table (no maturity data) -->
              <template v-else>
                <tr
                  v-for="comp in filteredComponents"
                  :key="comp.name"
                  class="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors"
                >
                  <td class="px-4 py-2.5 sticky left-0 z-10" :style="{ backgroundColor: 'inherit' }">
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-gray-900 dark:text-gray-100">{{ comp.name }}</span>
                      <a
                        v-if="comp.image"
                        :href="quayUrl(comp.image)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-gray-400 hover:text-primary-500 dark:text-gray-500 dark:hover:text-primary-400 transition-colors"
                        :title="`View ${comp.image} on Quay.io`"
                      >
                        <Package :size="14" />
                      </a>
                      <a
                        v-if="comp.pipelineRunFile"
                        :href="pipelineRunUrl(comp)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-gray-400 hover:text-primary-500 dark:text-gray-500 dark:hover:text-primary-400 transition-colors"
                        title="View Konflux PipelineRun config in konflux-central"
                      >
                        <FileCode :size="14" />
                      </a>
                    </div>
                  </td>
                  <td
                    v-for="arch in ARCHS"
                    :key="arch"
                    class="text-center px-4 py-2.5"
                  >
                    <span v-if="comp.architectures[arch]?.status === 'supported'" class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400" title="Supported">
                      <Check :size="14" />
                    </span>
                    <span v-else-if="comp.architectures[arch]?.status === 'incompatible'" class="text-xs font-medium text-gray-400 dark:text-gray-500" :title="'Incompatible: ' + (comp.architectures[arch]?.accelerator || 'N/A')">
                      N/A
                    </span>
                    <a
                      v-else-if="comp.architectures[arch]?.status === 'exception'"
                      :href="comp.architectures[arch]?.issueUrl || '#'"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
                      :title="comp.architectures[arch]?.reason || 'Exception'"
                    >
                      {{ comp.architectures[arch]?.issueKey || 'EXC' }}
                    </a>
                    <span v-else-if="comp.architectures[arch]?.status === 'not_built'" class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400" title="Not built for this architecture">
                      <Minus :size="14" />
                    </span>
                    <span v-else class="text-gray-300 dark:text-gray-600">&mdash;</span>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        </div>
      </div>

      <!-- Not found in Konflux -->
      <div v-if="hasMaturityData && emptyProductComponents.length > 0"
           id="not-found-in-konflux"
           class="bg-white dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-amber-800 overflow-hidden">
        <div class="px-4 py-3 border-b border-amber-200 dark:border-amber-800">
          <h4 class="text-sm font-semibold text-amber-700 dark:text-amber-300">
            {{ emptyProductComponentCount }} component{{ emptyProductComponentCount > 1 ? 's' : '' }} not found in Konflux
          </h4>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-900/80">
                <th class="text-left px-4 py-2 font-semibold text-gray-700 dark:text-gray-300 min-w-[160px]">Product Component</th>
                <th class="text-left px-4 py-2 font-semibold text-gray-700 dark:text-gray-300">Component Image</th>
                <th v-for="arch in ARCHS" :key="arch" class="text-center px-4 py-2 font-semibold text-gray-700 dark:text-gray-300 w-28">{{ arch }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pc in emptyProductComponents" :key="'empty-' + pc.name"
                  class="border-b border-gray-100 dark:border-gray-700/50">
                <td class="px-4 py-2.5">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ pc.name }}</span>
                    <span v-if="pc.team || pc.owner" class="text-xs text-gray-400">({{ pc.team || pc.owner }})</span>
                    <a
                      :href="jiraSearchUrl(pc.name)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                      title="Search JIRA issues for this component"
                    >JIRA</a>
                    <a
                      href="#/system-health/component-maturity"
                      class="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                      title="Component Maturity (in-app)"
                    >Maturity</a>
                    <a
                      href="https://data-hub.pages.redhat.com/component-maturity/"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-gray-400 hover:text-primary-500 dark:text-gray-500 dark:hover:text-primary-400"
                      title="Component Maturity (GitLab Pages)"
                    ><ExternalLink :size="10" /></a>
                  </div>
                </td>
                <td class="px-4 py-2.5">
                  <span class="text-sm text-amber-600 dark:text-amber-400 italic">unknown</span>
                </td>
                <td v-for="arch in ARCHS" :key="arch" class="text-center px-4 py-2.5">
                  <span class="text-gray-300 dark:text-gray-600">&mdash;</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="border-t border-amber-200 dark:border-amber-800 px-4 py-3 text-xs text-gray-600 dark:text-gray-400 space-y-1.5">
          <p>
            These are defined in
            <a href="https://gitlab.cee.redhat.com/data-hub/component-maturity" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400 hover:underline">Component Maturity</a> and
            <a href="https://redhat.atlassian.net/jira/software/c/projects/RHAI/components" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400 hover:underline">JIRA Components</a>
            but have no Konflux build configuration for the <strong>{{ selectedBranch }}</strong> branch.
          </p>
          <p>This is expected if the component doesn't produce container images or isn't onboarded to Konflux yet.</p>
          <p class="font-medium text-gray-700 dark:text-gray-300">To fix:</p>
          <ul class="list-disc list-inside space-y-0.5">
            <li>Add Konflux build configurations in the
              <a href="https://github.com/red-hat-data-services/konflux-central" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400 hover:underline">konflux-central</a>
              repository
            </li>
            <li>Or remove the component from
              <a href="https://gitlab.cee.redhat.com/data-hub/component-maturity" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400 hover:underline">Component Maturity</a> and
              <a href="https://redhat.atlassian.net/jira/software/c/projects/RHAI/components" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400 hover:underline">JIRA Components</a>
              if no longer needed
            </li>
          </ul>
        </div>
      </div>

      <!-- Unknown Product Component -->
      <div v-if="hasMaturityData && unmappedComponents.length > 0"
           id="unknown-product-component"
           class="bg-white dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-amber-800 overflow-hidden">
        <div class="px-4 py-3 border-b border-amber-200 dark:border-amber-800">
          <h4 class="text-sm font-semibold text-amber-700 dark:text-amber-300">
            {{ unmappedCount }} Konflux component{{ unmappedCount > 1 ? 's' : '' }} not matched to a Product Component
          </h4>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-900/80">
                <th class="text-left px-4 py-2 font-semibold text-gray-700 dark:text-gray-300 min-w-[160px]">Product Component</th>
                <th class="text-left px-4 py-2 font-semibold text-gray-700 dark:text-gray-300">Component Image</th>
                <th v-for="arch in ARCHS" :key="arch" class="text-center px-4 py-2 font-semibold text-gray-700 dark:text-gray-300 w-28">{{ arch }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="comp in unmappedComponents" :key="'unmapped-' + comp.name"
                  class="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors">
                <td class="px-4 py-2.5">
                  <span class="text-sm text-amber-600 dark:text-amber-400 italic">unknown</span>
                </td>
                <td class="px-4 py-2.5">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-gray-900 dark:text-gray-100">{{ comp.name }}</span>
                    <a
                      v-if="comp.image"
                      :href="quayUrl(comp.image)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-gray-400 hover:text-primary-500 dark:text-gray-500 dark:hover:text-primary-400 transition-colors"
                      :title="`View ${comp.image} on Quay.io`"
                    >
                      <Package :size="14" />
                    </a>
                    <a
                      v-if="comp.pipelineRunFile"
                      :href="pipelineRunUrl(comp)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-gray-400 hover:text-primary-500 dark:text-gray-500 dark:hover:text-primary-400 transition-colors"
                      title="View Konflux PipelineRun config in konflux-central"
                    >
                      <FileCode :size="14" />
                    </a>
                  </div>
                </td>
                <td
                  v-for="arch in ARCHS"
                  :key="arch"
                  class="text-center px-4 py-2.5"
                >
                  <span v-if="comp.architectures[arch]?.status === 'supported'" class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400" title="Supported">
                    <Check :size="14" />
                  </span>
                  <span v-else-if="comp.architectures[arch]?.status === 'incompatible'" class="text-xs font-medium text-gray-400 dark:text-gray-500" :title="'Incompatible: ' + (comp.architectures[arch]?.accelerator || 'N/A')">
                    N/A
                  </span>
                  <a
                    v-else-if="comp.architectures[arch]?.status === 'exception'"
                    :href="comp.architectures[arch]?.issueUrl || '#'"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
                    :title="comp.architectures[arch]?.reason || 'Exception'"
                  >
                    {{ comp.architectures[arch]?.issueKey || 'EXC' }}
                  </a>
                  <span v-else-if="comp.architectures[arch]?.status === 'not_built'" class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400" title="Not built for this architecture">
                    <Minus :size="14" />
                  </span>
                  <span v-else class="text-gray-300 dark:text-gray-600">&mdash;</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="border-t border-amber-200 dark:border-amber-800 px-4 py-3 text-xs text-gray-600 dark:text-gray-400 space-y-1.5">
          <p>
            These are built in Konflux but are not listed under any component in
            <a href="https://gitlab.cee.redhat.com/data-hub/component-maturity" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400 hover:underline">Component Maturity</a> and
            <a href="https://redhat.atlassian.net/jira/software/c/projects/RHAI/components" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400 hover:underline">JIRA Components</a>.
          </p>
          <p class="font-medium text-gray-700 dark:text-gray-300">To fix:</p>
          <ul class="list-disc list-inside space-y-0.5">
            <li>Add the images to the correct component in the
              <a href="https://gitlab.cee.redhat.com/data-hub/component-maturity" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400 hover:underline">component-maturity</a>
              GitLab repo and
              <a href="https://redhat.atlassian.net/jira/software/c/projects/RHAI/components" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400 hover:underline">JIRA Components</a>
            </li>
            <li>If they are new, create a component entry first in the
              <a href="https://gitlab.cee.redhat.com/data-hub/component-maturity" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400 hover:underline">component-maturity</a>
              GitLab repo and
              <a href="https://redhat.atlassian.net/jira/software/c/projects/RHAI/components" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400 hover:underline">JIRA Components</a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { ArrowLeft, RefreshCw, Cpu, Search, Check, Minus, Package, FileCode, BookOpen, AlertTriangle, ExternalLink } from 'lucide-vue-next'
import { useRhoaiComponentArchitectures } from './composables/useRhoaiComponentArchitectures'

const ARCHS = ['amd64', 'arm64', 'ppc64le', 's390x']

const nav = inject('moduleNav')
const { data, loading, error, refreshing, loadData, refresh } = useRhoaiComponentArchitectures()

const selectedBranch = ref(null)
const searchQuery = ref('')

const branchOptions = computed(() => {
  if (!data.value?.branches) return []
  return Object.keys(data.value.branches).sort((a, b) => {
    const pa = a.replace(/^rhoai-/, '').split(/[.-]/).map(Number)
    const pb = b.replace(/^rhoai-/, '').split(/[.-]/).map(Number)
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const va = pa[i] || 0
      const vb = pb[i] || 0
      if (va !== vb) return vb - va
    }
    return 0
  })
})

const currentBranchData = computed(() => {
  if (!data.value?.branches || !selectedBranch.value) return null
  return data.value.branches[selectedBranch.value]
})

const filteredComponents = computed(() => {
  const branch = currentBranchData.value
  if (!branch?.components) return []
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return branch.components
  return branch.components.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.productComponent && c.productComponent.toLowerCase().includes(q))
  )
})

const summary = computed(() => currentBranchData.value?.summary || null)

const hasMaturityData = computed(() => {
  const branch = currentBranchData.value
  if (!branch?.components) return false
  return branch.components.some(c => c.productComponent != null)
})

const allProductComponentMap = computed(() => {
  const rawEntries = data.value?.maturity?.allProductComponents || []
  const map = new Map()
  for (const entry of rawEntries) {
    const name = typeof entry === 'string' ? entry : entry.name
    if (name && !map.has(name)) {
      map.set(name, {
        name,
        owner: (typeof entry === 'object' && entry.owner) || null,
        team: (typeof entry === 'object' && entry.team) || null
      })
    }
  }
  return map
})

const displayGroups = computed(() => {
  if (!hasMaturityData.value) return []

  const comps = filteredComponents.value
  const grouped = new Map()

  for (const comp of comps) {
    if (comp.productComponent) {
      if (!grouped.has(comp.productComponent)) {
        grouped.set(comp.productComponent, [])
      }
      grouped.get(comp.productComponent).push(comp)
    }
  }

  const groups = []
  const sortedNames = [...grouped.keys()].sort()
  for (const name of sortedNames) {
    const sortedComps = [...grouped.get(name)].sort((a, b) => a.name.localeCompare(b.name))
    groups.push({ name, components: sortedComps })
  }

  return groups
})

const unmappedComponents = computed(() => {
  return filteredComponents.value
    .filter(c => !c.productComponent)
    .sort((a, b) => a.name.localeCompare(b.name))
})

const emptyProductComponents = computed(() => {
  const presentNames = new Set(
    (currentBranchData.value?.components || [])
      .filter(c => c.productComponent)
      .map(c => c.productComponent)
  )
  const q = searchQuery.value.toLowerCase().trim()
  return [...allProductComponentMap.value.values()]
    .filter(pc => !presentNames.has(pc.name))
    .filter(pc => !q || pc.name.toLowerCase().includes(q))
})

const unmappedCount = computed(() => unmappedComponents.value.length)
const emptyProductComponentCount = computed(() => emptyProductComponents.value.length)

const sourceUrl = computed(() => {
  if (!data.value?.source || !selectedBranch.value) return null
  return `https://github.com/${data.value.source.owner}/${data.value.source.repo}/blob/${selectedBranch.value}/multi-arch-report.yaml`
})

function quayUrl(image) {
  if (!image) return '#'
  const name = image.replace(/^quay\.io\//, '')
  return `https://quay.io/repository/${name}?tab=tags`
}

function pipelineRunUrl(comp) {
  if (!selectedBranch.value) return '#'
  if (comp.pipelineRunFile) {
    return `https://github.com/red-hat-data-services/konflux-central/blob/${selectedBranch.value}/${comp.pipelineRunFile}`
  }
  return '#'
}

const JIRA_PROJECT = 'RHAI'

function jiraSearchUrl(productComponentName) {
  if (!productComponentName) return null
  const jql = `project=${JIRA_PROJECT} AND component="${productComponentName}"`
  return `https://redhat.atlassian.net/issues/?jql=${encodeURIComponent(jql)}`
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function goBack() {
  nav.navigateTo('reports')
}

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function handleRefresh() {
  await refresh()
}

onMounted(async () => {
  await loadData()
  if (branchOptions.value.length && !selectedBranch.value) {
    const recommended = data.value?.recommendedBranch
    selectedBranch.value = (recommended && branchOptions.value.includes(recommended))
      ? recommended
      : branchOptions.value[0]
  }
})
</script>
