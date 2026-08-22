<template>
  <div class="space-y-5">
    <div class="flex items-start justify-between">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Component Release Load Tracking</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Track component workload distribution across releases.
        </p>
        <p v-if="formattedFetchedAt" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5" :title="'Live data — fetched from Jira each time you load or refresh. Last fetched: ' + fetchedAt">
          Data from {{ formattedFetchedAt }}
          <span class="text-gray-300 dark:text-gray-600 mx-0.5">&middot;</span>
          <span class="text-[10px]">auto-refreshes every 5 min</span>
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="pillarPanelOpen = true"
          class="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
          title="Configure pillars"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <button
          v-if="groups.length > 0"
          @click="handleExpandAll"
          class="px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >Expand All</button>
        <button
          v-if="groups.length > 0"
          @click="handleCollapseAll"
          class="px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >Collapse All</button>
        <button
          v-if="hasFetched"
          @click="loadData()"
          :disabled="loadingData"
          class="px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors"
          :class="loadingData
            ? 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 cursor-not-allowed'
            : 'text-white bg-primary-600 hover:bg-primary-700 border border-primary-600 hover:border-primary-700'"
          title="Re-fetch data from Jira"
        >
          <span v-if="loadingData" class="inline-flex items-center gap-1">
            <svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            Refreshing…
          </span>
          <span v-else>Refresh</span>
        </button>
      </div>
    </div>

    <!-- ═══ FILTER PANE ═══ -->
    <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40">
      <!-- Pane header -->
      <div class="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Filters</span>
          <span v-if="activeFilterCount > 0" class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-500 text-white text-[10px] font-bold">{{ activeFilterCount }}</span>
        </div>
        <button
          v-if="activeFilterCount > 0"
          @click="clearAllFilters"
          class="text-[11px] font-medium text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        >Clear All</button>
      </div>

      <!-- Row 1: Data filters -->
      <div class="px-4 py-3 flex flex-wrap items-start gap-3 border-b border-gray-100 dark:border-gray-700/50">
        <!-- Pillar -->
        <div class="relative min-w-[180px] flex-1 max-w-[260px]" ref="pillarDropdownRef">
          <label class="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">Pillar</label>
          <div
            class="rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 cursor-text flex flex-wrap items-center gap-1 min-h-[32px] text-xs"
            :class="{ 'ring-1 ring-primary-400 border-primary-400': pillarDropdownOpen }"
            @click="openPillarDropdown"
          >
            <span v-for="name in selectedPillars" :key="name" class="inline-flex items-center gap-0.5 bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 rounded px-1.5 py-0.5 text-[11px] font-medium">
              {{ name }}
              <button type="button" class="hover:text-violet-900 dark:hover:text-violet-100" @click.stop="togglePillar(name)">&times;</button>
            </span>
            <input ref="pillarInputRef" v-model="pillarSearch" type="text" class="flex-1 min-w-[50px] bg-transparent outline-none text-xs placeholder-gray-400 dark:placeholder-gray-500" :placeholder="selectedPillars.length ? '' : 'All'" @focus="pillarDropdownOpen = true" @keydown.backspace="onPillarBackspace" />
          </div>
          <div v-if="pillarDropdownOpen" class="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg">
            <div v-if="filteredPillarNames.length === 0" class="px-3 py-2 text-xs text-gray-400">No pillars</div>
            <button v-for="name in filteredPillarNames" :key="name" type="button" class="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2" @mousedown.prevent="togglePillar(name)">
              <span class="w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-[9px]" :class="selectedPillars.includes(name) ? 'bg-violet-500 border-violet-500 text-white' : 'border-gray-300 dark:border-gray-500'">
                <span v-if="selectedPillars.includes(name)">&#10003;</span>
              </span>
              {{ name }}
            </button>
          </div>
        </div>

        <!-- Jira Component -->
        <div class="relative min-w-[220px] flex-[2] max-w-[400px]" ref="componentDropdownRef">
          <label class="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">Jira Component</label>
          <div
            class="rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 cursor-text flex flex-wrap items-center gap-1 min-h-[32px] text-xs"
            :class="{ 'ring-1 ring-primary-400 border-primary-400': componentDropdownOpen }"
            @click="openComponentDropdown"
          >
            <span v-for="name in selectedComponents" :key="name" class="inline-flex items-center gap-0.5 bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded px-1.5 py-0.5 text-[11px] font-medium">
              {{ name }}
              <button type="button" class="hover:text-primary-900 dark:hover:text-primary-100" @click.stop="toggleComponent(name)">&times;</button>
            </span>
            <input ref="componentInputRef" v-model="componentSearch" type="text" class="flex-1 min-w-[60px] bg-transparent outline-none text-xs placeholder-gray-400 dark:placeholder-gray-500" :placeholder="selectedComponents.length ? '' : 'Search…'" @focus="componentDropdownOpen = true" @keydown.backspace="onComponentBackspace" />
          </div>
          <div v-if="componentDropdownOpen" class="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg">
            <div v-if="loadingComponents" class="px-3 py-2 text-xs text-gray-400">Loading…</div>
            <div v-else-if="filteredComponents.length === 0" class="px-3 py-2 text-xs text-gray-400">No matches</div>
            <button v-for="name in filteredComponents" :key="name" type="button" class="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2" @mousedown.prevent="toggleComponent(name)">
              <span class="w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-[9px]" :class="selectedComponents.includes(name) ? 'bg-primary-500 border-primary-500 text-white' : 'border-gray-300 dark:border-gray-500'">
                <span v-if="selectedComponents.includes(name)">&#10003;</span>
              </span>
              {{ name }}
            </button>
          </div>
        </div>

        <p v-if="componentError" class="text-xs text-red-500 self-end pb-1">{{ componentError }}</p>

        <!-- Release -->
        <div class="relative min-w-[180px] flex-1 max-w-[260px]" ref="versionDropdownRef">
          <label class="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">Release</label>
          <div
            class="rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 cursor-text flex flex-wrap items-center gap-1 min-h-[32px] text-xs"
            :class="{ 'ring-1 ring-primary-400 border-primary-400': versionDropdownOpen }"
            @click="openVersionDropdown"
          >
            <span v-for="name in selectedVersions" :key="name" class="inline-flex items-center gap-0.5 bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded px-1.5 py-0.5 text-[11px] font-medium">
              {{ name }}
              <button type="button" class="hover:text-primary-900 dark:hover:text-primary-100" @click.stop="toggleVersion(name)">&times;</button>
            </span>
            <input ref="versionInputRef" v-model="versionSearch" type="text" class="flex-1 min-w-[50px] bg-transparent outline-none text-xs placeholder-gray-400 dark:placeholder-gray-500" :placeholder="selectedVersions.length ? '' : 'All'" @focus="versionDropdownOpen = true" @keydown.backspace="onVersionBackspace" />
          </div>
          <div v-if="versionDropdownOpen" class="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg">
            <div v-if="filteredVersions.length === 0" class="px-3 py-2 text-xs text-gray-400">No matches</div>
            <button v-for="name in filteredVersions" :key="name" type="button" class="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2" @mousedown.prevent="toggleVersion(name)">
              <span class="w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-[9px]" :class="selectedVersions.includes(name) ? 'bg-primary-500 border-primary-500 text-white' : 'border-gray-300 dark:border-gray-500'">
                <span v-if="selectedVersions.includes(name)">&#10003;</span>
              </span>
              {{ name }}
            </button>
          </div>
        </div>
      </div>

      <!-- Row 2: Result filters (only when data loaded) -->
      <div v-if="groups.length > 0 && !loadingData" class="px-4 py-2.5 flex flex-wrap items-center gap-2">
        <!-- Product -->
        <div class="relative" ref="productDropdownRef">
          <button
            type="button"
            @click="productDropdownOpen = !productDropdownOpen"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
            :class="filterProduct.length > 0 ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'"
          >
            Product
            <span v-if="filterProduct.length > 0" class="bg-indigo-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px]">{{ filterProduct.length }}</span>
          </button>
          <div v-if="productDropdownOpen" class="absolute z-50 mt-1 w-40 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1">
            <button v-for="p in availableProducts" :key="p" type="button" class="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2" @mousedown.prevent="toggleFilter('filterProduct', p)">
              <span class="w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-[9px]" :class="filterProduct.includes(p) ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-300 dark:border-gray-500'"><span v-if="filterProduct.includes(p)">&#10003;</span></span>
              {{ p }}
            </button>
          </div>
        </div>

        <!-- Type -->
        <div class="inline-flex items-center rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 overflow-hidden">
          <button
            type="button"
            @click="toggleFilter('filterType', 'requested')"
            class="px-2.5 py-1 text-[11px] font-medium transition-colors"
            :class="filterType.includes('requested') ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'"
          >REQ</button>
          <span class="w-px h-4 bg-gray-200 dark:bg-gray-600" />
          <button
            type="button"
            @click="toggleFilter('filterType', 'committed')"
            class="px-2.5 py-1 text-[11px] font-medium transition-colors"
            :class="filterType.includes('committed') ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'"
          >COM</button>
        </div>

        <!-- Release Type -->
        <div class="relative" ref="releaseTypeDropdownRef">
          <button
            type="button"
            @click="releaseTypeDropdownOpen = !releaseTypeDropdownOpen"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
            :class="filterReleaseType.length > 0 ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'"
          >
            Release Type
            <span v-if="filterReleaseType.length > 0" class="bg-purple-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px]">{{ filterReleaseType.length }}</span>
          </button>
          <div v-if="releaseTypeDropdownOpen" class="absolute z-50 mt-1 w-48 max-h-48 overflow-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1">
            <div v-if="availableReleaseTypes.length === 0" class="px-3 py-2 text-xs text-gray-400">None</div>
            <button v-for="rt in availableReleaseTypes" :key="rt" type="button" class="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2" @mousedown.prevent="toggleFilter('filterReleaseType', rt)">
              <span class="w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-[9px]" :class="filterReleaseType.includes(rt) ? 'bg-purple-500 border-purple-500 text-white' : 'border-gray-300 dark:border-gray-500'"><span v-if="filterReleaseType.includes(rt)">&#10003;</span></span>
              {{ rt }}
            </button>
          </div>
        </div>

        <!-- Status -->
        <div class="inline-flex items-center gap-1">
          <button v-for="s in ['Green', 'Yellow', 'Red']" :key="s" type="button" @click="toggleFilter('filterStatus', s)" class="w-5 h-5 rounded-full ring-2 transition-all" :class="[statusDotClass(s), filterStatus.includes(s) ? 'ring-offset-2 ring-offset-white dark:ring-offset-gray-800 scale-110' : 'ring-transparent opacity-50 hover:opacity-80']" :title="s" />
        </div>

        <!-- Blocked -->
        <button
          type="button"
          @click="filterBlocked = filterBlocked === null ? true : filterBlocked === true ? false : null"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
          :class="filterBlocked === true ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300' : filterBlocked === false ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'"
        >
          {{ filterBlocked === true ? 'Blocked' : filterBlocked === false ? 'Not Blocked' : 'Blocked' }}
        </button>

        <!-- Docs Required -->
        <div class="inline-flex items-center rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 overflow-hidden">
          <button
            v-for="dv in ['Yes', 'No', 'Not set']"
            :key="dv"
            type="button"
            @click="toggleFilter('filterDocs', dv)"
            class="px-2.5 py-1 text-[11px] font-medium transition-colors"
            :class="filterDocs.includes(dv) ? 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'"
          >{{ dv === 'Not set' ? 'Docs Required ?' : 'Docs Required ' + dv }}</button>
        </div>

        <!-- TV/FV Align -->
        <div class="inline-flex items-center rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 overflow-hidden">
          <button
            v-for="cat in alignmentChipKeys"
            :key="cat"
            type="button"
            @click="toggleAlignmentDisplayKey(cat)"
            class="px-2.5 py-1 text-[11px] font-medium transition-colors"
            :class="displayKeySelected(cat, filterAlignment) ? alignmentCategoryChipClass(cat) : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'"
          >{{ alignmentCategoryLabel(cat) }}</button>
        </div>

        <!-- Delivery Owner -->
        <div class="relative" ref="delOwnerDropdownRef">
          <button
            type="button"
            @click="delOwnerDropdownOpen = !delOwnerDropdownOpen"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
            :class="filterDelOwner.length > 0 ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'"
          >
            Delivery Owner
            <span v-if="filterDelOwner.length > 0" class="bg-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px]">{{ filterDelOwner.length }}</span>
          </button>
          <div v-if="delOwnerDropdownOpen" class="absolute z-50 mt-1 w-56 max-h-48 overflow-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1">
            <input v-model="delOwnerSearch" type="text" class="w-full px-3 py-1.5 text-xs border-b border-gray-100 dark:border-gray-700 outline-none bg-transparent placeholder-gray-400" placeholder="Search…" />
            <div v-if="filteredDelOwners.length === 0" class="px-3 py-2 text-xs text-gray-400">None</div>
            <button v-for="o in filteredDelOwners" :key="o" type="button" class="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2" @mousedown.prevent="toggleFilter('filterDelOwner', o)">
              <span class="w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-[9px]" :class="filterDelOwner.includes(o) ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-300 dark:border-gray-500'"><span v-if="filterDelOwner.includes(o)">&#10003;</span></span>
              {{ o }}
            </button>
          </div>
        </div>

        <!-- PM Owner -->
        <div class="relative" ref="pmOwnerDropdownRef">
          <button
            type="button"
            @click="pmOwnerDropdownOpen = !pmOwnerDropdownOpen"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
            :class="filterPmOwner.length > 0 ? 'bg-violet-50 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'"
          >
            PM Owner
            <span v-if="filterPmOwner.length > 0" class="bg-violet-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px]">{{ filterPmOwner.length }}</span>
          </button>
          <div v-if="pmOwnerDropdownOpen" class="absolute z-50 mt-1 w-56 max-h-48 overflow-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1">
            <input v-model="pmOwnerSearch" type="text" class="w-full px-3 py-1.5 text-xs border-b border-gray-100 dark:border-gray-700 outline-none bg-transparent placeholder-gray-400" placeholder="Search…" />
            <div v-if="filteredPmOwners.length === 0" class="px-3 py-2 text-xs text-gray-400">None</div>
            <button v-for="o in filteredPmOwners" :key="o" type="button" class="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2" @mousedown.prevent="toggleFilter('filterPmOwner', o)">
              <span class="w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-[9px]" :class="filterPmOwner.includes(o) ? 'bg-violet-500 border-violet-500 text-white' : 'border-gray-300 dark:border-gray-500'"><span v-if="filterPmOwner.includes(o)">&#10003;</span></span>
              {{ o }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!--
      Summary cards are display-only KPIs except Align category clicks, which
      filter the table. Requested/Committed stay independent of REQ/COM chips.
      Delivered is Closed/Done/Resolved with Fix Version in the selected
      releases — not planning load.
    -->
    <div v-if="hasFetched && !loadingData" class="space-y-3">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3.5">
          <div class="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-xl" />
          <div class="flex items-center gap-2 mb-1.5">
            <span class="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/40">
              <svg class="w-3 h-3 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </span>
            <span class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Requested</span>
          </div>
          <div class="text-2xl font-bold text-blue-600 dark:text-blue-400 ml-7">{{ totalRequested }}</div>
        </div>
        <div class="relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3.5">
          <div class="absolute top-0 left-0 w-1 h-full bg-emerald-500 rounded-l-xl" />
          <div class="flex items-center gap-2 mb-1.5">
            <span class="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-100 dark:bg-emerald-900/40">
              <svg class="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </span>
            <span class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Committed</span>
          </div>
          <div class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 ml-7">{{ totalCommitted }}</div>
        </div>
        <div class="relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3.5">
          <div class="absolute top-0 left-0 w-1 h-full bg-slate-500 rounded-l-xl" />
          <div class="flex items-center gap-2 mb-1.5">
            <span class="inline-flex items-center justify-center w-5 h-5 rounded bg-slate-100 dark:bg-slate-700">
              <svg class="w-3 h-3 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
            </span>
            <span class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Delivered</span>
          </div>
          <div
            class="text-2xl font-bold ml-7 text-slate-700 dark:text-slate-200"
            :title="deliveredTitle"
          >{{ deliveredDisplay }}</div>
          <p v-if="deliveredTimedOut" class="ml-7 text-[10px] text-amber-600 dark:text-amber-400">Timed out — open load is unchanged</p>
        </div>
        <div class="relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3.5">
          <div class="absolute top-0 left-0 w-1 h-full bg-red-500 rounded-l-xl" />
          <div class="flex items-center gap-2 mb-1.5">
            <span class="inline-flex items-center justify-center w-5 h-5 rounded bg-red-100 dark:bg-red-900/40">
              <svg class="w-3 h-3 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
            </span>
            <span class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Blocked</span>
          </div>
          <div class="text-2xl font-bold ml-7" :class="totalBlocked > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'">{{ totalBlocked }}<span v-if="blockedPercent !== null" class="text-sm font-normal text-gray-400 dark:text-gray-500 ml-1">({{ blockedPercent }}%)</span></div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">TV/FV Align</span>
        <AlignmentLegendPopover variant="button" />
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-6 gap-2">
        <template v-for="cat in alignmentChipKeys" :key="cat">
          <button
            v-if="cat !== 'after_requested'"
            type="button"
            class="px-3 py-2 rounded-xl border text-left transition-colors"
            :class="isDisplayFilterActive(cat)
              ? 'border-primary-400 ring-1 ring-primary-400 bg-white dark:bg-gray-800'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'"
            :title="'Filter the table to ' + alignmentCategoryLabel(cat) + '. Requested and Committed tiles stay unfiltered.'"
            @click="setAlignmentDisplayFilter(cat)"
          >
            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold" :class="alignmentCategoryChipClass(cat)">{{ alignmentCategoryLabel(cat) }}</span>
            <div class="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{{ alignmentCounts[cat] }}</div>
          </button>
          <div
            v-else
            class="px-3 py-2 rounded-xl border text-left transition-colors"
            :class="isDisplayFilterActive('after_requested')
              ? 'border-primary-400 ring-1 ring-primary-400 bg-white dark:bg-gray-800'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'"
            role="button"
            tabindex="0"
            title="Fix Version later than Target Version. Yellow until the committed freeze, then green. Click the tile for both; click a number for that color only."
            @click="setAlignmentDisplayFilter('after_requested')"
            @keydown.enter.prevent="setAlignmentDisplayFilter('after_requested')"
          >
            <span class="inline-flex items-center gap-1">
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold" :class="alignmentCategoryChipClass('after_requested')">After requested</span>
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold" :class="alignmentCategoryChipClass('aligned_late')">After requested</span>
            </span>
            <div class="mt-1 flex items-baseline gap-3">
              <span
                class="text-lg font-bold tabular-nums text-amber-700 dark:text-amber-400 cursor-pointer"
                title="Before committed freeze"
                @click.stop="setAlignmentFilterExact('after_requested')"
              >{{ afterRequestedCounts.yellow }}</span>
              <span
                class="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400 cursor-pointer"
                title="After committed freeze"
                @click.stop="setAlignmentFilterExact('aligned_late')"
              >{{ afterRequestedCounts.green }}</span>
            </div>
          </div>
        </template>
        <div class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <span class="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Align %</span>
          <div
            class="mt-1 text-lg font-bold tabular-nums"
            :class="alignmentPctClass"
            title="(Early or as requested + green After requested) / unique keys with Target Version or Fix Version. Follows selected releases that are still before freeze. Yellow After requested does not count as aligned."
          >{{ alignmentCounts.alignment_pct }}%</div>
        </div>
      </div>

      <AlignmentRollupTable
        :rollup="alignmentRollup"
        @select-scope="onSelectScope"
        @select-milestone="onSelectMilestone"
        @select-product="onSelectProduct"
        @select-category="setAlignmentFilterExact"
      />
    </div>

    <!-- Loading -->
    <div v-if="loadingData" class="flex flex-col items-center justify-center py-16 gap-3">
      <svg class="animate-spin h-8 w-8 text-primary-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
      <span class="text-sm text-gray-500 dark:text-gray-400">Loading data from Jira…</span>
    </div>

    <!-- Error -->
    <div v-else-if="dataError" class="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-5 py-4 text-sm text-red-700 dark:text-red-400 flex items-start gap-3">
      <svg class="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
      {{ dataError }}
    </div>

    <!-- Empty prompt -->
    <div v-else-if="groups.length === 0 && !hasFetched" class="text-center py-16 text-gray-400 dark:text-gray-500">
      <svg class="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      <p class="text-sm font-medium">Select components and/or releases to view data.</p>
    </div>

    <!-- No results -->
    <div v-else-if="groups.length === 0 && hasFetched" class="text-center py-16 text-gray-400 dark:text-gray-500">
      <svg class="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
      <p class="text-sm font-medium">No features found for the selected filters.</p>
    </div>

    <!-- Data table -->
    <ComponentReleaseLoadTable
      v-if="groups.length > 0 && !loadingData"
      ref="tableRef"
      :groups="clientFilteredGroups"
      :componentLeads="componentLeads"
      :initialSort="savedSort"
      @sort-changed="onSortChanged"
      @select="selectedFeature = $event"
    />

    <!-- Pillar config panel -->
    <PillarConfigPanel
      :open="pillarPanelOpen"
      :config="pillarConfig"
      @close="pillarPanelOpen = false"
      @saved="onPillarConfigSaved"
    />

    <FeatureReadinessDrawer
      :feature="drawerFeature"
      :jiraBaseUrl="jiraBaseUrl"
      @close="selectedFeature = null"
      @navigate="navigateToFeature"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, inject } from 'vue'
import { getApiBase } from '@shared/client/services/api'
import { buildComponentLeadsMap } from '../../composables/componentLeads'
import ComponentReleaseLoadTable from '../components/ComponentReleaseLoadTable.vue'
import AlignmentRollupTable from '../components/AlignmentRollupTable.vue'
import AlignmentLegendPopover from '../components/AlignmentLegendPopover.vue'
import PillarConfigPanel from '../components/PillarConfigPanel.vue'
import FeatureReadinessDrawer from '../components/FeatureReadinessDrawer.vue'
import { toDrawerFeature } from '../utils/feature-readiness-drawer-model.js'
import {
  ALIGNMENT_DISPLAY_KEYS,
  alignmentCategoryLabel,
  alignmentCategoryChipClass,
  categoriesForDisplayKey,
  displayKeySelected,
  toggleDisplayKeyInSelection,
  categorySetsEqual
} from '../utils/tv-fv-alignment-display.js'
import {
  countAlignment,
  countAlignmentForGroups,
  buildAlignmentRollup,
  countDeliveredInVisibleVersions,
  visibleVersionNames,
  afterRequestedSplit
} from '../utils/alignment-rollup.js'

const nav = inject('moduleNav', null)
const jiraBaseUrl = 'https://issues.redhat.com/browse'

function navigateToFeature(key) {
  if (nav && typeof nav.navigateTo === 'function') {
    nav.navigateTo('feature-detail', { key, from: 'plan-pm-hub' })
  }
}

const API_BASE = '/modules/releases/pm-hub'
var STORAGE_KEY = 'pm-hub-filters'
var AUTO_REFRESH_MS = 5 * 60 * 1000

var selectedPillars = ref([])
var selectedComponents = ref([])
var selectedVersions = ref([])

var pillarSearch = ref('')
var componentSearch = ref('')
var versionSearch = ref('')

var pillarDropdownOpen = ref(false)
var componentDropdownOpen = ref(false)
var versionDropdownOpen = ref(false)

var pillarDropdownRef = ref(null)
var pillarInputRef = ref(null)
var componentDropdownRef = ref(null)
var componentInputRef = ref(null)
var versionDropdownRef = ref(null)
var versionInputRef = ref(null)

var pillarConfig = ref({ pillars: [] })
var pillarPanelOpen = ref(false)

var components = ref([])
var loadingComponents = ref(false)
var componentError = ref(null)

var groups = ref([])
var loadingData = ref(false)
var activeLoadController = null
var dataError = ref(null)
var hasFetched = ref(false)
var tableRef = ref(null)
var fetchedAt = ref(null)
var autoRefreshTimer = ref(null)
var selectedFeature = ref(null)
var deliveredIssues = ref([])
var deliveredSkipped = ref(null)
var deliveredTimedOut = ref(false)
var drawerFeature = computed(function() {
  return toDrawerFeature(selectedFeature.value)
})

var filterProduct = ref([])
var filterType = ref([])
var filterReleaseType = ref([])
var filterStatus = ref([])
var filterBlocked = ref(null)
var filterAlignment = ref([])
var filterDelOwner = ref([])
var filterPmOwner = ref([])
var filterDocs = ref([])

var productDropdownOpen = ref(false)
var productDropdownRef = ref(null)
var releaseTypeDropdownOpen = ref(false)
var releaseTypeDropdownRef = ref(null)
var delOwnerDropdownOpen = ref(false)
var delOwnerDropdownRef = ref(null)
var delOwnerSearch = ref('')
var pmOwnerDropdownOpen = ref(false)
var pmOwnerDropdownRef = ref(null)
var pmOwnerSearch = ref('')

var savedSort = ref({ column: null, direction: 'asc' })

var availableProducts = ['RHOAI', 'RHELAI', 'RHAII']

// ═══ FILTER PERSISTENCE ═══

function saveFilters() {
  try {
    var state = {
      pillars: selectedPillars.value,
      components: selectedComponents.value,
      versions: selectedVersions.value,
      product: filterProduct.value,
      type: filterType.value,
      releaseType: filterReleaseType.value,
      status: filterStatus.value,
      blocked: filterBlocked.value,
      alignment: filterAlignment.value,
      delOwner: filterDelOwner.value,
      pmOwner: filterPmOwner.value,
      docs: filterDocs.value,
      sort: savedSort.value
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) { void e }
}

function restoreFilters() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    var state = JSON.parse(raw)
    if (state.pillars && Array.isArray(state.pillars)) selectedPillars.value = state.pillars
    if (state.components && Array.isArray(state.components)) selectedComponents.value = state.components
    if (state.versions && Array.isArray(state.versions)) selectedVersions.value = state.versions
    if (state.product && Array.isArray(state.product)) filterProduct.value = state.product
    if (state.type && Array.isArray(state.type)) filterType.value = state.type
    if (state.releaseType && Array.isArray(state.releaseType)) filterReleaseType.value = state.releaseType
    if (state.status && Array.isArray(state.status)) filterStatus.value = state.status
    if (state.blocked !== undefined) filterBlocked.value = state.blocked
    if (state.alignment && Array.isArray(state.alignment)) filterAlignment.value = state.alignment
    if (state.delOwner && Array.isArray(state.delOwner)) filterDelOwner.value = state.delOwner
    if (state.pmOwner && Array.isArray(state.pmOwner)) filterPmOwner.value = state.pmOwner
    if (state.docs && Array.isArray(state.docs)) filterDocs.value = state.docs
    if (state.sort && typeof state.sort === 'object') savedSort.value = state.sort
    return true
  } catch { return false }
}

function onSortChanged(sort) {
  savedSort.value = sort
  saveFilters()
}

function statusDotClass(s) {
  if (s === 'Green') return 'bg-emerald-500 ring-emerald-300 dark:ring-emerald-700'
  if (s === 'Yellow') return 'bg-amber-400 ring-amber-300 dark:ring-amber-700'
  if (s === 'Red') return 'bg-red-500 ring-red-300 dark:ring-red-700'
  return 'bg-gray-400 ring-gray-300'
}

var filterRefs = {
  filterProduct: filterProduct,
  filterType: filterType,
  filterReleaseType: filterReleaseType,
  filterStatus: filterStatus,
  filterAlignment: filterAlignment,
  filterDelOwner: filterDelOwner,
  filterPmOwner: filterPmOwner,
  filterDocs: filterDocs
}

function toggleFilter(filterName, value) {
  var arrRef = filterRefs[filterName]
  if (arrRef) toggleInArray(arrRef, value)
}

function toggleInArray(arrRef, value) {
  var idx = arrRef.value.indexOf(value)
  if (idx >= 0) {
    arrRef.value.splice(idx, 1)
  } else {
    arrRef.value.push(value)
  }
}

var activeFilterCount = computed(function() {
  var count = selectedPillars.value.length + selectedComponents.value.length + selectedVersions.value.length
  count += filterProduct.value.length + filterType.value.length + filterReleaseType.value.length
  count += filterStatus.value.length + filterDelOwner.value.length + filterPmOwner.value.length + filterDocs.value.length + filterAlignment.value.length
  if (filterBlocked.value !== null) count++
  return count
})

function clearAllFilters() {
  selectedPillars.value = []
  pillarSearch.value = ''
  selectedComponents.value = []
  componentSearch.value = ''
  selectedVersions.value = []
  versionSearch.value = ''
  filterProduct.value = []
  filterType.value = []
  filterReleaseType.value = []
  filterStatus.value = []
  filterBlocked.value = null
  filterAlignment.value = []
  filterDelOwner.value = []
  filterPmOwner.value = []
  filterDocs.value = []
  savedSort.value = { column: null, direction: 'asc' }
  try { localStorage.removeItem(STORAGE_KEY) } catch (e) { void e }
}

function extractProduct(versionName) {
  if (!versionName) return versionName
  var lower = versionName.toLowerCase()
  if (lower.indexOf('rhoai') !== -1) return 'RHOAI'
  if (lower.indexOf('rhelai') !== -1) return 'RHELAI'
  if (lower.indexOf('rhaii') !== -1) return 'RHAII'
  return null
}

function flattenFeatures() {
  var result = []
  var seen = {}
  for (var gi = 0; gi < groups.value.length; gi++) {
    var g = groups.value[gi]
    var version = g.version
    for (var ci = 0; ci < g.components.length; ci++) {
      var comp = g.components[ci]
      var lists = [comp.requestedFeatures || [], comp.committedFeatures || []]
      for (var li = 0; li < lists.length; li++) {
        for (var fi = 0; fi < lists[li].length; fi++) {
          var f = lists[li][fi]
          if (!seen[f.key]) {
            seen[f.key] = true
            result.push({
              releaseType: f.releaseType,
              assignee: f.assignee,
              pmOwner: f.pmOwner,
              product: extractProduct(version)
            })
          }
        }
      }
    }
  }
  return result
}

var availableReleaseTypes = computed(function() {
  var feats = flattenFeatures()
  var set = new Set()
  for (var i = 0; i < feats.length; i++) {
    if (feats[i].releaseType) set.add(feats[i].releaseType)
  }
  return Array.from(set).sort()
})

var availableDelOwners = computed(function() {
  var feats = flattenFeatures()
  var set = new Set()
  for (var i = 0; i < feats.length; i++) {
    if (feats[i].assignee) set.add(feats[i].assignee)
  }
  return Array.from(set).sort()
})

var availablePmOwners = computed(function() {
  var feats = flattenFeatures()
  var set = new Set()
  for (var i = 0; i < feats.length; i++) {
    if (feats[i].pmOwner) set.add(feats[i].pmOwner)
  }
  return Array.from(set).sort()
})

var filteredDelOwners = computed(function() {
  var q = delOwnerSearch.value.toLowerCase().trim()
  if (!q) return availableDelOwners.value
  return availableDelOwners.value.filter(function(o) { return o.toLowerCase().includes(q) })
})

var filteredPmOwners = computed(function() {
  var q = pmOwnerSearch.value.toLowerCase().trim()
  if (!q) return availablePmOwners.value
  return availablePmOwners.value.filter(function(o) { return o.toLowerCase().includes(q) })
})

/**
 * Apply client-side filters to groups.
 * @param {{ applyType?: boolean, applyAlignment?: boolean }} opts
 *   KPI / roll-up omit REQ/COM and Align so Requested, Committed, and the
 *   five Align counts stay independent headline numbers.
 */
function filterGroups(opts) {
  var applyType = !!(opts && opts.applyType) && filterType.value.length > 0
  var applyAlignment = !!(opts && opts.applyAlignment) && filterAlignment.value.length > 0
  var hasOther = filterProduct.value.length > 0 || filterReleaseType.value.length > 0 ||
    filterStatus.value.length > 0 || filterBlocked.value !== null ||
    filterDelOwner.value.length > 0 || filterPmOwner.value.length > 0 || filterDocs.value.length > 0

  if (!applyType && !applyAlignment && !hasOther) return groups.value

  return groups.value.map(function(g) {
    var version = g.version
    var product = extractProduct(version)

    if (filterProduct.value.length > 0 && filterProduct.value.indexOf(product) === -1) {
      return Object.assign({}, g, { components: [] })
    }

    var filteredComps = g.components.map(function(comp) {
      var reqList = comp.requestedFeatures || []
      var comList = comp.committedFeatures || []
      var reqKeys = {}
      var comKeys = {}
      for (var ri = 0; ri < reqList.length; ri++) reqKeys[reqList[ri].key] = true
      for (var cmi = 0; cmi < comList.length; cmi++) comKeys[comList[cmi].key] = true

      var allFeatures = []
      var seen = {}
      var lists = [reqList, comList]
      for (var li = 0; li < lists.length; li++) {
        for (var fi = 0; fi < lists[li].length; fi++) {
          var f = lists[li][fi]
          if (!seen[f.key]) {
            seen[f.key] = true
            allFeatures.push(f)
          }
        }
      }

      var filtered = allFeatures.filter(function(f) {
        var isReq = !!reqKeys[f.key]
        var isCom = !!comKeys[f.key]

        if (applyType) {
          var matches = false
          if (filterType.value.indexOf('requested') >= 0 && isReq) matches = true
          if (filterType.value.indexOf('committed') >= 0 && isCom) matches = true
          if (!matches) return false
        }
        if (applyAlignment && filterAlignment.value.indexOf(f.alignmentCategory) === -1) return false
        if (filterReleaseType.value.length > 0 && filterReleaseType.value.indexOf(f.releaseType || '') === -1) return false
        if (filterStatus.value.length > 0) {
          var cs = (f.colorStatus || '').toLowerCase()
          var match = false
          for (var si = 0; si < filterStatus.value.length; si++) {
            if (filterStatus.value[si].toLowerCase() === cs) { match = true; break }
          }
          if (!match) return false
        }
        if (filterBlocked.value === true && !f.isBlocked) return false
        if (filterBlocked.value === false && f.isBlocked) return false
        if (filterDelOwner.value.length > 0 && filterDelOwner.value.indexOf(f.assignee || '') === -1) return false
        if (filterPmOwner.value.length > 0 && filterPmOwner.value.indexOf(f.pmOwner || '') === -1) return false
        if (filterDocs.value.length > 0) {
          var docVal = f.docsRequired || ''
          var docsMatch = false
          for (var di = 0; di < filterDocs.value.length; di++) {
            if (filterDocs.value[di] === 'Yes' && docVal === 'Yes') docsMatch = true
            if (filterDocs.value[di] === 'No' && docVal === 'No') docsMatch = true
            if (filterDocs.value[di] === 'Not set' && !docVal) docsMatch = true
          }
          if (!docsMatch) return false
        }
        return true
      })

      var newReq = []
      var newCom = []
      for (var nfi = 0; nfi < filtered.length; nfi++) {
        var ff = filtered[nfi]
        if (reqKeys[ff.key]) newReq.push(ff)
        if (comKeys[ff.key]) newCom.push(ff)
      }

      return Object.assign({}, comp, {
        requestedFeatures: newReq,
        committedFeatures: newCom,
        requestedCount: newReq.length,
        committedCount: newCom.length,
        blockedCount: filtered.filter(function(ff) { return ff.isBlocked }).length,
        alignmentCounts: countAlignment(filtered)
      })
    }).filter(function(comp) {
      return (comp.requestedFeatures.length + comp.committedFeatures.length) > 0
    })

    return Object.assign({}, g, { components: filteredComps })
  }).filter(function(g) { return g.components.length > 0 })
}

/** Table — includes REQ/COM and Align category chips. */
var clientFilteredGroups = computed(function() {
  return filterGroups({ applyType: true, applyAlignment: true })
})

/** KPI tiles and Align roll-up — ignore REQ/COM and Align filters. */
var summaryFilteredGroups = computed(function() {
  return filterGroups({ applyType: false, applyAlignment: false })
})

var HIDDEN_COMPONENTS = ['lllm-d']

var uniqueComponents = computed(function() {
  var seen = new Set()
  var result = []
  for (var i = 0; i < components.value.length; i++) {
    var name = components.value[i].name
    if (!seen.has(name) && HIDDEN_COMPONENTS.indexOf(name) === -1) {
      seen.add(name)
      result.push(name)
    }
  }
  return result
})

var PORTFOLIO_VERSIONS = [
  { label: '3.5 EA1', jiraVersions: ['3.5 EA1 RHOAI RELEASE', '3.5 EA1 RHELAI RELEASE', '3.5 EA1 RHAII RELEASE'] },
  { label: '3.5 EA2', jiraVersions: ['3.5 EA2 RHOAI RELEASE', '3.5 EA2 RHELAI RELEASE', '3.5 EA2 RHAII RELEASE'] },
  { label: '3.5', jiraVersions: ['3.5 GA RHOAI RELEASE', '3.5 GA RHELAI RELEASE', '3.5 GA RHAII RELEASE'] },
  { label: '3.6 EA1', jiraVersions: ['3.6 EA1 RHOAI RELEASE', '3.6 EA1 RHELAI RELEASE', '3.6 EA1 RHAII RELEASE'] },
  { label: '3.6 EA2', jiraVersions: ['3.6 EA2 RHOAI RELEASE', '3.6 EA2 RHELAI RELEASE', '3.6 EA2 RHAII RELEASE'] },
  { label: '3.6', jiraVersions: ['3.6 GA RHOAI RELEASE', '3.6 GA RHELAI RELEASE', '3.6 GA RHAII RELEASE'] }
]

var portfolioVersionLabels = PORTFOLIO_VERSIONS.map(function(v) { return v.label })

function resolveJiraVersions(selectedLabels) {
  var result = []
  for (var i = 0; i < selectedLabels.length; i++) {
    var pv = PORTFOLIO_VERSIONS.find(function(v) { return v.label === selectedLabels[i] })
    if (pv) {
      for (var j = 0; j < pv.jiraVersions.length; j++) {
        if (result.indexOf(pv.jiraVersions[j]) === -1) result.push(pv.jiraVersions[j])
      }
    }
  }
  return result
}

var pillarNames = computed(function() {
  return pillarConfig.value.pillars.map(function(p) { return p.name })
})

var componentLeads = computed(function() {
  return buildComponentLeadsMap(pillarConfig.value)
})

var filteredPillarNames = computed(function() {
  var q = pillarSearch.value.toLowerCase().trim()
  if (!q) return pillarNames.value
  return pillarNames.value.filter(function(name) { return name.toLowerCase().includes(q) })
})

var pillarAllowedComponents = computed(function() {
  if (selectedPillars.value.length === 0) return null
  var allowed = new Set()
  for (var pi = 0; pi < selectedPillars.value.length; pi++) {
    var pillar = pillarConfig.value.pillars.find(function(p) { return p.name === selectedPillars.value[pi] })
    if (!pillar) continue
    for (var ci = 0; ci < pillar.components.length; ci++) {
      var pc = pillar.components[ci]
      var pcName = typeof pc === 'string' ? pc : (pc && pc.name) || ''
      if (pcName) allowed.add(pcName.toLowerCase())
    }
  }
  return allowed
})

function normalizeComponentName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function componentMatchesPillar(jiraName) {
  var allowed = pillarAllowedComponents.value
  if (!allowed) return true
  if (allowed.has(jiraName.toLowerCase())) return true
  var normalized = normalizeComponentName(jiraName)
  var iter = allowed.values()
  var next = iter.next()
  while (!next.done) {
    if (normalizeComponentName(next.value) === normalized) return true
    next = iter.next()
  }
  return false
}

var pillarFilteredComponents = computed(function() {
  if (!pillarAllowedComponents.value) return uniqueComponents.value
  return uniqueComponents.value.filter(componentMatchesPillar)
})

var filteredComponents = computed(function() {
  var q = componentSearch.value.toLowerCase().trim()
  if (!q) return pillarFilteredComponents.value
  return pillarFilteredComponents.value.filter(function(name) { return name.toLowerCase().includes(q) })
})

var filteredVersions = computed(function() {
  var q = versionSearch.value.toLowerCase().trim()
  if (!q) return portfolioVersionLabels
  return portfolioVersionLabels.filter(function(name) { return name.toLowerCase().includes(q) })
})

/** Count unique feature keys across component groups (multi-component features must not inflate summary cards). */
function countUniqueFeatureKeys(groups, listName) {
  var seen = {}
  var count = 0
  for (var gi = 0; gi < groups.length; gi++) {
    var comps = groups[gi].components || []
    for (var ci = 0; ci < comps.length; ci++) {
      var list = comps[ci][listName] || []
      for (var fi = 0; fi < list.length; fi++) {
        var f = list[fi]
        if (!f || !f.key || seen[f.key]) continue
        seen[f.key] = true
        count++
      }
    }
  }
  return count
}

var totalRequested = computed(function() {
  return countUniqueFeatureKeys(summaryFilteredGroups.value, 'requestedFeatures')
})

var totalCommitted = computed(function() {
  return countUniqueFeatureKeys(summaryFilteredGroups.value, 'committedFeatures')
})

var totalBlocked = computed(function() {
  // Unique blocked keys across either bucket (same feature under multiple components counts once)
  var source = summaryFilteredGroups.value
  var seen = {}
  var count = 0
  for (var gi = 0; gi < source.length; gi++) {
    var comps = source[gi].components || []
    for (var ci = 0; ci < comps.length; ci++) {
      var lists = [comps[ci].requestedFeatures || [], comps[ci].committedFeatures || []]
      for (var li = 0; li < lists.length; li++) {
        for (var fi = 0; fi < lists[li].length; fi++) {
          var f = lists[li][fi]
          if (!f || !f.key || seen[f.key] || !f.isBlocked) continue
          seen[f.key] = true
          count++
        }
      }
    }
  }
  return count
})

var totalFeatures = computed(function() {
  var source = summaryFilteredGroups.value
  var seen = {}
  var count = 0
  for (var gi = 0; gi < source.length; gi++) {
    var comps = source[gi].components || []
    for (var ci = 0; ci < comps.length; ci++) {
      var lists = [comps[ci].requestedFeatures || [], comps[ci].committedFeatures || []]
      for (var li = 0; li < lists.length; li++) {
        for (var fi = 0; fi < lists[li].length; fi++) {
          var key = lists[li][fi].key
          if (!seen[key]) {
            seen[key] = true
            count++
          }
        }
      }
    }
  }
  return count
})

var blockedPercent = computed(function() {
  var total = totalFeatures.value
  if (total === 0) return null
  return Math.round((totalBlocked.value / total) * 100)
})

var alignmentChipKeys = ALIGNMENT_DISPLAY_KEYS

var alignmentCounts = computed(function() {
  return countAlignmentForGroups(summaryFilteredGroups.value)
})

var afterRequestedCounts = computed(function() {
  return afterRequestedSplit(alignmentCounts.value)
})

var alignmentRollup = computed(function() {
  return buildAlignmentRollup(summaryFilteredGroups.value)
})

var alignmentPctClass = computed(function() {
  var pct = alignmentCounts.value.alignment_pct
  if (pct < 50) return 'text-red-600 dark:text-red-400'
  if (pct < 75) return 'text-amber-600 dark:text-amber-400'
  return 'text-emerald-600 dark:text-emerald-400'
})

var deliveredCount = computed(function() {
  if (deliveredSkipped.value === 'no-versions' || deliveredTimedOut.value) return null
  return countDeliveredInVisibleVersions(
    deliveredIssues.value,
    visibleVersionNames(summaryFilteredGroups.value)
  )
})

var deliveredDisplay = computed(function() {
  if (deliveredCount.value == null) return '—'
  return String(deliveredCount.value)
})

var deliveredTitle = computed(function() {
  if (deliveredSkipped.value === 'no-versions') {
    return 'Select a release to see Closed/Done/Resolved issues with Fix Version in that version. This is not planning load.'
  }
  if (deliveredTimedOut.value) {
    return 'Delivered query timed out. Open Requested/Committed/Align numbers are unchanged.'
  }
  return 'Closed, Done, or Resolved with Fix Version in the versions still visible after filters. Not included in Requested, Committed, or Align %.'
})

function toggleAlignmentDisplayKey(displayKey) {
  filterAlignment.value = toggleDisplayKeyInSelection(displayKey, filterAlignment.value)
}

function isDisplayFilterActive(displayKey) {
  return categorySetsEqual(filterAlignment.value, categoriesForDisplayKey(displayKey))
}

function setAlignmentDisplayFilter(displayKey) {
  var cats = categoriesForDisplayKey(displayKey)
  if (categorySetsEqual(filterAlignment.value, cats)) {
    filterAlignment.value = []
    return
  }
  filterAlignment.value = cats.slice()
}

function setAlignmentFilterExact(category) {
  if (filterAlignment.value.length === 1 && filterAlignment.value[0] === category) {
    filterAlignment.value = []
    return
  }
  filterAlignment.value = [category]
}

function onSelectScope() {
  filterProduct.value = []
  filterAlignment.value = []
}

function onSelectMilestone() {
  filterProduct.value = []
}

function onSelectProduct(row) {
  if (row && row.product) filterProduct.value = [row.product]
}

var formattedFetchedAt = computed(function() {
  if (!fetchedAt.value) return null
  try {
    var d = new Date(fetchedAt.value)
    if (isNaN(d.getTime())) return null
    return d.toLocaleString()
  } catch { return null }
})

function togglePillar(name) {
  var idx = selectedPillars.value.indexOf(name)
  if (idx >= 0) { selectedPillars.value.splice(idx, 1) } else { selectedPillars.value.push(name) }
  pillarSearch.value = ''
}

function openPillarDropdown() {
  pillarDropdownOpen.value = true
  if (pillarInputRef.value) pillarInputRef.value.focus()
}

function onPillarBackspace() {
  if (!pillarSearch.value && selectedPillars.value.length) selectedPillars.value.pop()
}

function toggleComponent(name) {
  var idx = selectedComponents.value.indexOf(name)
  if (idx >= 0) { selectedComponents.value.splice(idx, 1) } else { selectedComponents.value.push(name) }
  componentSearch.value = ''
}

function toggleVersion(name) {
  var idx = selectedVersions.value.indexOf(name)
  if (idx >= 0) { selectedVersions.value.splice(idx, 1) } else { selectedVersions.value.push(name) }
  versionSearch.value = ''
}

function openComponentDropdown() {
  componentDropdownOpen.value = true
  if (componentInputRef.value) componentInputRef.value.focus()
}

function openVersionDropdown() {
  versionDropdownOpen.value = true
  if (versionInputRef.value) versionInputRef.value.focus()
}

function onComponentBackspace() {
  if (!componentSearch.value && selectedComponents.value.length) selectedComponents.value.pop()
}

function onVersionBackspace() {
  if (!versionSearch.value && selectedVersions.value.length) selectedVersions.value.pop()
}

function handleClickOutside(e) {
  if (pillarDropdownRef.value && !pillarDropdownRef.value.contains(e.target)) { pillarDropdownOpen.value = false; pillarSearch.value = '' }
  if (componentDropdownRef.value && !componentDropdownRef.value.contains(e.target)) { componentDropdownOpen.value = false; componentSearch.value = '' }
  if (versionDropdownRef.value && !versionDropdownRef.value.contains(e.target)) { versionDropdownOpen.value = false; versionSearch.value = '' }
  if (productDropdownRef.value && !productDropdownRef.value.contains(e.target)) { productDropdownOpen.value = false }
  if (releaseTypeDropdownRef.value && !releaseTypeDropdownRef.value.contains(e.target)) { releaseTypeDropdownOpen.value = false }
  if (delOwnerDropdownRef.value && !delOwnerDropdownRef.value.contains(e.target)) { delOwnerDropdownOpen.value = false; delOwnerSearch.value = '' }
  if (pmOwnerDropdownRef.value && !pmOwnerDropdownRef.value.contains(e.target)) { pmOwnerDropdownOpen.value = false; pmOwnerSearch.value = '' }
}

function handleExpandAll() { if (tableRef.value) tableRef.value.expandAll() }
function handleCollapseAll() { if (tableRef.value) tableRef.value.collapseAll() }

function onPillarConfigSaved(newConfig) {
  pillarConfig.value = newConfig
  pillarPanelOpen.value = false
}

async function fetchPillarConfig() {
  try {
    var response = await fetch(getApiBase() + API_BASE + '/pillar-config')
    if (response.ok) {
      var data = await response.json()
      pillarConfig.value = data
    }
  } catch (e) { void e }
}

async function fetchComponents() {
  loadingComponents.value = true
  componentError.value = null
  try {
    var response = await fetch(getApiBase() + API_BASE + '/jira/components')
    if (!response.ok) {
      var errData = await response.json().catch(function() { return {} })
      throw new Error(errData.error || 'HTTP ' + response.status)
    }
    var data = await response.json()
    components.value = data.components || []
  } catch (err) {
    componentError.value = err.message
  } finally {
    loadingComponents.value = false
  }
}

function getEffectiveComponents() {
  if (selectedComponents.value.length > 0) return selectedComponents.value
  if (pillarAllowedComponents.value) return pillarFilteredComponents.value
  return []
}

function stopAutoRefresh() {
  if (autoRefreshTimer.value) {
    clearInterval(autoRefreshTimer.value)
    autoRefreshTimer.value = null
  }
}

function startAutoRefresh() {
  stopAutoRefresh()
  autoRefreshTimer.value = setInterval(function() {
    if (!hasFetched.value || loadingData.value) return
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    loadData({ silent: true })
  }, AUTO_REFRESH_MS)
}

async function loadData(opts) {
  var silent = opts && opts.silent
  var effectiveComponents = getEffectiveComponents()
  if (effectiveComponents.length === 0 && selectedVersions.value.length === 0) return

  if (activeLoadController) activeLoadController.abort()
  var controller = new AbortController()
  activeLoadController = controller

  if (!silent) loadingData.value = true
  if (!silent) dataError.value = null
  hasFetched.value = true

  try {
    var params = new URLSearchParams()
    if (effectiveComponents.length > 0) params.set('components', effectiveComponents.join(','))
    if (selectedVersions.value.length > 0) {
      var jiraVersions = resolveJiraVersions(selectedVersions.value)
      params.set('versions', jiraVersions.join(','))
    }
    var response = await fetch(getApiBase() + API_BASE + '/component-release-load?' + params.toString(), { signal: controller.signal })
    if (!response.ok) {
      var errData = await response.json().catch(function() { return {} })
      if (response.status === 504) {
        throw new Error(
          'Request timed out (HTTP 504). Narrow the Release or Pillar filter and retry — ' +
          'loading several releases with Pillar=All hits Jira too hard for the gateway limit.'
        )
      }
      throw new Error(errData.error || 'HTTP ' + response.status)
    }
    var data = await response.json()
    groups.value = data.groups || []
    fetchedAt.value = data.fetchedAt || null
    var delivered = data.delivered || {}
    deliveredIssues.value = delivered.issues || []
    deliveredSkipped.value = delivered.skipped || null
    deliveredTimedOut.value = !!delivered.timedOut
  } catch (err) {
    if (err.name === 'AbortError') return
    if (!silent) dataError.value = err.message
    if (!silent) {
      groups.value = []
      fetchedAt.value = null
      deliveredIssues.value = []
      deliveredSkipped.value = null
      deliveredTimedOut.value = false
    }
  } finally {
    if (activeLoadController === controller) {
      if (!silent) loadingData.value = false
      if (hasFetched.value && !autoRefreshTimer.value) startAutoRefresh()
    }
  }
}

watch(selectedPillars, function() {
  var allowed = pillarFilteredComponents.value
  selectedComponents.value = selectedComponents.value.filter(function(c) {
    return allowed.indexOf(c) >= 0
  })
}, { deep: true })

watch([selectedComponents, selectedVersions, selectedPillars], function() {
  var effectiveComponents = getEffectiveComponents()
  if (effectiveComponents.length === 0 && selectedVersions.value.length === 0) {
    if (activeLoadController) activeLoadController.abort()
    groups.value = []
    hasFetched.value = false
    deliveredIssues.value = []
    deliveredSkipped.value = null
    deliveredTimedOut.value = false
    return
  }
  loadData()
}, { deep: true })

// Save filters to localStorage on any filter change
watch(
  [selectedPillars, selectedComponents, selectedVersions, filterProduct, filterType, filterReleaseType, filterStatus, filterBlocked, filterAlignment, filterDelOwner, filterPmOwner, filterDocs],
  saveFilters,
  { deep: true }
)

onMounted(async function() {
  restoreFilters()
  await Promise.all([fetchPillarConfig(), fetchComponents()])
  document.addEventListener('mousedown', handleClickOutside)
  if (!hasFetched.value) {
    var effectiveComponents = getEffectiveComponents()
    if (effectiveComponents.length > 0 || selectedVersions.value.length > 0) {
      loadData()
    }
  }
})

onBeforeUnmount(function() {
  document.removeEventListener('mousedown', handleClickOutside)
  stopAutoRefresh()
  if (activeLoadController) activeLoadController.abort()
})
</script>
