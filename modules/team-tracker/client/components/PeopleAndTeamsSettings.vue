<template>
  <div class="space-y-6">
    <!-- Org Roots -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Org Roots</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Define the org leaders whose teams will be tracked. The roster sync traverses each leader's LDAP reporting chain.
      </p>

      <div class="space-y-3 mb-4">
        <div
          v-for="(root, idx) in editRoots"
          :key="idx"
          class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md"
        >
          <div class="flex-1 grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Kerberos UID</label>
              <input
                v-model="root.uid"
                placeholder="e.g. shgriffi"
                class="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Display Name</label>
              <input
                v-model="root.displayName"
                placeholder="e.g. AI Platform"
                class="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          <button
            @click="removeRoot(idx)"
            class="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors mt-4"
            title="Remove"
          >
            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <button
        @click="addRoot"
        class="text-sm text-primary-600 hover:text-primary-700 dark:hover:text-primary-400 font-medium flex items-center gap-1"
      >
        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Add org root
      </button>
    </div>

    <!-- Google Sheets Integration -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Google Sheets Integration</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Optionally enrich LDAP data with team assignments from a Google Sheet.
      </p>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Spreadsheet ID</label>
        <input
          v-model="editSheetId"
          placeholder="e.g. 1gQfxqHE5y9PIuW-pJONDITbeNA0Vg2x1pazywAcDHTg"
          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Enter the spreadsheet ID, then click "Discover Sheets" to select which sheets to include.
        </p>
      </div>

      <!-- Sheet Picker -->
      <div v-if="editSheetId.trim()" class="mt-4">
        <div class="flex items-center gap-2 mb-2">
          <button
            @click="handleDiscoverSheets"
            :disabled="discoveringSheets"
            class="px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 border border-primary-300 dark:border-primary-600 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="discoveringSheets" class="flex items-center gap-1.5">
              <svg class="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Discovering...
            </span>
            <span v-else>Discover Sheets</span>
          </button>
        </div>

        <div v-if="discoverError" class="text-sm text-red-600 dark:text-red-400 mb-2">
          {{ discoverError }}
        </div>

        <div v-if="discoveredSheets !== null && discoveredSheets.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
          No sheets found in this spreadsheet.
        </div>

        <div v-if="discoveredSheets !== null && discoveredSheets.length > 0" class="space-y-1.5">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select sheets to include</label>
          <label
            v-for="sheet in discoveredSheets"
            :key="sheet"
            class="flex items-center gap-2 cursor-pointer"
          >
            <input
              type="checkbox"
              :value="sheet"
              v-model="editSelectedSheets"
              class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ sheet }}</span>
          </label>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
            When no sheets are selected, all sheets are auto-discovered during sync.
          </p>
        </div>

        <p v-if="discoveredSheets === null && !discoverError" class="text-xs text-gray-400 dark:text-gray-500">
          Click "Discover Sheets" to load sheet names for this spreadsheet.
        </p>
      </div>
    </div>

    <!-- Column Mappings -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Column Mappings</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Map the required columns from your spreadsheet. These are used to match people and group them into teams.
      </p>

      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name Column <span class="text-red-500 dark:text-red-400">*</span></label>
          <input
            v-model="editNameColumn"
            placeholder="e.g. Associate's Name"
            class="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Exact column header used to match people from LDAP</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team Grouping Column <span class="text-red-500 dark:text-red-400">*</span></label>
          <input
            v-model="editTeamGroupingColumn"
            placeholder="e.g. Scrum Team Name"
            class="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Column used to group people into teams (comma-separated values create multi-team membership)</p>
        </div>
      </div>
    </div>

    <!-- Custom Fields -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Custom Fields</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Map additional spreadsheet columns to custom fields. These can be displayed on person cards and used for filtering.
      </p>

      <div class="space-y-3 mb-4">
        <div
          v-for="(field, idx) in editCustomFields"
          :key="idx"
          class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md"
        >
          <div class="grid grid-cols-3 gap-3 mb-2">
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Spreadsheet Column</label>
              <input
                v-model="field.columnLabel"
                placeholder="e.g. Engineering Speciality"
                class="w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                :class="columnLabelError(idx) ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'"
              />
              <p v-if="columnLabelError(idx)" class="text-xs text-red-500 dark:text-red-400 mt-0.5">{{ columnLabelError(idx) }}</p>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Display Label</label>
              <input
                v-model="field.displayLabel"
                placeholder="e.g. Specialty"
                class="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Key</label>
              <input
                v-model="field.key"
                placeholder="auto-generated"
                class="w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                :class="keyError(idx) ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'"
              />
              <p v-if="keyError(idx)" class="text-xs text-red-500 dark:text-red-400 mt-0.5">{{ keyError(idx) }}</p>
              <p v-else class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Letters, numbers, underscores</p>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <label class="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                v-model="field.visible"
                class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              />
              <span class="text-xs text-gray-600 dark:text-gray-400">Show in person details</span>
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer group relative">
              <input
                type="radio"
                name="primaryDisplay"
                :value="idx"
                :checked="primaryDisplayIdx === idx"
                @change="setPrimaryDisplay(idx)"
                class="border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              />
              <span class="text-xs text-gray-600 dark:text-gray-400">Show as badge on person cards</span>
              <svg class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="absolute bottom-full left-0 mb-1 hidden group-hover:block w-64 p-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-10">
                The badge field appears as a colored tag on each person card and as a filter on the People view. Only one field can be the badge. Use "Show in person details" for additional fields you want displayed.
              </div>
            </label>
            <button
              @click="removeField(idx)"
              class="ml-auto p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Remove field"
            >
              <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button
          @click="addField"
          :disabled="editCustomFields.length >= 20"
          class="text-sm text-primary-600 hover:text-primary-700 dark:hover:text-primary-400 font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add field
        </button>
        <button
          v-if="primaryDisplayIdx !== null"
          @click="clearPrimaryDisplay"
          class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-medium"
        >
          Clear primary display
        </button>
      </div>
    </div>

    <!-- Org Name Mapping -->
    <div v-if="orgConfig.teamBoardsTab" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div class="flex items-center justify-between mb-1">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Org Name Mapping</h3>
        <button
          @click="handleDetectOrgs"
          :disabled="detectingOrgs"
          class="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ detectingOrgs ? 'Detecting...' : 'Detect & Match' }}
        </button>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Maps org names from the spreadsheet to configured org display names. Only teams in configured orgs are synced.
      </p>

      <div v-if="orgMappingRows.length > 0" class="space-y-2">
        <!-- Auto-matched orgs -->
        <div
          v-for="row in autoMatchedOrgs"
          :key="'matched-' + row.sheetOrg"
          class="flex gap-2 items-center px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg"
        >
          <span class="flex-1 text-sm text-green-800 dark:text-green-300">{{ row.sheetOrg }}</span>
          <span class="text-green-400 text-sm">→</span>
          <span class="flex-1 text-sm text-green-800 dark:text-green-300">{{ row.sheetOrg }}</span>
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">matched</span>
        </div>

        <!-- Unmatched / suggested orgs -->
        <div
          v-for="row in unmatchedOrgs"
          :key="'unmatched-' + row.sheetOrg"
          class="rounded-lg"
          :class="row.isSuggestion && row.selectedOrg ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-3' : ''"
        >
          <div class="flex gap-2 items-center">
            <span class="flex-1 px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300">{{ row.sheetOrg }}</span>
            <span class="text-gray-400 text-sm">→</span>
            <select
              v-model="row.selectedOrg"
              class="flex-1 px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              :class="row.isSuggestion && row.selectedOrg ? 'border-amber-300 dark:border-amber-600' : 'border-gray-300 dark:border-gray-600'"
              @change="row.isSuggestion && (row.isSuggestion = false)"
            >
              <option value="">— skip (don't sync) —</option>
              <option v-for="org in configuredOrgs" :key="org" :value="org">{{ org }}</option>
            </select>
          </div>
          <div v-if="row.isSuggestion && row.selectedOrg" class="flex items-center justify-between mt-2">
            <span class="text-xs text-amber-700 dark:text-amber-300">Suggested match — does this look right?</span>
            <div class="flex gap-2">
              <button
                @click="row.isSuggestion = false"
                class="px-2.5 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
              >
                Accept
              </button>
              <button
                @click="row.selectedOrg = ''; row.isSuggestion = false"
                class="px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="!detectingOrgs" class="text-xs text-gray-400 dark:text-gray-500 py-2">
        Click "Detect & Match" to discover org names from the spreadsheet.
      </div>

      <p v-if="detectError" class="mt-2 text-xs text-red-600 dark:text-red-400">{{ detectError }}</p>
    </div>

    <!-- Username Inference -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Username Inference</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Optionally infer missing GitHub/GitLab usernames by matching roster people against org/group member lists.
      </p>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GitHub Orgs</label>
          <div class="space-y-2 mb-2">
            <div v-for="(org, idx) in editGithubOrgs" :key="'gh-' + idx" class="flex items-center gap-2">
              <input
                v-model="editGithubOrgs[idx]"
                placeholder="e.g. opendatahub-io"
                class="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              <button
                @click="editGithubOrgs.splice(idx, 1)"
                class="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Remove"
              >
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <button
            @click="editGithubOrgs.push('')"
            class="text-sm text-primary-600 hover:text-primary-700 dark:hover:text-primary-400 font-medium flex items-center gap-1"
          >
            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Add GitHub org
          </button>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Requires GITHUB_TOKEN env var.</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GitLab Instances</label>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Configure one or more GitLab instances. Each instance needs its own token env var set on the server.
          </p>
          <div class="space-y-4 mb-3">
            <div
              v-for="(instance, iIdx) in editGitlabInstances"
              :key="'gli-' + iIdx"
              class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md border border-gray-200 dark:border-gray-600"
            >
              <div class="flex items-start justify-between mb-3">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Instance {{ iIdx + 1 }}</span>
                <button
                  @click="editGitlabInstances.splice(iIdx, 1)"
                  class="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Remove instance"
                >
                  <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <div class="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Label</label>
                  <input
                    v-model="instance.label"
                    placeholder="e.g. GitLab.com"
                    class="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Base URL</label>
                  <input
                    v-model="instance.baseUrl"
                    placeholder="https://gitlab.com"
                    class="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    :class="{ 'border-red-400 dark:border-red-500': instance.baseUrl && !instance.baseUrl.startsWith('https://') }"
                  />
                  <p v-if="instance.baseUrl && !instance.baseUrl.startsWith('https://')" class="text-xs text-red-500 mt-0.5">Must start with https://</p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Token Env Var</label>
                  <input
                    v-model="instance.tokenEnvVar"
                    placeholder="GITLAB_TOKEN"
                    class="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Groups</label>
                <div class="space-y-2 mb-2">
                  <div v-for="(group, gIdx) in instance.groups" :key="'glg-' + iIdx + '-' + gIdx" class="flex items-center gap-2">
                    <input
                      v-model="instance.groups[gIdx]"
                      placeholder="e.g. redhat/rhoai"
                      class="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                    <button
                      @click="instance.groups.splice(gIdx, 1)"
                      class="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Remove group"
                    >
                      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <button
                  @click="instance.groups.push('')"
                  class="text-sm text-primary-600 hover:text-primary-700 dark:hover:text-primary-400 font-medium flex items-center gap-1"
                >
                  <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add group
                </button>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Exclude Groups</label>
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">Skip specific groups (e.g., mirrors)</p>
                <div class="space-y-2 mb-2">
                  <div v-for="(group, eIdx) in instance.excludeGroups" :key="'gle-' + iIdx + '-' + eIdx" class="flex items-center gap-2">
                    <input
                      v-model="instance.excludeGroups[eIdx]"
                      placeholder="e.g. redhat/rhel-ai/core/mirrors"
                      class="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                    <button
                      @click="instance.excludeGroups.splice(eIdx, 1)"
                      class="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Remove excluded group"
                    >
                      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <button
                  @click="instance.excludeGroups.push('')"
                  class="text-sm text-primary-600 hover:text-primary-700 dark:hover:text-primary-400 font-medium flex items-center gap-1"
                >
                  <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add excluded group
                </button>
              </div>
            </div>
          </div>
          <button
            @click="addGitlabInstance"
            class="text-sm text-primary-600 hover:text-primary-700 dark:hover:text-primary-400 font-medium flex items-center gap-1"
          >
            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Add GitLab instance
          </button>
        </div>
      </div>
    </div>

    <!-- Save -->
    <div class="flex items-center gap-3">
      <button
        @click="handleSave"
        :disabled="saving || !canSave"
        class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {{ saving ? 'Saving...' : 'Save Configuration' }}
      </button>
      <span v-if="saveMessage" class="text-sm" :class="saveError ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
        {{ saveMessage }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRosterSync } from '../composables/useRosterSync'
import { useOrgRoster } from '../composables/useOrgRoster'

const emit = defineEmits(['toast', 'config-saved'])

const {
  config,
  saving,
  fetchConfig,
  saveConfig,
  discoverSheets
} = useRosterSync()

const {
  loadSheetOrgs,
  loadConfiguredOrgs,
  loadConfig: loadOrgConfig,
  saveConfig: saveOrgConfig
} = useOrgRoster()

// --- Form state ---
const editRoots = ref([])
const editGithubOrgs = ref([])
const editGitlabInstances = ref([])
const editSheetId = ref('')
const editNameColumn = ref('')
const editTeamGroupingColumn = ref('')
const editCustomFields = ref([])
const primaryDisplayIdx = ref(null)
const editSelectedSheets = ref([])
const discoveredSheets = ref(null)
const discoveringSheets = ref(false)
const discoverError = ref(null)

// Org name mapping state
const orgConfig = ref({ teamBoardsTab: '', orgNameMapping: {} })
const orgMappingRows = ref([])
const configuredOrgs = ref([])
const detectingOrgs = ref(false)
const detectError = ref('')

const saveMessage = ref(null)
const saveError = ref(false)

// Snapshot original values for detecting structure-affecting changes
let savedOrgRoots = []
let savedSheetId = ''
let savedNameColumn = ''
let savedTeamGroupingColumn = ''
let savedOrgNameMapping = {}

const autoMatchedOrgs = computed(() => orgMappingRows.value.filter(r => r.isExactMatch))
const unmatchedOrgs = computed(() => orgMappingRows.value.filter(r => !r.isExactMatch))

const hasErrors = computed(() => {
  return editCustomFields.value.some((_, idx) => keyError(idx) || columnLabelError(idx))
})

const canSave = computed(() => {
  if (hasErrors.value) return false
  const hasOrgRoots = editRoots.value.some(r => r.uid && r.displayName)
  if (!hasOrgRoots) return false
  const hasAnyStructure = editNameColumn.value.trim() || editTeamGroupingColumn.value.trim() || editCustomFields.value.length > 0
  if (hasAnyStructure) {
    if (!editNameColumn.value.trim() || !editTeamGroupingColumn.value.trim()) return false
  }
  return true
})

// --- Populate from loaded configs ---

let populatingForm = false
function populateForm() {
  if (config.value) {
    populatingForm = true

    // Roster sync fields
    if (config.value.configured) {
      editRoots.value = (config.value.orgRoots || []).map(r => ({ ...r }))
      editGithubOrgs.value = [...(config.value.githubOrgs || [])]
      editGitlabInstances.value = (config.value.gitlabInstances || []).map(i => ({
        label: i.label || '',
        baseUrl: i.baseUrl || '',
        tokenEnvVar: i.tokenEnvVar || '',
        groups: [...(i.groups || [])],
        excludeGroups: [...(i.excludeGroups || [])]
      }))
    } else {
      editRoots.value = [{ uid: '', displayName: '' }]
      editGithubOrgs.value = []
      editGitlabInstances.value = []
    }

    // Team structure fields
    editSheetId.value = config.value.googleSheetId || ''
    editSelectedSheets.value = [...(config.value.sheetNames || [])]
    const ts = config.value.teamStructure
    if (ts) {
      editNameColumn.value = ts.nameColumn || ''
      editTeamGroupingColumn.value = ts.teamGroupingColumn || ''
      editCustomFields.value = (ts.customFields || []).map(f => ({ ...f }))
      const pIdx = editCustomFields.value.findIndex(f => f.primaryDisplay)
      primaryDisplayIdx.value = pIdx >= 0 ? pIdx : null
    } else {
      editNameColumn.value = ''
      editTeamGroupingColumn.value = ''
      editCustomFields.value = []
      primaryDisplayIdx.value = null
    }

    // Snapshot saved values for structure-affecting detection
    savedOrgRoots = JSON.stringify(editRoots.value)
    savedSheetId = editSheetId.value
    savedNameColumn = editNameColumn.value
    savedTeamGroupingColumn = editTeamGroupingColumn.value
    savedOrgNameMapping = JSON.stringify(orgConfig.value.orgNameMapping || {})

    populatingForm = false
  }
}

watch(config, populateForm)

// Clear discovered sheets when spreadsheet ID changes (but not during form population)
watch(editSheetId, () => {
  if (populatingForm) return
  discoveredSheets.value = null
  editSelectedSheets.value = []
  discoverError.value = null
})

onMounted(async () => {
  const [, orgCfg] = await Promise.all([
    fetchConfig(),
    loadOrgConfig().catch(() => null)
  ])
  if (orgCfg) {
    orgConfig.value = orgCfg
    if (Object.keys(orgCfg.orgNameMapping || {}).length > 0) {
      handleDetectOrgs()
    }
  }
  populateForm()
})

// --- Helpers ---

function addRoot() {
  editRoots.value.push({ uid: '', displayName: '' })
}

function removeRoot(idx) {
  editRoots.value.splice(idx, 1)
}

function addField() {
  editCustomFields.value.push({ key: '', columnLabel: '', displayLabel: '', visible: false, primaryDisplay: false })
}

function removeField(idx) {
  editCustomFields.value.splice(idx, 1)
  if (primaryDisplayIdx.value === idx) {
    primaryDisplayIdx.value = null
  } else if (primaryDisplayIdx.value !== null && primaryDisplayIdx.value > idx) {
    primaryDisplayIdx.value--
  }
}

function setPrimaryDisplay(idx) {
  primaryDisplayIdx.value = idx
}

function clearPrimaryDisplay() {
  primaryDisplayIdx.value = null
}

function addGitlabInstance() {
  editGitlabInstances.value.push({ label: '', baseUrl: '', tokenEnvVar: '', groups: [], excludeGroups: [] })
}

function keyError(idx) {
  const key = (editCustomFields.value[idx].key || '').trim()
  if (!key) return null
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) return 'Invalid: letters, numbers, underscores only'
  const reserved = ['_teamGrouping', 'name', 'originalName', 'sourceSheet', '__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty']
  if (reserved.includes(key)) return 'Reserved key'
  const duplicate = editCustomFields.value.some((f, i) => i !== idx && f.key.trim() === key)
  if (duplicate) return 'Duplicate key'
  return null
}

function columnLabelError(idx) {
  const col = (editCustomFields.value[idx].columnLabel || '').trim()
  if (!col) return null
  const duplicate = editCustomFields.value.some((f, i) => i !== idx && (f.columnLabel || '').trim() === col)
  if (duplicate) return 'Duplicate column'
  return null
}

function generateKey(label) {
  if (!label) return ''
  return label
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

function deduplicateKey(key, existingKeys) {
  if (!existingKeys.has(key)) return key
  let i = 2
  while (existingKeys.has(key + i)) i++
  return key + i
}

function findBestMatch(sheetOrg, configured) {
  const lower = sheetOrg.toLowerCase()
  for (const org of configured) {
    const orgLower = org.toLowerCase()
    if (lower.includes(orgLower) || orgLower.includes(lower)) {
      return org
    }
  }
  const sheetWords = new Set(lower.split(/\s+/))
  let bestOrg = null
  let bestOverlap = 0
  for (const org of configured) {
    const orgWords = org.toLowerCase().split(/\s+/)
    const overlap = orgWords.filter(w => sheetWords.has(w)).length
    if (overlap > bestOverlap && overlap >= Math.ceil(orgWords.length / 2)) {
      bestOverlap = overlap
      bestOrg = org
    }
  }
  return bestOrg
}

async function handleDetectOrgs() {
  detectingOrgs.value = true
  detectError.value = ''
  try {
    const [sheetData, configData] = await Promise.all([
      loadSheetOrgs(),
      loadConfiguredOrgs()
    ])
    const sheetOrgs = sheetData.sheetOrgs || []
    configuredOrgs.value = configData.configuredOrgs || []
    const savedMapping = orgConfig.value.orgNameMapping || {}
    const configuredSet = new Set(configuredOrgs.value)

    orgMappingRows.value = sheetOrgs.map(sheetOrg => {
      if (configuredSet.has(sheetOrg)) {
        return { sheetOrg, selectedOrg: sheetOrg, isSuggestion: false, isExactMatch: true }
      }
      if (savedMapping[sheetOrg] && configuredSet.has(savedMapping[sheetOrg])) {
        return { sheetOrg, selectedOrg: savedMapping[sheetOrg], isSuggestion: false, isExactMatch: false }
      }
      const suggestion = findBestMatch(sheetOrg, configuredOrgs.value)
      return { sheetOrg, selectedOrg: suggestion || '', isSuggestion: !!suggestion, isExactMatch: false }
    })
  } catch (err) {
    detectError.value = err.message
  } finally {
    detectingOrgs.value = false
  }
}

async function handleDiscoverSheets() {
  discoveringSheets.value = true
  discoverError.value = null
  try {
    const sheets = await discoverSheets(editSheetId.value.trim())
    discoveredSheets.value = sheets
    editSelectedSheets.value = editSelectedSheets.value.filter(s => sheets.includes(s))
  } catch (err) {
    discoverError.value = err.message
    discoveredSheets.value = null
  } finally {
    discoveringSheets.value = false
  }
}

// --- Save ---

async function handleSave() {
  saveMessage.value = null
  saveError.value = false

  const orgRoots = editRoots.value
    .filter(r => r.uid && r.displayName)
    .map(r => ({ uid: r.uid.trim(), displayName: r.displayName.trim() }))

  if (orgRoots.length === 0) {
    saveMessage.value = 'At least one org root with UID and display name is required.'
    saveError.value = true
    return
  }

  try {
    // Build teamStructure if configured
    let teamStructure = null
    if (editNameColumn.value.trim() && editTeamGroupingColumn.value.trim()) {
      const usedKeys = new Set()
      const customFields = editCustomFields.value
        .filter(f => f.columnLabel.trim())
        .map((f, idx) => {
          let key = f.key.trim()
          if (!key) {
            key = generateKey(f.displayLabel || f.columnLabel)
          }
          if (!key) key = 'field'
          key = deduplicateKey(key, usedKeys)
          usedKeys.add(key)
          return {
            key,
            columnLabel: f.columnLabel.trim(),
            displayLabel: (f.displayLabel || f.columnLabel).trim(),
            visible: !!f.visible,
            primaryDisplay: primaryDisplayIdx.value === idx
          }
        })

      teamStructure = {
        nameColumn: editNameColumn.value.trim(),
        teamGroupingColumn: editTeamGroupingColumn.value.trim(),
        customFields
      }
    }

    // Save org name mapping first (if detect has been run)
    let orgConfigSaveError = null
    if (orgMappingRows.value.length > 0) {
      const mapping = {}
      for (const row of orgMappingRows.value) {
        if (!row.isExactMatch && row.selectedOrg) {
          mapping[row.sheetOrg] = row.selectedOrg
        }
      }
      try {
        await saveOrgConfig({ orgNameMapping: mapping })
        orgConfig.value.orgNameMapping = mapping
        for (const row of orgMappingRows.value) {
          if (row.selectedOrg) row.isSuggestion = false
        }
      } catch (err) {
        orgConfigSaveError = err
      }
    }

    // Save roster sync config
    const githubOrgs = editGithubOrgs.value.map(s => s.trim()).filter(Boolean)
    const gitlabInstances = editGitlabInstances.value
      .filter(i => i.label.trim() && i.baseUrl.trim() && i.tokenEnvVar.trim())
      .map(i => ({
        label: i.label.trim(),
        baseUrl: i.baseUrl.trim(),
        tokenEnvVar: i.tokenEnvVar.trim(),
        groups: i.groups.map(g => g.trim()).filter(Boolean),
        excludeGroups: (i.excludeGroups || []).map(g => g.trim()).filter(Boolean)
      }))

    try {
      await saveConfig({
        orgRoots,
        githubOrgs,
        gitlabInstances,
        googleSheetId: editSheetId.value.trim() || null,
        sheetNames: editSelectedSheets.value,
        teamStructure
      })
    } catch (err) {
      if (orgConfigSaveError) {
        // Both failed — re-fetch both to show accurate state
        await Promise.all([fetchConfig(), loadOrgConfig().catch(() => null)])
        populateForm()
        saveMessage.value = 'Both saves failed. Forms refreshed.'
        saveError.value = true
        return
      }
      // Only roster-sync config failed — re-fetch both
      await Promise.all([fetchConfig(), loadOrgConfig().catch(() => null)])
      populateForm()
      saveMessage.value = `Roster sync config save failed: ${err.message}`
      saveError.value = true
      return
    }

    if (orgConfigSaveError) {
      // Org config failed but roster sync succeeded — re-fetch both
      await Promise.all([fetchConfig(), loadOrgConfig().catch(() => null)])
      populateForm()
      saveMessage.value = `Org config save failed: ${orgConfigSaveError.message}`
      saveError.value = true
      return
    }

    // Detect if structure-affecting fields changed
    const currentOrgRoots = JSON.stringify(orgRoots)
    const currentOrgMapping = JSON.stringify(orgConfig.value.orgNameMapping || {})
    const structureAffecting =
      currentOrgRoots !== savedOrgRoots ||
      editSheetId.value !== savedSheetId ||
      editNameColumn.value !== savedNameColumn ||
      editTeamGroupingColumn.value !== savedTeamGroupingColumn ||
      currentOrgMapping !== savedOrgNameMapping

    // Update snapshots
    savedOrgRoots = currentOrgRoots
    savedSheetId = editSheetId.value
    savedNameColumn = editNameColumn.value
    savedTeamGroupingColumn = editTeamGroupingColumn.value
    savedOrgNameMapping = currentOrgMapping

    saveMessage.value = 'Configuration saved.'
    emit('toast', { message: 'Configuration saved', type: 'success' })
    emit('config-saved', { structureAffecting })
    setTimeout(() => { saveMessage.value = null }, 3000)
  } catch (err) {
    saveMessage.value = err.message
    saveError.value = true
  }
}
</script>
