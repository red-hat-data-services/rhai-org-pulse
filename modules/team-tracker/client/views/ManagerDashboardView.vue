<template>
  <div class="max-w-7xl mx-auto px-4 py-6">
    <div data-tour="dashboard-header" class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">My Teams</h2>
      <button
        v-if="!loading && !error && reason !== 'no-registry-identity'"
        @click="handleLaunchTutorial"
        class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Dashboard tour"
      >
        <CircleQuestionMark class="w-5 h-5" />
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="text-center py-12 text-gray-500 dark:text-gray-400">
      Loading dashboard...
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-center py-12 text-red-600 dark:text-red-400">
      {{ error }}
    </div>

    <!-- Empty state: no registry identity -->
    <div v-else-if="reason === 'no-registry-identity'" class="text-center py-12 text-gray-500 dark:text-gray-400">
      <p class="text-lg font-medium mb-2">No Registry Identity</p>
      <p>Your account is not linked to the people registry. In local dev, this typically means your email address does not match any person in the registry.</p>
    </div>

    <!-- Empty state: no direct reports -->
    <div v-else-if="reason === 'no-direct-reports'" class="text-center py-12 text-gray-500 dark:text-gray-400">
      <p class="text-lg font-medium mb-2">No Direct Reports</p>
      <p>You have no direct reports in the system.</p>
    </div>

    <!-- Dashboard content -->
    <template v-else>
      <!-- Include indirect reports toggle -->
      <label data-tour="indirect-toggle" class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4 cursor-pointer select-none">
        <button
          role="switch"
          :aria-checked="includeIndirect"
          @click="toggleIndirectReports"
          class="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          :class="includeIndirect ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'"
        >
          <span
            class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            :class="includeIndirect ? 'translate-x-4' : 'translate-x-0'"
          />
        </button>
        Include indirect reports
      </label>

      <!-- Tabs -->
      <div class="flex space-x-4 border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          :data-tour="tab.id === 'teams' ? 'tab-teams' : undefined"
          class="pb-2 px-1 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === tab.id
            ? 'border-primary-600 text-primary-600'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
        >
          {{ tab.label }}
          <span class="ml-1 text-xs text-gray-400 dark:text-gray-500">({{ tab.count }})</span>
        </button>
      </div>

      <!-- My Reports tab -->
      <div v-if="activeTab === 'reports'">
        <div v-if="directReports.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
          No direct reports found.
        </div>
        <div v-else>
          <!-- Edit mode controls -->
          <div class="flex items-center justify-end gap-3 mb-3">
            <template v-if="bulkEditing">
              <span v-if="pendingChangeCount > 0" class="text-xs text-amber-600 dark:text-amber-400">{{ pendingChangeCount }} unsaved change{{ pendingChangeCount !== 1 ? 's' : '' }}</span>
              <button
                class="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors"
                :disabled="saving || pendingChangeCount === 0"
                @click="saveAllChanges"
              >
                {{ saving ? 'Saving...' : `Save All (${pendingChangeCount})` }}
              </button>
              <button
                class="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors"
                :disabled="saving"
                @click="cancelBulkEdit"
              >
                Cancel
              </button>
            </template>
            <button
              v-else
              data-tour="edit-all-btn"
              class="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors flex items-center gap-1.5"
              @click="enterBulkEdit"
            >
              <Pencil class="w-3.5 h-3.5" />
              Edit All Fields
            </button>
          </div>

          <!-- Search -->
          <div data-tour="search-reports" class="relative mb-3">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by name, title, team, or field values..."
              class="w-full pl-9 pr-8 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
            <button
              v-if="searchQuery"
              @click="searchQuery = ''"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Field completeness banner -->
          <div
            v-if="!bannerDismissed && incompleteReports.length > 0"
            class="flex items-center gap-3 px-4 py-3 mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm"
          >
            <AlertTriangle class="w-4 h-4 flex-shrink-0" />
            <span>{{ incompleteReports.length }} of {{ visibleReports.length }} {{ visibleReports.length === 1 ? 'person has' : 'people have' }} incomplete fields</span>
            <button
              @click="showIncompleteOnly = !showIncompleteOnly"
              class="ml-auto text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline"
            >{{ showIncompleteOnly ? 'Show all' : 'Show incomplete only' }}</button>
            <button @click="bannerDismissed = true" class="text-amber-500 hover:text-amber-700">
              <X class="w-4 h-4" />
            </button>
          </div>

          <div v-if="searchQuery && filteredReports.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
            No reports match "{{ searchQuery }}"
          </div>

          <table v-else class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" :class="bulkEditing ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'">Name</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" :class="bulkEditing ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'">Title</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" :class="bulkEditing ? 'text-primary-700 dark:text-primary-300 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-500 dark:text-gray-400'">Team(s)</th>
                <th
                  v-for="(field, idx) in visiblePersonFields"
                  :key="field.id"
                  :data-tour="idx === 0 ? 'field-cell' : undefined"
                  class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                  :class="bulkEditing ? 'text-primary-700 dark:text-primary-300 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-500 dark:text-gray-400'"
                >{{ field.label }}</th>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="report in filteredReports"
                :key="report.uid"
                class="hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <td class="px-4 py-3 text-sm whitespace-nowrap" :class="bulkEditing ? 'opacity-50' : ''">
                  <div class="flex items-center gap-1.5">
                    <button
                      @click="navigateToPersonDetail(report.uid)"
                      class="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                    >
                      {{ report.name }}
                    </button>
                    <span
                      v-if="includeIndirect && !directReportUidSet.has(report.uid)"
                      class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                      title="Indirect report"
                    >indirect</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-sm whitespace-nowrap" :class="bulkEditing ? 'opacity-50 text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-400'">
                  {{ report.title || '—' }}
                </td>
                <td class="px-4 py-3 text-sm" :class="bulkEditing ? 'bg-blue-50 dark:bg-blue-900/20' : ''">
                  <!-- BULK EDIT MODE -->
                  <div v-if="bulkEditing" class="min-w-[140px]">
                    <ConstrainedAutocomplete
                      :model-value="getBulkTeamValue(report.uid)"
                      :options="allOrgTeamNames"
                      :multi-value="true"
                      @update:model-value="setBulkTeamValue(report.uid, $event)"
                    />
                  </div>

                  <!-- SINGLE-CELL EDIT MODE -->
                  <div v-else-if="editingTeamUid === report.uid" class="relative min-w-[160px]">
                    <ConstrainedAutocomplete
                      :model-value="editTeamValue"
                      :options="allOrgTeamNames"
                      :multi-value="true"
                      @update:model-value="editTeamValue = $event"
                    />
                    <div class="flex gap-1.5 mt-1">
                      <button class="px-2 py-0.5 text-xs font-medium text-white bg-primary-600 rounded hover:bg-primary-700 disabled:opacity-50" :disabled="saving" @click="saveTeamEdit(report.uid)">Save</button>
                      <button class="px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600" @click="cancelTeamEdit">Cancel</button>
                    </div>
                  </div>

                  <!-- DISPLAY MODE -->
                  <div v-else class="group flex items-center gap-1.5 cursor-pointer" @click="startTeamEdit(report)">
                    <div v-if="report.teamIds.length > 0">
                      <template v-for="(id, idx) in report.teamIds" :key="id">
                        <span v-if="idx > 0" class="text-gray-400 dark:text-gray-500">, </span>
                        <button
                          v-if="teamById[id]"
                          @click.stop="navigateToTeamDetail(teamById[id])"
                          class="text-primary-600 dark:text-primary-400 hover:underline"
                        >{{ teamById[id].name }}</button>
                        <span v-else class="text-gray-600 dark:text-gray-400">{{ id }}</span>
                      </template>
                    </div>
                    <span v-else class="text-amber-500 dark:text-amber-400">Unassigned</span>
                    <svg class="h-3 w-3 text-gray-400 dark:text-gray-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                </td>
                <!-- Field cells -->
                <td
                  v-for="field in visiblePersonFields"
                  :key="field.id"
                  class="px-4 py-3 text-sm"
                  :class="bulkEditing ? 'bg-blue-50 dark:bg-blue-900/20' : ''"
                >
                  <!-- BULK EDIT MODE: all cells are editors -->
                  <div v-if="bulkEditing" class="min-w-[140px]">
                    <ConstrainedAutocomplete
                      v-if="field.type === 'constrained' && field.allowedValues"
                      :model-value="getBulkValue(report.uid, field)"
                      :options="field.allowedValues"
                      :multi-value="!!field.multiValue"
                      @update:model-value="setBulkValue(report.uid, field.id, $event)"
                    />
                    <PersonAutocomplete
                      v-else-if="field.type === 'person-reference-linked'"
                      :model-value="getBulkValue(report.uid, field)"
                      :people="allPeopleForEditor"
                      @update:model-value="setBulkValue(report.uid, field.id, $event)"
                    />
                    <input
                      v-else
                      :value="getBulkValue(report.uid, field)"
                      class="w-full rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm"
                      @input="setBulkValue(report.uid, field.id, $event.target.value)"
                    >
                  </div>

                  <!-- SINGLE-CELL EDIT MODE -->
                  <div v-else-if="editingCell.uid === report.uid && editingCell.fieldId === field.id" class="editing-cell relative min-w-[160px]">
                    <ConstrainedAutocomplete
                      v-if="field.type === 'constrained' && field.allowedValues"
                      :model-value="editValue"
                      :options="field.allowedValues"
                      :multi-value="!!field.multiValue"
                      @update:model-value="editValue = $event"
                      @save="saveCell(report.uid, field.id)"
                      @cancel="cancelEdit"
                    />
                    <PersonAutocomplete
                      v-else-if="field.type === 'person-reference-linked'"
                      :model-value="editValue"
                      :people="allPeopleForEditor"
                      @update:model-value="editValue = $event"
                      @save="saveCell(report.uid, field.id)"
                      @cancel="cancelEdit"
                    />
                    <input
                      v-else
                      v-model="editValue"
                      class="w-full rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm"
                      @keyup.enter="saveCell(report.uid, field.id)"
                      @keyup.escape="cancelEdit"
                    >
                    <div class="flex gap-1.5 mt-1">
                      <button class="px-2 py-0.5 text-xs font-medium text-white bg-primary-600 rounded hover:bg-primary-700 disabled:opacity-50" :disabled="saving" @click="saveCell(report.uid, field.id)">Save</button>
                      <button class="px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600" @click="cancelEdit">Cancel</button>
                    </div>
                  </div>

                  <!-- DISPLAY MODE -->
                  <div
                    v-else
                    class="group flex items-center gap-1.5 cursor-pointer"
                    :class="{ 'bg-red-100 dark:bg-red-700/50 rounded px-1': isFieldEmpty(report.customFields?.[field.id], field) }"
                    @click="startCellEdit(report, field)"
                  >
                    <template v-if="field.multiValue && field.type === 'constrained'">
                      <div class="flex flex-wrap gap-1">
                        <span
                          v-for="v in displayMultiValues(report, field)"
                          :key="v"
                          class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        >{{ v }}</span>
                        <span v-if="displayMultiValues(report, field).length === 0" class="text-gray-400 dark:text-gray-500">—</span>
                      </div>
                    </template>
                    <template v-else-if="field.type === 'person-reference-linked'">
                      <span v-if="resolvePersonName(report.customFields?.[field.id])" class="text-primary-600 dark:text-primary-400">{{ resolvePersonName(report.customFields?.[field.id]) }}</span>
                      <span v-else class="text-gray-400 dark:text-gray-500">—</span>
                    </template>
                    <template v-else>
                      <span class="text-gray-900 dark:text-gray-100">{{ displaySingleValue(report, field) }}</span>
                    </template>
                    <svg class="h-3 w-3 text-gray-400 dark:text-gray-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- My Teams tab -->
      <div v-if="activeTab === 'teams'">
        <div v-if="teams.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
          None of your direct reports are assigned to a team.
        </div>
        <div v-else>
          <!-- Edit mode controls -->
          <div class="flex items-center justify-end gap-3 mb-3">
            <template v-if="teamBulkEditing">
              <span v-if="teamPendingChangeCount > 0" class="text-xs text-amber-600 dark:text-amber-400">{{ teamPendingChangeCount }} unsaved change{{ teamPendingChangeCount !== 1 ? 's' : '' }}</span>
              <button
                class="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors"
                :disabled="saving || teamPendingChangeCount === 0"
                @click="saveAllTeamChanges"
              >
                {{ saving ? 'Saving...' : `Save All (${teamPendingChangeCount})` }}
              </button>
              <button
                class="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors"
                :disabled="saving"
                @click="cancelTeamBulkEdit"
              >
                Cancel
              </button>
            </template>
            <button
              v-else
              class="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors flex items-center gap-1.5"
              @click="enterTeamBulkEdit"
            >
              <Pencil class="w-3.5 h-3.5" />
              Edit All Fields
            </button>
          </div>

          <!-- Search -->
          <div class="relative mb-3">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              v-model="teamSearchQuery"
              type="text"
              placeholder="Search by team name, org, or field values..."
              class="w-full pl-9 pr-8 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
            <button
              v-if="teamSearchQuery"
              @click="teamSearchQuery = ''"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Field completeness banner -->
          <div
            v-if="!teamBannerDismissed && incompleteTeams.length > 0"
            class="flex items-center gap-3 px-4 py-3 mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm"
          >
            <AlertTriangle class="w-4 h-4 flex-shrink-0" />
            <span>{{ incompleteTeams.length }} of {{ teams.length }} {{ teams.length === 1 ? 'team has' : 'teams have' }} incomplete fields</span>
            <button
              @click="showIncompleteTeamsOnly = !showIncompleteTeamsOnly"
              class="ml-auto text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline"
            >{{ showIncompleteTeamsOnly ? 'Show all' : 'Show incomplete only' }}</button>
            <button @click="teamBannerDismissed = true" class="text-amber-500 hover:text-amber-700">
              <X class="w-4 h-4" />
            </button>
          </div>

          <div v-if="teamSearchQuery && filteredTeams.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
            No teams match "{{ teamSearchQuery }}"
          </div>

          <div v-else data-tour="team-fields-table" class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" :class="teamBulkEditing ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'">Team</th>
                  <th
                    v-for="field in visibleTeamFields"
                    :key="field.id"
                    class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                    :class="teamBulkEditing ? 'text-primary-700 dark:text-primary-300 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-500 dark:text-gray-400'"
                  >{{ field.label }}</th>
                  <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" :class="teamBulkEditing ? 'text-primary-700 dark:text-primary-300 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-500 dark:text-gray-400'">Boards</th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                <tr
                  v-for="(team, idx) in filteredTeams"
                  :key="team.id"
                  class="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <!-- Team name -->
                  <td class="px-4 py-3 text-sm whitespace-nowrap" :class="teamBulkEditing ? 'opacity-50' : ''">
                    <button
                      :data-tour="idx === 0 ? 'first-team-link' : undefined"
                      :data-tour-team-key="idx === 0 ? `${team.orgKey}::${team.name}` : undefined"
                      @click="navigateToTeamDetail(team)"
                      class="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                    >{{ team.name }}</button>
                    <span v-if="teamsHaveMultipleOrgs" class="ml-1.5 text-xs text-gray-400 dark:text-gray-500">{{ team.orgDisplayName || team.orgKey }}</span>
                  </td>
                  <!-- Team field cells -->
                  <td
                    v-for="field in visibleTeamFields"
                    :key="field.id"
                    class="px-4 py-3 text-sm text-left"
                    :class="teamBulkEditing ? 'bg-blue-50 dark:bg-blue-900/20' : ''"
                  >
                    <!-- BULK EDIT MODE -->
                    <div v-if="teamBulkEditing" class="min-w-[140px]">
                      <ConstrainedAutocomplete
                        v-if="field.type === 'constrained' && field.allowedValues"
                        :model-value="getTeamBulkValue(team.id, field)"
                        :options="field.allowedValues"
                        :multi-value="!!field.multiValue"
                        @update:model-value="setTeamBulkValue(team.id, field.id, $event)"
                      />
                      <div v-else-if="field.type === 'person-reference-linked'" class="space-y-1">
                        <div class="flex flex-wrap gap-1">
                          <span
                            v-for="uid in getTeamBulkValue(team.id, field)"
                            :key="uid"
                            class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                          >
                            {{ referencedPeople[uid] || uid }}
                            <button class="ml-1 text-primary-500 hover:text-primary-700" @click="removeFromTeamBulkPersonValue(team.id, field.id, uid)">&times;</button>
                          </span>
                        </div>
                        <PersonAutocomplete
                          :model-value="''"
                          :people="allPeopleForEditor.filter(p => !getTeamBulkValue(team.id, field).includes(p.uid))"
                          placeholder="Add person..."
                          @update:model-value="addToTeamBulkPersonValue(team.id, field.id, $event)"
                        />
                      </div>
                      <input
                        v-else
                        :value="getTeamBulkValue(team.id, field)"
                        class="w-full rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm"
                        @input="setTeamBulkValue(team.id, field.id, $event.target.value)"
                      >
                    </div>

                    <!-- SINGLE-CELL EDIT MODE -->
                    <div v-else-if="editingTeamCell.teamId === team.id && editingTeamCell.fieldId === field.id" class="editing-cell relative min-w-[160px]">
                      <ConstrainedAutocomplete
                        v-if="field.type === 'constrained' && field.allowedValues"
                        :model-value="editTeamFieldValue"
                        :options="field.allowedValues"
                        :multi-value="!!field.multiValue"
                        @update:model-value="editTeamFieldValue = $event"
                        @save="saveTeamFieldCell(team.id, field.id)"
                        @cancel="cancelTeamFieldEdit"
                      />
                      <div v-else-if="field.type === 'person-reference-linked'" class="space-y-1">
                        <div class="flex flex-wrap gap-1">
                          <span
                            v-for="uid in editTeamFieldValue"
                            :key="uid"
                            class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                          >
                            {{ referencedPeople[uid] || uid }}
                            <button class="ml-1 text-primary-500 hover:text-primary-700" @click="editTeamFieldValue = editTeamFieldValue.filter(u => u !== uid)">&times;</button>
                          </span>
                        </div>
                        <PersonAutocomplete
                          :model-value="''"
                          :people="allPeopleForEditor.filter(p => !editTeamFieldValue.includes(p.uid))"
                          placeholder="Add person..."
                          @update:model-value="addToEditTeamFieldValue($event)"
                        />
                      </div>
                      <input
                        v-else
                        v-model="editTeamFieldValue"
                        class="w-full rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm"
                        @keyup.enter="saveTeamFieldCell(team.id, field.id)"
                        @keyup.escape="cancelTeamFieldEdit"
                      >
                      <div class="flex gap-1.5 mt-1">
                        <button class="px-2 py-0.5 text-xs font-medium text-white bg-primary-600 rounded hover:bg-primary-700 disabled:opacity-50" :disabled="saving" @click="saveTeamFieldCell(team.id, field.id)">Save</button>
                        <button class="px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600" @click="cancelTeamFieldEdit">Cancel</button>
                      </div>
                    </div>

                    <!-- DISPLAY MODE -->
                    <div
                      v-else
                      class="group cursor-pointer flex items-start gap-1"
                      :class="{ 'bg-red-100 dark:bg-red-700/50 rounded px-1': isFieldEmpty(team.metadata?.[field.id], field) }"
                      @click="startTeamFieldEdit(team, field)"
                    >
                      <!-- Person reference -->
                      <div v-if="field.type === 'person-reference-linked'" class="flex-1 text-left">
                        <template v-for="(uid, i) in normalizeArray(team.metadata[field.id])" :key="uid"><button
                            @click.stop="navigateToPersonDetail(uid)"
                            class="inline text-left text-primary-600 dark:text-primary-400 hover:underline"
                          >{{ referencedPeople[uid] || uid }}<template v-if="i < normalizeArray(team.metadata[field.id]).length - 1">,</template></button>{{ ' ' }}</template>
                        <span v-if="normalizeArray(team.metadata[field.id]).length === 0" class="text-gray-400 dark:text-gray-500">—</span>
                      </div>
                      <!-- Multi-value constrained pills -->
                      <div v-else-if="field.type === 'constrained' && field.multiValue" class="flex flex-wrap gap-1">
                        <span
                          v-for="v in normalizeArray(team.metadata[field.id])"
                          :key="v"
                          class="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        >{{ v }}</span>
                        <span v-if="normalizeArray(team.metadata[field.id]).length === 0" class="text-gray-400 dark:text-gray-500">—</span>
                      </div>
                      <!-- Plain text -->
                      <span v-else class="text-gray-900 dark:text-gray-100">{{ displayTeamFieldValue(team, field) }}</span>
                      <svg class="h-3 w-3 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </div>
                  </td>
                  <!-- Boards column -->
                  <td class="px-4 py-3 text-sm" :class="teamBulkEditing ? 'bg-blue-50 dark:bg-blue-900/20' : ''">
                    <div
                      class="group flex items-center gap-1.5 cursor-pointer"
                      :class="{ 'bg-red-100 dark:bg-red-700/50 rounded px-1': !team.boards || team.boards.length === 0 }"
                      @click="boardsDrawerTeam = team"
                    >
                      <div v-if="team.boards && team.boards.length > 0" class="flex flex-wrap gap-1.5">
                        <a
                          v-for="(board, idx) in team.boards"
                          :key="idx"
                          :href="board.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          @click.stop
                          class="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                        >
                          {{ board.name || 'Board' }}
                          <ExternalLink class="w-3 h-3" />
                        </a>
                      </div>
                      <span v-else class="text-gray-400 dark:text-gray-500">—</span>
                      <svg class="h-3 w-3 text-gray-400 dark:text-gray-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>

    <!-- Boards edit drawer -->
    <TeamBoardsDrawer
      :team="boardsDrawerTeam"
      :is-open="!!boardsDrawerTeam"
      @close="boardsDrawerTeam = null"
      @saved="refresh()"
    />

  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onBeforeUnmount, inject, watch } from 'vue'
import { ExternalLink, Pencil, Search, X, AlertTriangle, CircleQuestionMark } from 'lucide-vue-next'
import { useManagerDashboard } from '../composables/useManagerDashboard'
import { useFieldDefinitions } from '@shared/client/composables/useFieldDefinitions'
import { useTeams } from '@shared/client/composables/useTeams'
import { useRoster } from '@shared/client/composables/useRoster'
import { apiRequest } from '@shared/client/services/api'
import ConstrainedAutocomplete from '../components/ConstrainedAutocomplete.vue'
import PersonAutocomplete from '../components/PersonAutocomplete.vue'
import TeamBoardsDrawer from '../components/TeamBoardsDrawer.vue'
import { useManagerTutorial } from '../composables/useManagerTutorial'

const nav = inject('moduleNav', null)

const { directReports, indirectReports, teams, allOrgTeams, allPeople, referencedPeople, fieldDefinitions, loading, error, reason, includeIndirect, load, refresh } = useManagerDashboard()
const { updatePersonFields } = useFieldDefinitions()
const { updateTeamFields } = useTeams()
const { reloadRoster } = useRoster()
const { launchTutorial, destroyTour, checkFirstVisit } = useManagerTutorial()

const activeTab = ref('reports')
const searchQuery = ref('')
const teamSearchQuery = ref('')

// Field completeness filter & banner state
const showIncompleteOnly = ref(false)
const showIncompleteTeamsOnly = ref(false)
const bannerDismissed = ref(false)
const teamBannerDismissed = ref(false)

// Single-cell editing state
const editingCell = ref({ uid: null, fieldId: null })
const editValue = ref(null)
const editingTeamUid = ref(null)
const editTeamValue = ref([])
const saving = ref(false)

// Bulk editing state
const bulkEditing = ref(false)
// Stores pending changes: { "uid:fieldId": newValue }
const bulkChanges = reactive({})
// Stores pending team changes: { "uid": ["teamName1", "teamName2"] }
const bulkTeamChanges = reactive({})

// Team tab: single-cell editing state
const editingTeamCell = ref({ teamId: null, fieldId: null })
const editTeamFieldValue = ref(null)

// Team tab: boards drawer state
const boardsDrawerTeam = ref(null)

// Team tab: bulk editing state
const teamBulkEditing = ref(false)
const teamBulkChanges = reactive({})

const visibleReports = computed(() =>
  includeIndirect.value
    ? [...directReports.value, ...indirectReports.value]
    : directReports.value
)

// --- Field completeness ---

function isFieldEmpty(value, field) {
  if (value === null || value === undefined || value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  if (field.multiValue && Array.isArray(value) && value.every(v => !v)) return true
  return false
}

const incompleteReports = computed(() => {
  return visibleReports.value.filter(report => {
    return visiblePersonFields.value.some(field =>
      isFieldEmpty(report.customFields?.[field.id], field)
    )
  })
})

const incompleteReportUids = computed(() => new Set(incompleteReports.value.map(r => r.uid)))

const incompleteTeams = computed(() => {
  return teams.value.filter(team => {
    if (!team.boards || team.boards.length === 0) return true
    return visibleTeamFields.value.some(field =>
      isFieldEmpty(team.metadata?.[field.id], field)
    )
  })
})

const incompleteTeamIds = computed(() => new Set(incompleteTeams.value.map(t => t.id)))

const directReportUidSet = computed(() =>
  new Set(directReports.value.map(r => r.uid))
)

const filteredReports = computed(() => {
  let result = visibleReports.value
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    result = result.filter(r => {
      if (r.name?.toLowerCase().includes(q)) return true
      if (r.title?.toLowerCase().includes(q)) return true
      if (r.teamIds?.some(id => teamById.value[id]?.name?.toLowerCase().includes(q))) return true
      // Search custom field values
      for (const field of visiblePersonFields.value) {
        const val = r.customFields?.[field.id]
        if (!val) continue
        if (typeof val === 'string' && val.toLowerCase().includes(q)) return true
        if (Array.isArray(val) && val.some(v => {
          if (typeof v === 'string') {
            const resolved = referencedPeople.value[v]
            return (resolved || v).toLowerCase().includes(q)
          }
          return false
        })) return true
      }
      return false
    })
  }
  if (showIncompleteOnly.value) {
    result = result.filter(r => incompleteReportUids.value.has(r.uid))
  }
  return result
})

const filteredTeams = computed(() => {
  let result = teams.value
  const q = teamSearchQuery.value.trim().toLowerCase()
  if (q) {
    result = result.filter(t => {
      if (t.name?.toLowerCase().includes(q)) return true
      if (t.orgKey?.toLowerCase().includes(q)) return true
      // Search team metadata field values
      for (const field of visibleTeamFields.value) {
        const val = t.metadata?.[field.id]
        if (!val) continue
        if (typeof val === 'string' && val.toLowerCase().includes(q)) return true
        if (Array.isArray(val) && val.some(v => {
          if (typeof v === 'string') {
            const resolved = referencedPeople.value[v]
            return (resolved || v).toLowerCase().includes(q)
          }
          return false
        })) return true
      }
      return false
    })
  }
  if (showIncompleteTeamsOnly.value) {
    result = result.filter(t => incompleteTeamIds.value.has(t.id))
  }
  return result
})

const teamsHaveMultipleOrgs = computed(() => {
  const orgs = new Set(filteredTeams.value.map(t => t.orgKey))
  return orgs.size > 1
})

const tabs = computed(() => [
  { id: 'reports', label: 'My Reports', count: visibleReports.value.length },
  { id: 'teams', label: 'My Teams', count: teams.value.length }
])

const personFieldDefs = computed(() =>
  (fieldDefinitions.value.person || []).filter(f => !f.deleted)
)

const visiblePersonFields = computed(() =>
  personFieldDefs.value.filter(f => f.visible)
)

const teamFieldDefs = computed(() =>
  (fieldDefinitions.value.team || []).filter(f => !f.deleted)
)

const visibleTeamFields = computed(() =>
  teamFieldDefs.value.filter(f => f.visible)
)

const teamById = computed(() => {
  const map = {}
  for (const team of teams.value) {
    map[team.id] = team
  }
  return map
})

const allPeopleForEditor = computed(() => {
  const seen = new Set()
  const result = []
  // Use the full registry people list so person-reference fields (e.g. Product Manager) can find anyone
  for (const p of allPeople.value) {
    if (!seen.has(p.uid)) {
      seen.add(p.uid)
      result.push(p)
    }
  }
  // Include referenced people not already in registry (edge case: inactive person still referenced)
  for (const [uid, name] of Object.entries(referencedPeople.value)) {
    if (!seen.has(uid)) {
      seen.add(uid)
      result.push({ uid, name })
    }
  }
  return result
})

async function toggleIndirectReports() {
  includeIndirect.value = !includeIndirect.value
  if (bulkEditing.value) cancelBulkEdit()
  await load()
}

const allOrgTeamNames = computed(() =>
  allOrgTeams.value.map(t => t.name).sort()
)

const orgTeamNameToId = computed(() => {
  const map = {}
  for (const t of allOrgTeams.value) {
    map[t.name] = t.id
  }
  return map
})

const pendingChangeCount = computed(() => {
  const fieldChanges = Object.keys(bulkChanges).length
  const teamChanges = Object.keys(bulkTeamChanges).length
  return fieldChanges + teamChanges
})

// --- Bulk editing ---

function enterBulkEdit() {
  bulkEditing.value = true
  for (const key of Object.keys(bulkChanges)) delete bulkChanges[key]
  for (const key of Object.keys(bulkTeamChanges)) delete bulkTeamChanges[key]
}

function cancelBulkEdit() {
  bulkEditing.value = false
  for (const key of Object.keys(bulkChanges)) delete bulkChanges[key]
  for (const key of Object.keys(bulkTeamChanges)) delete bulkTeamChanges[key]
}

function bulkKey(uid, fieldId) {
  return `${uid}:${fieldId}`
}

function getBulkValue(uid, field) {
  const key = bulkKey(uid, field.id)
  if (key in bulkChanges) return bulkChanges[key]
  // Return current value from data
  const raw = visibleReports.value.find(r => r.uid === uid)?.customFields?.[field.id] ?? null
  if (field.type === 'constrained' && field.multiValue) {
    return Array.isArray(raw) ? raw : (raw ? [raw] : [])
  }
  if (field.type === 'person-reference-linked') {
    return (Array.isArray(raw) ? raw[0] : raw) || ''
  }
  return Array.isArray(raw) ? (raw[0] || '') : (raw || '')
}

function setBulkValue(uid, fieldId, value) {
  const key = bulkKey(uid, fieldId)
  // Check if value differs from original
  const report = visibleReports.value.find(r => r.uid === uid)
  const original = report?.customFields?.[fieldId] ?? null
  const field = visiblePersonFields.value.find(f => f.id === fieldId)

  let originalNormalized
  if (field?.type === 'constrained' && field?.multiValue) {
    originalNormalized = Array.isArray(original) ? original : (original ? [original] : [])
  } else if (field?.type === 'person-reference-linked') {
    originalNormalized = (Array.isArray(original) ? original[0] : original) || ''
  } else {
    originalNormalized = Array.isArray(original) ? (original[0] || '') : (original || '')
  }

  // If value matches original, remove from pending changes
  if (JSON.stringify(value) === JSON.stringify(originalNormalized)) {
    delete bulkChanges[key]
  } else {
    bulkChanges[key] = value
  }
}

function teamNamesForUid(uid) {
  const report = visibleReports.value.find(r => r.uid === uid)
  if (!report || !report.teamIds) return []
  return report.teamIds.map(id => teamById.value[id]?.name).filter(Boolean)
}

function getBulkTeamValue(uid) {
  if (uid in bulkTeamChanges) return bulkTeamChanges[uid]
  return teamNamesForUid(uid)
}

function setBulkTeamValue(uid, names) {
  const original = teamNamesForUid(uid)
  if (JSON.stringify([...names].sort()) === JSON.stringify([...original].sort())) {
    delete bulkTeamChanges[uid]
  } else {
    bulkTeamChanges[uid] = names
  }
}

async function saveTeamChanges(uid, newNames) {
  const report = directReports.value.find(r => r.uid === uid)
  const oldIds = report?.teamIds || []
  const newIds = newNames.map(n => orgTeamNameToId.value[n]).filter(Boolean)
  const toAdd = newIds.filter(id => !oldIds.includes(id))
  const toRemove = oldIds.filter(id => !newIds.includes(id))
  const ops = [
    ...toAdd.map(id =>
      apiRequest(`/modules/team-tracker/structure/teams/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid })
      })
    ),
    ...toRemove.map(id =>
      apiRequest(`/modules/team-tracker/structure/teams/${id}/members/${uid}`, { method: 'DELETE' })
    )
  ]
  await Promise.all(ops)
}

async function saveAllChanges() {
  saving.value = true
  try {
    // Group field changes by uid
    const changesByUid = {}
    for (const [key, value] of Object.entries(bulkChanges)) {
      const [uid, fieldId] = key.split(':')
      if (!changesByUid[uid]) changesByUid[uid] = {}
      const field = visiblePersonFields.value.find(f => f.id === fieldId)
      let valueToSave = value
      if (field?.type !== 'constrained' || !field?.multiValue) {
        valueToSave = valueToSave || null
      }
      changesByUid[uid][fieldId] = valueToSave
    }
    // Save field changes and team changes in parallel
    await Promise.all([
      ...Object.entries(changesByUid).map(([uid, fields]) =>
        updatePersonFields(uid, fields)
      ),
      ...Object.entries(bulkTeamChanges).map(([uid, names]) =>
        saveTeamChanges(uid, names)
      )
    ])
    bulkEditing.value = false
    for (const key of Object.keys(bulkChanges)) delete bulkChanges[key]
    if (Object.keys(bulkTeamChanges).length > 0) reloadRoster()
    for (const key of Object.keys(bulkTeamChanges)) delete bulkTeamChanges[key]
    refresh()
  } finally {
    saving.value = false
  }
}

// --- Single-cell editing ---

function startCellEdit(report, field) {
  const raw = report.customFields?.[field.id] ?? null
  if (field.type === 'constrained' && field.multiValue) {
    editValue.value = Array.isArray(raw) ? [...raw] : (raw ? [raw] : [])
  } else if (field.type === 'person-reference-linked') {
    editValue.value = (Array.isArray(raw) ? raw[0] : raw) || ''
  } else {
    editValue.value = Array.isArray(raw) ? (raw[0] || '') : (raw || '')
  }
  editingCell.value = { uid: report.uid, fieldId: field.id }
}

async function saveCell(uid, fieldId) {
  saving.value = true
  try {
    const field = visiblePersonFields.value.find(f => f.id === fieldId)
    let valueToSave = editValue.value
    if (field?.type !== 'constrained' || !field?.multiValue) {
      valueToSave = valueToSave || null
    }
    await updatePersonFields(uid, { [fieldId]: valueToSave })
    editingCell.value = { uid: null, fieldId: null }
    refresh()
  } finally {
    saving.value = false
  }
}

function cancelEdit() {
  editingCell.value = { uid: null, fieldId: null }
}

function startTeamEdit(report) {
  editingTeamUid.value = report.uid
  editTeamValue.value = [...teamNamesForUid(report.uid)]
}

async function saveTeamEdit(uid) {
  saving.value = true
  try {
    await saveTeamChanges(uid, editTeamValue.value)
    editingTeamUid.value = null
    reloadRoster()
    refresh()
  } finally {
    saving.value = false
  }
}

function cancelTeamEdit() {
  editingTeamUid.value = null
}

// --- Display helpers ---

function displaySingleValue(report, field) {
  const raw = report.customFields?.[field.id]
  const val = Array.isArray(raw) ? raw[0] : raw
  return val || '—'
}

function displayMultiValues(report, field) {
  const raw = report.customFields?.[field.id]
  return Array.isArray(raw) ? raw : (raw ? [raw] : [])
}

function resolvePersonName(rawUid) {
  const uid = Array.isArray(rawUid) ? rawUid[0] : rawUid
  if (!uid) return null
  const person = allPeopleForEditor.value.find(p => p.uid === uid)
  return person ? person.name : null
}

// --- Shared helpers ---

function normalizeArray(val) {
  return Array.isArray(val) ? val : (val ? [val] : [])
}

function navigateToPersonDetail(uid) {
  if (nav) nav.navigateTo('person-detail', { uid })
}

function navigateToTeamDetail(team) {
  if (nav) nav.navigateTo('team-detail', { teamKey: `${team.orgKey}::${team.name}` })
}

// --- Team tab: display helpers ---

function displayTeamFieldValue(team, field) {
  const raw = team.metadata[field.id]
  if (raw == null) return '—'
  const val = Array.isArray(raw) ? raw[0] : raw
  return val || '—'
}

// --- Team tab: single-cell editing ---

function isMultiValueField(field) {
  return (field.type === 'constrained' && field.multiValue) || field.type === 'person-reference-linked'
}

function startTeamFieldEdit(team, field) {
  const raw = team.metadata[field.id] ?? null
  if (isMultiValueField(field)) {
    editTeamFieldValue.value = Array.isArray(raw) ? [...raw] : (raw ? [raw] : [])
  } else {
    editTeamFieldValue.value = Array.isArray(raw) ? (raw[0] || '') : (raw || '')
  }
  editingTeamCell.value = { teamId: team.id, fieldId: field.id }
}

async function saveTeamFieldCell(teamId, fieldId) {
  saving.value = true
  try {
    const field = visibleTeamFields.value.find(f => f.id === fieldId)
    let valueToSave = editTeamFieldValue.value
    if (!field || !isMultiValueField(field)) {
      valueToSave = valueToSave || null
    }
    await updateTeamFields(teamId, { [fieldId]: valueToSave })
    editingTeamCell.value = { teamId: null, fieldId: null }
    refresh()
  } finally {
    saving.value = false
  }
}

function cancelTeamFieldEdit() {
  editingTeamCell.value = { teamId: null, fieldId: null }
}

function addToEditTeamFieldValue(uid) {
  if (uid && Array.isArray(editTeamFieldValue.value) && !editTeamFieldValue.value.includes(uid)) {
    editTeamFieldValue.value = [...editTeamFieldValue.value, uid]
  }
}

function addToTeamBulkPersonValue(teamId, fieldId, uid) {
  if (!uid) return
  const current = [...getTeamBulkValue(teamId, { id: fieldId, type: 'person-reference-linked' })]
  if (!current.includes(uid)) {
    current.push(uid)
    setTeamBulkValue(teamId, fieldId, current)
  }
}

function removeFromTeamBulkPersonValue(teamId, fieldId, uid) {
  const current = [...getTeamBulkValue(teamId, { id: fieldId, type: 'person-reference-linked' })]
  setTeamBulkValue(teamId, fieldId, current.filter(u => u !== uid))
}

// --- Team tab: bulk editing ---

const teamPendingChangeCount = computed(() => {
  return Object.keys(teamBulkChanges).length
})

function enterTeamBulkEdit() {
  teamBulkEditing.value = true
  for (const key of Object.keys(teamBulkChanges)) delete teamBulkChanges[key]
}

function cancelTeamBulkEdit() {
  teamBulkEditing.value = false
  for (const key of Object.keys(teamBulkChanges)) delete teamBulkChanges[key]
}

function teamBulkKey(teamId, fieldId) {
  return `${teamId}:${fieldId}`
}

function getTeamBulkValue(teamId, field) {
  const key = teamBulkKey(teamId, field.id)
  if (key in teamBulkChanges) return teamBulkChanges[key]
  const raw = teams.value.find(t => t.id === teamId)?.metadata[field.id] ?? null
  if (isMultiValueField(field)) {
    return Array.isArray(raw) ? raw : (raw ? [raw] : [])
  }
  return Array.isArray(raw) ? (raw[0] || '') : (raw || '')
}

function setTeamBulkValue(teamId, fieldId, value) {
  const key = teamBulkKey(teamId, fieldId)
  const team = teams.value.find(t => t.id === teamId)
  const original = team?.metadata[fieldId] ?? null
  const field = visibleTeamFields.value.find(f => f.id === fieldId)

  let originalNormalized
  if (field && isMultiValueField(field)) {
    originalNormalized = Array.isArray(original) ? original : (original ? [original] : [])
  } else {
    originalNormalized = Array.isArray(original) ? (original[0] || '') : (original || '')
  }

  if (JSON.stringify(value) === JSON.stringify(originalNormalized)) {
    delete teamBulkChanges[key]
  } else {
    teamBulkChanges[key] = value
  }
}


async function saveAllTeamChanges() {
  saving.value = true
  try {
    // Group field changes by teamId
    const changesByTeam = {}
    for (const [key, value] of Object.entries(teamBulkChanges)) {
      const [teamId, fieldId] = key.split(':')
      if (!changesByTeam[teamId]) changesByTeam[teamId] = {}
      const field = visibleTeamFields.value.find(f => f.id === fieldId)
      let valueToSave = value
      if (!field || !isMultiValueField(field)) {
        valueToSave = valueToSave || null
      }
      changesByTeam[teamId][fieldId] = valueToSave
    }

    await Promise.all(
      Object.entries(changesByTeam).map(([teamId, fields]) =>
        updateTeamFields(teamId, fields)
      )
    )

    teamBulkEditing.value = false
    for (const key of Object.keys(teamBulkChanges)) delete teamBulkChanges[key]
    refresh()
  } finally {
    saving.value = false
  }
}

watch(activeTab, () => {
  showIncompleteOnly.value = false
  showIncompleteTeamsOnly.value = false
  bannerDismissed.value = false
  teamBannerDismissed.value = false
})

watch(bulkEditing, () => {
  // Cross-tab filter is irrelevant, clear it; same-tab filter is preserved
  showIncompleteTeamsOnly.value = false
})

watch(teamBulkEditing, () => {
  showIncompleteOnly.value = false
})

function handleLaunchTutorial() {
  launchTutorial({ onTabClick: (tabId) => { activeTab.value = tabId }, nav })
}

let initialLoadHandled = false
watch(loading, (isLoading, wasLoading) => {
  if (!initialLoadHandled && wasLoading && !isLoading && !error.value && !reason.value) {
    initialLoadHandled = true
    const opts = { onTabClick: (tabId) => { activeTab.value = tabId }, nav }
    if (nav?.params.value?.tutorial === '1') {
      launchTutorial(opts)
    } else {
      checkFirstVisit(opts)
    }
  }
})

onMounted(() => {
  load()
})

onBeforeUnmount(() => {
  destroyTour()
})
</script>
